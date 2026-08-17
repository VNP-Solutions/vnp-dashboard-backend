import { createHash } from 'node:crypto'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '../../config/config.service'

/**
 * The ticket that proves an operator saw a preview before confirming.
 *
 * The modal fetches a preview and gets one of these back; POST /audit/:id/payout won't run without
 * it. It is not authorization, the route still runs the normal guards, and the payout service still
 * re-derives every amount. It only answers "was this confirmed", which is what makes a blind POST
 * from outside the UI fail closed.
 *
 * Not the service-to-service JWT, on purpose. That one is unscoped and would let a browser call the
 * DBMS and external APIs directly. This one is bound to one audit and one user and expires in
 * minutes.
 */

const TOKEN_TYPE = 'payout-confirm'
const TOKEN_TTL_SECONDS = 5 * 60

interface PayoutConfirmClaims {
  typ: string
  auditId: string
  userId: string
}

@Injectable()
export class PayoutConfirmTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  private get secret(): string {
    // Signed with the dashboard's own access secret: this token is only ever minted and verified
    // here, so it must not share the cross-service communication secret.
    return this.configService.jwt.accessSecret
  }

  mint(auditId: string, userId: string): { token: string; expiresAt: string } {
    const claims: PayoutConfirmClaims = { typ: TOKEN_TYPE, auditId, userId }
    const token = this.jwtService.sign(claims, {
      secret: this.secret,
      expiresIn: TOKEN_TTL_SECONDS
    })
    return {
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString()
    }
  }

  /** Throws unless the token is valid, unexpired, the right type, and for this audit and user. */
  verify(token: string | undefined, auditId: string, userId: string): void {
    if (!token) {
      throw new ForbiddenException('A payout confirmation token is required')
    }

    let claims: PayoutConfirmClaims
    try {
      claims = this.jwtService.verify<PayoutConfirmClaims>(token, { secret: this.secret })
    } catch {
      throw new ForbiddenException('Payout confirmation token is invalid or expired, please reopen the confirmation dialog')
    }

    if (claims.typ !== TOKEN_TYPE) {
      throw new ForbiddenException('Payout confirmation token is not valid for this action')
    }
    if (claims.auditId !== auditId) {
      throw new ForbiddenException('Payout confirmation token was issued for a different audit')
    }
    if (claims.userId !== userId) {
      throw new ForbiddenException('Payout confirmation token was issued for a different user')
    }
  }

  /**
   * Same idea for the bulk modal, over a set of audits.
   *
   * Stops someone previewing three audits, seeing a small total, then dispatching thirty with the
   * same token. Amounts are always re-derived server-side, so the risk was never a wrong number, it
   * was a bigger set than the operator approved.
   */
  mintForSet(auditIds: string[], userId: string): { token: string; expiresAt: string } {
    return this.mint(fingerprintAuditIds(auditIds), userId)
  }

  verifyForSet(token: string | undefined, auditIds: string[], userId: string): void {
    this.verify(token, fingerprintAuditIds(auditIds), userId)
  }
}

/** Order-independent, duplicate-independent fingerprint of an audit selection. */
export function fingerprintAuditIds(auditIds: string[]): string {
  const canonical = [...new Set(auditIds)].sort().join(',')
  return `set:${createHash('sha256').update(canonical).digest('hex').slice(0, 32)}`
}
