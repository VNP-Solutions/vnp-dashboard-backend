import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { ConfigService } from '../../config/config.service'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { EmailUtil } from '../../common/utils/email.util'
import { PrismaService } from '../prisma/prisma.service'
import type { IAuthRepository } from '../auth/auth.interface'
import { fingerprintAuditIds } from './payout-confirm-token.service'

/** A payout total, per currency. A mixed selection has one of these per currency it touches. */
export interface CurrencyTotal {
  currency: string
  amount_minor: number
}

/**
 * The emailed second factor for a large payout.
 *
 * Reuses the login OTP machinery wholesale: same generator, same table, same expiry, same mail
 * helper. The only addition is `payout_scope`, a marker on the row, following the same pattern the
 * admin password-reset and account-verify flows already use.
 *
 * That marker is what makes the codes non-interchangeable. `findValidOtp` filters on it and defaults
 * it to null, so a login code cannot authorise a payout, a payout code cannot log anyone in, and a
 * code minted for one selection cannot release a different one.
 */
@Injectable()
export class PayoutOtpService {
  constructor(
    private readonly config: ConfigService,
    private readonly emailUtil: EmailUtil,
    private readonly prisma: PrismaService,
    @Inject('IAuthRepository') private readonly authRepository: IAuthRepository
  ) {}

  /**
   * Does this payout need an OTP?
   *
   * Compared PER CURRENCY, not on a summed total. A selection spanning properties can mix GBP, EUR
   * and USD, and adding those together would be arithmetic on incompatible units. We hold no FX rate
   * at this point, so the honest rule is: if any single currency exceeds the threshold, confirm.
   */
  isRequired(totals: CurrencyTotal[]): boolean {
    const thresholdMinor = Math.round(this.config.payoutOtpThreshold * 100)
    return totals.some(t => t.amount_minor >= thresholdMinor)
  }

  /**
   * Per-currency totals from either preview shape.
   *
   * The bulk preview already reports `totals` split by rail and currency; the single-audit preview
   * reports `results`, one per rail. Both are net amounts, i.e. what the hotel is actually paid.
   */
  static totalsFrom(preview: unknown): CurrencyTotal[] {
    const p = (preview ?? {}) as {
      totals?: { currency?: string; net_minor?: number }[]
      results?: { currency?: string; net_minor?: number }[]
    }
    const rows = p.totals ?? p.results ?? []
    const byCurrency = new Map<string, number>()
    for (const r of rows) {
      const cur = (r.currency ?? '').toLowerCase()
      if (!cur) continue
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + (r.net_minor ?? 0))
    }
    return [...byCurrency].map(([currency, amount_minor]) => ({ currency, amount_minor }))
  }

  /** The threshold, for the UI to explain why it is asking. */
  get threshold(): number {
    return this.config.payoutOtpThreshold
  }

  /**
   * Mint a code for one selection and email it.
   *
   * Bound to the audit ids, so the code released by previewing two audits cannot dispatch twenty.
   * Any earlier unused code for the same user and scope is spent first, so a resend invalidates the
   * message still sitting in their inbox.
   */
  async send(userId: string, auditIds: string[]): Promise<{ message: string; expires_in_minutes: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    })
    if (!user) throw new NotFoundException('User not found')

    const scope = fingerprintAuditIds(auditIds)
    const otp = EncryptionUtil.generateOtp()
    const expiryMinutes = this.config.otpExpiryMinutes
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    await this.prisma.otp.updateMany({
      where: { user_id: user.id, payout_scope: scope, is_used: false },
      data: { is_used: true }
    })
    await this.prisma.otp.create({
      data: {
        user_id: user.id,
        otp,
        is_used: false,
        expires_at: expiresAt,
        payout_scope: scope,
        admin_password_reset_for_user_id: null,
        admin_verify_for_user_id: null
      }
    })
    await this.emailUtil.sendOtpEmail(user.email, otp)

    return { message: 'A confirmation code has been sent to your email', expires_in_minutes: expiryMinutes }
  }

  /**
   * Spend the code, or refuse the payout.
   *
   * Marked used BEFORE the dispatch runs. A code that survived a failed dispatch could authorise a
   * second attempt the operator never confirmed, and re-requesting one costs them an email.
   */
  async verifyAndSpend(userId: string, auditIds: string[], otp: number | undefined): Promise<void> {
    if (otp === undefined || otp === null) {
      throw new ForbiddenException(
        'This payout is above the confirmation threshold and needs the code emailed to you'
      )
    }

    const scope = fingerprintAuditIds(auditIds)
    const valid = await this.prisma.otp.findFirst({
      where: {
        user_id: userId,
        otp,
        is_used: false,
        expires_at: { gte: new Date() },
        payout_scope: scope
      }
    })

    if (!valid) {
      // Separate the two so an operator knows whether to retype or to request a new code.
      const expired = await this.prisma.otp.findFirst({
        where: { user_id: userId, otp, is_used: false, payout_scope: scope }
      })
      throw new BadRequestException(
        expired ? 'That code has expired, request a new one' : 'That code is not valid for this payout'
      )
    }

    await this.prisma.otp.update({ where: { id: valid.id }, data: { is_used: true } })
  }
}
