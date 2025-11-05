import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreateAuditBatchDto,
  UpdateAuditBatchDto
} from './audit-batch.dto'
import type { IAuditBatchRepository } from './audit-batch.interface'

@Injectable()
export class AuditBatchRepository implements IAuditBatchRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateAuditBatchDto) {
    const count = await this.prisma.auditBatch.count()
    return this.prisma.auditBatch.create({
      data: {
        ...data,
        order: count + 1
      }
    })
  }

  async findAll(queryOptions: any) {
    const { where, orderBy } = queryOptions

    return this.prisma.auditBatch.findMany({
      where,
      orderBy,
      include: {
        audits: {
          select: {
            id: true,
            property_id: true,
            start_date: true,
            end_date: true,
            is_archived: true
          }
        }
      }
    })
  }

  async findById(id: string) {
    return this.prisma.auditBatch.findUnique({
      where: { id },
      include: {
        audits: {
          select: {
            id: true,
            property_id: true,
            start_date: true,
            end_date: true,
            is_archived: true
          }
        }
      }
    })
  }

  async findByBatchNo(batchNo: string) {
    return this.prisma.auditBatch.findUnique({
      where: { batch_no: batchNo }
    })
  }

  async update(id: string, data: UpdateAuditBatchDto) {
    return this.prisma.auditBatch.update({
      where: { id },
      data
    })
  }

  async delete(id: string) {
    return this.prisma.auditBatch.delete({
      where: { id }
    })
  }

  async countAudits(batchId: string): Promise<number> {
    return this.prisma.audit.count({
      where: { batch_id: batchId }
    })
  }

  async count(): Promise<number> {
    return this.prisma.auditBatch.count()
  }

  async updateMany(data: Array<{ id: string; order: number }>): Promise<void> {
    await this.prisma.$transaction(
      data.map(item =>
        this.prisma.auditBatch.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    )
  }
}

