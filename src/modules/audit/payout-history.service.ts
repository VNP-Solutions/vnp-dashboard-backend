import { Injectable } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import type { IPayoutHistoryService } from './payout-history.interface'
import type { PayoutHistoryQueryDto } from './payout-history.dto'
import { PayoutClient } from './payout.client'

/**
 * Read-only payout history.
 *
 * The payout service treats a peer service as unrestricted, because a service principal has no hotel
 * assignments of its own. That is only safe if we say which properties the human behind the call may
 * see, which is what this layer exists to do.
 */
@Injectable()
export class PayoutHistoryService implements IPayoutHistoryService {
  constructor(
    private readonly payoutClient: PayoutClient,
    private readonly permissionService: PermissionService
  ) {}

  /**
   * Narrow the query to the properties this user may see.
   *
   * `all` means no narrowing. An empty list goes through as an empty string so the payout service
   * denies rather than falling back to unrestricted: a user assigned no properties must see nothing.
   */
  private async scopedQuery(
    query: PayoutHistoryQueryDto,
    user: IUserWithPermissions
  ): Promise<PayoutHistoryQueryDto & { dashboard_property_ids?: string }> {
    const accessible = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )
    if (accessible === 'all') return query
    return { ...query, dashboard_property_ids: accessible.join(',') }
  }

  async list(query: PayoutHistoryQueryDto, user: IUserWithPermissions): Promise<unknown> {
    return this.payoutClient.listPayouts(await this.scopedQuery(query, user), user.id)
  }

  async summary(query: PayoutHistoryQueryDto, user: IUserWithPermissions): Promise<unknown> {
    return this.payoutClient.payoutSummary(await this.scopedQuery(query, user), user.id)
  }

  /**
   * Takes the same scope as the list. Leaving lookup-by-id open would not be a partial fix, since
   * the ids appear in list responses.
   */
  async findOne(id: string, user: IUserWithPermissions): Promise<unknown> {
    const { dashboard_property_ids } = await this.scopedQuery({}, user)
    return this.payoutClient.getPayout(id, user.id, { dashboard_property_ids })
  }
}
