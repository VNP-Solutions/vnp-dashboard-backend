import { Inject, Injectable } from '@nestjs/common'
import { PayoutStatus, Prisma } from '@prisma/client'
import {
  applyManualDerivedAmountOverrides,
  computeAuditDerivedAmounts,
  shouldRecalculateAuditDerivedAmounts
} from '../../common/utils/amount.util'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAuditDto, UpdateAuditDto } from './audit.dto'
import type { IAuditRepository } from './audit.interface'

@Injectable()
export class AuditRepository implements IAuditRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateAuditDto) {
    const {
      gross_total: _ignoredGrossTotal,
      due_to_vnp: _ignoredDueToVnp,
      due_to_property: _ignoredDueToProperty,
      ...createPayload
    } = data as CreateAuditDto & {
      gross_total?: number
      due_to_vnp?: number
      due_to_property?: number
    }

    const derived = computeAuditDerivedAmounts(
      {
        expedia_amount_confirmed: createPayload.expedia_amount_confirmed,
        agoda_amount_confirmed: createPayload.agoda_amount_confirmed,
        booking_amount_confirmed: createPayload.booking_amount_confirmed
      },
      createPayload.type_of_ota
    )

    return this.prisma.audit.create({
      data: {
        ...createPayload,
        ...derived,
        review_collection_date: createPayload.review_collection_date
          ? new Date(createPayload.review_collection_date)
          : undefined
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

    const audits = await this.prisma.audit.findMany({
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
                name: true,
                parent_id: true,
                serviceType: {
                  select: {
                    id: true,
                    type: true
                  }
                }
              }
            }
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
            audit_update_data: true,
            reason: true,
            created_at: true,
            requestedBy: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true
              }
            }
          }
        }
      }
    })

    // Get unique audit IDs for note count
    const auditIds = audits.map(a => a.id)

    // Get note counts for each audit
    const noteCounts = await Promise.all(
      auditIds.map(async auditId => ({
        auditId,
        count: await this.prisma.note.count({
          where: { audit_id: auditId }
        })
      }))
    )

    const noteCountMap = new Map(noteCounts.map(nc => [nc.auditId, nc.count]))

    // Enrich each audit with total_notes count
    return audits.map(audit => ({
      ...audit,
      total_notes: noteCountMap.get(audit.id) || 0
    }))
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
    const audit = await this.prisma.audit.findUnique({
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
            portfolio_id: true,
            card_descriptor: true,
            parent_id: true,
            // Who collected each OTA's money. The payout service turns these into a rail, so an
            // audit whose property has none is not payable.
            expedia_processor: true,
            booking_processor: true,
            agoda_processor: true,
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
        },
        pendingActions: {
          where: {
            status: 'PENDING'
          },
          select: {
            id: true,
            action_type: true,
            status: true,
            audit_update_data: true,
            reason: true,
            created_at: true,
            requestedBy: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true
              }
            }
          }
        }
      }
    })

    if (!audit) {
      return null
    }

    // Get note count for this audit
    const noteCount = await this.prisma.note.count({
      where: { audit_id: id }
    })

    return {
      ...audit,
      total_notes: noteCount
    }
  }

  async update(id: string, data: UpdateAuditDto) {
    const incoming = { ...data }
    const updateData: any = { ...incoming }

    if (incoming.review_collection_date) {
      updateData.review_collection_date = new Date(incoming.review_collection_date)
    }

    if (shouldRecalculateAuditDerivedAmounts(incoming)) {
      const current = await this.prisma.audit.findUnique({
        where: { id },
        select: {
          type_of_ota: true,
          expedia_amount_confirmed: true,
          agoda_amount_confirmed: true,
          booking_amount_confirmed: true
        }
      })

      const typeOfOta =
        incoming.type_of_ota !== undefined ? incoming.type_of_ota : current?.type_of_ota

      const derived = computeAuditDerivedAmounts(
        {
          expedia_amount_confirmed:
            incoming.expedia_amount_confirmed !== undefined
              ? incoming.expedia_amount_confirmed
              : current?.expedia_amount_confirmed,
          agoda_amount_confirmed:
            incoming.agoda_amount_confirmed !== undefined
              ? incoming.agoda_amount_confirmed
              : current?.agoda_amount_confirmed,
          booking_amount_confirmed:
            incoming.booking_amount_confirmed !== undefined
              ? incoming.booking_amount_confirmed
              : current?.booking_amount_confirmed
        },
        typeOfOta
      )

      updateData.gross_total = derived.gross_total
      updateData.due_to_vnp = derived.due_to_vnp
      updateData.due_to_property = derived.due_to_property
    } else {
      const currentDerived = await this.prisma.audit.findUnique({
        where: { id },
        select: {
          gross_total: true,
          due_to_vnp: true,
          due_to_property: true
        }
      })

      const derived = applyManualDerivedAmountOverrides(incoming, {
        gross_total: currentDerived?.gross_total ?? 0,
        due_to_vnp: currentDerived?.due_to_vnp ?? 0,
        due_to_property: currentDerived?.due_to_property ?? 0
      })

      if (derived) {
        updateData.gross_total = derived.gross_total
        updateData.due_to_vnp = derived.due_to_vnp
        updateData.due_to_property = derived.due_to_property
      }
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

    if (data.review_collection_date) {
      updateData.review_collection_date = new Date(data.review_collection_date)
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

  /**
   * Ids and their property, nothing else. Used on the table-page scope check, where findByIds would
   * hydrate every audit's status, batch, property, currency and portfolio to read two columns.
   */
  async findScopeByIds(ids: string[]) {
    return this.prisma.audit.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        property_id: true,
        // Portfolio too: a bulk payout may span properties but never portfolios.
        property: { select: { portfolio_id: true, name: true } }
      }
    })
  }

  /** Just the payout columns, for the ordering guard on an inbound status push. */
  async findPayoutStateById(id: string) {
    return this.prisma.audit.findUnique({
      where: { id },
      select: { id: true, payout_status: true, payout_updated_at: true }
    })
  }

  async updatePayoutState(
    id: string,
    data: {
      payout_status: PayoutStatus
      payout_legs: Prisma.InputJsonValue
      payout_updated_at: Date
    }
  ) {
    return this.prisma.audit.update({ where: { id }, data })
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
            portfolio_id: true,
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
        },
        pendingActions: {
          where: {
            status: 'PENDING'
          },
          select: {
            id: true,
            action_type: true,
            status: true,
            audit_update_data: true,
            reason: true,
            created_at: true,
            requestedBy: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true
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

  async deleteByPortfolioId(portfolioId: string) {
    const result = await this.prisma.audit.deleteMany({
      where: {
        property: {
          portfolio_id: portfolioId
        }
      }
    })

    return { count: result.count }
  }
}
