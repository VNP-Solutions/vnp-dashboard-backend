import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreateConsolidatedReportDto,
  UpdateConsolidatedReportDto
} from './consolidated-report.dto'
import type { IConsolidatedReportRepository } from './consolidated-report.interface'

@Injectable()
export class ConsolidatedReportRepository
  implements IConsolidatedReportRepository
{
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateConsolidatedReportDto) {
    return this.prisma.consolidatedReport.create({
      data,
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async findAll(queryOptions: any, _portfolioId?: string) {
    const { where, skip, take, orderBy } = queryOptions

    return this.prisma.consolidatedReport.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async count(whereClause: any, _portfolioId?: string): Promise<number> {
    return this.prisma.consolidatedReport.count({
      where: whereClause
    })
  }

  async findById(id: string) {
    return this.prisma.consolidatedReport.findUnique({
      where: { id },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        }
      }
    })
  }

  async findByPortfolioId(portfolioId: string) {
    return this.prisma.consolidatedReport.findMany({
      where: {
        portfolio_id: portfolioId
      },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  async update(id: string, data: UpdateConsolidatedReportDto) {
    return this.prisma.consolidatedReport.update({
      where: { id },
      data,
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async delete(id: string) {
    return this.prisma.consolidatedReport.delete({
      where: { id }
    })
  }
}
