import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { IPendingActionRepository } from './pending-action.interface'

type PendingActionWithRelations = Prisma.PendingActionGetPayload<{
  include: {
    property: {
      select: {
        id: true
        name: true
        portfolio_id: true
        portfolio: {
          select: {
            id: true
            name: true
          }
        }
      }
    }
    portfolio: {
      select: {
        id: true
        name: true
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
export class PendingActionRepository implements IPendingActionRepository {
  constructor(private prisma: PrismaService) {}

  create(data: {
    resource_type: string
    property_id?: string
    portfolio_id?: string
    action_type: string
    requested_user_id: string
    transfer_data?: {
      new_portfolio_id: string
      portfolio_from?: {
        id: string
        name: string
      }
      portfolio_to?: {
        id: string
        name: string
      }
    }
    reason?: string
  }): Promise<PendingActionWithRelations> {
    return this.prisma.pendingAction.create({
      data: {
        resource_type: data.resource_type,
        property_id: data.property_id,
        portfolio_id: data.portfolio_id,
        action_type: data.action_type as any,
        requested_user_id: data.requested_user_id,
        transfer_data: data.transfer_data
          ? {
              new_portfolio_id: data.transfer_data.new_portfolio_id,
              portfolio_from: data.transfer_data.portfolio_from,
              portfolio_to: data.transfer_data.portfolio_to
            }
          : undefined,
        reason: data.reason,
        status: 'PENDING'
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
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
    skip?: number
    take?: number
  }): Promise<PendingActionWithRelations[]> {
    const result = await this.prisma.pendingAction.findMany({
      where: queryOptions.where,
      include: queryOptions.include || {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
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
      orderBy: queryOptions.orderBy || { created_at: 'desc' },
      skip: queryOptions.skip,
      take: queryOptions.take
    })
    return result as unknown as PendingActionWithRelations[]
  }

  async count(where?: any): Promise<number> {
    return this.prisma.pendingAction.count({ where })
  }

  findById(id: string): Promise<PendingActionWithRelations | null> {
    return this.prisma.pendingAction.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
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
  ): Promise<PendingActionWithRelations> {
    return this.prisma.pendingAction.update({
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
            portfolio_id: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
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
  ): Promise<PendingActionWithRelations[]> {
    return this.prisma.pendingAction.findMany({
      where: {
        property_id: propertyId,
        status: 'PENDING'
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
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

  async findByPortfolioId(
    portfolioId: string
  ): Promise<PendingActionWithRelations[]> {
    return this.prisma.pendingAction.findMany({
      where: {
        portfolio_id: portfolioId,
        status: 'PENDING'
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
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

  async findByStatus(status: string): Promise<PendingActionWithRelations[]> {
    return this.prisma.pendingAction.findMany({
      where: {
        status: status as any
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        portfolio: {
          select: {
            id: true,
            name: true
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
