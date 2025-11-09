import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePropertyDto, UpdatePropertyDto } from './property.dto'
import type { IPropertyRepository } from './property.interface'

@Injectable()
export class PropertyRepository implements IPropertyRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreatePropertyDto) {
    const createData: any = { ...data }
    if (data.next_due_date) {
      createData.next_due_date = new Date(data.next_due_date)
    }

    return this.prisma.property.create({
      data: createData,
      include: {
        currency: {
          select: {
            id: true,
            code: true,
            name: true,
            symbol: true
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        },
        credentials: true
      }
    })
  }

  async findAll(queryOptions: any, _propertyIds?: string[]) {
    const { where, skip, take, orderBy } = queryOptions

    return this.prisma.property.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        currency: {
          select: {
            id: true,
            code: true,
            name: true,
            symbol: true
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        },
        credentials: {
          select: {
            expedia_id: true,
            agoda_id: true,
            booking_id: true
          }
        },
        bankDetails: {
          select: {
            bank_type: true
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
            transfer_data: true,
            requested_user_id: true,
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
  }

  async count(whereClause: any, _propertyIds?: string[]): Promise<number> {
    return this.prisma.property.count({
      where: whereClause
    })
  }

  async findById(id: string) {
    return this.prisma.property.findUnique({
      where: { id },
      include: {
        currency: {
          select: {
            id: true,
            code: true,
            name: true,
            symbol: true
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true,
            is_active: true,
            service_type_id: true,
            serviceType: {
              select: {
                id: true,
                type: true
              }
            }
          }
        },
        credentials: true,
        bankDetails: true,
        audits: {
          select: {
            id: true,
            type_of_ota: true,
            audit_status_id: true,
            amount_collectable: true,
            amount_confirmed: true,
            start_date: true,
            end_date: true
          }
        }
      }
    })
  }

  async findByIds(ids: string[]) {
    return this.prisma.property.findMany({
      where: { id: { in: ids } }
    })
  }

  async findByName(name: string) {
    return this.prisma.property.findUnique({
      where: { name }
    })
  }

  async update(id: string, data: UpdatePropertyDto) {
    const updateData: any = { ...data }
    if (data.next_due_date) {
      updateData.next_due_date = new Date(data.next_due_date)
    }

    return this.prisma.property.update({
      where: { id },
      data: updateData,
      include: {
        currency: {
          select: {
            id: true,
            code: true,
            name: true,
            symbol: true
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        }
      }
    })
  }

  async delete(id: string) {
    return this.prisma.property.delete({
      where: { id }
    })
  }

  async countAudits(propertyId: string): Promise<number> {
    return this.prisma.audit.count({
      where: { property_id: propertyId }
    })
  }
}
