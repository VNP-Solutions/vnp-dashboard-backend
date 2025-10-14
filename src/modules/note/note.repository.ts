import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateNoteDto, UpdateNoteDto } from './note.dto'
import type { INoteRepository } from './note.interface'

@Injectable()
export class NoteRepository implements INoteRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateNoteDto) {
    return this.prisma.note.create({
      data,
      include: {
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

    return this.prisma.note.findMany({
      where,
      orderBy,
      include: {
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
    return this.prisma.note.findUnique({
      where: { id },
      include: {
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

  async update(id: string, data: UpdateNoteDto) {
    return this.prisma.note.update({
      where: { id },
      data,
      include: {
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
    return this.prisma.note.delete({
      where: { id }
    })
  }

  async deleteMany(whereClause: any): Promise<number> {
    const result = await this.prisma.note.deleteMany({
      where: whereClause
    })
    return result.count
  }
}
