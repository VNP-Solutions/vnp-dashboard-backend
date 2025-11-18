import { Portfolio, Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { AttachmentUrlDto, EmailAttachment } from '../email/email.dto'
import {
  CreatePortfolioDto,
  PortfolioQueryDto,
  PortfolioStatsQueryDto,
  PortfolioStatsResponseDto,
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
  }
}> & {
  total_properties: number
  total_contract_urls: number
}

type PortfolioWithFullDetails = Prisma.PortfolioGetPayload<{
  include: {
    serviceType: {
      select: {
        id: true
        type: true
        is_active: true
      }
    }
  }
}> & {
  total_properties: number
  total_contract_urls: number
}

export interface IPortfolioRepository {
  create(
    data: CreatePortfolioDto,
    userId?: string,
    isSuperAdmin?: boolean
  ): Promise<PortfolioWithServiceType>
  findAll(
    queryOptions: any,
    portfolioIds?: string[],
    userId?: string,
    isSuperAdmin?: boolean
  ): Promise<PortfolioWithRelations[]>
  count(whereClause: any, portfolioIds?: string[]): Promise<number>
  findById(
    id: string,
    userId?: string,
    isSuperAdmin?: boolean
  ): Promise<PortfolioWithFullDetails | null>
  findByName(name: string): Promise<Portfolio | null>
  update(
    id: string,
    data: UpdatePortfolioDto,
    userId?: string,
    isSuperAdmin?: boolean
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
  findAllForExport(
    query: PortfolioQueryDto,
    user: IUserWithPermissions
  ): Promise<PortfolioWithRelations[]>
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
  sendEmail(
    id: string,
    subject: string,
    body: string,
    user: IUserWithPermissions,
    uploadedAttachments?: EmailAttachment[],
    attachmentUrls?: AttachmentUrlDto[]
  ): Promise<{ message: string }>
  bulkImport(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<any>
  getStats(
    portfolioId: string,
    query: PortfolioStatsQueryDto,
    user: IUserWithPermissions
  ): Promise<PortfolioStatsResponseDto>
}
