import { Inject, Injectable } from '@nestjs/common'
import { Otp, Prisma, User } from '@prisma/client'
import { hasExhaustedAttempts, OtpPurpose } from './otp.policy'
import { PrismaService } from '../prisma/prisma.service'
import type { IAuthRepository } from './auth.interface'

type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    role: true
    userAccessedProperties: {
      select: {
        portfolio_id: true
        property_id: true
      }
    }
  }
}>

@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<UserWithRelations | null> {
    const formattedEmail = email.includes('+')
      ? email.replaceAll('+', '\\+')
      : email
    return this.prisma.user.findFirst({
      where: {
        // DON'T TOUCH IT, DISCUSS IT WITH ABRAR BHAIYA BEFORE DOING IT. VERY DANGEROUS!!!! ⚠️
        email: { equals: formattedEmail, mode: 'insensitive' }
      },
      include: {
        role: true,
        userAccessedProperties: {
          select: {
            portfolio_id: true,
            property_id: true
          }
        }
      }
    })
  }

  async createOtp(
    userId: string,
    otp: number,
    expiresAt: Date,
    purpose: OtpPurpose,
    adminPasswordResetForUserId?: string | null,
    adminVerifyForUserId?: string | null
  ): Promise<void> {
    await this.invalidateOtps(userId, purpose)
    await this.prisma.otp.create({
      data: {
        user_id: userId,
        otp,
        expires_at: expiresAt,
        is_used: false,
        purpose,
        attempts: 0,
        // Written explicitly: an absent field in Mongo does not match a `null` filter, and the
        // lookup pins payout_scope to null for every non-payout code.
        payout_scope: null,
        admin_password_reset_for_user_id: adminPasswordResetForUserId ?? null,
        admin_verify_for_user_id: adminVerifyForUserId ?? null
      }
    })
  }

  /**
   * Spend any live code of the same purpose before issuing another.
   *
   * Without this, every request added a code: a hundred password-reset requests left a hundred live
   * codes, and guessing one of a hundred in a 900k space is a different problem from guessing one.
   */
  async invalidateOtps(userId: string, purpose: OtpPurpose): Promise<void> {
    await this.prisma.otp.updateMany({
      where: { user_id: userId, purpose, is_used: false },
      data: { is_used: true }
    })
  }

  /**
   * Counts a wrong guess against every live code of this purpose, spending those that run out.
   * Returns true when the caller has burned through its allowance.
   */
  async registerFailedOtpAttempt(
    userId: string,
    purpose: OtpPurpose
  ): Promise<boolean> {
    const live = await this.prisma.otp.findMany({
      where: {
        user_id: userId,
        purpose,
        is_used: false,
        expires_at: { gte: new Date() }
      },
      select: { id: true, attempts: true }
    })

    if (live.length === 0) return false

    const exhausted = live.filter(row => hasExhaustedAttempts(row.attempts))

    await this.prisma.otp.updateMany({
      where: { id: { in: live.map(row => row.id) } },
      data: { attempts: { increment: 1 } }
    })

    if (exhausted.length > 0) {
      await this.prisma.otp.updateMany({
        where: { id: { in: exhausted.map(row => row.id) } },
        data: { is_used: true }
      })
    }

    return exhausted.length === live.length
  }

  async createOtpTx(
    tx: Prisma.TransactionClient,
    userId: string,
    otp: number,
    expiresAt: Date,
    purpose: OtpPurpose,
    adminPasswordResetForUserId?: string | null,
    adminVerifyForUserId?: string | null
  ): Promise<void> {
    await tx.otp.updateMany({
      where: { user_id: userId, purpose, is_used: false },
      data: { is_used: true }
    })
    await tx.otp.create({
      data: {
        user_id: userId,
        otp,
        expires_at: expiresAt,
        is_used: false,
        purpose,
        attempts: 0,
        // Written explicitly: an absent field in Mongo does not match a `null` filter, and the
        // lookup pins payout_scope to null for every non-payout code.
        payout_scope: null,
        admin_password_reset_for_user_id: adminPasswordResetForUserId ?? null,
        admin_verify_for_user_id: adminVerifyForUserId ?? null
      }
    })
  }

  async createUserTx(
    tx: Prisma.TransactionClient,
    data: {
      email: string
      first_name: string
      last_name: string
      language: string
      user_role_id: string
      password: string
      job_title?: string
      temp_password?: string
      is_verified: boolean
      invited_by_id?: string
      invitation_sent_at?: Date
    }
  ): Promise<User> {
    return tx.user.create({
      data: { ...data, email: data.email.toLowerCase() }
    })
  }

  async createUserAccessTx(
    tx: Prisma.TransactionClient,
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void> {
    await tx.userAccessedProperty.create({
      data: {
        user_id: userId,
        portfolio_id: portfolioIds,
        property_id: propertyIds
      }
    })
  }

  async findValidOtp(
    userId: string,
    otp: number,
    purpose: OtpPurpose,
    options?: {
      adminPasswordResetForUserId?: string
      adminVerifyForUserId?: string
      payoutScope?: string
    }
  ): Promise<Otp | null> {
    return this.prisma.otp.findFirst({
      where: {
        user_id: userId,
        otp,
        is_used: false,
        purpose,
        payout_scope: options?.payoutScope ?? null,
        expires_at: {
          gte: new Date()
        },
        admin_password_reset_for_user_id:
          options?.adminPasswordResetForUserId !== undefined
            ? options.adminPasswordResetForUserId
            : null,
        admin_verify_for_user_id:
          options?.adminVerifyForUserId !== undefined
            ? options.adminVerifyForUserId
            : null
      }
    })
  }

  /** Unused OTP matching the code (may be expired). Same scope filters as findValidOtp. */
  async findUnusedOtpByCode(
    userId: string,
    otp: number,
    purpose: OtpPurpose,
    options?: {
      adminPasswordResetForUserId?: string
      adminVerifyForUserId?: string
      payoutScope?: string
    }
  ): Promise<Otp | null> {
    return this.prisma.otp.findFirst({
      where: {
        user_id: userId,
        otp,
        is_used: false,
        purpose,
        payout_scope: options?.payoutScope ?? null,
        admin_password_reset_for_user_id:
          options?.adminPasswordResetForUserId !== undefined
            ? options.adminPasswordResetForUserId
            : null,
        admin_verify_for_user_id:
          options?.adminVerifyForUserId !== undefined
            ? options.adminVerifyForUserId
            : null
      },
      orderBy: { created_at: 'desc' }
    })
  }

  async markOtpAsUsed(otpId: string): Promise<void> {
    await this.prisma.otp.update({
      where: { id: otpId },
      data: { is_used: true }
    })
  }

  async createUser(data: {
    email: string
    first_name: string
    last_name: string
    language: string
    user_role_id: string
    password: string
    job_title?: string
    temp_password?: string
    is_verified: boolean
    invited_by_id?: string
    invitation_sent_at?: Date
  }): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() }
    })
  }

  async updateUserPassword(userId: string, password: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password }
    })
  }

  async clearTempPassword(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { temp_password: null, is_verified: true }
    })
  }

  async createUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void> {
    await this.prisma.userAccessedProperty.create({
      data: {
        user_id: userId,
        portfolio_id: portfolioIds,
        property_id: propertyIds
      }
    })
  }

  async updateInvitationSentAt(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { invitation_sent_at: new Date() }
    })
  }
}
