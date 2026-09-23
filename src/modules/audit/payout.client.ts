import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException
} from '@nestjs/common'
import { ConfigService } from '../../config/config.service'

/**
 * The only way this backend talks to the payout service.
 *
 * We send an audit id and nothing else. The payout service derives the amount, the rail and the
 * destination itself, so a tampered browser number can never be paid. `x-actor-user-id` carries the
 * operator for its audit log, and the idempotency key is `audit:<id>`, so a second click replays
 * instead of paying twice.
 */

/**
 * Paging in THIS API's shape, not the payout service's. Matches what /audit and /property already
 * emit, so the dashboard's existing pagination works unchanged. See listPayouts for the translation.
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

interface CachedCommunicationToken {
  token: string
  expiresAtMs: number
}

const COMMUNICATION_TOKEN_PATH = 'external-auth/generate-token'
const COMMUNICATION_TOKEN_EXPIRY_SKEW_MS = 60_000

@Injectable()
export class PayoutClient {
  private communicationTokenCache: CachedCommunicationToken | null = null

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    const base = this.config.payoutBaseUrl
    if (!base) {
      throw new InternalServerErrorException('Payout service is not configured (PAYOUT_BASE_URL)')
    }
    return base.replace(/\/$/, '')
  }

  private communicationTokenExpiry(token: string): number {
    const parts = token.split('.')
    if (parts.length !== 3) return Date.now() + COMMUNICATION_TOKEN_EXPIRY_SKEW_MS

    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8')
      ) as { exp?: number }
      if (typeof payload.exp === 'number') return payload.exp * 1000
    } catch {
      // A token that cannot be decoded is cached only briefly. The payout service still verifies it.
    }
    return Date.now() + COMMUNICATION_TOKEN_EXPIRY_SKEW_MS
  }

  /** Exchange the shared secret once for a short-lived token minted by the payout service. */
  private async communicationToken(baseUrl: string): Promise<string> {
    if (
      this.communicationTokenCache &&
      this.communicationTokenCache.expiresAtMs - COMMUNICATION_TOKEN_EXPIRY_SKEW_MS > Date.now()
    ) {
      return this.communicationTokenCache.token
    }

    const secret = this.config.jwt.communicationSecret
    if (!secret) {
      throw new HttpException(
        'Payout service authentication is not configured',
        HttpStatus.SERVICE_UNAVAILABLE
      )
    }

    const url = new URL(COMMUNICATION_TOKEN_PATH, `${baseUrl.replace(/\/+$/, '')}/`).toString()
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: '{}'
      })
    } catch {
      throw new HttpException(
        'Payout service is unreachable while authenticating',
        HttpStatus.BAD_GATEWAY
      )
    }

    if (!response.ok) {
      throw new HttpException(
        {
          code: 'PAYOUT_SERVICE_AUTH_FAILED',
          message: 'Payout service authentication failed'
        },
        HttpStatus.BAD_GATEWAY
      )
    }

    const body = (await response.json()) as {
      token?: string
      data?: { token?: string }
    }
    const token = body?.data?.token ?? body?.token
    if (!token) {
      throw new HttpException(
        'Payout service token exchange returned no token',
        HttpStatus.BAD_GATEWAY
      )
    }

    this.communicationTokenCache = {
      token,
      expiresAtMs: this.communicationTokenExpiry(token)
    }
    return token
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
   * Returns the WHOLE envelope, not just `data`. Paging sits in a sibling block, so unwrapping to
   * `data` here would drop the total and page count and the table could not be paged.
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
    const base = this.baseUrl()

    let bearer = await this.communicationToken(base)
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-actor-user-id': actorUserId,
      authorization: `Bearer ${bearer}`
    }

    let res: Response
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        ...(method === 'POST' ? { body: JSON.stringify(payload) } : {})
      })
    } catch (err) {
      if (err instanceof HttpException) throw err
      throw new HttpException('Payout service is unreachable', 502)
    }

    // The peer may have restarted with a rotated secret while our cached token is still alive.
    // Exchange once more and retry the business request; never retry a second rejection.
    if (res.status === 401) {
      this.communicationTokenCache = null
      bearer = await this.communicationToken(base)
      headers.authorization = `Bearer ${bearer}`
      try {
        res = await fetch(`${base}${path}`, {
          method,
          headers,
          ...(method === 'POST' ? { body: JSON.stringify(payload) } : {})
        })
      } catch {
        throw new HttpException('Payout service is unreachable', HttpStatus.BAD_GATEWAY)
      }
    }

    const text = await res.text()
    const body = text ? (JSON.parse(text) as Record<string, any>) : null

    if (!res.ok) {
      // This credential belongs to the dashboard service, not the browser session. Forwarding an
      // upstream 401 makes the frontend refresh a valid user token and eventually log the operator
      // out. Keep that failure on the service boundary instead.
      if (res.status === 401) {
        throw new HttpException(
          {
            code: 'PAYOUT_SERVICE_AUTH_FAILED',
            message: 'Payout service authentication failed'
          },
          HttpStatus.BAD_GATEWAY
        )
      }

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

  /**
   * The real send. `retry` re-drives groups whose previous attempt moved no money.
   *
   * Default off: an existing key always replays, so a double-click cannot become a second payment.
   * The payout service refuses a retry for `returned` and `reconciliation_required`, the two states
   * where money may already be gone.
   */
  async dispatchFromAudit(auditId: string, actorUserId: string, retry = false): Promise<unknown> {
    return this.post('/payout-requests/from-audit', actorUserId, {
      audit_id: auditId,
      idempotency_key: `audit:${auditId}`,
      ...(retry ? { retry: true } : {})
    })
  }

  /**
   * Bulk payout: each audit dispatched on its own, and the selection may span properties.
   *
   * No idempotency key is passed and none would be honoured. The payout service derives one per
   * audit, so a caller can't vary it and a repeat of the same audit collides with itself.
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
   * Only forwards keys the payout service understands, so a stray filter can't silently widen the
   * result set by being ignored upstream. Empty values are dropped, not sent as blanks.
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
        // Recomputed, not trusted: if the upstream field is ever missing, reporting 0 pages while
        // returning rows would make the pager vanish on a table that clearly has data.
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
