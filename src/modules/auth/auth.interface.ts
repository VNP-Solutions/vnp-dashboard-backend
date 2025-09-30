import { Otp, User } from '@prisma/client'
import {
  AuthResponseDto,
  InviteUserDto,
  ResetPasswordDto,
  VerifyInvitationDto,
  VerifyLoginOtpDto
} from './auth.dto'

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<User | null>
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
  }): Promise<User>
  updateUserPassword(userId: string, password: string): Promise<void>
  clearTempPassword(userId: string): Promise<void>
  createUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void>
}

export interface IAuthService {
  requestLoginOtp(email: string): Promise<{ message: string }>
  verifyLoginOtp(data: VerifyLoginOtpDto): Promise<AuthResponseDto>
  inviteUser(data: InviteUserDto): Promise<{ message: string }>
  verifyInvitation(data: VerifyInvitationDto): Promise<AuthResponseDto>
  requestPasswordReset(email: string): Promise<{ message: string }>
  resetPassword(data: ResetPasswordDto): Promise<{ message: string }>
  refreshAccessToken(refreshToken: string): Promise<{ access_token: string }>
}

export interface JwtPayload {
  sub: string
  email: string
  role_id: string
}
