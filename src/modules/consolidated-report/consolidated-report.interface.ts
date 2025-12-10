import { ConsolidatedReport, Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  BulkCreateConsolidatedReportDto,
  BulkCreateResultDto,
  ConsolidatedReportQueryDto,
  CreateConsolidatedReportDto,
  UpdateConsolidatedReportDto
} from './consolidated-report.dto'

type ConsolidatedReportWithRelations = Prisma.ConsolidatedReportGetPayload<{
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

type ConsolidatedReportWithFullDetails = Prisma.ConsolidatedReportGetPayload<{
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

export interface IConsolidatedReportRepository {
  create(
    data: CreateConsolidatedReportDto & { user_id: string }
  ): Promise<ConsolidatedReportWithRelations>
  findAll(
    queryOptions: any,
    portfolioId?: string
  ): Promise<ConsolidatedReportWithRelations[]>
  count(whereClause: any, portfolioId?: string): Promise<number>
  findById(id: string): Promise<ConsolidatedReportWithFullDetails | null>
  findByPortfolioId(portfolioId: string): Promise<ConsolidatedReportWithRelations[]>
  update(
    id: string,
    data: UpdateConsolidatedReportDto
  ): Promise<ConsolidatedReportWithRelations>
  delete(id: string): Promise<ConsolidatedReport>
}

export interface IConsolidatedReportService {
  create(
    data: CreateConsolidatedReportDto,
    user: IUserWithPermissions
  ): Promise<ConsolidatedReportWithRelations>
  bulkCreate(
    data: BulkCreateConsolidatedReportDto,
    user: IUserWithPermissions
  ): Promise<BulkCreateResultDto>
  findAll(
    query: ConsolidatedReportQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<ConsolidatedReportWithRelations>>
  findAllForExport(
    query: ConsolidatedReportQueryDto,
    user: IUserWithPermissions
  ): Promise<ConsolidatedReportWithRelations[]>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<ConsolidatedReportWithFullDetails>
  findByPortfolio(
    portfolioId: string,
    user: IUserWithPermissions
  ): Promise<ConsolidatedReportWithRelations[]>
  update(
    id: string,
    data: UpdateConsolidatedReportDto,
    user: IUserWithPermissions
  ): Promise<ConsolidatedReportWithRelations>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
