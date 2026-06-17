# Bulk Archive Update — SQS Async Pipeline

## Summary

**Yes — SQS is implemented** for `POST /jobs/bulk_archive_update`, but only for large requests.

| Condition                                                       | Behavior                                                  | HTTP status |
| --------------------------------------------------------------- | --------------------------------------------------------- | ----------- |
| `job_ids.length ≤ 20`                                           | Synchronous DB update in the request                      | **200**     |
| `job_ids.length > 20` **and** `REPORTS_EXPORT_QUEUE_URL` is set | Message enqueued to SQS; work runs in background          | **202**     |
| `job_ids.length > 20` **and** queue URL is **not** set          | Falls back to synchronous update (same as small requests) | **200**     |

The async path reuses the **reports-export** SQS queue (`REPORTS_EXPORT_QUEUE_URL`). It is **not** the scraper FIFO queue (`QUEUE_URL` used by Expedia job scraping).

---

## API Contract

**Endpoint:** `POST /jobs/bulk_archive_update`  
**Auth:** JWT (`JwtAuthGuard`)

**Request body:**

```json
{
  "job_ids": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "status": true
}
```

- `job_ids` — array of MongoDB ObjectIds (min 1). Duplicates are deduped server-side.
- `status` — `true` to archive, `false` to unarchive.

**Sync response (200):**

```json
{
  "statusCode": 200,
  "message": "Jobs archived successfully",
  "data": {
    "updatedCount": 2,
    "status": true
  }
}
```

**Async response (202):**

```json
{
  "statusCode": 202,
  "message": "150 jobs are being archived in the background. A confirmation email will be sent to you once the process is complete.",
  "data": {
    "async": true,
    "jobCount": 150,
    "status": true
  }
}
```

The async threshold is defined by `BULK_ARCHIVE_ASYNC_THRESHOLD = 20` in `job.controller.ts`.

---

## Architecture Overview

```
Client
  │
  ▼
POST /jobs/bulk_archive_update  (JobController)
  │
  ├─ ≤ 20 IDs ──────────────────► JobService.bulkArchiveUpdate() ──► MongoDB
  │
  └─ > 20 IDs + queue configured
        │
        ▼
     enqueueReportExport()  (reports-sqs.util.ts)
        │
        ▼
     AWS SQS Standard Queue  (REPORTS_EXPORT_QUEUE_URL)
        │
        ▼
     ReportsExportConsumer  (long-poll, in-process)
        │
        ▼
     handleBulkArchive()
        │
        ├─► JobService.bulkArchiveUpdate() ──► MongoDB (batched updateMany)
        ├─► MailService.sendBulkArchiveDoneEmail()  (best-effort)
        └─► deleteReportExportMessage()  (ack on success)
```

The consumer (`ReportsExportConsumer`) starts automatically when the NestJS app boots, as long as `REPORTS_EXPORT_QUEUE_URL` is configured. It is registered in `ReportsModule` and shares the same queue used by async report exports (`/reports/export-*`).

---

## Key Source Files

| File                                            | Role                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `src/module/job/job.controller.ts`              | Route handler; sync vs async branching                                 |
| `src/module/reports/reports-sqs.util.ts`        | SQS client, `enqueueReportExport`, receive/delete helpers              |
| `src/module/reports/reports-export.consumer.ts` | Long-poll worker; `handleBulkArchive` for `exportType: 'bulk_archive'` |
| `src/module/job/job.service.ts`                 | Business logic wrapper around repository                               |
| `src/module/job/job.repository.ts`              | Prisma `updateMany` in batches of 500                                  |
| `src/common/utils/mail.service.ts`              | `sendBulkArchiveDoneEmail` confirmation                                |

---

## SQS Message Payload

When the async path is taken, the controller sends a single SQS message with this shape (`ReportExportMessage`):

```json
{
  "exportType": "bulk_archive",
  "jobIds": ["...", "..."],
  "archiveStatus": true,
  "user": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "Jane Doe"
  },
  "requestedAt": "2026-06-15T12:00:00.000Z"
}
```

| Field           | Purpose                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| `exportType`    | Discriminator. Must be `"bulk_archive"` for this flow.                             |
| `jobIds`        | Deduped list of job IDs to update.                                                 |
| `archiveStatus` | `true` = archive, `false` = unarchive. Required for this type.                     |
| `user`          | Taken from the JWT-authenticated request. Used for logging and confirmation email. |
| `requestedAt`   | ISO timestamp when the message was enqueued.                                       |

Messages are sent via `SendMessageCommand` (standard queue — no FIFO group/dedup IDs). SQS enforces a 256 KB body limit; very large `job_ids` arrays could approach this cap (same constraint as report exports).

---

## Producer: Enqueueing

In `JobController.bulkArchiveUpdate`:

1. Job IDs are deduped: `Array.from(new Set(...)).filter(Boolean)`.
2. If count exceeds 20 **and** `getReportsExportQueueUrl()` returns a URL, `enqueueReportExport()` is called.
3. The API returns **202** immediately — the DB update has **not** happened yet.

`enqueueReportExport()` (`reports-sqs.util.ts`):

- Uses `@aws-sdk/client-sqs` `SendMessageCommand`.
- AWS credentials come from `S3_REGION`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` (same as S3 and the scraper queue).
- Logs the SQS `MessageId` on success.

If `REPORTS_EXPORT_QUEUE_URL` is missing, the controller skips SQS entirely and runs the sync path even for large payloads.

---

## Consumer: Processing

`ReportsExportConsumer` runs a continuous long-poll loop:

- **Poll:** `ReceiveMessageCommand` with `MaxNumberOfMessages: 1`, `WaitTimeSeconds: 20`.
- **Concurrency:** One in-flight message per Node process.
- **Shutdown:** `@OnApplicationShutdown` waits for the current message to finish; if the process is killed mid-job, SQS redelivers after the visibility timeout.

For messages where `exportType === 'bulk_archive'`, the consumer takes a lightweight path (`handleBulkArchive`) — **no S3 upload**, unlike report export types.

### Processing steps

1. **Validate** — `archiveStatus` must be a boolean. Invalid payloads are deleted from the queue (non-retryable).
2. **DB update** — `jobService.bulkArchiveUpdate(jobIds, archiveStatus)`.
   - Repository runs Prisma `updateMany` in chunks of **500** IDs per batch.
   - Sets `is_archived` on matching jobs.
3. **Confirmation email** (best-effort) — If `user.email` is present, sends `sendBulkArchiveDoneEmail`. Email failure does **not** fail the job or block ack.
4. **Ack** — `deleteReportExportMessage(receiptHandle)` on success.

### Failure and retries

| Failure                 | Message deleted? | Behavior                                          |
| ----------------------- | ---------------- | ------------------------------------------------- |
| Invalid JSON body       | Yes              | Dropped — would fail every retry                  |
| Missing required fields | Yes              | Dropped                                           |
| Missing `archiveStatus` | Yes              | Dropped                                           |
| DB update throws        | **No**           | SQS redelivers after visibility timeout           |
| Email send throws       | N/A              | Archive already succeeded; message is still acked |

After the queue's configured `maxReceiveCount` (typically 3), failed messages move to the **DLQ** (`vnp-reports-export-dlq` in production — same DLQ as report exports). There is no dedicated failure email for bulk archive (unlike report exports, which call `sendReportFailedEmail`).

---

## Environment Variables

| Variable                       | Required for async     | Description                                             |
| ------------------------------ | ---------------------- | ------------------------------------------------------- |
| `REPORTS_EXPORT_QUEUE_URL`     | Yes                    | Full URL of the standard reports-export SQS queue       |
| `S3_REGION`                    | Yes                    | AWS region (defaults to `us-east-1`)                    |
| `S3_ACCESS_KEY`                | Yes                    | IAM access key with SQS send/receive/delete permissions |
| `S3_SECRET_KEY`                | Yes                    | IAM secret key                                          |
| `SMTP_EMAIL` / `SMTP_PASSWORD` | For confirmation email | Used by `MailService`                                   |

**Not used by this endpoint:** `QUEUE_URL` (scraper FIFO queue for Expedia jobs).

> **Note:** `REPORTS_EXPORT_QUEUE_URL` is not yet listed in `.env.example` but is documented in `reports-sqs.util.ts`. Without it, all bulk archive requests run synchronously regardless of size.

---

## Sync Path (No SQS)

When any of these is true, the controller calls `jobService.bulkArchiveUpdate()` directly in the HTTP handler:

- `job_ids.length ≤ 20`
- `REPORTS_EXPORT_QUEUE_URL` is unset or empty

The response is **200** with `{ updatedCount, status }` after the DB update completes.

---

## Relationship to Report Exports

Both features share:

- The same SQS queue (`REPORTS_EXPORT_QUEUE_URL`)
- The same consumer (`ReportsExportConsumer`)
- The same `ReportExportMessage` envelope (discriminated by `exportType`)

| `exportType`                            | Work performed                                     |
| --------------------------------------- | -------------------------------------------------- |
| `master` / `consolidated` / `dashboard` | Stream XLSX/ZIP → S3 → presigned URL → email link  |
| `bulk_archive`                          | DB `updateMany` only → optional confirmation email |

Because the consumer processes **one message at a time**, a large bulk archive job and a large report export queued at the same time will be handled sequentially within a single Node process. Multiple app replicas each run their own poll loop for natural fan-out.

---

## Operational Notes

- **Idempotency:** Re-processing the same archive message is safe — `updateMany` with the same `is_archived` value is a no-op for already-updated rows, though `updatedCount` may reflect rows that were already in the target state depending on Prisma behavior.
- **Observability:** Search logs for `[BulkArchive]`, `ReportsExportConsumer`, or the SQS `MessageId` logged at enqueue time.
- **Local dev:** Leave `REPORTS_EXPORT_QUEUE_URL` empty to avoid needing AWS SQS; large requests will run synchronously in the HTTP request (may timeout for very large lists).
