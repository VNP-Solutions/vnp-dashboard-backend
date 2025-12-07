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
        start_date: data.start_date ? new Date(data.start_date) : undefined,
        end_date: data.end_date ? new Date(data.end_date) : undefined
      },
      include: {
        auditStatus: {
          select: {
            id: true,
            status: true
          }
        },
        batch: {
          select: {
            id: true,
            batch_no: true,
            order: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            currency: {
              select: {
                id: true,
                code: true,
                name: true,
                symbol: true
              }
            },
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

    const finalWhere = { ...where }

    if (propertyIds && propertyIds.length > 0) {
      // If there's already a property_id filter in where, intersect with accessible propertyIds
      if (where.property_id) {
        const existingPropertyId = where.property_id
        if (typeof existingPropertyId === 'string') {
          // Single property_id filter - only include if it's in accessible propertyIds
          if (propertyIds.includes(existingPropertyId)) {
            finalWhere.property_id = existingPropertyId
          } else {
            // User doesn't have access to this property - return empty result
            finalWhere.property_id = { in: [] }
          }
        } else if (existingPropertyId.in) {
          // property_id: { in: [...] } - intersect with accessible propertyIds
          finalWhere.property_id = {
            in: existingPropertyId.in.filter((id: string) =>
              propertyIds.includes(id)
            )
          }
        } else {
          // Other operator - add AND condition
          finalWhere.AND = [
            { property_id: existingPropertyId },
            { property_id: { in: propertyIds } }
          ]
        }
      } else {
        // No existing property_id filter - just use accessible propertyIds
        finalWhere.property_id = {
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
        batch: {
          select: {
            id: true,
            batch_no: true,
            order: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            currency: {
              select: {
                id: true,
                code: true,
                name: true,
                symbol: true
              }
            },
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
    const finalWhere = { ...whereClause }

    if (propertyIds && propertyIds.length > 0) {
      // If there's already a property_id filter in whereClause, intersect with accessible propertyIds
      if (whereClause.property_id) {
        const existingPropertyId = whereClause.property_id
        if (typeof existingPropertyId === 'string') {
          // Single property_id filter - only include if it's in accessible propertyIds
          if (propertyIds.includes(existingPropertyId)) {
            finalWhere.property_id = existingPropertyId
          } else {
            // User doesn't have access to this property - return 0
            finalWhere.property_id = { in: [] }
          }
        } else if (existingPropertyId.in) {
          // property_id: { in: [...] } - intersect with accessible propertyIds
          finalWhere.property_id = {
            in: existingPropertyId.in.filter((id: string) =>
              propertyIds.includes(id)
            )
          }
        } else {
          // Other operator - add AND condition
          finalWhere.AND = [
            { property_id: existingPropertyId },
            { property_id: { in: propertyIds } }
          ]
        }
      } else {
        // No existing property_id filter - just use accessible propertyIds
        finalWhere.property_id = {
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
        batch: {
          select: {
            id: true,
            batch_no: true,
            order: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            is_active: true,
            card_descriptor: true,
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
        batch: {
          select: {
            id: true,
            batch_no: true,
            order: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            currency: {
              select: {
                id: true,
                code: true,
                name: true,
                symbol: true
              }
            },
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

  async delete(id: string): Promise<void> {
    await this.prisma.audit.delete({
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
        batch: {
          select: {
            id: true,
            batch_no: true,
            order: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            currency: {
              select: {
                id: true,
                code: true,
                name: true,
                symbol: true
              }
            },
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
        batch: {
          select: {
            id: true,
            batch_no: true,
            order: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            is_active: true,
            card_descriptor: true,
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
        batch: {
          select: {
            id: true,
            batch_no: true,
            order: true
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            is_active: true,
            currency: {
              select: {
                id: true,
                code: true,
                name: true,
                symbol: true
              }
            },
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

  async bulkDelete(auditIds: string[]) {
    const result = await this.prisma.audit.deleteMany({
      where: {
        id: {
          in: auditIds
        }
      }
    })

    return { count: result.count }
  }
}
