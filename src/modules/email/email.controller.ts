import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { SendEmailDto } from './email.dto'
import type { IEmailService } from './email.interface'

@ApiTags('Email')
@ApiBearerAuth('JWT-auth')
@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(
    @Inject('IEmailService')
    private readonly emailService: IEmailService
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Send email to any recipient' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Access token missing, invalid, or expired'
  })
  sendEmail(
    @Body() sendEmailDto: SendEmailDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.emailService.sendEmail(sendEmailDto, user)
  }
}
