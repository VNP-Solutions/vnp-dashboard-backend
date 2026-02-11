import { Prisma, Task } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreateTaskDto,
  DeleteAllTasksDto,
  TaskQueryDto,
  UpdateTaskDto
} from './task.dto'

type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    user: {
      select: {
        id: true
        email: true
        first_name: true
        last_name: true
      }
    }
    portfolio: {
      select: {
        id: true
        name: true
      }
    }
    property: {
      select: {
        id: true
        name: true
      }
    }
    audit: {
      select: {
        id: true
        type_of_ota: true
        start_date: true
        end_date: true
      }
    }
  }
}>

export interface ITaskRepository {
  create(data: CreateTaskDto & { user_id: string }): Promise<TaskWithRelations>
  findAll(queryOptions: any): Promise<TaskWithRelations[]>
  findById(id: string): Promise<TaskWithRelations | null>
  findAuditById(auditId: string): Promise<{ property_id: string } | null>
  update(id: string, data: UpdateTaskDto): Promise<TaskWithRelations>
  delete(id: string): Promise<Task>
  deleteMany(whereClause: any): Promise<number>
}

export interface ITaskService {
  create(
    data: CreateTaskDto,
    user: IUserWithPermissions
  ): Promise<TaskWithRelations>
  findAll(
    query: TaskQueryDto,
    user: IUserWithPermissions
  ): Promise<TaskWithRelations[]>
  findOne(id: string, user: IUserWithPermissions): Promise<TaskWithRelations>
  update(
    id: string,
    data: UpdateTaskDto,
    user: IUserWithPermissions
  ): Promise<TaskWithRelations>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  removeAll(
    query: DeleteAllTasksDto,
    user: IUserWithPermissions
  ): Promise<{ message: string; deletedCount: number }>
}
