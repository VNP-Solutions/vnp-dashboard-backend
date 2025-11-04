import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePortfolioDto, UpdatePortfolioDto } from './portfolio.dto'
import type { IPortfolioRepository } from './portfolio.interface'

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreatePortfolioDto, userId?: string, isSuperAdmin?: boolean) {
    return this.prisma.portfolio.create({
      data,
      include: {
        serviceType: {
          select: {
            id: true,
            type: true,
            is_active: true
          }
        },
        contractUrls: userId ? {
          where: isSuperAdmin ? undefined : {
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
        } : false
      }
    })
  }

  async findAll(queryOptions: any, _portfolioIds?: string[], userId?: string, isSuperAdmin?: boolean) {
    const { where, skip, take, orderBy } = queryOptions

    return this.prisma.portfolio.findMany({
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
        properties: {
          select: {
            id: true
          }
        },
        contractUrls: {
          where: (userId && !isSuperAdmin) ? {
            user_id: userId
          } : undefined,
          select: {
            id: true,
            url: true,
            description: true,
            is_active: true,
            created_at: true,
            updated_at: true
          }
        }
      }
    })
  }

  async count(whereClause: any, _portfolioIds?: string[]): Promise<number> {
    return this.prisma.portfolio.count({
      where: whereClause
    })
  }

  async findById(id: string, userId?: string, isSuperAdmin?: boolean) {
    return this.prisma.portfolio.findUnique({
      where: { id },
      include: {
        serviceType: {
          select: {
            id: true,
            type: true,
            is_active: true
          }
        },
        properties: {
          select: {
            id: true
          }
        },
        contractUrls: userId ? {
          where: isSuperAdmin ? undefined : {
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
        } : false
      }
    })
  }

  async findByName(name: string) {
    return this.prisma.portfolio.findUnique({
      where: { name }
    })
  }

  async update(id: string, data: UpdatePortfolioDto, userId?: string, isSuperAdmin?: boolean) {
    return this.prisma.portfolio.update({
      where: { id },
      data,
      include: {
        serviceType: {
          select: {
            id: true,
            type: true,
            is_active: true
          }
        },
        contractUrls: userId ? {
          where: isSuperAdmin ? undefined : {
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
        } : false
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
