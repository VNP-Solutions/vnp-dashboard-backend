import { Otp, Prisma, User } from '@prisma/client'
import {
  AuthResponseDto,
  InviteUserDto,
  ResetPasswordDto,
  VerifyInvitationDto,
  VerifyLoginOtpDto
} from './auth.dto'

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

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<UserWithRelations | null>
  createOtp(userId: string, otp: number, expiresAt: Date): Promise<void>
  findValidOtp(userId: string, otp: number): Promise<Otp | null>
  markOtpAsUsed(otpId: string): Promise<void>
  createUser(data: {
    email: string
    first_name: string
    last_name: string
    language: string
    user_role_id: string
    password: string
    temp_password?: string
    is_verified: boolean
    invited_by_id?: string
    invitation_sent_at?: Date
  }): Promise<User>
  updateUserPassword(userId: string, password: string): Promise<void>
  clearTempPassword(userId: string): Promise<void>
  createUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void>
  updateInvitationSentAt(userId: string): Promise<void>
}

export interface IAuthService {
  requestLoginOtp(email: string, password: string): Promise<{ message: string }>
  verifyLoginOtp(data: VerifyLoginOtpDto): Promise<AuthResponseDto>
  inviteUser(
    data: InviteUserDto,
    inviterId: string,
    inviterRolePermissionLevel: string | undefined
  ): Promise<{ message: string }>
  resendInvitation(
    email: string,
    inviterRolePermissionLevel: string | undefined
  ): Promise<{ message: string }>
  verifyInvitation(data: VerifyInvitationDto): Promise<AuthResponseDto>
  requestPasswordReset(email: string): Promise<{ message: string }>
  resetPassword(data: ResetPasswordDto): Promise<{ message: string }>
  refreshAccessToken(refreshToken: string): Promise<AuthResponseDto>
}

export interface JwtPayload {
  sub: string
  email: string
  role_id: string
}
