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
 */
@Injectable()
export class PayoutClient {
  constructor(private readonly config: ConfigService) {}

  async dispatchFromAudit(auditId: string, actorUserId: string): Promise<unknown> {
    const base = this.config.payoutBaseUrl
    const key = this.config.payoutServiceApiKey
    if (!base || !key) {
      throw new InternalServerErrorException(
        'Payout service is not configured (PAYOUT_BASE_URL / PAYOUT_SERVICE_API_KEY)'
      )
    }

    let res: Response
    try {
      res = await fetch(`${base.replace(/\/$/, '')}/payout-requests/from-audit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'x-actor-user-id': actorUserId
        },
        body: JSON.stringify({ audit_id: auditId, idempotency_key: `audit:${auditId}` })
      })
    } catch {
      throw new HttpException('Payout service is unreachable', 502)
    }

    const text = await res.text()
    const body = text ? (JSON.parse(text) as Record<string, any>) : null

    if (!res.ok) {
      const message = body?.error?.message ?? 'Payout dispatch failed'
      throw new HttpException(message, res.status)
    }
    // Payout backend envelope is { success, data }; hand the caller just the result.
    return body?.data ?? body
  }
}
