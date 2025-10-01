import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './service-type.dto'
import type { IServiceTypeRepository } from './service-type.interface'

@Injectable()
export class ServiceTypeRepository implements IServiceTypeRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateServiceTypeDto) {
    return this.prisma.serviceType.create({
      data
    })
  }

  async findAll() {
    return this.prisma.serviceType.findMany({
      include: {
        portfolios: {
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
    return this.prisma.serviceType.findUnique({
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

  async findByType(type: string) {
    return this.prisma.serviceType.findUnique({
      where: { type }
    })
  }

  async update(id: string, data: UpdateServiceTypeDto) {
    return this.prisma.serviceType.update({
      where: { id },
      data
    })
  }

  async delete(id: string) {
    return this.prisma.serviceType.delete({
      where: { id }
    })
  }

  async countPortfolios(serviceTypeId: string): Promise<number> {
    return this.prisma.portfolio.count({
      where: { service_type_id: serviceTypeId }
    })
  }
}
