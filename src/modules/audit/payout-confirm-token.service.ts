import { ForbiddenException, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '../../config/config.service'

/**
 * Short-lived confirmation token for the payout modal.
 *
 * The modal opens, fetches a preview, and receives one of these. The Confirm button stays disabled
 * until it arrives, and the token must be presented back on POST /audit/:id/payout.
 *
 * Deliberately NOT the service-to-service communication JWT. That credential is unscoped and lets a
 * holder call the DBMS and dashboard external APIs directly; handing it to a browser would be a
 * privilege escalation. This token is bound to one audit AND one user, is useless anywhere else, and
 * expires in minutes.
 *
 * It is a confirmation step, not an authorization step: the route still runs the normal JWT +
 * permission guards, and the payout service still re-derives every amount from the audit id. The
 * token's job is to prove "this operator was shown a preview and clicked Confirm", which also makes
 * a blind POST from outside the UI fail closed.
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

  /**
   * Throws unless the token is valid, unexpired, of the right type, and issued for exactly this
   * audit and this user. Binding the user prevents one operator's token being used to confirm a
   * payout as someone else.
   */
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
}
