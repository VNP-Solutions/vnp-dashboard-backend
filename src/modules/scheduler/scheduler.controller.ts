import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { SchedulerService } from './scheduler.service'
import type { WeeklyAuditReportOptions } from './scheduler.interface'

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('trigger-weekly-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger the weekly audit report email',
    description:
      'This endpoint allows manual triggering of the audit report email that normally runs every Monday at 10 AM via cron. Use options.testEmails to send test emails to specific recipients.'
  })
  @ApiResponse({
    status: 200,
    description: 'Audit reports sent successfully'
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to send audit reports'
  })
  async triggerWeeklyReport(
    @Body() options: WeeklyAuditReportOptions = {}
  ) {
    await this.schedulerService.sendWeeklyAuditReports(options)

    return {
      success: true,
      message: options.isTestRun
        ? 'Test audit reports sent successfully'
        : 'Weekly audit reports sent successfully'
    }
  }
}
