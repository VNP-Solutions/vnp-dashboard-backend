import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAuditBatchDto, UpdateAuditBatchDto } from './audit-batch.dto'
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
      orderBy
    })
  }

  async findById(id: string) {
    return this.prisma.auditBatch.findUnique({
      where: { id }
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
    const updates = data.map(item =>
      this.prisma.auditBatch.update({
        where: { id: item.id },
        data: { order: item.order }
      })
    )

    await this.prisma.$transaction([...updates] as any, {
      timeout: 10000 // 10 seconds timeout for bulk order updates
    })
  }
}
