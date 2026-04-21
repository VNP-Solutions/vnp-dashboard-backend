import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { canInviteRole } from '../../common/utils/permission.util'
import { Configuration } from '../../config/configuration'
import { PrismaService } from '../prisma/prisma.service'
import {
  AuthResponseDto,
  InviteUserDto,
  ResetPasswordDto,
  VerifyInvitationDto,
  VerifyLoginOtpDto
} from './auth.dto'
import type {
  IAuthRepository,
  IAuthService,
  JwtPayload
} from './auth.interface'

/**
 * Interactive transaction: DB changes commit only after the callback completes.
 * Email is sent last so SMTP failure rolls back prior writes (MongoDB replica set required).
 */
const DB_EMAIL_TX = { maxWait: 10_000, timeout: 60_000 } as const

interface UserWithRole {
  id: string
  email: string
  first_name: string
  last_name: string
  user_role_id: string
  role: {
    id: string
    name: string
    description: string
    is_external: boolean
    can_access_mis: boolean
    portfolio_permission: any
    property_permission: any
    audit_permission: any
    user_permission: any
    system_settings_permission: any
    bank_details_permission: any
  }
}

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    @Inject('IAuthRepository')
    private authRepository: IAuthRepository,
    @Inject(JwtService)
    private jwtService: JwtService,
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>,
    @Inject(EmailUtil)
    private emailUtil: EmailUtil,
    @Inject(PrismaService)
    private prisma: PrismaService,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  async requestLoginOtp(
    email: string,
    password: string
  ): Promise<{ message: string }> {
    try {
      const user = await this.authRepository.findUserByEmail(email)

      if (!user) {
        throw new NotFoundException('User not found with this email address')
      }

      if (user.temp_password) {
        throw new BadRequestException(
          'Please complete your invitation verification first'
        )
      }

      const isPasswordValid = await EncryptionUtil.comparePassword(
        password,
        user.password
      )

      if (!isPasswordValid) {
        throw new BadRequestException('Invalid password')
      }

      const otp = EncryptionUtil.generateOtp()
      const expiryMinutes = this.configService.get('auth.otpExpiryMinutes', {
        infer: true
      })!
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

      await this.prisma.$transaction(async tx => {
        await this.authRepository.createOtpTx(tx, user.id, otp, expiresAt)
        await this.emailUtil.sendOtpEmail(user.email, otp)
      }, DB_EMAIL_TX)

      console.log(`Login OTP for ${user.email}: ${otp}`)

      return { message: 'OTP sent to your email' }
    } catch (error) {
      this.logError('requestLoginOtp', error, email)
      throw error
    }
  }

  async verifyLoginOtp(data: VerifyLoginOtpDto): Promise<AuthResponseDto> {
    try {
      const user = await this.authRepository.findUserByEmail(data.email)

      if (!user) {
        throw new NotFoundException('User not found with this email address')
      }

      const validOtp = await this.authRepository.findValidOtp(user.id, data.otp)

      if (!validOtp) {
        throw new BadRequestException('Invalid or expired OTP')
      }

      await this.authRepository.markOtpAsUsed(validOtp.id)

      const userWithRole = await this.authRepository.findUserByEmail(user.email)
      if (!userWithRole) {
        throw new BadRequestException('User not found')
      }

      return this.generateAuthResponse(userWithRole as unknown as UserWithRole)
    } catch (error) {
      this.logError('verifyLoginOtp', error, data.email)
      throw error
    }
  }

  async inviteUser(
    data: InviteUserDto,
    inviterId: string,
    inviterRolePermissionLevel: string | undefined
  ): Promise<{ message: string }> {
    try {
      // Check if user has permission to invite (permission_level must be 'all' or 'update' for CREATE permission)
      if (
        inviterRolePermissionLevel !== 'all' &&
        inviterRolePermissionLevel !== 'update'
      ) {
        throw new ForbiddenException(
          'You do not have permission to invite users. Only users with CREATE permission (all or update) can invite.'
        )
      }

      const existingUser = await this.authRepository.findUserByEmail(data.email)

      if (existingUser) {
        throw new ConflictException('User with this email already exists')
      }

      // Fetch inviter's full user object with permissions for validation
      const inviterUser = await this.prisma.user.findUnique({
        where: { id: inviterId },
        include: { role: true }
      })

      if (!inviterUser || !inviterUser.role) {
        throw new ForbiddenException('Inviter user or role not found')
      }

      // Fetch target role with full permissions
      const targetRole = await this.prisma.userRole.findUnique({
        where: { id: data.role_id }
      })

      if (!targetRole) {
        throw new BadRequestException('Selected role not found')
      }

      // Validate role hierarchy: Can inviter assign this role?
      if (!canInviteRole(inviterUser as any, targetRole)) {
        throw new ForbiddenException(
          'You cannot invite users with this role. The role has permissions equal to or higher than yours, or you cannot invite this user type (internal/external).'
        )
      }

      // Validate portfolio/property access constraints for partial access users
      if (data.portfolio_ids && data.portfolio_ids.length > 0) {
        const accessiblePortfolioIds =
          await this.permissionService.getAccessibleResourceIds(
            inviterUser as any,
            ModuleType.PORTFOLIO
          )

        if (Array.isArray(accessiblePortfolioIds)) {
          // Inviter has partial access - validate they can only assign portfolios they have access to
          const invalidPortfolioIds = data.portfolio_ids.filter(
            id => !accessiblePortfolioIds.includes(id)
          )

          if (invalidPortfolioIds.length > 0) {
            throw new ForbiddenException(
              `You cannot assign access to portfolios you don't have access to: ${invalidPortfolioIds.join(', ')}`
            )
          }
        }
        // If accessiblePortfolioIds === 'all', inviter can assign any portfolio
      }

      if (data.property_ids && data.property_ids.length > 0) {
        const accessiblePropertyIds =
          await this.permissionService.getAccessibleResourceIds(
            inviterUser as any,
            ModuleType.PROPERTY
          )

        if (Array.isArray(accessiblePropertyIds)) {
          // Inviter has partial access - validate they can only assign properties they have access to
          const invalidPropertyIds = data.property_ids.filter(
            id => !accessiblePropertyIds.includes(id)
          )

          if (invalidPropertyIds.length > 0) {
            throw new ForbiddenException(
              `You cannot assign access to properties you don't have access to: ${invalidPropertyIds.join(', ')}`
            )
          }
        }
        // If accessiblePropertyIds === 'all', inviter can assign any property
      }

      const tempPassword = EncryptionUtil.generateTempPassword()
      const hashedPassword = await EncryptionUtil.hashPassword(tempPassword)
      const expiryDays = this.configService.get('auth.tempPasswordExpiryDays', {
        infer: true
      })!

      await this.prisma.$transaction(async tx => {
        const user = await this.authRepository.createUserTx(tx, {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          language: data.language,
          user_role_id: data.role_id,
          password: hashedPassword,
          job_title: data.job_title,
          temp_password: tempPassword,
          is_verified: false,
          invited_by_id: inviterId,
          invitation_sent_at: new Date()
        })

        if (data.portfolio_ids || data.property_ids) {
          await this.authRepository.createUserAccessTx(
            tx,
            user.id,
            data.portfolio_ids || [],
            data.property_ids || []
          )
        }

        await this.emailUtil.sendInvitationEmail(
          data.email,
          tempPassword,
          targetRole.name,
          data.first_name,
          targetRole.is_external
        )
      }, DB_EMAIL_TX)

      console.log(
        `Invitation sent to ${data.email}. Temp password: ${tempPassword}`
      )

      return {
        message: `Invitation sent successfully. Temporary password is valid for ${expiryDays} days.`
      }
    } catch (error) {
      this.logError('inviteUser', error, data.email)
      throw error
    }
  }

  async resendInvitation(
    email: string,
    inviterRolePermissionLevel: string | undefined
  ): Promise<{ message: string }> {
    try {
      // Check if user has permission to resend invitation (permission_level must be 'all' or 'update' for CREATE permission)
      if (
        inviterRolePermissionLevel !== 'all' &&
        inviterRolePermissionLevel !== 'update'
      ) {
        throw new ForbiddenException(
          'You do not have permission to resend invitations. Only users with CREATE permission (all or update) can resend.'
        )
      }

      const user = await this.authRepository.findUserByEmail(email)

      if (!user) {
        throw new BadRequestException('User not found')
      }

      // Check if user has a pending invitation (temp_password exists and is_verified is false)
      if (!user.temp_password || user.is_verified) {
        throw new BadRequestException(
          'No pending invitation found for this user. The user may have already verified their account.'
        )
      }

      // Check 5-minute cooldown
      const COOLDOWN_MINUTES = 5
      if (user.invitation_sent_at) {
        const timeSinceLastInvitation =
          Date.now() - new Date(user.invitation_sent_at).getTime()
        const cooldownMs = COOLDOWN_MINUTES * 60 * 1000

        if (timeSinceLastInvitation < cooldownMs) {
          const remainingSeconds = Math.ceil(
            (cooldownMs - timeSinceLastInvitation) / 1000
          )
          const remainingMinutes = Math.floor(remainingSeconds / 60)
          const remainingSecs = remainingSeconds % 60

          throw new BadRequestException(
            `Please wait ${remainingMinutes}m ${remainingSecs}s before resending the invitation.`
          )
        }
      }

      // Generate new temporary password
      const tempPassword = EncryptionUtil.generateTempPassword()
      const hashedPassword = await EncryptionUtil.hashPassword(tempPassword)
      const expiryDays = this.configService.get('auth.tempPasswordExpiryDays', {
        infer: true
      })!

      const role = await this.prisma.userRole.findUnique({
        where: { id: user.user_role_id },
        select: { name: true, is_external: true }
      })

      if (!role) {
        throw new Error('Role not found')
      }

      await this.prisma.$transaction(async tx => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            temp_password: tempPassword,
            invitation_sent_at: new Date()
          }
        })

        await this.emailUtil.sendInvitationEmail(
          user.email,
          tempPassword,
          role.name,
          user.first_name,
          role.is_external
        )
      }, DB_EMAIL_TX)

      console.log(
        `Invitation resent to ${email}. Temp password: ${tempPassword}`
      )

      return {
        message: `Invitation resent successfully. Temporary password is valid for ${expiryDays} days.`
      }
    } catch (error) {
      this.logError('resendInvitation', error, email)
      throw error
    }
  }

  async verifyInvitation(data: VerifyInvitationDto): Promise<AuthResponseDto> {
    try {
      const user = await this.authRepository.findUserByEmail(data.email)

      if (!user) {
        throw new NotFoundException('User not found with this email address')
      }

      if (user.is_verified) {
        throw new BadRequestException(
          'This invitation link is no longer valid. Your account has already been verified.'
        )
      }

      if (!user.temp_password) {
        throw new BadRequestException('No pending invitation found')
      }

      if (user.temp_password !== data.temp_password) {
        throw new BadRequestException('Invalid temporary password')
      }

      const hashedNewPassword = await EncryptionUtil.hashPassword(
        data.new_password
      )

      await this.prisma.$transaction(async tx => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            password: hashedNewPassword,
            temp_password: null,
            is_verified: true
          }
        })
      })

      const updatedUser = await this.authRepository.findUserByEmail(data.email)
      if (!updatedUser) {
        throw new BadRequestException('User not found')
      }

      return this.generateAuthResponse(updatedUser as unknown as UserWithRole)
    } catch (error) {
      this.logError('verifyInvitation', error, data.email)
      throw error
    }
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    try {
      const user = await this.authRepository.findUserByEmail(email)

      if (!user) {
        throw new NotFoundException(
          "The user doesn't exist with this email address"
        )
      }

      if (!user.is_verified) {
        throw new BadRequestException(
          'User is not verified, please verify the invitation first!'
        )
      }

      const otp = EncryptionUtil.generateOtp()
      const expiryMinutes = this.configService.get('auth.otpExpiryMinutes', {
        infer: true
      })!
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

      await this.prisma.$transaction(async tx => {
        await this.authRepository.createOtpTx(tx, user.id, otp, expiresAt)
        await this.emailUtil.sendPasswordResetOtpEmail(user.email, otp)
      }, DB_EMAIL_TX)

      console.log(`Password Reset OTP for ${user.email}: ${otp}`)

      return { message: 'An OTP has been sent to the email' }
    } catch (error) {
      this.logError('requestPasswordReset', error, email)
      throw error
    }
  }

  async resetPassword(data: ResetPasswordDto): Promise<{ message: string }> {
    try {
      const user = await this.authRepository.findUserByEmail(data.email)

      if (!user) {
        throw new NotFoundException('User not found with this email address')
      }

      if (!user.is_verified) {
        throw new BadRequestException(
          'Account not yet verified. Please complete your invitation before resetting your password.'
        )
      }

      const validOtp = await this.authRepository.findValidOtp(user.id, data.otp)

      if (!validOtp) {
        throw new BadRequestException('Invalid or expired OTP')
      }

      const hashedNewPassword = await EncryptionUtil.hashPassword(
        data.new_password
      )

      await this.prisma.$transaction(async tx => {
        await tx.otp.update({
          where: { id: validOtp.id },
          data: { is_used: true }
        })
        await tx.user.update({
          where: { id: user.id },
          data: { password: hashedNewPassword }
        })
      })

      return { message: 'Password reset successfully' }
    } catch (error) {
      this.logError('resetPassword', error, data.email)
      throw error
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret', { infer: true })
      })

      const user = await this.authRepository.findUserByEmail(payload.email)

      if (!user) {
        throw new UnauthorizedException('Invalid token')
      }

      // Ensure user has role info for response generation
      const userWithRole = await this.authRepository.findUserByEmail(user.email)
      if (!userWithRole) {
        throw new UnauthorizedException('User not found')
      }

      return this.generateAuthResponse(userWithRole as unknown as UserWithRole)
    } catch (error) {
      this.logError(
        'refreshAccessToken',
        error,
        this.getEmailFromRefreshToken(refreshToken)
      )
      throw new UnauthorizedException('Invalid or expired refresh token')
    }
  }

  private logError(context: string, error: unknown, email?: string): void {
    const errorResponse =
      error instanceof HttpException ? error.getResponse() : error

    console.error(
      `[AuthService.${context}]`,
      email ? { email, error: errorResponse } : errorResponse
    )
  }

  private getEmailFromRefreshToken(refreshToken: string): string | undefined {
    const decodedToken = this.jwtService.decode(refreshToken)

    if (
      decodedToken &&
      typeof decodedToken === 'object' &&
      'email' in decodedToken &&
      typeof decodedToken.email === 'string'
    ) {
      return decodedToken.email
    }

    return undefined
  }

  private generateAuthResponse(user: UserWithRole): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role_id: user.user_role_id
    }

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.accessSecret', { infer: true }),
      expiresIn: this.configService.get('jwt.accessExpiresIn', { infer: true })
    })

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret', { infer: true }),
      expiresIn: this.configService.get('jwt.refreshExpiresIn', {
        infer: true
      })
    })

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    }
  }
}
