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
  }
}>

export interface ITaskRepository {
  create(data: CreateTaskDto): Promise<TaskWithRelations>
  findAll(queryOptions: any): Promise<TaskWithRelations[]>
  findById(id: string): Promise<TaskWithRelations | null>
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
