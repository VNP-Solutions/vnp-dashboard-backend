import { SalesAgent, Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreateSalesAgentDto,
  SalesAgentQueryDto,
  SalesAgentReportQueryDto,
  UpdateSalesAgentDto
} from './sales-agent.dto'

export type SalesAgentWithPortfolios = Prisma.SalesAgentGetPayload<{
  include: {
    portfolios: {
      select: {
        id: true
        name: true
        is_active: true
      }
    }
  }
}>

export interface ISalesAgentRepository {
  create(data: CreateSalesAgentDto): Promise<SalesAgent>
  findAll(queryOptions: any): Promise<SalesAgent[]>
  count(whereClause: any): Promise<number>
  findById(id: string): Promise<SalesAgentWithPortfolios | null>
  findByEmail(email: string): Promise<SalesAgent | null>
  update(id: string, data: UpdateSalesAgentDto): Promise<SalesAgent>
  delete(id: string): Promise<SalesAgent>
}

export interface ISalesAgentService {
  create(
    data: CreateSalesAgentDto,
    user: IUserWithPermissions
  ): Promise<SalesAgent>
  findAll(
    query: SalesAgentQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<SalesAgent>>
  findOne(id: string, user: IUserWithPermissions): Promise<SalesAgentWithPortfolios>
  update(
    id: string,
    data: UpdateSalesAgentDto,
    user: IUserWithPermissions
  ): Promise<SalesAgent>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  downloadReport(
    id: string,
    query: SalesAgentReportQueryDto,
    user: IUserWithPermissions
  ): Promise<Buffer>
}
