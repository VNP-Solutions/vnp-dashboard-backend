import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePortfolioDto, UpdatePortfolioDto } from './portfolio.dto'

@Injectable()
export class PortfolioRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: CreatePortfolioDto) {
    return this.prisma.portfolio.create({
      data,
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

  async findAll(portfolioIds?: string[]) {
    return this.prisma.portfolio.findMany({
      where: portfolioIds
        ? {
            id: {
              in: portfolioIds
            }
          }
        : undefined,
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
            id: true,
            name: true,
            is_active: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  async findById(id: string) {
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
            id: true,
            name: true,
            address: true,
            is_active: true,
            card_descriptor: true,
            next_due_date: true
          }
        }
      }
    })
  }

  async findByName(name: string) {
    return this.prisma.portfolio.findUnique({
      where: { name }
    })
  }

  async update(id: string, data: UpdatePortfolioDto) {
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
        }
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
