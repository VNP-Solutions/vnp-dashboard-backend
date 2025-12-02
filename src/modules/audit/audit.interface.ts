import { Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AuditQueryDto,
  BulkArchiveAuditDto,
  BulkImportResultDto,
  BulkUpdateResultDto,
  BulkUploadReportDto,
  CreateAuditDto,
  GlobalStatsResponseDto,
  UpdateAuditDto
} from './audit.dto'

type AuditWithRelations = Prisma.AuditGetPayload<{
  include: {
    auditStatus: {
      select: {
        id: true
        status: true
      }
    }
    batch: {
      select: {
        id: true
        batch_no: true
        order: true
      }
    }
    property: {
      select: {
        id: true
        name: true
        is_active: true
        portfolio: {
          select: {
            id: true
            name: true
          }
        }
      }
    }
  }
}>

type AuditWithFullDetails = Prisma.AuditGetPayload<{
  include: {
    auditStatus: {
      select: {
        id: true
        status: true
      }
    }
    batch: {
      select: {
        id: true
        batch_no: true
        order: true
      }
    }
    property: {
      select: {
        id: true
        name: true
        address: true
        is_active: true
        card_descriptor: true
        portfolio: {
          select: {
            id: true
            name: true
            is_active: true
            serviceType: {
              select: {
                id: true
                type: true
              }
            }
          }
        }
        credentials: {
          select: {
            id: true
            expedia_id: true
            agoda_id: true
            booking_id: true
          }
        }
      }
    }
  }
}>

export interface IAuditRepository {
  create(data: CreateAuditDto): Promise<AuditWithRelations>
  findAll(
    queryOptions: any,
    propertyIds?: string[]
  ): Promise<AuditWithRelations[]>
  count(whereClause: any, propertyIds?: string[]): Promise<number>
  findById(id: string): Promise<AuditWithFullDetails | null>
  findByIds(ids: string[]): Promise<AuditWithFullDetails[]>
  update(id: string, data: UpdateAuditDto): Promise<AuditWithRelations>
  archive(id: string): Promise<AuditWithRelations>
  unarchive(id: string): Promise<AuditWithRelations>
  bulkUpdate(
    auditIds: string[],
    data: UpdateAuditDto
  ): Promise<{ count: number }>
  bulkArchive(auditIds: string[]): Promise<{ count: number }>
  delete(id: string): Promise<void>
}

export interface IAuditService {
  create(
    data: CreateAuditDto,
    user: IUserWithPermissions
  ): Promise<AuditWithRelations>
  findAll(
    query: AuditQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<AuditWithRelations>>
  findAllForExport(
    query: AuditQueryDto,
    user: IUserWithPermissions
  ): Promise<AuditWithRelations[]>
  findOne(id: string, user: IUserWithPermissions): Promise<AuditWithFullDetails>
  update(
    id: string,
    data: UpdateAuditDto,
    user: IUserWithPermissions
  ): Promise<AuditWithRelations>
  archive(id: string, user: IUserWithPermissions): Promise<AuditWithRelations>
  unarchive(id: string, user: IUserWithPermissions): Promise<AuditWithRelations>
  bulkUpdate(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<BulkUpdateResultDto>
  bulkArchive(
    data: BulkArchiveAuditDto,
    user: IUserWithPermissions
  ): Promise<{
    message: string
    successfully_archived: number
    failed_to_archive: number
    failed_audits: Array<{ id: string; reason: string }>
  }>
  bulkImport(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<BulkImportResultDto>
  getGlobalStats(user: IUserWithPermissions): Promise<GlobalStatsResponseDto>
  bulkUploadReport(
    data: BulkUploadReportDto,
    user: IUserWithPermissions
  ): Promise<{
    message: string
    updated_count: number
    updated_ids: string[]
  }>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
