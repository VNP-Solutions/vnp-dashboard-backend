import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreatePropertyContractUrlDto,
  UpdatePropertyContractUrlDto
} from './property-contract-url.dto'
import type { IPropertyContractUrlRepository } from './property-contract-url.interface'

@Injectable()
export class PropertyContractUrlRepository implements IPropertyContractUrlRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreatePropertyContractUrlDto & { user_id: string }) {
    return this.prisma.propertyContractUrl.create({
      data,
      include: {
        property: {
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

  async findAll(queryOptions: any, _propertyId?: string) {
    const { where, skip, take, orderBy } = queryOptions

    return this.prisma.propertyContractUrl.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        property: {
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

  async count(whereClause: any, _propertyId?: string): Promise<number> {
    return this.prisma.propertyContractUrl.count({
      where: whereClause
    })
  }

  async findById(id: string) {
    return this.prisma.propertyContractUrl.findUnique({
      where: { id },
      include: {
        property: {
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

  async findByPropertyId(propertyId: string, userId?: string) {
    return this.prisma.propertyContractUrl.findMany({
      where: {
        property_id: propertyId,
        ...(userId ? { user_id: userId } : {})
      },
      include: {
        property: {
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
    return this.prisma.propertyContractUrl.findMany({
      where: {
        user_id: userId
      },
      include: {
        property: {
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

  async update(id: string, data: UpdatePropertyContractUrlDto) {
    return this.prisma.propertyContractUrl.update({
      where: { id },
      data,
      include: {
        property: {
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
    return this.prisma.propertyContractUrl.delete({
      where: { id }
    })
  }
}
