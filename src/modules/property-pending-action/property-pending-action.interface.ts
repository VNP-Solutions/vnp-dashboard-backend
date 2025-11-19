import { Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ApprovePropertyPendingActionDto,
  CreatePropertyPendingActionDto,
  PropertyPendingActionQueryDto
} from './property-pending-action.dto'

type PropertyPendingActionWithRelations = Prisma.PropertyPendingActionGetPayload<{
  include: {
    property: {
      select: {
        id: true
        name: true
        portfolio_id: true
        portfolio: {
          select: {
            id: true
            name: true
          }
        }
      }
    }
    requestedBy: {
      select: {
        id: true
        email: true
        first_name: true
        last_name: true
      }
    }
    approvedBy: {
      select: {
        id: true
        email: true
        first_name: true
        last_name: true
      }
    }
  }
}>

export interface IPropertyPendingActionRepository {
  create(data: {
    property_id: string
    action_type: string
    requested_user_id: string
    transfer_data?: { new_portfolio_id: string }
  }): Promise<PropertyPendingActionWithRelations>
  findAll(queryOptions: {
    where?: any
    include?: any
    orderBy?: any
    skip?: number
    take?: number
  }): Promise<PropertyPendingActionWithRelations[]>
  count(where?: any): Promise<number>
  findById(id: string): Promise<PropertyPendingActionWithRelations | null>
  update(
    id: string,
    data: {
      status?: string
      approval_user_id?: string
      rejection_reason?: string
      approved_at?: Date
    }
  ): Promise<PropertyPendingActionWithRelations>
  findByPropertyId(propertyId: string): Promise<PropertyPendingActionWithRelations[]>
  findByStatus(status: string): Promise<PropertyPendingActionWithRelations[]>
}

export interface IPropertyPendingActionService {
  create(
    data: CreatePropertyPendingActionDto,
    user: IUserWithPermissions
  ): Promise<PropertyPendingActionWithRelations>
  findAll(
    query: PropertyPendingActionQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PropertyPendingActionWithRelations>>
  findOne(id: string, user: IUserWithPermissions): Promise<PropertyPendingActionWithRelations>
  approve(
    id: string,
    data: ApprovePropertyPendingActionDto,
    user: IUserWithPermissions
  ): Promise<PropertyPendingActionWithRelations>
  reject(
    id: string,
    data: ApprovePropertyPendingActionDto,
    user: IUserWithPermissions
  ): Promise<PropertyPendingActionWithRelations>
  findByPropertyId(
    propertyId: string
  ): Promise<PropertyPendingActionWithRelations[]>
}
