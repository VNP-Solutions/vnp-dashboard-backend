import { Portfolio, Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreatePortfolioDto,
  PortfolioQueryDto,
  UpdatePortfolioDto
} from './portfolio.dto'

type PortfolioWithServiceType = Prisma.PortfolioGetPayload<{
  include: {
    serviceType: {
      select: {
        id: true
        type: true
        is_active: true
      }
    }
  }
}>

type PortfolioWithRelations = Prisma.PortfolioGetPayload<{
  include: {
    serviceType: {
      select: {
        id: true
        type: true
        is_active: true
      }
    }
    properties: {
      select: {
        id: true
        name: true
        is_active: true
      }
    }
  }
}>

type PortfolioWithFullDetails = Prisma.PortfolioGetPayload<{
  include: {
    serviceType: {
      select: {
        id: true
        type: true
        is_active: true
      }
    }
    properties: {
      select: {
        id: true
        name: true
        address: true
        is_active: true
        card_descriptor: true
        next_due_date: true
      }
    }
  }
}>

export interface IPortfolioRepository {
  create(data: CreatePortfolioDto): Promise<PortfolioWithServiceType>
  findAll(
    queryOptions: any,
    portfolioIds?: string[]
  ): Promise<PortfolioWithRelations[]>
  count(whereClause: any, portfolioIds?: string[]): Promise<number>
  findById(id: string): Promise<PortfolioWithFullDetails | null>
  findByName(name: string): Promise<Portfolio | null>
  update(
    id: string,
    data: UpdatePortfolioDto
  ): Promise<PortfolioWithServiceType>
  delete(id: string): Promise<Portfolio>
  countProperties(portfolioId: string): Promise<number>
}

export interface IPortfolioService {
  create(
    data: CreatePortfolioDto,
    user: IUserWithPermissions
  ): Promise<PortfolioWithServiceType>
  findAll(
    query: PortfolioQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PortfolioWithRelations>>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<PortfolioWithFullDetails>
  update(
    id: string,
    data: UpdatePortfolioDto,
    user: IUserWithPermissions
  ): Promise<PortfolioWithServiceType>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
