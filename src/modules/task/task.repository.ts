import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateTaskDto, UpdateTaskDto } from './task.dto'
import type { ITaskRepository } from './task.interface'

@Injectable()
export class TaskRepository implements ITaskRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateTaskDto & { user_id: string }) {
    return this.prisma.task.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        property: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async findAll(queryOptions: any) {
    const { where, orderBy } = queryOptions

    return this.prisma.task.findMany({
      where,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        property: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async findById(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        property: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async update(id: string, data: UpdateTaskDto) {
    return this.prisma.task.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        property: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async delete(id: string) {
    return this.prisma.task.delete({
      where: { id }
    })
  }

  async deleteMany(whereClause: any): Promise<number> {
    const result = await this.prisma.task.deleteMany({
      where: whereClause
    })
    return result.count
  }
}
