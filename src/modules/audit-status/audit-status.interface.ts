import { AuditStatus, Prisma } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateAuditStatusDto, ReorderAuditStatusDto, UpdateAuditStatusDto } from './audit-status.dto'

type AuditStatusWithRelations = Prisma.AuditStatusGetPayload<{
  include: {
    audits: {
      select: {
        id: true
        property_id: true
        start_date: true
        end_date: true
        is_archived: true
      }
    }
  }
}>

export interface IAuditStatusRepository {
  create(data: CreateAuditStatusDto): Promise<AuditStatus>
  findAll(): Promise<AuditStatus[]>
  findById(id: string): Promise<AuditStatusWithRelations | null>
  findByStatus(status: string): Promise<AuditStatus | null>
  update(id: string, data: UpdateAuditStatusDto): Promise<AuditStatus>
  delete(id: string): Promise<AuditStatus>
  countAudits(auditStatusId: string): Promise<number>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IAuditStatusService {
  create(
    data: CreateAuditStatusDto,
    user: IUserWithPermissions
  ): Promise<AuditStatus>
  findAll(user: IUserWithPermissions): Promise<AuditStatus[]>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<AuditStatusWithRelations>
  update(
    id: string,
    data: UpdateAuditStatusDto,
    user: IUserWithPermissions
  ): Promise<AuditStatus>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  reorder(id: string, data: ReorderAuditStatusDto, user: IUserWithPermissions): Promise<{ message: string }>
}
