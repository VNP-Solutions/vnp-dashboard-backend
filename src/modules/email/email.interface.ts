import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { SendEmailDto } from './email.dto'

export interface IEmailService {
  sendEmail(
    data: SendEmailDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
}
