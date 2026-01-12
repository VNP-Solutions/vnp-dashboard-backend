import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePortfolioDto, UpdatePortfolioDto } from './portfolio.dto'
import type { IPortfolioRepository } from './portfolio.interface'

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(
    data: CreatePortfolioDto,
    _userId?: string,
    _isSuperAdmin?: boolean
  ) {
    const { service_type_id, ...portfolioData } = data

    return this.prisma.portfolio.create({
      data: {
        ...portfolioData,
        serviceType: {
          connect: {
            id: service_type_id
          }
        }
      },
      include: {
        serviceType: {
          select: {
            id: true,
            type: true,
            is_active: true
          }
        }
      }
    })
  }

  async findAll(
    queryOptions: any,
    _portfolioIds?: string[],
    userId?: string,
    isSuperAdmin?: boolean
  ) {
    const { where, skip, take, orderBy } = queryOptions

    const portfolios = await this.prisma.portfolio.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        serviceType: {
          select: {
            id: true,
            type: true,
            is_active: true
          }
        },
        pendingActions: {
          where: {
            status: 'PENDING'
          },
          select: {
            id: true,
            action_type: true,
            status: true,
            requested_user_id: true,
            reason: true,
            created_at: true,
            requestedBy: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: {
            created_at: 'desc'
          }
        }
      }
    })

    // Get unique portfolio IDs from the results
    const portfolioIds = portfolios.map(p => p.id)

    // Get property counts and contract URL counts for each portfolio
    const [portfolioCounts, contractUrlCounts] = await Promise.all([
      Promise.all(
        portfolioIds.map(async (portfolioId) => ({
          portfolioId,
          count: await this.prisma.property.count({
            where: { portfolio_id: portfolioId }
          })
        }))
      ),
      Promise.all(
        portfolioIds.map(async (portfolioId) => ({
          portfolioId,
          count: await this.prisma.contractUrl.count({
            where: {
              portfolio_id: portfolioId,
              ...(userId && !isSuperAdmin ? { user_id: userId } : {})
            }
          })
        }))
      )
    ])

    // Create maps for quick lookup
    const propertyCountMap = new Map(
      portfolioCounts.map(pc => [pc.portfolioId, pc.count])
    )
    const contractUrlCountMap = new Map(
      contractUrlCounts.map(cc => [cc.portfolioId, cc.count])
    )

    // Enrich each portfolio with counts
    return portfolios.map(portfolio => ({
      ...portfolio,
      total_properties: propertyCountMap.get(portfolio.id) || 0,
      total_contract_urls: contractUrlCountMap.get(portfolio.id) || 0
    }))
  }

  async count(whereClause: any, _portfolioIds?: string[]): Promise<number> {
    return this.prisma.portfolio.count({
      where: whereClause
    })
  }

  async findById(id: string, userId?: string, isSuperAdmin?: boolean) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      include: {
        serviceType: {
          select: {
            id: true,
            type: true,
            is_active: true
          }
        }
      }
    })

    if (!portfolio) {
      return null
    }

    // Get property count and contract URL count for this portfolio
    const [propertyCount, contractUrlCount] = await Promise.all([
      this.prisma.property.count({
        where: { portfolio_id: id }
      }),
      this.prisma.contractUrl.count({
        where: {
          portfolio_id: id,
          ...(userId && !isSuperAdmin ? { user_id: userId } : {})
        }
      })
    ])

    return {
      ...portfolio,
      total_properties: propertyCount,
      total_contract_urls: contractUrlCount
    }
  }

  async findByName(name: string) {
    return this.prisma.portfolio.findUnique({
      where: { name }
    })
  }

  async update(
    id: string,
    data: UpdatePortfolioDto,
    userId?: string,
    isSuperAdmin?: boolean
  ) {
    const { service_type_id, ...portfolioData } = data

    const updateData: any = {
      ...portfolioData
    }

    // Only include serviceType relation if service_type_id is provided
    if (service_type_id) {
      updateData.serviceType = {
        connect: {
          id: service_type_id
        }
      }
    }

    return this.prisma.portfolio.update({
      where: { id },
      data: updateData,
      include: {
        serviceType: {
          select: {
            id: true,
            type: true,
            is_active: true
          }
        },
        contractUrls: userId
          ? {
              where: isSuperAdmin
                ? undefined
                : {
                    user_id: userId
                  },
              select: {
                id: true,
                url: true,
                description: true,
                is_active: true,
                created_at: true,
                updated_at: true
              }
            }
          : false
      }
    })
  }

  async delete(id: string) {
    return this.prisma.portfolio.delete({
      where: { id }
    })
  }

  async countProperties(portfolioId: string): Promise<number> {
    return this.prisma.property.count({
      where: { portfolio_id: portfolioId }
    })
  }
}
