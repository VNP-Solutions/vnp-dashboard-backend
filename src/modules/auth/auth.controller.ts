import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import {
  AuthResponseDto,
  InviteUserDto,
  LoginRequestOtpDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyInvitationDto,
  VerifyLoginOtpDto
} from './auth.dto'
import { AuthService } from './auth.service'
import { Public } from './decorators/public.decorator'

@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/request-otp')
  @HttpCode(HttpStatus.OK)
  async requestLoginOtp(@Body() body: LoginRequestOtpDto) {
    const result = await this.authService.requestLoginOtp(body.email)
    return {
      message: result.message,
      data: null
    }
  }

  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyLoginOtp(
    @Body() body: VerifyLoginOtpDto
  ): Promise<{ message: string; data: AuthResponseDto }> {
    const result = await this.authService.verifyLoginOtp(body)
    return {
      message: 'Login successful',
      data: result
    }
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async inviteUser(@Body() body: InviteUserDto) {
    const result = await this.authService.inviteUser(body)
    return {
      message: result.message,
      data: null
    }
  }

  @Post('verify-invitation')
  @HttpCode(HttpStatus.OK)
  async verifyInvitation(
    @Body() body: VerifyInvitationDto
  ): Promise<{ message: string; data: AuthResponseDto }> {
    const result = await this.authService.verifyInvitation(body)
    return {
      message: 'Invitation verified successfully',
      data: result
    }
  }

  @Post('password/request-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    const result = await this.authService.requestPasswordReset(body.email)
    return {
      message: result.message,
      data: null
    }
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordDto) {
    const result = await this.authService.resetPassword(body)
    return {
      message: result.message,
      data: null
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() body: RefreshTokenDto) {
    const result = await this.authService.refreshAccessToken(body.refresh_token)
    return {
      message: 'Access token refreshed successfully',
      data: result
    }
  }
}
