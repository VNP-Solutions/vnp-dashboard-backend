import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
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
  constructor(private readonly payoutClient: PayoutClient) {}

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
  list(@Query() query: PayoutHistoryQueryDto, @CurrentUser() user: IUserWithPermissions) {
    return this.payoutClient.listPayouts(query, user.id)
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
  summary(@Query() query: PayoutHistoryQueryDto, @CurrentUser() user: IUserWithPermissions) {
    return this.payoutClient.payoutSummary(query, user.id)
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
  detail(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.payoutClient.getPayout(id, user.id)
  }
}
