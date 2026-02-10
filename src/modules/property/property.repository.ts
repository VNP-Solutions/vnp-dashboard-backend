import { Inject, Injectable } from '@nestjs/common'
import { BankAccountType, BankSubType, BankType } from '@prisma/client'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PrismaService } from '../prisma/prisma.service'
import {
  CompleteBankDetailsDto,
  CompletePropertyCredentialsDto,
  CreatePropertyDto,
  UpdatePropertyDto
} from './property.dto'
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

  async completeCreate(
    propertyData: CreatePropertyDto,
    credentialsData?: CompletePropertyCredentialsDto,
    bankDetailsData?: CompleteBankDetailsDto,
    userId?: string
  ) {
    const encryptionSecret = process.env.JWT_ACCESS_SECRET || ''

    return this.prisma.$transaction(async tx => {
      // Create property data
      const createData: any = { ...propertyData }
      if (propertyData.next_due_date) {
        createData.next_due_date = new Date(propertyData.next_due_date)
      }

      // Create property
      const property = await tx.property.create({
        data: createData
      })

      // Create credentials if provided
      if (credentialsData) {
        await tx.propertyCredentials.create({
          data: {
            property_id: property.id,
            // Only expedia_id is required, username and password are optional
            expedia_id: credentialsData.expedia.id,
            expedia_username: credentialsData.expedia.username || null,
            expedia_password: credentialsData.expedia.password
              ? EncryptionUtil.encrypt(
                  credentialsData.expedia.password,
                  encryptionSecret
                )
              : null,
            // All agoda fields are optional
            agoda_id: credentialsData.agoda?.id || null,
            agoda_username: credentialsData.agoda?.username || null,
            agoda_password: credentialsData.agoda?.password
              ? EncryptionUtil.encrypt(
                  credentialsData.agoda.password,
                  encryptionSecret
                )
              : null,
            // All booking fields are optional
            booking_id: credentialsData.booking?.id || null,
            booking_username: credentialsData.booking?.username || null,
            booking_password: credentialsData.booking?.password
              ? EncryptionUtil.encrypt(
                  credentialsData.booking.password,
                  encryptionSecret
                )
              : null
          }
        })
      }

      // Create bank details if provided
      if (bankDetailsData) {
        const bankData: any = {
          property_id: property.id,
          bank_type: bankDetailsData.bank_type as BankType
        }

        // Add optional fields if provided
        if (bankDetailsData.bank_sub_type) {
          bankData.bank_sub_type = bankDetailsData.bank_sub_type as BankSubType
        }
        if (bankDetailsData.hotel_portfolio_name) {
          bankData.hotel_portfolio_name = bankDetailsData.hotel_portfolio_name
        }
        if (bankDetailsData.beneficiary_name) {
          bankData.beneficiary_name = bankDetailsData.beneficiary_name
        }
        if (bankDetailsData.beneficiary_address) {
          bankData.beneficiary_address = bankDetailsData.beneficiary_address
        }
        if (bankDetailsData.account_number) {
          bankData.account_number = bankDetailsData.account_number
        }
        if (bankDetailsData.account_name) {
          bankData.account_name = bankDetailsData.account_name
        }
        if (bankDetailsData.bank_name) {
          bankData.bank_name = bankDetailsData.bank_name
        }
        if (bankDetailsData.bank_branch) {
          bankData.bank_branch = bankDetailsData.bank_branch
        }
        if (bankDetailsData.swift_bic_iban) {
          bankData.swift_bic_iban = bankDetailsData.swift_bic_iban
        }
        if (bankDetailsData.routing_number) {
          bankData.routing_number = bankDetailsData.routing_number
        }
        if (bankDetailsData.bank_account_type) {
          bankData.bank_account_type =
            bankDetailsData.bank_account_type as BankAccountType
        }
        if (bankDetailsData.currency) {
          bankData.currency = bankDetailsData.currency
        }
        if (bankDetailsData.stripe_account_email) {
          bankData.stripe_account_email = bankDetailsData.stripe_account_email
        }
        if (bankDetailsData.contact_name) {
          bankData.contact_name = bankDetailsData.contact_name
        }
        if (bankDetailsData.email_address) {
          bankData.email_address = bankDetailsData.email_address
        }
        if (bankDetailsData.bank_address) {
          bankData.bank_address = bankDetailsData.bank_address
        }
        if (bankDetailsData.comments) {
          bankData.comments = bankDetailsData.comments
        }
        if (userId) {
          bankData.associated_user_id = userId
        }

        await tx.propertyBankDetails.create({
          data: bankData
        })
      }

      // Fetch and return the complete property with all relations
      const completeProperty = await tx.property.findUnique({
        where: { id: property.id },
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

      if (!completeProperty) {
        throw new Error('Failed to retrieve created property')
      }

      return completeProperty
    })
  }

  async completeUpdate(
    propertyId: string,
    propertyData?: UpdatePropertyDto,
    credentialsData?: CompletePropertyCredentialsDto,
    bankDetailsData?: CompleteBankDetailsDto,
    userId?: string
  ) {
    const encryptionSecret = process.env.JWT_ACCESS_SECRET || ''

    return this.prisma.$transaction(
      async tx => {
        // Update property data if provided
        if (propertyData && Object.keys(propertyData).length > 0) {
          const updateData: any = { ...propertyData }
          if (propertyData.next_due_date) {
            updateData.next_due_date = new Date(propertyData.next_due_date)
          }

          await tx.property.update({
            where: { id: propertyId },
            data: updateData
          })
        }

        // Update or create credentials if provided
        if (credentialsData) {
          const existingCredentials = await tx.propertyCredentials.findUnique({
            where: { property_id: propertyId }
          })

          const credentialsPayload: any = {
            // Only expedia_id is required, username and password are optional
            expedia_id: credentialsData.expedia.id,
            expedia_username: credentialsData.expedia.username || null,
            expedia_password: credentialsData.expedia.password
              ? EncryptionUtil.encrypt(
                  credentialsData.expedia.password,
                  encryptionSecret
                )
              : null,
            // All agoda fields are optional
            agoda_id: credentialsData.agoda?.id || null,
            agoda_username: credentialsData.agoda?.username || null,
            agoda_password: credentialsData.agoda?.password
              ? EncryptionUtil.encrypt(
                  credentialsData.agoda.password,
                  encryptionSecret
                )
              : null,
            // All booking fields are optional
            booking_id: credentialsData.booking?.id || null,
            booking_username: credentialsData.booking?.username || null,
            booking_password: credentialsData.booking?.password
              ? EncryptionUtil.encrypt(
                  credentialsData.booking.password,
                  encryptionSecret
                )
              : null
          }

          if (existingCredentials) {
            await tx.propertyCredentials.update({
              where: { property_id: propertyId },
              data: credentialsPayload
            })
          } else {
            await tx.propertyCredentials.create({
              data: {
                property_id: propertyId,
                ...credentialsPayload
              }
            })
          }
        }

        // Update or create bank details if provided
        if (bankDetailsData) {
          const existingBankDetails = await tx.propertyBankDetails.findUnique({
            where: { property_id: propertyId }
          })

          // If bank_type is "none", delete existing bank details
          if (bankDetailsData.bank_type === 'none') {
            if (existingBankDetails) {
              await tx.propertyBankDetails.delete({
                where: { property_id: propertyId }
              })
            }
            // Skip the rest of bank details processing
          } else {
            const bankData: any = {
              bank_type: bankDetailsData.bank_type as BankType
            }

            // Add optional fields if provided
            if (bankDetailsData.bank_sub_type) {
              bankData.bank_sub_type =
                bankDetailsData.bank_sub_type as BankSubType
            }
            if (bankDetailsData.hotel_portfolio_name) {
              bankData.hotel_portfolio_name =
                bankDetailsData.hotel_portfolio_name
            }
            if (bankDetailsData.beneficiary_name) {
              bankData.beneficiary_name = bankDetailsData.beneficiary_name
            }
            if (bankDetailsData.beneficiary_address) {
              bankData.beneficiary_address = bankDetailsData.beneficiary_address
            }
            if (bankDetailsData.account_number) {
              bankData.account_number = bankDetailsData.account_number
            }
            if (bankDetailsData.account_name) {
              bankData.account_name = bankDetailsData.account_name
            }
            if (bankDetailsData.bank_name) {
              bankData.bank_name = bankDetailsData.bank_name
            }
            if (bankDetailsData.bank_branch) {
              bankData.bank_branch = bankDetailsData.bank_branch
            }
            if (bankDetailsData.swift_bic_iban) {
              bankData.swift_bic_iban = bankDetailsData.swift_bic_iban
            }
            if (bankDetailsData.routing_number) {
              bankData.routing_number = bankDetailsData.routing_number
            }
            if (bankDetailsData.bank_account_type) {
              bankData.bank_account_type =
                bankDetailsData.bank_account_type as BankAccountType
            }
            if (bankDetailsData.currency) {
              bankData.currency = bankDetailsData.currency
            }
            if (bankDetailsData.stripe_account_email) {
              bankData.stripe_account_email =
                bankDetailsData.stripe_account_email
            }
            if (bankDetailsData.contact_name) {
              bankData.contact_name = bankDetailsData.contact_name
            }
            if (bankDetailsData.email_address) {
              bankData.email_address = bankDetailsData.email_address
            }
            if (bankDetailsData.bank_address) {
              bankData.bank_address = bankDetailsData.bank_address
            }
            if (bankDetailsData.comments) {
              bankData.comments = bankDetailsData.comments
            }
            if (userId) {
              bankData.associated_user_id = userId
            }

            if (existingBankDetails) {
              await tx.propertyBankDetails.update({
                where: { property_id: propertyId },
                data: bankData
              })
            } else {
              await tx.propertyBankDetails.create({
                data: {
                  property_id: propertyId,
                  ...bankData
                }
              })
            }
          }
        }

        // Fetch and return the complete property with all relations
        const completeProperty = await tx.property.findUnique({
          where: { id: propertyId },
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

        if (!completeProperty) {
          throw new Error('Failed to retrieve updated property')
        }

        return completeProperty
      },
      {
        timeout: 30000 // 30 seconds timeout for complex update operations
      }
    )
  }

  async findAll(
    queryOptions: any,
    _propertyIds?: string[],
    hasAuditAccess?: boolean
  ) {
    const { where, skip, take, orderBy } = queryOptions

    const properties = await this.prisma.property.findMany({
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
            is_active: true,
            service_type_id: true,
            contact_email: true,
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

    // Get unique property IDs and previous portfolio IDs
    const propertyIds = properties.map(p => p.id)
    const previousPortfolioIds = properties
      .map(p => p.previous_portfolio_id)
      .filter((id): id is string => id !== null && id !== undefined)

    // Fetch previous portfolios in bulk
    const previousPortfolios =
      previousPortfolioIds.length > 0
        ? await this.prisma.portfolio.findMany({
            where: { id: { in: previousPortfolioIds } },
            select: {
              id: true,
              name: true,
              is_active: true
            }
          })
        : []

    // Create a map for quick lookup
    const previousPortfolioMap = new Map(previousPortfolios.map(p => [p.id, p]))

    // Get audit counts for each property only if user has audit access
    let auditCountMap = new Map<string, number>()
    if (hasAuditAccess !== false) {
      const auditCounts = await Promise.all(
        propertyIds.map(async propertyId => ({
          propertyId,
          count: await this.prisma.audit.count({
            where: {
              property_id: propertyId,
              is_archived: false
            }
          })
        }))
      )

      auditCountMap = new Map(auditCounts.map(ac => [ac.propertyId, ac.count]))
    }

    // Enrich each property with total_audits count and previous_portfolio data
    // If user doesn't have audit access, total_audits will be 0
    return properties.map(property => ({
      ...property,
      total_audits:
        hasAuditAccess !== false ? auditCountMap.get(property.id) || 0 : 0,
      previous_portfolio: property.previous_portfolio_id
        ? previousPortfolioMap.get(property.previous_portfolio_id) || null
        : null
    })) as any
  }

  async count(whereClause: any, _propertyIds?: string[]): Promise<number> {
    return this.prisma.property.count({
      where: whereClause
    })
  }

  async findById(id: string) {
    const property = await this.prisma.property.findUnique({
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

    if (!property) {
      return null
    }

    // Fetch previous portfolio if exists
    let previous_portfolio: any = null
    if (property.previous_portfolio_id) {
      previous_portfolio = await this.prisma.portfolio.findUnique({
        where: { id: property.previous_portfolio_id },
        select: {
          id: true,
          name: true,
          is_active: true
        }
      })
    }

    return {
      ...property,
      previous_portfolio
    } as any
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

  async findByExpediaId(expediaId: string) {
    return this.prisma.property.findFirst({
      where: {
        credentials: {
          expedia_id: expediaId
        }
      }
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
