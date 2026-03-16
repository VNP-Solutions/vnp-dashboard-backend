import { Prisma, Property } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  BulkTransferPropertyDto,
  BulkUpdateResultDto,
  CompleteBankDetailsDto,
  CompleteCreatePropertyDto,
  CompletePropertyCredentialsDto,
  CompleteUpdatePropertyDto,
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
}> & {
  total_audits: number
  total_contract_urls: number
}

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
        expedia_amount_collectable: true
        expedia_amount_confirmed: true
        agoda_amount_collectable: true
        agoda_amount_confirmed: true
        booking_amount_collectable: true
        booking_amount_confirmed: true
        start_date: true
        end_date: true
      }
    }
  }
}> & {
  total_notes?: number
  total_contract_urls?: number
}

export interface IPropertyRepository {
  create(data: CreatePropertyDto): Promise<PropertyWithRelations>
  completeCreate(
    propertyData: CreatePropertyDto,
    credentialsData?: CompletePropertyCredentialsDto,
    bankDetailsData?: CompleteBankDetailsDto,
    userId?: string
  ): Promise<PropertyWithFullDetails>
  completeUpdate(
    propertyId: string,
    propertyData?: UpdatePropertyDto,
    credentialsData?: CompletePropertyCredentialsDto,
    bankDetailsData?: CompleteBankDetailsDto,
    userId?: string
  ): Promise<PropertyWithFullDetails>
  findAll(
    queryOptions: any,
    propertyIds?: string[],
    hasAuditAccess?: boolean
  ): Promise<PropertyWithPendingActions[]>
  count(whereClause: any, propertyIds?: string[]): Promise<number>
  findById(id: string): Promise<PropertyWithFullDetails | null>
  findByIds(ids: string[]): Promise<Property[]>
  findByName(name: string): Promise<Property | null>
  findByExpediaId(expediaId: string): Promise<Property | null>
  update(id: string, data: UpdatePropertyDto): Promise<PropertyWithRelations>
  delete(id: string): Promise<Property>
  countAudits(propertyId: string): Promise<number>
}

export interface IPropertyService {
  create(
    data: CreatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  completeCreate(
    data: CompleteCreatePropertyDto,
    user: IUserWithPermissions,
    location?: string | null
  ): Promise<PropertyWithFullDetails>
  completeUpdate(
    id: string,
    data: CompleteUpdatePropertyDto,
    user: IUserWithPermissions,
    location?: string | null
  ): Promise<PropertyWithFullDetails>
  findAll(
    query: PropertyQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PropertyWithPendingActions>>
  findAllForExport(
    query: PropertyQueryDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithPendingActions[]>
  findOneSecure(
    id: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithFullDetails>
  findAllSecure(
    query: PropertyQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PropertyWithPendingActions>>
  findManyByIdsSecure(
    propertyIds: string[],
    user: IUserWithPermissions
  ): Promise<PropertyWithFullDetails[]>
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
  bulkDelete(
    property_ids: string[],
    password: string,
    user: IUserWithPermissions
  ): Promise<{
    success: number
    failed: number
    results: Array<{
      property_id: string
      success: boolean
      message?: string
    }>
  }>
  deactivate(
    id: string,
    user: IUserWithPermissions,
    reason?: string
  ): Promise<{ message: string; pending_action?: any }>
  activate(
    id: string,
    user: IUserWithPermissions,
    reason?: string
  ): Promise<{ message: string; pending_action?: any }>
  bulkImport(
    file: Express.Multer.File,
    user: IUserWithPermissions,
    location?: string | null
  ): Promise<any>
  bulkUpdate(
    file: Express.Multer.File,
    user: IUserWithPermissions,
    location?: string | null
  ): Promise<BulkUpdateResultDto>
  getStats(
    propertyId: string,
    user: IUserWithPermissions
  ): Promise<PropertyStatsResponseDto>
}
