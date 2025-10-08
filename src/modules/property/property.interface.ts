import { Prisma, Property } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  BulkTransferPropertyDto,
  CreatePropertyDto,
  PropertyQueryDto,
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
    batch: {
      select: {
        id: true
        batch_no: true
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
    batch: {
      select: {
        id: true
        batch_no: true
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
  ): Promise<PropertyWithRelations[]>
  count(whereClause: any, propertyIds?: string[]): Promise<number>
  findById(id: string): Promise<PropertyWithFullDetails | null>
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
  ): Promise<PaginatedResult<PropertyWithRelations>>
  findAllForExport(
    query: PropertyQueryDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]>
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
  ): Promise<PropertyWithRelations>
  bulkTransfer(
    data: BulkTransferPropertyDto,
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
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  bulkImport(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<any>
}
