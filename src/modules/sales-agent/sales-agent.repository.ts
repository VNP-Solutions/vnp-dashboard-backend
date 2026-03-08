import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateSalesAgentDto, UpdateSalesAgentDto } from './sales-agent.dto'
import type { ISalesAgentRepository } from './sales-agent.interface'

@Injectable()
export class SalesAgentRepository implements ISalesAgentRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateSalesAgentDto) {
    return this.prisma.salesAgent.create({
      data: {
        full_name: data.full_name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        commission: data.commission,
        documents: data.documents ?? []
      }
    })
  }

  async findAll(queryOptions: any) {
    const { where, skip, take, orderBy } = queryOptions
    return this.prisma.salesAgent.findMany({ where, skip, take, orderBy })
  }

  async count(whereClause: any): Promise<number> {
    return this.prisma.salesAgent.count({ where: whereClause })
  }

  async findById(id: string) {
    return this.prisma.salesAgent.findUnique({
      where: { id },
      include: {
        portfolios: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        }
      }
    })
  }

  async findByEmail(email: string) {
    return this.prisma.salesAgent.findUnique({ where: { email } })
  }

  async update(id: string, data: UpdateSalesAgentDto) {
    return this.prisma.salesAgent.update({
      where: { id },
      data: {
        ...(data.full_name !== undefined && { full_name: data.full_name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.commission !== undefined && { commission: data.commission }),
        ...(data.documents !== undefined && { documents: data.documents })
      }
    })
  }

  async delete(id: string) {
    return this.prisma.salesAgent.delete({ where: { id } })
  }
}
