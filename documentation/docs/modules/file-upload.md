---
sidebar_position: 11
title: File Upload Module
---

# File Upload Module

**Path:** `src/modules/file-upload/`

## Purpose

Upload files to AWS S3 (audit reports, documents, exports, etc.).

## Pattern

```typescript
@UseInterceptors(FileInterceptor('file'))
uploadFile(@UploadedFile() file: Express.Multer.File) {
  return this.fileUploadService.uploadFile(file, 'folder-name')
}
```

Some upload endpoints are `@Public()` for unauthenticated flows (e.g. help forms) — check controller decorators before relying on that.

## Config

Requires `S3_*` environment variables. See [Environment](../getting-started/environment).

## Live API

Swagger tag **File Upload** — [`/api/docs`](pathname:///api/docs).

## Related

- [Audit](./audit) (report uploads)
- [Email module](../getting-started/commands) (attachments often via S3 URL)
