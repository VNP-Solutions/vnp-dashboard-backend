import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
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
    portfolio_permission: any
    property_permission: any
    audit_permission: any
    user_permission: any
    system_settings_permission: any
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
    private prisma: PrismaService
  ) {}

  async requestLoginOtp(
    email: string,
    password: string
  ): Promise<{ message: string }> {
    const user = await this.authRepository.findUserByEmail(email)

    if (!user) {
      throw new BadRequestException('Invalid credentials')
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
      throw new BadRequestException('Invalid credentials')
    }

    const otp = EncryptionUtil.generateOtp()
    const expiryMinutes = this.configService.get('auth.otpExpiryMinutes', {
      infer: true
    })!
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    await this.authRepository.createOtp(user.id, otp, expiresAt)
    await this.emailUtil.sendOtpEmail(email, otp)

    console.log(`Login OTP for ${email}: ${otp}`)

    return { message: 'OTP sent to your email' }
  }

  async verifyLoginOtp(data: VerifyLoginOtpDto): Promise<AuthResponseDto> {
    const user = await this.authRepository.findUserByEmail(data.email)

    if (!user) {
      throw new BadRequestException('Invalid credentials')
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
  }

  async inviteUser(data: InviteUserDto): Promise<{ message: string }> {
    const existingUser = await this.authRepository.findUserByEmail(data.email)

    if (existingUser) {
      throw new ConflictException('User with this email already exists')
    }

    const tempPassword = EncryptionUtil.generateTempPassword()
    const hashedPassword = await EncryptionUtil.hashPassword(tempPassword)
    const expiryDays = this.configService.get('auth.tempPasswordExpiryDays', {
      infer: true
    })!

    const user = await this.authRepository.createUser({
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      language: data.language,
      user_role_id: data.role_id,
      password: hashedPassword,
      temp_password: tempPassword,
      is_verified: false
    })

    if (data.portfolio_ids || data.property_ids) {
      await this.authRepository.createUserAccess(
        user.id,
        data.portfolio_ids || [],
        data.property_ids || []
      )
    }

    // Fetch role details to get is_external flag
    const role = await this.prisma.userRole.findUnique({
      where: { id: data.role_id },
      select: { name: true, is_external: true }
    })

    if (!role) {
      throw new Error('Role not found')
    }

    await this.emailUtil.sendInvitationEmail(
      data.email,
      tempPassword,
      role.name,
      data.first_name,
      role.is_external
    )

    return {
      message: `Invitation sent successfully. Temporary password is valid for ${expiryDays} days.`
    }
  }

  async verifyInvitation(data: VerifyInvitationDto): Promise<AuthResponseDto> {
    const user = await this.authRepository.findUserByEmail(data.email)

    if (!user) {
      throw new BadRequestException('Invalid credentials')
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
    await this.authRepository.updateUserPassword(user.id, hashedNewPassword)
    await this.authRepository.clearTempPassword(user.id)

    const updatedUser = await this.authRepository.findUserByEmail(data.email)
    if (!updatedUser) {
      throw new BadRequestException('User not found')
    }
    return this.generateAuthResponse(updatedUser as unknown as UserWithRole)
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.authRepository.findUserByEmail(email)

    if (!user) {
      return { message: 'If the email exists, an OTP has been sent' }
    }

    const otp = EncryptionUtil.generateOtp()
    const expiryMinutes = this.configService.get('auth.otpExpiryMinutes', {
      infer: true
    })!
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    await this.authRepository.createOtp(user.id, otp, expiresAt)
    await this.emailUtil.sendPasswordResetOtpEmail(email, otp)

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Password Reset OTP for ${email}: ${otp}`)
    }

    return { message: 'If the email exists, an OTP has been sent' }
  }

  async resetPassword(data: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.authRepository.findUserByEmail(data.email)

    if (!user) {
      throw new BadRequestException('Invalid credentials')
    }

    const validOtp = await this.authRepository.findValidOtp(user.id, data.otp)

    if (!validOtp) {
      throw new BadRequestException('Invalid or expired OTP')
    }

    await this.authRepository.markOtpAsUsed(validOtp.id)

    const hashedNewPassword = await EncryptionUtil.hashPassword(
      data.new_password
    )
    await this.authRepository.updateUserPassword(user.id, hashedNewPassword)

    return { message: 'Password reset successfully' }
  }

  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret', { infer: true })
      })

      const user = await this.authRepository.findUserByEmail(payload.email)

      if (!user) {
        throw new UnauthorizedException('Invalid token')
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role_id: user.user_role_id
      }

      const accessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get('jwt.accessSecret', { infer: true }),
        expiresIn: this.configService.get('jwt.accessExpiresIn', {
          infer: true
        })
      })

      return { access_token: accessToken }
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }
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
