import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateContractUrlDto, UpdateContractUrlDto } from './contract-url.dto'
import type { IContractUrlRepository } from './contract-url.interface'

@Injectable()
export class ContractUrlRepository implements IContractUrlRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateContractUrlDto & { user_id: string }) {
    return this.prisma.contractUrl.create({
      data,
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })
  }

  async findAll(queryOptions: any, _portfolioId?: string) {
    const { where, skip, take, orderBy } = queryOptions

    return this.prisma.contractUrl.findMany({
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
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })
  }

  async count(whereClause: any, _portfolioId?: string): Promise<number> {
    return this.prisma.contractUrl.count({
      where: whereClause
    })
  }

  async findById(id: string) {
    return this.prisma.contractUrl.findUnique({
      where: { id },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })
  }

  async findByPortfolioId(portfolioId: string) {
    return this.prisma.contractUrl.findMany({
      where: {
        portfolio_id: portfolioId
      },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  async findByUserId(userId: string) {
    return this.prisma.contractUrl.findMany({
      where: {
        user_id: userId
      },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  async update(id: string, data: UpdateContractUrlDto) {
    return this.prisma.contractUrl.update({
      where: { id },
      data,
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })
  }

  async delete(id: string) {
    return this.prisma.contractUrl.delete({
      where: { id }
    })
  }
}

