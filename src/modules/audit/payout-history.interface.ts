import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import type { PayoutHistoryQueryDto } from './payout-history.dto'

export interface IPayoutHistoryService {
  list(query: PayoutHistoryQueryDto, user: IUserWithPermissions): Promise<unknown>
  summary(query: PayoutHistoryQueryDto, user: IUserWithPermissions): Promise<unknown>
  findOne(id: string, user: IUserWithPermissions): Promise<unknown>
}
