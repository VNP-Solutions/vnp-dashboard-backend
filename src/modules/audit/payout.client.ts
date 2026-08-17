import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '../../config/config.service'

/**
 * Service-to-service client for the payout backend (vnps-stripe-backend-new).
 *
 * The operator clicks "Pay out" on an audit row; this forwards the audit id to the payout backend's
 * id-only route, authenticated with the shared service key (x-api-key) and carrying the operator's id
 * (x-actor-user-id) for that side's audit log. The payout backend derives amount/rail/destination and
 * runs the dispatch. A STABLE idempotency key (audit:<id>) makes a re-click safe: already-sent groups
 * replay without a second send, and any group parked awaiting_funding is retried once funded.
 *
 * Three calls, all over the same seam:
 *   previewFromAudit  — dry run, writes nothing, feeds the confirmation modal
 *   dispatchFromAudit — the real send
 *   payoutStatusByAudits — "which of these audits already have a payout?" for the table
 */
/**
 * Paging block in THIS API's shape, not the payout service's. See listPayouts for why they differ.
 *
 * Field names match what every other paginated endpoint here already emits (verified against
 * /audit and /property), so the dashboard's existing IMetadata type and pagination controls work
 * unchanged. Note this is NOT the shape written in the repo's CLAUDE.md, which is out of date.
 */
export interface PayoutHistoryMetadata {
  totalDocuments: number
  currentPage: number
  totalPages: number
}

/** Filters the payout history page may pass through. Mirrors the payout service's own query params. */
export interface PayoutHistoryQuery {
  page?: number
  page_size?: number
  status?: string
  hotel_id?: string
  currency?: string
  date_from?: string
  date_to?: string
  /**
   * Comma-separated dashboard property ids this user may see. Set by the controller for users with
   * PARTIAL access, never by the browser: it is an authorization decision, not a filter.
   */
  dashboard_property_ids?: string
}

@Injectable()
export class PayoutClient {
  constructor(private readonly config: ConfigService) {}

  /** Cached communication token for the payout service, with the epoch ms we stop reusing it. */
  private cachedToken: { token: string; expiresAtMs: number } | null = null

  /** Re-mint this far before real expiry so a token cannot lapse mid-flight. */
  private static readonly EXPIRY_SKEW_MS = 60_000

  /** Resolve base URL + key together so every call fails the same, obvious way when unconfigured. */
  private credentials(): { base: string; key?: string } {
    const base = this.config.payoutBaseUrl
    if (!base) {
      throw new InternalServerErrorException('Payout service is not configured (PAYOUT_BASE_URL)')
    }
    return { base: base.replace(/\/$/, ''), key: this.config.payoutServiceApiKey }
  }

  /**
   * Swap the shared secret for a short-lived JWT at the payout service, the same exchange this
   * backend already exposes at /external/generate-token and that dbms and scraper both use.
   *
   * Cached until shortly before expiry so a burst of calls costs one mint.
   */
  private async communicationToken(base: string): Promise<string | null> {
    const secret = this.config.jwt.communicationSecret
    if (!secret) return null

    if (this.cachedToken && this.cachedToken.expiresAtMs - PayoutClient.EXPIRY_SKEW_MS > Date.now()) {
      return this.cachedToken.token
    }

    let res: Response
    try {
      res = await fetch(`${base}/external-auth/generate-token`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json'
        },
        body: '{}'
      })
    } catch {
      throw new HttpException('Payout service is unreachable', 502)
    }
    if (!res.ok) {
      throw new HttpException(
        `Token exchange with the payout service failed (${res.status}); check JWT_COMMUNICATION_SECRET matches`,
        502
      )
    }

    const body = (await res.json()) as { data?: { token?: string }; token?: string }
    const token = body?.data?.token ?? body?.token
    if (!token) throw new HttpException('Payout service returned no communication token', 502)

    this.cachedToken = { token, expiresAtMs: this.decodeExpiry(token) }
    return token
  }

  /** Read `exp` without verifying: the token is the peer's to validate, we only schedule re-mints. */
  private decodeExpiry(token: string): number {
    const parts = token.split('.')
    if (parts.length !== 3) return Date.now() + PayoutClient.EXPIRY_SKEW_MS
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: number }
      if (typeof payload.exp === 'number') return payload.exp * 1000
    } catch {
      // fall through
    }
    return Date.now() + PayoutClient.EXPIRY_SKEW_MS
  }

  /**
   * One POST to the payout backend. Unwraps its { success, data } envelope and translates a failure
   * into an HttpException carrying the upstream status, so the dashboard never reports a payout
   * problem as a generic 500.
   */
  private async post(path: string, actorUserId: string, payload: unknown): Promise<unknown> {
    const body = await this.call('POST', path, actorUserId, payload)
    return body?.data ?? body
  }

  /**
   * Read side of the same seam, for the payout history page.
   *
   * GET carries no body; everything is in the query string, which the caller builds. Reads are
   * otherwise identical to writes here: same token exchange, same one-shot re-mint on 401, same
   * upstream-status translation.
   *
   * Returns the WHOLE envelope, not just `data`. The payout service reports paging in a sibling
   * `metadata` block, and unwrapping to `data` here would silently drop the total and page count, so
   * the table would render rows it could not page through.
   */
  private async get(path: string, actorUserId: string): Promise<Record<string, any> | null> {
    return this.call('GET', path, actorUserId)
  }

  private async call(
    method: 'GET' | 'POST',
    path: string,
    actorUserId: string,
    payload?: unknown
  ): Promise<Record<string, any> | null> {
    const { base, key } = this.credentials()

    const send = async (bearer: string | null): Promise<Response> => {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-actor-user-id': actorUserId
      }
      if (bearer) headers.authorization = `Bearer ${bearer}`
      // Legacy static key still sent alongside while the estate migrates; harmless once the peer
      // accepts Bearer tokens, and it keeps an un-migrated deployment working.
      if (key) headers['x-api-key'] = key
      return fetch(`${base}${path}`, {
        method,
        headers,
        ...(method === 'POST' ? { body: JSON.stringify(payload) } : {})
      })
    }

    let bearer = await this.communicationToken(base)
    let res: Response
    try {
      res = await send(bearer)
      // One retry with a fresh token: a cached one can be rejected if the peer restarted.
      if (bearer && (res.status === 401 || res.status === 403)) {
        this.cachedToken = null
        bearer = await this.communicationToken(base)
        res = await send(bearer)
      }
    } catch (err) {
      if (err instanceof HttpException) throw err
      throw new HttpException('Payout service is unreachable', 502)
    }

    const text = await res.text()
    const body = text ? (JSON.parse(text) as Record<string, any>) : null

    if (!res.ok) {
      const message = body?.error?.message ?? 'Payout request failed'
      throw new HttpException(message, res.status)
    }
    return body
  }

  /** Dry run: same resolve/gate logic as a real dispatch, but nothing is sent and nothing is written. */
  async previewFromAudit(auditId: string, actorUserId: string): Promise<unknown> {
    return this.post('/payout-requests/from-audit/preview', actorUserId, {
      audit_id: auditId,
      idempotency_key: `audit:${auditId}`
    })
  }

  async dispatchFromAudit(auditId: string, actorUserId: string): Promise<unknown> {
    return this.post('/payout-requests/from-audit', actorUserId, {
      audit_id: auditId,
      idempotency_key: `audit:${auditId}`
    })
  }

  /**
   * Bulk payout: many audits, each dispatched INDIVIDUALLY, and they may span properties.
   *
   * Preview returns a plan (what will be paid, what is excluded and why, and the payment count).
   * Dispatch STARTS A RUN and returns a run id immediately without paying anything: fifty audits is
   * minutes of work, so the payout service does it in the background and we poll.
   *
   * No idempotency key is passed, and none would be honoured: the payout service derives one per
   * audit, so a caller cannot vary it and a repeat of the same audit collides with itself.
   */
  async previewBulkPayout(auditIds: string[], actorUserId: string): Promise<unknown> {
    return this.post('/payout-requests/bulk/preview', actorUserId, { audit_ids: auditIds })
  }

  /** Starts the run. Returns { run_id, total_items, plan }; nothing has been paid yet. */
  async startBulkPayout(auditIds: string[], actorUserId: string): Promise<unknown> {
    return this.post('/payout-requests/bulk', actorUserId, { audit_ids: auditIds })
  }

  /** The poll: run counters plus every audit's current state. */
  async getBulkPayoutRun(runId: string, actorUserId: string): Promise<unknown> {
    return this.get(`/payout-requests/bulk/${encodeURIComponent(runId)}`, actorUserId)
  }

  /** Bulk lookup for a table page: audit ids that already have a payout, with a per-audit summary. */
  async payoutStatusByAudits(auditIds: string[], actorUserId: string): Promise<unknown> {
    if (auditIds.length === 0) return {}
    return this.post('/payout-requests/by-audits', actorUserId, { audit_ids: auditIds })
  }

  /**
   * Build the upstream query string.
   *
   * Only forwards keys the payout service actually understands, so a stray dashboard-side filter
   * cannot silently widen the result set by being ignored upstream. Empty values are dropped rather
   * than sent as blanks, which the service would treat as a real filter value.
   */
  private static query(params: PayoutHistoryQuery): string {
    const allowed: (keyof PayoutHistoryQuery)[] = [
      'page',
      'page_size',
      'status',
      'hotel_id',
      'currency',
      'date_from',
      'date_to',
      'dashboard_property_ids'
    ]
    const qs = new URLSearchParams()
    for (const key of allowed) {
      const value = params[key]
      if (value === undefined || value === null || `${value}`.trim() === '') continue
      qs.set(key, `${value}`)
    }
    const s = qs.toString()
    return s ? `?${s}` : ''
  }

  /**
   * Paged payout history, translated into this API's envelope.
   *
   * The two services do NOT agree on the shape. The payout service returns paging under `meta`
   * ({page, page_size, total, total_pages}); this API returns it under `metadata`
   * ({page, limit, total, totalPages}). Returning the upstream body verbatim looks like it works,
   * because the rows are right there, but the interceptor passes any object carrying `success`
   * straight through, so paging silently arrives as null and the table can render only page one.
   * It also leaks the upstream request_id to the browser. Hence an explicit translation.
   */
  async listPayouts(
    params: PayoutHistoryQuery,
    actorUserId: string
  ): Promise<{ data: unknown; metadata: PayoutHistoryMetadata }> {
    const body = await this.get(`/payouts${PayoutClient.query(params)}`, actorUserId)
    const meta = (body?.meta ?? {}) as Record<string, any>
    const rows = body?.data ?? []
    const limit = Number(meta.page_size) || params.page_size || (Array.isArray(rows) ? rows.length : 0)
    const total = Number(meta.total) || 0
    return {
      data: rows,
      metadata: {
        totalDocuments: total,
        currentPage: Number(meta.page) || params.page || 1,
        // Recompute rather than trusting the upstream field: if it is ever absent we must not report
        // 0 pages while returning rows, which would make the pager disappear on a non-empty table.
        totalPages: Number(meta.total_pages) || (limit > 0 ? Math.ceil(total / limit) : 1) || 1
      }
    }
  }

  /** Settlement totals for the whole filtered set, not just the current page. */
  async payoutSummary(params: PayoutHistoryQuery, actorUserId: string): Promise<unknown> {
    const body = await this.get(`/payouts/summary${PayoutClient.query(params)}`, actorUserId)
    return body?.data ?? body
  }

  /**
   * One payout request with its legs and status history.
   *
   * Takes the same property scope as the list. Scoping the list while leaving lookup-by-id open
   * would not be a partial fix: the ids appear in list responses, so an unscoped detail route hands
   * back any payout to anyone who has ever seen its id.
   */
  async getPayout(
    id: string,
    actorUserId: string,
    scope?: Pick<PayoutHistoryQuery, 'dashboard_property_ids'>
  ): Promise<unknown> {
    const body = await this.get(
      `/payouts/${encodeURIComponent(id)}${PayoutClient.query(scope ?? {})}`,
      actorUserId
    )
    return body?.data ?? body
  }
}
