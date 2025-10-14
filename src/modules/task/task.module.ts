import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { TaskController } from './task.controller'
import { TaskRepository } from './task.repository'
import { TaskService } from './task.service'

@Module({
  controllers: [TaskController],
  providers: [
    {
      provide: 'ITaskService',
      useClass: TaskService
    },
    {
      provide: 'ITaskRepository',
      useClass: TaskRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'ITaskService',
      useClass: TaskService
    }
  ]
})
export class TaskModule {}
