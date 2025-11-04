import { ContractUrl, Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ContractUrlQueryDto,
  CreateContractUrlDto,
  UpdateContractUrlDto
} from './contract-url.dto'

type ContractUrlWithRelations = Prisma.ContractUrlGetPayload<{
  include: {
    portfolio: {
      select: {
        id: true
        name: true
      }
    }
    user: {
      select: {
        id: true
        first_name: true
        last_name: true
        email: true
      }
    }
  }
}>

type ContractUrlWithFullDetails = Prisma.ContractUrlGetPayload<{
  include: {
    portfolio: {
      select: {
        id: true
        name: true
        is_active: true
      }
    }
    user: {
      select: {
        id: true
        first_name: true
        last_name: true
        email: true
      }
    }
  }
}>

export interface IContractUrlRepository {
  create(
    data: CreateContractUrlDto & { user_id: string }
  ): Promise<ContractUrlWithRelations>
  findAll(
    queryOptions: any,
    portfolioId?: string
  ): Promise<ContractUrlWithRelations[]>
  count(whereClause: any, portfolioId?: string): Promise<number>
  findById(id: string): Promise<ContractUrlWithFullDetails | null>
  findByPortfolioId(portfolioId: string): Promise<ContractUrlWithRelations[]>
  findByUserId(userId: string): Promise<ContractUrlWithRelations[]>
  update(
    id: string,
    data: UpdateContractUrlDto
  ): Promise<ContractUrlWithRelations>
  delete(id: string): Promise<ContractUrl>
}

export interface IContractUrlService {
  create(
    data: CreateContractUrlDto,
    user: IUserWithPermissions
  ): Promise<ContractUrlWithRelations>
  findAll(
    query: ContractUrlQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<ContractUrlWithRelations>>
  findAllForExport(
    query: ContractUrlQueryDto,
    user: IUserWithPermissions
  ): Promise<ContractUrlWithRelations[]>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<ContractUrlWithFullDetails>
  findByPortfolio(
    portfolioId: string,
    user: IUserWithPermissions
  ): Promise<ContractUrlWithRelations[]>
  update(
    id: string,
    data: UpdateContractUrlDto,
    user: IUserWithPermissions
  ): Promise<ContractUrlWithRelations>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
