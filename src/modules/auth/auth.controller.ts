import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
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
import type { IAuthService } from './auth.interface'
import { Public } from './decorators/public.decorator'

@ApiTags('Authentication')
@Controller('auth')
@Public()
export class AuthController {
  constructor(
    @Inject('IAuthService')
    private readonly authService: IAuthService
  ) {}

  @Post('login/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for login' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  async requestLoginOtp(@Body() body: LoginRequestOtpDto) {
    const result = await this.authService.requestLoginOtp(
      body.email,
      body.password
    )
    return {
      message: result.message,
      data: null
    }
  }

  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto
  })
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
  @ApiOperation({ summary: 'Invite a new user' })
  @ApiResponse({ status: 201, description: 'User invited successfully' })
  async inviteUser(@Body() body: InviteUserDto) {
    const result = await this.authService.inviteUser(body)
    return {
      message: result.message,
      data: null
    }
  }

  @Post('verify-invitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify invitation and set password' })
  @ApiResponse({
    status: 200,
    description: 'Invitation verified successfully',
    type: AuthResponseDto
  })
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
  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({ status: 200, description: 'Password reset OTP sent' })
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    const result = await this.authService.requestPasswordReset(body.email)
    return {
      message: result.message,
      data: null
    }
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    const result = await this.authService.resetPassword(body)
    return {
      message: result.message,
      data: null
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully'
  })
  async refreshToken(@Body() body: RefreshTokenDto) {
    const result = await this.authService.refreshAccessToken(body.refresh_token)
    return {
      message: 'Access token refreshed successfully',
      data: result
    }
  }
}
