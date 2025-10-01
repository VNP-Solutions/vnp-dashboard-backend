import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCurrencyDto, UpdateCurrencyDto } from './currency.dto'
import type { ICurrencyRepository } from './currency.interface'

@Injectable()
export class CurrencyRepository implements ICurrencyRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateCurrencyDto) {
    return this.prisma.currency.create({
      data
    })
  }

  async findAll() {
    return this.prisma.currency.findMany({
      include: {
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
    return this.prisma.currency.findUnique({
      where: { id },
      include: {
        properties: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        }
      }
    })
  }

  async findByCode(code: string) {
    return this.prisma.currency.findUnique({
      where: { code }
    })
  }

  async update(id: string, data: UpdateCurrencyDto) {
    return this.prisma.currency.update({
      where: { id },
      data
    })
  }

  async delete(id: string) {
    return this.prisma.currency.delete({
      where: { id }
    })
  }

  async countProperties(currencyId: string): Promise<number> {
    return this.prisma.property.count({
      where: { currency_id: currencyId }
    })
  }
}
