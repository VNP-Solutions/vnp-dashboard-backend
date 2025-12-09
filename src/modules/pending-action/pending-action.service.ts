import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef
} from '@nestjs/common'
import { PendingActionStatus, PendingActionType } from '@prisma/client'
import type { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { isUserSuperAdmin, isInternalUser } from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { EmailUtil } from '../../common/utils/email.util'
import type { IPortfolioRepository } from '../portfolio/portfolio.interface'
import type { IPropertyService } from '../property/property.interface'
import { PrismaService } from '../prisma/prisma.service'
import {
  ApprovePendingActionDto,
  CreatePendingActionDto,
  PendingActionQueryDto
} from './pending-action.dto'
import type {
  IPendingActionRepository,
  IPendingActionService
} from './pending-action.interface'

@Injectable()
export class PendingActionService
  implements IPendingActionService
{
  constructor(
    @Inject('IPendingActionRepository')
    private repository: IPendingActionRepository,
    @Inject(forwardRef(() => 'IPropertyService'))
    private propertyService: IPropertyService,
    @Inject('IPortfolioRepository')
    private portfolioRepository: IPortfolioRepository,
    @Inject(EmailUtil)
    private emailUtil: EmailUtil,
    @Inject(PrismaService)
    private prisma: PrismaService
  ) {}

  async create(
    data: CreatePendingActionDto,
    user: IUserWithPermissions
  ) {
    // Only internal users can create pending actions
    if (!isInternalUser(user)) {
      throw new ForbiddenException(
        'Only internal users can create property action requests'
      )
    }

    // DELETE actions are no longer supported via pending actions
    if (data.action_type === PendingActionType.PROPERTY_DELETE) {
      throw new BadRequestException(
        'DELETE actions are no longer supported via pending actions. Only super admins can delete properties directly.'
      )
    }

    // Validate transfer data for transfer actions
    if (
      data.action_type === PendingActionType.PROPERTY_TRANSFER &&
      !data.transfer_data?.new_portfolio_id
    ) {
      throw new BadRequestException(
        'Transfer data with new_portfolio_id is required for transfer actions'
      )
    }

    // Create the pending action with the new unified model
    return this.repository.create({
      resource_type: data.resource_type,
      property_id: data.property_id,
      portfolio_id: data.portfolio_id,
      action_type: data.action_type,
      requested_user_id: user.id,
      transfer_data: data.transfer_data,
      reason: data.reason
    })
  }

  async findAll(
    query: PendingActionQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<any>> {
    // Only super admins can access this endpoint
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admins can access all pending actions'
      )
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.status) {
      additionalFilters.status = query.status
    }
    if (query.action_type) {
      additionalFilters.action_type = query.action_type
    }
    if (query.requested_user_id) {
      additionalFilters.requested_user_id = query.requested_user_id
    }
    if (query.property_id) {
      additionalFilters.property_id = query.property_id
    }
    if (query.portfolio_id) {
      additionalFilters.portfolio_id = query.portfolio_id
    }
    if (query.resource_type) {
      additionalFilters.resource_type = query.resource_type
    }
    if (query.audit_id) {
      additionalFilters.audit_id = query.audit_id
    }

    // Merge with existing filters
    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    // Configuration for query builder
    const queryConfig = {
      searchFields: [
        'id',
        'property.name',
        'portfolio.name',
        'requestedBy.email',
        'requestedBy.first_name',
        'requestedBy.last_name',
        'approvedBy.email',
        'approvedBy.first_name',
        'approvedBy.last_name',
        'rejection_reason'
      ],
      filterableFields: [
        'status',
        'action_type',
        'requested_user_id',
        'approval_user_id',
        'property_id',
        'portfolio_id',
        'audit_id',
        'resource_type'
      ],
      sortableFields: [
        'created_at',
        'updated_at',
        'approved_at',
        'status',
        'action_type',
        'property.name',
        'portfolio.name'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name',
        portfolio_name: 'portfolio.name',
        requested_by_email: 'requestedBy.email',
        approved_by_email: 'approvedBy.email'
      }
    }

    // Build Prisma query options
    const baseWhere: any = {}

    const { skip, take, orderBy, where } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.repository.findAll({ where, skip, take, orderBy }),
      this.repository.count(where)
    ])

    // Enrich transfer actions with target portfolio information
    const enrichedData = await this.enrichPendingActionsWithPortfolioData(data)

    return QueryBuilder.buildPaginatedResult(
      enrichedData,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findOne(id: string, user: IUserWithPermissions) {
    // Only super admins can access this endpoint
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admins can access this resource'
      )
    }

    const pendingAction = await this.repository.findById(id)

    if (!pendingAction) {
      throw new NotFoundException('Pending action not found')
    }

    // Enrich with portfolio data
    const enrichedData = await this.enrichPendingActionsWithPortfolioData([
      pendingAction
    ])

    return enrichedData[0]
  }

  async approve(
    id: string,
    _data: ApprovePendingActionDto,
    user: IUserWithPermissions
  ) {
    // Only super admins can approve
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can approve actions')
    }

    const pendingAction = await this.repository.findById(id)

    if (!pendingAction) {
      throw new NotFoundException('Pending action not found')
    }

    if (pendingAction.status !== PendingActionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve action with status: ${pendingAction.status}`
      )
    }

    // Execute the actual action based on type
    await this.executeAction(pendingAction, user)

    // Send email notification for transfer actions
    if (pendingAction.action_type === PendingActionType.PROPERTY_TRANSFER) {
      await this.sendTransferNotificationEmail(pendingAction)
    }

    // Update the pending action status
    return this.repository.update(id, {
      status: PendingActionStatus.APPROVED,
      approval_user_id: user.id,
      approved_at: new Date()
    })
  }

  async reject(
    id: string,
    data: ApprovePendingActionDto,
    user: IUserWithPermissions
  ) {
    // Only super admins can reject
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can reject actions')
    }

    const pendingAction = await this.repository.findById(id)

    if (!pendingAction) {
      throw new NotFoundException('Pending action not found')
    }

    if (pendingAction.status !== PendingActionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject action with status: ${pendingAction.status}`
      )
    }

    if (!data.rejection_reason) {
      throw new BadRequestException('Rejection reason is required')
    }

    // Send rejection notification email
    await this.sendRejectionNotificationEmail(pendingAction, data.rejection_reason)

    // Update the pending action status
    return this.repository.update(id, {
      status: PendingActionStatus.REJECTED,
      approval_user_id: user.id,
      rejection_reason: data.rejection_reason,
      approved_at: new Date()
    })
  }

  async findByPropertyId(propertyId: string) {
    return this.repository.findByPropertyId(propertyId)
  }

  async findByPortfolioId(portfolioId: string) {
    return this.repository.findByPortfolioId(portfolioId)
  }

  findByAuditId(auditId: string) {
    return this.repository.findByAuditId(auditId)
  }

  /**
   * Execute the actual property action
   * This method delegates to the property service to perform the actual operation
   */
  private async executeAction(pendingAction: any, user: IUserWithPermissions) {
    switch (pendingAction.action_type) {
      case PendingActionType.PROPERTY_DELETE:
        // DELETE actions are no longer supported
        // This case exists only for legacy pending actions created before the policy change
        throw new BadRequestException(
          'DELETE actions are no longer supported via pending actions. This legacy action cannot be approved. Please reject it and have a super admin delete the property directly.'
        )

      case PendingActionType.PROPERTY_TRANSFER:
        // Transfer the property
        if (!pendingAction.transfer_data?.new_portfolio_id) {
          throw new BadRequestException(
            'Transfer data is missing for TRANSFER action'
          )
        }
        await this.propertyService.transfer(
          pendingAction.property_id,
          {
            new_portfolio_id: pendingAction.transfer_data.new_portfolio_id,
            password: '' // Password already validated when creating pending action
          },
          user
        )
        break

      case PendingActionType.PROPERTY_DEACTIVATE:
        // Deactivate the property
        await this.propertyService.deactivate(pendingAction.property_id, user)
        break

      case PendingActionType.PROPERTY_ACTIVATE:
        // Activate the property
        await this.propertyService.activate(pendingAction.property_id, user)
        break

      case PendingActionType.PORTFOLIO_DEACTIVATE:
        // Deactivate the portfolio
        // Note: This will be implemented when portfolio deactivation is added
        throw new BadRequestException(
          'Portfolio deactivation is not yet implemented'
        )

      case PendingActionType.AUDIT_UPDATE_AMOUNT_CONFIRMED:
        // Update the audit's amount_confirmed field
        if (!pendingAction.audit_id) {
          throw new BadRequestException(
            'Audit ID is missing for AUDIT_UPDATE_AMOUNT_CONFIRMED action'
          )
        }
        if (!pendingAction.audit_update_data?.amount_confirmed) {
          throw new BadRequestException(
            'Audit update data is missing for AUDIT_UPDATE_AMOUNT_CONFIRMED action'
          )
        }
        await this.prisma.audit.update({
          where: { id: pendingAction.audit_id },
          data: {
            amount_confirmed: pendingAction.audit_update_data.amount_confirmed
          }
        })
        break

      default:
        throw new BadRequestException(
          `Unknown action type: ${pendingAction.action_type}`
        )
    }
  }

  /**
   * Enrich pending actions with target portfolio information for transfer actions
   */
  private async enrichPendingActionsWithPortfolioData(pendingActions: any[]) {
    // Get all unique target portfolio IDs from transfer actions that don't have stored portfolio data
    const targetPortfolioIds = pendingActions
      .filter(
        (action) =>
          action.action_type === PendingActionType.PROPERTY_TRANSFER &&
          action.transfer_data?.new_portfolio_id &&
          !action.transfer_data?.portfolio_to // Only fetch if not already stored
      )
      .map((action) => action.transfer_data.new_portfolio_id)
      .filter((id, index, self) => self.indexOf(id) === index) // Remove duplicates

    // Fetch all target portfolios in one query
    const targetPortfolios = new Map()
    if (targetPortfolioIds.length > 0) {
      const portfolios = await Promise.all(
        targetPortfolioIds.map((id) => this.portfolioRepository.findById(id))
      )
      portfolios.forEach((portfolio) => {
        if (portfolio) {
          targetPortfolios.set(portfolio.id, {
            id: portfolio.id,
            name: portfolio.name
          })
        }
      })
    }

    // Enrich the pending actions with portfolio data
    return pendingActions.map((action) => {
      const enrichedAction: any = {
        ...action
      }

      // Add portfolio info for transfer actions
      if (
        action.action_type === PendingActionType.PROPERTY_TRANSFER &&
        action.transfer_data?.new_portfolio_id
      ) {
        // Use stored portfolio_from and portfolio_to if available (for approved/rejected actions)
        // Otherwise, use current property.portfolio and fetch target portfolio (for pending actions)
        if (action.transfer_data.portfolio_from && action.transfer_data.portfolio_to) {
          // Already have stored history, just use it
          enrichedAction.transfer_data = {
            ...action.transfer_data
          }
        } else {
          // For pending actions, dynamically get current and target portfolios
          const currentPortfolio = action.property?.portfolio
            ? {
                id: action.property.portfolio.id,
                name: action.property.portfolio.name
              }
            : null

          const targetPortfolio = targetPortfolios.get(
            action.transfer_data.new_portfolio_id
          )

          enrichedAction.transfer_data = {
            ...action.transfer_data,
            portfolio_from: currentPortfolio,
            portfolio_to: targetPortfolio || null
          }
        }

        // Also add current_portfolio for backward compatibility
        enrichedAction.current_portfolio = enrichedAction.transfer_data.portfolio_from
      } else {
        // For non-transfer actions, add current_portfolio from property relation
        enrichedAction.current_portfolio = action.property?.portfolio
          ? {
              id: action.property.portfolio.id,
              name: action.property.portfolio.name
            }
          : null
      }

      return enrichedAction
    })
  }

  /**
   * Send email notification for property transfer
   */
  private async sendTransferNotificationEmail(pendingAction: any) {
    try {
      const recipientEmails: string[] = []

      // Get the requesting user's email
      const requestingUser = await this.prisma.user.findUnique({
        where: { id: pendingAction.requested_user_id },
        select: { email: true }
      })

      if (requestingUser?.email) {
        recipientEmails.push(requestingUser.email)
      }

      // Get property details
      const property = await this.prisma.property.findUnique({
        where: { id: pendingAction.property_id },
        select: { name: true, portfolio_id: true }
      })

      if (!property) {
        console.error('Property not found for email notification')
        return
      }

      // Get current portfolio contact email
      const currentPortfolio = await this.portfolioRepository.findById(
        property.portfolio_id
      )

      if (currentPortfolio?.contact_email) {
        recipientEmails.push(currentPortfolio.contact_email)
      }

      // Get new portfolio details
      const newPortfolio = await this.portfolioRepository.findById(
        pendingAction.transfer_data.new_portfolio_id
      )

      if (!newPortfolio) {
        console.error('New portfolio not found for email notification')
        return
      }

      if (newPortfolio.contact_email) {
        recipientEmails.push(newPortfolio.contact_email)
      }

      // Send the email to all recipients (duplicates will be removed by the email utility)
      await this.emailUtil.sendPropertyTransferEmail(
        recipientEmails,
        property.name,
        newPortfolio.name,
        new Date()
      )
    } catch (error) {
      // Log the error but don't fail the approval process
      console.error('Failed to send property transfer notification email:', error)
    }
  }

  /**
   * Send email notification for pending action rejection
   */
  private async sendRejectionNotificationEmail(
    pendingAction: any,
    rejectionReason: string
  ) {
    try {
      const recipientEmails: string[] = []

      // Get the requesting user's email
      const requestingUser = await this.prisma.user.findUnique({
        where: { id: pendingAction.requested_user_id },
        select: { email: true }
      })

      if (requestingUser?.email) {
        recipientEmails.push(requestingUser.email)
      }

      switch (pendingAction.action_type) {
        case PendingActionType.PROPERTY_TRANSFER: {
          // Get property details
          const property = await this.prisma.property.findUnique({
            where: { id: pendingAction.property_id },
            select: { name: true, portfolio_id: true }
          })

          if (!property) {
            console.error('Property not found for rejection email notification')
            return
          }

          // Get current portfolio details and contact email
          const currentPortfolio = await this.portfolioRepository.findById(
            property.portfolio_id
          )

          if (!currentPortfolio) {
            console.error('Current portfolio not found for rejection email notification')
            return
          }

          if (currentPortfolio.contact_email) {
            recipientEmails.push(currentPortfolio.contact_email)
          }

          // Get target portfolio details and contact email
          const targetPortfolio = await this.portfolioRepository.findById(
            pendingAction.transfer_data.new_portfolio_id
          )

          if (!targetPortfolio) {
            console.error('Target portfolio not found for rejection email notification')
            return
          }

          if (targetPortfolio.contact_email) {
            recipientEmails.push(targetPortfolio.contact_email)
          }

          // Send rejection email
          await this.emailUtil.sendPropertyTransferRejectionEmail(
            recipientEmails,
            property.name,
            currentPortfolio.name,
            targetPortfolio.name,
            rejectionReason,
            pendingAction.created_at
          )
          break
        }

        case PendingActionType.PROPERTY_DEACTIVATE: {
          // Get property details
          const property = await this.prisma.property.findUnique({
            where: { id: pendingAction.property_id },
            select: { name: true, portfolio_id: true }
          })

          if (!property) {
            console.error('Property not found for rejection email notification')
            return
          }

          // Get portfolio details and contact email
          const portfolio = await this.portfolioRepository.findById(
            property.portfolio_id
          )

          if (!portfolio) {
            console.error('Portfolio not found for rejection email notification')
            return
          }

          if (portfolio.contact_email) {
            recipientEmails.push(portfolio.contact_email)
          }

          // Send rejection email
          await this.emailUtil.sendPropertyDeactivateRejectionEmail(
            recipientEmails,
            property.name,
            portfolio.name,
            rejectionReason,
            pendingAction.created_at
          )
          break
        }

        case PendingActionType.PROPERTY_ACTIVATE: {
          // Get property details
          const property = await this.prisma.property.findUnique({
            where: { id: pendingAction.property_id },
            select: { name: true, portfolio_id: true }
          })

          if (!property) {
            console.error('Property not found for rejection email notification')
            return
          }

          // Get portfolio details and contact email
          const portfolio = await this.portfolioRepository.findById(
            property.portfolio_id
          )

          if (!portfolio) {
            console.error('Portfolio not found for rejection email notification')
            return
          }

          if (portfolio.contact_email) {
            recipientEmails.push(portfolio.contact_email)
          }

          // Send rejection email
          await this.emailUtil.sendPropertyActivateRejectionEmail(
            recipientEmails,
            property.name,
            portfolio.name,
            rejectionReason,
            pendingAction.created_at
          )
          break
        }

        case PendingActionType.PORTFOLIO_DEACTIVATE: {
          // Get portfolio details and contact email
          const portfolio = await this.portfolioRepository.findById(
            pendingAction.portfolio_id
          )

          if (!portfolio) {
            console.error('Portfolio not found for rejection email notification')
            return
          }

          if (portfolio.contact_email) {
            recipientEmails.push(portfolio.contact_email)
          }

          // Send rejection email
          await this.emailUtil.sendPortfolioDeactivateRejectionEmail(
            recipientEmails,
            portfolio.name,
            rejectionReason,
            pendingAction.created_at
          )
          break
        }

        case PendingActionType.PROPERTY_DELETE: {
          // For legacy delete actions, just notify the requesting user
          // No need to notify portfolio contacts as this action type is deprecated
          if (recipientEmails.length > 0) {
            // Get property details if available
            const property = await this.prisma.property.findUnique({
              where: { id: pendingAction.property_id },
              select: { name: true, portfolio_id: true }
            })

            if (property) {
              const portfolio = await this.portfolioRepository.findById(
                property.portfolio_id
              )

              if (portfolio) {
                // Send a simple property deactivation rejection email
                // (reusing the deactivate email template since DELETE is deprecated)
                await this.emailUtil.sendPropertyDeactivateRejectionEmail(
                  recipientEmails,
                  property.name,
                  portfolio.name,
                  `${rejectionReason} (Note: DELETE actions are deprecated. Please contact support for assistance.)`,
                  pendingAction.created_at
                )
              }
            }
          }
          break
        }

        default:
          console.warn(`Unknown action type for rejection email: ${pendingAction.action_type}`)
      }
    } catch (error) {
      // Log the error but don't fail the rejection process
      console.error('Failed to send rejection notification email:', error)
    }
  }
}
