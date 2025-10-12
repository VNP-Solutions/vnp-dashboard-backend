import { Audit, Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { AuditQueryDto, CreateAuditDto, UpdateAuditDto } from './audit.dto'

type AuditWithRelations = Prisma.AuditGetPayload<{
  include: {
    auditStatus: {
      select: {
        id: true
        status: true
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
  update(id: string, data: UpdateAuditDto): Promise<AuditWithRelations>
  delete(id: string): Promise<Audit>
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
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
