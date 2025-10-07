import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyCredentialsRepository } from './property-credentials.interface'

@Injectable()
export class PropertyCredentialsRepository
  implements IPropertyCredentialsRepository
{
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.propertyCredentials.create({
      data
    })
  }

  async findAll(queryOptions: any, propertyIds?: string[]) {
    const { where, skip, take, orderBy } = queryOptions

    return this.prisma.propertyCredentials.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        }
      }
    })
  }

  async count(whereClause: any, propertyIds?: string[]): Promise<number> {
    return this.prisma.propertyCredentials.count({
      where: whereClause
    })
  }

  async findByPropertyId(propertyId: string) {
    return this.prisma.propertyCredentials.findUnique({
      where: { property_id: propertyId }
    })
  }

  async update(propertyId: string, data: any) {
    return this.prisma.propertyCredentials.update({
      where: { property_id: propertyId },
      data
    })
  }

  async delete(id: string) {
    return this.prisma.propertyCredentials.delete({
      where: { id }
    })
  }
}
