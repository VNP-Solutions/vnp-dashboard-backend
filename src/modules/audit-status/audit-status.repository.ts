import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAuditStatusDto, UpdateAuditStatusDto } from './audit-status.dto'
import type { IAuditStatusRepository } from './audit-status.interface'

@Injectable()
export class AuditStatusRepository implements IAuditStatusRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateAuditStatusDto) {
    return this.prisma.auditStatus.create({
      data
    })
  }

  async findAll() {
    return this.prisma.auditStatus.findMany({
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  async findById(id: string) {
    return this.prisma.auditStatus.findUnique({
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

  async findByStatus(status: string) {
    return this.prisma.auditStatus.findFirst({
      where: { status }
    })
  }

  async update(id: string, data: UpdateAuditStatusDto) {
    return this.prisma.auditStatus.update({
      where: { id },
      data
    })
  }

  async delete(id: string) {
    return this.prisma.auditStatus.delete({
      where: { id }
    })
  }

  async countAudits(auditStatusId: string): Promise<number> {
    return this.prisma.audit.count({
      where: { audit_status_id: auditStatusId }
    })
  }
}
