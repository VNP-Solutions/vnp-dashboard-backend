import { Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ApprovePendingActionDto,
  CreatePendingActionDto,
  PendingActionQueryDto
} from './pending-action.dto'

type PendingActionWithRelations = Prisma.PendingActionGetPayload<{
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
    portfolio: {
      select: {
        id: true
        name: true
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

export interface IPendingActionRepository {
  create(data: {
    resource_type: string
    property_id?: string
    portfolio_id?: string
    action_type: string
    requested_user_id: string
    transfer_data?: { new_portfolio_id: string }
  }): Promise<PendingActionWithRelations>
  findAll(queryOptions: {
    where?: any
    include?: any
    orderBy?: any
    skip?: number
    take?: number
  }): Promise<PendingActionWithRelations[]>
  count(where?: any): Promise<number>
  findById(id: string): Promise<PendingActionWithRelations | null>
  update(
    id: string,
    data: {
      status?: string
      approval_user_id?: string
      rejection_reason?: string
      approved_at?: Date
    }
  ): Promise<PendingActionWithRelations>
  findByPropertyId(propertyId: string): Promise<PendingActionWithRelations[]>
  findByPortfolioId(portfolioId: string): Promise<PendingActionWithRelations[]>
  findByStatus(status: string): Promise<PendingActionWithRelations[]>
}

export interface IPendingActionService {
  create(
    data: CreatePendingActionDto,
    user: IUserWithPermissions
  ): Promise<PendingActionWithRelations>
  findAll(
    query: PendingActionQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PendingActionWithRelations>>
  findOne(id: string, user: IUserWithPermissions): Promise<PendingActionWithRelations>
  approve(
    id: string,
    data: ApprovePendingActionDto,
    user: IUserWithPermissions
  ): Promise<PendingActionWithRelations>
  reject(
    id: string,
    data: ApprovePendingActionDto,
    user: IUserWithPermissions
  ): Promise<PendingActionWithRelations>
  findByPropertyId(
    propertyId: string
  ): Promise<PendingActionWithRelations[]>
  findByPortfolioId(
    portfolioId: string
  ): Promise<PendingActionWithRelations[]>
}
