import { Inject, Injectable } from '@nestjs/common'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EmailUtil } from '../../common/utils/email.util'
import { PrismaService } from '../prisma/prisma.service'
import { SendEmailDto } from './email.dto'
import type { IEmailService } from './email.interface'

@Injectable()
export class EmailService implements IEmailService {
  constructor(
    @Inject(EmailUtil) private emailUtil: EmailUtil,
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  async sendEmail(data: SendEmailDto, user: IUserWithPermissions) {
    // Default send_sender_data to true if not specified
    const shouldSendSenderData = data.send_sender_data !== false

    // Build the email body
    let fullEmailBody = data.body

    // Append sender information if requested
    if (shouldSendSenderData) {
      const senderInfo = await this.buildSenderInfo(user.id, user)
      fullEmailBody = `${data.body}\n\n${senderInfo}`
    }

    // Send the email
    await this.emailUtil.sendEmail(data.to, data.subject, fullEmailBody)

    return { message: 'Email sent successfully' }
  }

  private async buildSenderInfo(
    userId: string,
    user: IUserWithPermissions
  ): Promise<string> {
    // Query database to get full user details
    const fullUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        first_name: true,
        last_name: true,
        email: true
      }
    })

    const divider = '-----------------------------------'
    const senderDetails = [
      divider,
      'This email was sent by:',
      '',
      `Name: ${fullUser?.first_name} ${fullUser?.last_name}`,
      `Email: ${fullUser?.email || user.email}`,
      `Role: ${user.role.name}`
    ]

    return senderDetails.join('\n')
  }
}
