import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAuditDto, UpdateAuditDto } from './audit.dto'
import type { IAuditRepository } from './audit.interface'

@Injectable()
export class AuditRepository implements IAuditRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateAuditDto) {
    return this.prisma.audit.create({
      data: {
        ...data,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date)
      },
      include: {
        auditStatus: {
          select: {
            id: true,
            status: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            credentials: {
              select: {
                expedia_id: true,
                agoda_id: true,
                booking_id: true
              }
            },
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })
  }

  async findAll(queryOptions: any, propertyIds?: string[]) {
    const { where, skip, take, orderBy } = queryOptions

    let finalWhere = where

    if (propertyIds && propertyIds.length > 0) {
      finalWhere = {
        ...where,
        property_id: {
          in: propertyIds
        }
      }
    }

    return this.prisma.audit.findMany({
      where: finalWhere,
      skip,
      take,
      orderBy,
      include: {
        auditStatus: {
          select: {
            id: true,
            status: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            credentials: {
              select: {
                expedia_id: true,
                agoda_id: true,
                booking_id: true
              }
            },
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })
  }

  async count(whereClause: any, propertyIds?: string[]): Promise<number> {
    let finalWhere = whereClause

    if (propertyIds && propertyIds.length > 0) {
      finalWhere = {
        ...whereClause,
        property_id: {
          in: propertyIds
        }
      }
    }

    return this.prisma.audit.count({
      where: finalWhere
    })
  }

  async findById(id: string) {
    return this.prisma.audit.findUnique({
      where: { id },
      include: {
        auditStatus: {
          select: {
            id: true,
            status: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            is_active: true,
            card_descriptor: true,
            portfolio: {
              select: {
                id: true,
                name: true,
                is_active: true,
                serviceType: {
                  select: {
                    id: true,
                    type: true
                  }
                }
              }
            },
            credentials: {
              select: {
                id: true,
                expedia_id: true,
                agoda_id: true,
                booking_id: true
              }
            }
          }
        }
      }
    })
  }

  async update(id: string, data: UpdateAuditDto) {
    const updateData: any = { ...data }

    if (data.start_date) {
      updateData.start_date = new Date(data.start_date)
    }
    if (data.end_date) {
      updateData.end_date = new Date(data.end_date)
    }

    return this.prisma.audit.update({
      where: { id },
      data: updateData,
      include: {
        auditStatus: {
          select: {
            id: true,
            status: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })
  }

  async delete(id: string) {
    return this.prisma.audit.delete({
      where: { id }
    })
  }

  async archive(id: string) {
    return this.prisma.audit.update({
      where: { id },
      data: { is_archived: true },
      include: {
        auditStatus: {
          select: {
            id: true,
            status: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })
  }

  async bulkUpdate(auditIds: string[], data: UpdateAuditDto) {
    const updateData: any = { ...data }

    if (data.start_date) {
      updateData.start_date = new Date(data.start_date)
    }
    if (data.end_date) {
      updateData.end_date = new Date(data.end_date)
    }

    const result = await this.prisma.audit.updateMany({
      where: {
        id: {
          in: auditIds
        }
      },
      data: updateData
    })

    return { count: result.count }
  }

  async findByIds(ids: string[]) {
    return this.prisma.audit.findMany({
      where: {
        id: {
          in: ids
        }
      },
      include: {
        auditStatus: {
          select: {
            id: true,
            status: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            is_active: true,
            card_descriptor: true,
            portfolio: {
              select: {
                id: true,
                name: true,
                is_active: true,
                serviceType: {
                  select: {
                    id: true,
                    type: true
                  }
                }
              }
            },
            credentials: {
              select: {
                id: true,
                expedia_id: true,
                agoda_id: true,
                booking_id: true
              }
            }
          }
        }
      }
    })
  }

  async bulkArchive(auditIds: string[]) {
    const result = await this.prisma.audit.updateMany({
      where: {
        id: {
          in: auditIds
        }
      },
      data: { is_archived: true }
    })

    return { count: result.count }
  }

  async unarchive(id: string) {
    return this.prisma.audit.update({
      where: { id },
      data: { is_archived: false },
      include: {
        auditStatus: {
          select: {
            id: true,
            status: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            portfolio: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })
  }
}
