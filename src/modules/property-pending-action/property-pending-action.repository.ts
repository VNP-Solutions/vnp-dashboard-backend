import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyPendingActionRepository } from './property-pending-action.interface'

type PropertyPendingActionWithRelations =
  Prisma.PropertyPendingActionGetPayload<{
    include: {
      property: {
        select: {
          id: true
          name: true
          portfolio_id: true
        }
      }
      requestedBy: {
        select: {
          id: true
          email: true
          first_name: true
          last_name: true
        }
      }
      approvedBy: {
        select: {
          id: true
          email: true
          first_name: true
          last_name: true
        }
      }
    }
  }>

@Injectable()
export class PropertyPendingActionRepository
  implements IPropertyPendingActionRepository
{
  constructor(private prisma: PrismaService) {}

  create(data: {
    property_id: string
    action_type: string
    requested_user_id: string
    transfer_data?: { new_portfolio_id: string }
  }): Promise<PropertyPendingActionWithRelations> {
    return this.prisma.propertyPendingAction.create({
      data: {
        property_id: data.property_id,
        action_type: data.action_type as any,
        requested_user_id: data.requested_user_id,
        transfer_data: data.transfer_data
          ? { new_portfolio_id: data.transfer_data.new_portfolio_id }
          : undefined,
        status: 'PENDING'
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })
  }

  async findAll(queryOptions: {
    where?: any
    include?: any
    orderBy?: any
  }): Promise<PropertyPendingActionWithRelations[]> {
    const result = await this.prisma.propertyPendingAction.findMany({
      where: queryOptions.where,
      include: queryOptions.include || {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: queryOptions.orderBy || { created_at: 'desc' }
    })
    return result as unknown as PropertyPendingActionWithRelations[]
  }

  findById(id: string): Promise<PropertyPendingActionWithRelations | null> {
    return this.prisma.propertyPendingAction.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })
  }

  async update(
    id: string,
    data: {
      status?: string
      approval_user_id?: string
      rejection_reason?: string
      approved_at?: Date
    }
  ): Promise<PropertyPendingActionWithRelations> {
    return this.prisma.propertyPendingAction.update({
      where: { id },
      data: {
        status: data.status as any,
        approval_user_id: data.approval_user_id,
        rejection_reason: data.rejection_reason,
        approved_at: data.approved_at
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })
  }

  async findByPropertyId(
    propertyId: string
  ): Promise<PropertyPendingActionWithRelations[]> {
    return this.prisma.propertyPendingAction.findMany({
      where: {
        property_id: propertyId,
        status: 'PENDING'
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })
  }

  async findByStatus(
    status: string
  ): Promise<PropertyPendingActionWithRelations[]> {
    return this.prisma.propertyPendingAction.findMany({
      where: {
        status: status as any
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })
  }
}
