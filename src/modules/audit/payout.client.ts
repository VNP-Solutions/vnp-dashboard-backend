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
      return fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(payload) })
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
    return body?.data ?? body
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

  /** Bulk lookup for a table page: audit ids that already have a payout, with a per-audit summary. */
  async payoutStatusByAudits(auditIds: string[], actorUserId: string): Promise<unknown> {
    if (auditIds.length === 0) return {}
    return this.post('/payout-requests/by-audits', actorUserId, { audit_ids: auditIds })
  }
}
