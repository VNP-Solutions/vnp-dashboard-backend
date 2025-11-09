import { Prisma, Property } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  BulkTransferPropertyDto,
  CreatePropertyDto,
  GetPropertiesByPortfoliosDto,
  PropertyQueryDto,
  PropertyStatsResponseDto,
  SharePropertyDto,
  TransferPropertyDto,
  UnsharePropertyDto,
  UpdatePropertyDto
} from './property.dto'

type PropertyWithRelations = Prisma.PropertyGetPayload<{
  include: {
    currency: {
      select: {
        id: true
        code: true
        name: true
        symbol: true
      }
    }
    portfolio: {
      select: {
        id: true
        name: true
        is_active: true
      }
    }
  }
}>

type PropertyWithPendingActions = Prisma.PropertyGetPayload<{
  include: {
    currency: {
      select: {
        id: true
        code: true
        name: true
        symbol: true
      }
    }
    portfolio: {
      select: {
        id: true
        name: true
        is_active: true
      }
    }
    pendingActions: {
      select: {
        id: true
        action_type: true
        status: true
        transfer_data: true
        requested_user_id: true
        created_at: true
        requestedBy: {
          select: {
            id: true
            email: true
            first_name: true
            last_name: true
          }
        }
      }
    }
  }
}>

type PropertyWithFullDetails = Prisma.PropertyGetPayload<{
  include: {
    currency: {
      select: {
        id: true
        code: true
        name: true
        symbol: true
      }
    }
    portfolio: {
      select: {
        id: true
        name: true
        is_active: true
        service_type_id: true
        serviceType: {
          select: {
            id: true
            type: true
          }
        }
      }
    }
    credentials: true
    bankDetails: true
    audits: {
      select: {
        id: true
        type_of_ota: true
        audit_status_id: true
        amount_collectable: true
        amount_confirmed: true
        start_date: true
        end_date: true
      }
    }
  }
}>

export interface IPropertyRepository {
  create(data: CreatePropertyDto): Promise<PropertyWithRelations>
  findAll(
    queryOptions: any,
    propertyIds?: string[]
  ): Promise<PropertyWithPendingActions[]>
  count(whereClause: any, propertyIds?: string[]): Promise<number>
  findById(id: string): Promise<PropertyWithFullDetails | null>
  findByIds(ids: string[]): Promise<Property[]>
  findByName(name: string): Promise<Property | null>
  update(id: string, data: UpdatePropertyDto): Promise<PropertyWithRelations>
  delete(id: string): Promise<Property>
  countAudits(propertyId: string): Promise<number>
}

export interface IPropertyService {
  create(
    data: CreatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  findAll(
    query: PropertyQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PropertyWithPendingActions>>
  findAllForExport(
    query: PropertyQueryDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithPendingActions[]>
  getPropertiesByPortfolios(
    data: GetPropertiesByPortfoliosDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithPendingActions[]>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithFullDetails>
  update(
    id: string,
    data: UpdatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  transfer(
    id: string,
    data: TransferPropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations | { message: string; pending_action: any }>
  bulkTransfer(
    data: BulkTransferPropertyDto,
    user: IUserWithPermissions
  ): Promise<
    | { message: string; pending_action: any }
    | {
        success: number
        failed: number
        results: Array<{
          property_id: string
          success: boolean
          message?: string
        }>
      }
  >
  share(
    id: string,
    data: SharePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  unshare(
    id: string,
    data: UnsharePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  remove(
    id: string,
    user: IUserWithPermissions
  ): Promise<{ message: string; pending_action?: any }>
  bulkImport(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<any>
  getStats(
    propertyId: string,
    user: IUserWithPermissions
  ): Promise<PropertyStatsResponseDto>
}
