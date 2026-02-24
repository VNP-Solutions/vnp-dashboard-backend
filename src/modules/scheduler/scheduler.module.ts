import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SchedulerService } from './scheduler.service'
import { SchedulerController } from './scheduler.controller'
import { PrismaService } from '../prisma/prisma.service'
import { EmailUtil } from '../../common/utils/email.util'
import { EmailModule } from '../email/email.module'

@Module({
  imports: [ScheduleModule.forRoot(), EmailModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, PrismaService, EmailUtil],
  exports: [SchedulerService]
})
export class SchedulerModule {}
