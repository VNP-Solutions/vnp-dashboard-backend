import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreatePropertyBatchDto,
  UpdatePropertyBatchDto
} from './property-batch.dto'
import type { IPropertyBatchRepository } from './property-batch.interface'

@Injectable()
export class PropertyBatchRepository implements IPropertyBatchRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreatePropertyBatchDto) {
    const count = await this.prisma.propertyBatch.count()
    return this.prisma.propertyBatch.create({
      data: {
        ...data,
        order: count + 1
      }
    })
  }

  async findAll(queryOptions: any) {
    const { where, orderBy } = queryOptions

    return this.prisma.propertyBatch.findMany({
      where,
      orderBy,
      include: {
        properties: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        }
      }
    })
  }

  async findById(id: string) {
    return this.prisma.propertyBatch.findUnique({
      where: { id },
      include: {
        properties: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        }
      }
    })
  }

  async findByBatchNo(batchNo: string) {
    return this.prisma.propertyBatch.findUnique({
      where: { batch_no: batchNo }
    })
  }

  async update(id: string, data: UpdatePropertyBatchDto) {
    return this.prisma.propertyBatch.update({
      where: { id },
      data
    })
  }

  async delete(id: string) {
    return this.prisma.propertyBatch.delete({
      where: { id }
    })
  }

  async countProperties(batchId: string): Promise<number> {
    return this.prisma.property.count({
      where: { batch_id: batchId }
    })
  }

  async count(): Promise<number> {
    return this.prisma.propertyBatch.count()
  }

  async updateMany(data: Array<{ id: string; order: number }>): Promise<void> {
    await this.prisma.$transaction(
      data.map(item =>
        this.prisma.propertyBatch.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    )
  }
}
