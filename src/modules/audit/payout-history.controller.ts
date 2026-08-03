import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { PermissionService } from '../../common/services/permission.service'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PayoutHistoryQueryDto } from './payout-history.dto'
import { PayoutClient } from './payout.client'

/**
 * Read-only payout history for the dashboard.
 *
 * A thin proxy onto the payout service's journal, for the same reason the "Pay out" button is one:
 * Stripe credentials and the payout database live in exactly one service, and the dashboard never
 * talks to either directly. Nothing here writes, so there is no idempotency key and no confirm token.
 *
 * Authorization happens HERE, not upstream. The payout service trusts a service principal precisely
 * because this guard already ran, so any new route on this controller must keep the guard pair and
 * the AUDIT view permission, or it becomes an unauthenticated window onto every hotel's payouts.
 */
@ApiTags('Payout History')
@ApiBearerAuth('JWT-auth')
@Controller('payouts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PayoutHistoryController {
  constructor(
    private readonly payoutClient: PayoutClient,
    private readonly permissionService: PermissionService
  ) {}

  /**
   * Narrow the query to the properties this user may actually see.
   *
   * REQUIRED, not defensive. The payout service treats a peer service as unrestricted, because a
   * service principal has no hotel assignments of its own to resolve; that is only safe if we say
   * which properties the human behind the call may see. Until this existed, a user with PARTIAL
   * audit access saw two audits and every hotel's payouts, because the permission guard checks
   * whether they may read audits at all and says nothing about which ones.
   *
   * `all` means no narrowing. An empty list is sent through as an empty string so the payout service
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

  @Get()
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary: 'Paged payout history',
    description:
      'Reads the payout service journal. Every payout leg is a row: one audit paying two OTAs on ' +
      'different rails appears as two rows, each with its own rail, amount, currency and status. ' +
      'Pass hotel_id to scope the page to a single property.'
  })
  @ApiResponse({ status: 200, description: 'Payout rows plus paging metadata' })
  async list(@Query() query: PayoutHistoryQueryDto, @CurrentUser() user: IUserWithPermissions) {
    return this.payoutClient.listPayouts(await this.scopedQuery(query, user), user.id)
  }

  @Get('summary')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary: 'Settlement totals for the whole filtered set',
    description:
      'Totals come from the database over every matching row, NOT from the current page, and are ' +
      'returned per currency because a sum across currencies would be meaningless. Takes the same ' +
      'filters as the list so the header and the rows always describe the same set.'
  })
  @ApiResponse({ status: 200, description: 'Per-currency settled totals and counts' })
  async summary(@Query() query: PayoutHistoryQueryDto, @CurrentUser() user: IUserWithPermissions) {
    return this.payoutClient.payoutSummary(await this.scopedQuery(query, user), user.id)
  }

  // Registered after 'summary' so that literal path is never captured as an id.
  @Get(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary: 'One payout with its legs and status history',
    description:
      'Includes the append-only status events, so an operator can see how a payout reached its ' +
      'current state rather than only the state itself.'
  })
  @ApiResponse({ status: 200, description: 'Payout detail' })
  @ApiResponse({ status: 404, description: 'No payout with that id' })
  async detail(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    const { dashboard_property_ids } = await this.scopedQuery({}, user)
    return this.payoutClient.getPayout(id, user.id, { dashboard_property_ids })
  }
}
