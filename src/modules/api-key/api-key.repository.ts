import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type {
  ApiKeyWithPortfolio,
  IApiKeyRepository
} from './api-key.interface'

const portfolioInclude = {
  portfolio: {
    select: {
      id: true,
      name: true,
      is_active: true
    }
  }
} as const

@Injectable()
export class ApiKeyRepository implements IApiKeyRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: {
    api_key: string
    key_hash: string
    portfolio_id: string
    is_active: boolean
  }): Promise<ApiKeyWithPortfolio> {
    return this.prisma.apiKey.create({
      data,
      include: portfolioInclude
    })
  }

  async findAll(): Promise<ApiKeyWithPortfolio[]> {
    return this.prisma.apiKey.findMany({
      include: portfolioInclude,
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  async findById(id: string): Promise<ApiKeyWithPortfolio | null> {
    return this.prisma.apiKey.findUnique({
      where: { id },
      include: portfolioInclude
    })
  }

  async findByKeyHash(key_hash: string): Promise<ApiKeyWithPortfolio | null> {
    return this.prisma.apiKey.findUnique({
      where: { key_hash },
      include: portfolioInclude
    })
  }

  async updateActive(
    id: string,
    is_active: boolean
  ): Promise<ApiKeyWithPortfolio> {
    return this.prisma.apiKey.update({
      where: { id },
      data: { is_active },
      include: portfolioInclude
    })
  }

  async delete(id: string): Promise<ApiKeyWithPortfolio> {
    return this.prisma.apiKey.delete({
      where: { id },
      include: portfolioInclude
    })
  }
}
