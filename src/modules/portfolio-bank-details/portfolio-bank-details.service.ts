import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { BankSubType, BankType } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import {
  comparableBankDetailsEqual,
  logBankDetailsEmailComparison,
  toComparableBankDetails
} from '../../common/utils/bank-details.util'
import { EmailUtil } from '../../common/utils/email.util'
import { isBankDetailsNotificationRecipientRole } from '../../common/utils/permission.util'
import { isNineDigitUsRoutingNumber } from '../../common/utils/spreadsheet.util'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreatePortfolioBankDetailsDto,
  UpdatePortfolioBankDetailsDto
} from './portfolio-bank-details.dto'
import type {
  IPortfolioBankDetailsRepository,
  IPortfolioBankDetailsService
} from './portfolio-bank-details.interface'

@Injectable()
export class PortfolioBankDetailsService
  implements IPortfolioBankDetailsService
{
  private readonly logger = new Logger(PortfolioBankDetailsService.name)

  constructor(
    @Inject('IPortfolioBankDetailsRepository')
    private portfolioBankDetailsRepository: IPortfolioBankDetailsRepository,
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(PermissionService) private permissionService: PermissionService,
    @Inject(EmailUtil) private emailUtil: EmailUtil
  ) {}

  /**
   * Validate bank details based on bank type and sub-type
   * Copied from PropertyBankDetailsService
   */
  private validateAndNormalizeBankDetails(
    data: CreatePortfolioBankDetailsDto | UpdatePortfolioBankDetailsDto
  ): CreatePortfolioBankDetailsDto | UpdatePortfolioBankDetailsDto | null {
    // Check if bank_type is "none" - this means remove bank details
    if (data.bank_type === 'none') {
      return null
    }

    // Check if stripe_account_email is provided
    if (data.stripe_account_email && data.stripe_account_email.trim()) {
      // This is a Stripe account - override bank_type and validate
      const normalizedData: any = {
        ...data,
        bank_type: BankType.stripe,
        stripe_account_email: data.stripe_account_email.trim(),
        // Clear bank-specific fields for stripe
        bank_sub_type: undefined,
        hotel_portfolio_name: undefined,
        beneficiary_name: undefined,
        beneficiary_address: undefined,
        account_number: undefined,
        account_name: undefined,
        bank_name: undefined,
        bank_branch: undefined,
        swift_bic_iban: undefined,
        routing_number: undefined,
        bank_account_type: undefined,
        currency: undefined
      }

      return normalizedData
    } else {
      // This is a bank account - validate bank_sub_type is provided
      if (!data.bank_sub_type) {
        throw new BadRequestException(
          'bank_sub_type is required when bank_type is "bank". Please choose: ach, domestic_wire, or international_wire'
        )
      }

      // Validate required fields based on bank_sub_type
      const missingFields: string[] = []

      // Common required fields for all bank sub-types
      if (!data.hotel_portfolio_name || !data.hotel_portfolio_name.trim()) {
        missingFields.push('hotel_portfolio_name')
      }
      if (!data.bank_name || !data.bank_name.trim()) {
        missingFields.push('bank_name')
      }

      // Validate based on bank sub-type
      switch (data.bank_sub_type) {
        case BankSubType.ach:
          // ACH required fields
          if (!data.beneficiary_name || !data.beneficiary_name.trim()) {
            missingFields.push('beneficiary_name')
          }
          if (!data.account_number || !data.account_number.trim()) {
            missingFields.push('account_number')
          }
          if (!data.routing_number || !data.routing_number.trim()) {
            missingFields.push('routing_number')
          } else if (!isNineDigitUsRoutingNumber(data.routing_number)) {
            throw new BadRequestException(
              'Routing number must be 9 digits for ACH'
            )
          }
          if (!data.bank_account_type) {
            missingFields.push('bank_account_type')
          }
          break

        case BankSubType.domestic_wire:
          // Domestic US Wire required fields
          if (!data.beneficiary_name || !data.beneficiary_name.trim()) {
            missingFields.push('beneficiary_name')
          }
          if (!data.account_number || !data.account_number.trim()) {
            missingFields.push('account_number')
          }
          if (!data.routing_number || !data.routing_number.trim()) {
            missingFields.push('routing_number')
          } else if (!isNineDigitUsRoutingNumber(data.routing_number)) {
            throw new BadRequestException(
              'Routing number must be 9 digits for Domestic Wire'
            )
          }
          break

        case BankSubType.international_wire:
          // International Wire required fields
          if (!data.beneficiary_name || !data.beneficiary_name.trim()) {
            missingFields.push('beneficiary_name')
          }
          if (!data.iban_number || !data.iban_number.trim()) {
            missingFields.push('iban_number')
          }
          if (!data.swift_bic_number || !data.swift_bic_number.trim()) {
            missingFields.push('swift_bic_number')
          }
          break

        default:
          throw new BadRequestException(
            `Invalid bank_sub_type: ${String(data.bank_sub_type)}. Must be one of: ach, domestic_wire, international_wire`
          )
      }

      if (missingFields.length > 0) {
        throw new BadRequestException(
          `Missing required fields for ${data.bank_sub_type}: ${missingFields.join(', ')}`
        )
      }

      // This is a bank account - override bank_type and clear stripe field
      const normalizedData: any = {
        ...data,
        bank_type: BankType.bank,
        stripe_account_email: undefined
      }

      return normalizedData
    }
  }

  /**
   * Check if user has permission to perform an action on bank details for a portfolio
   */
  private async checkPortfolioBankDetailsPermission(
    user: IUserWithPermissions,
    portfolioId: string,
    action: PermissionAction
  ): Promise<void> {
    // Verify portfolio exists
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: { id: true }
    })

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    // Use PermissionService to check bank_details permission
    await this.permissionService.requirePermission(
      user,
      ModuleType.BANK_DETAILS,
      action,
      portfolioId
    )
  }

  /**
   * Copy portfolio bank details to all child properties
   */
  private async copyToChildProperties(
    portfolioId: string,
    bankDetailsData: any,
    userId: string
  ): Promise<void> {
    // Get all properties under this portfolio
    const properties = await this.prisma.property.findMany({
      where: { portfolio_id: portfolioId },
      select: { id: true }
    })

    if (properties.length === 0) {
      return // No properties to update
    }

    // Copy bank details to each property
    for (const property of properties) {
      const existingBankDetails =
        await this.prisma.propertyBankDetails.findUnique({
          where: { property_id: property.id }
        })

      // Exclude portfolio_id as PropertyBankDetails doesn't have this field
      const { portfolio_id: _portfolio_id, ...propertyBankData } = bankDetailsData

      const dataForProperty = {
        ...propertyBankData,
        property_id: property.id,
        associated_user_id: userId
      }

      if (existingBankDetails) {
        // Update existing bank details
        await this.prisma.propertyBankDetails.update({
          where: { property_id: property.id },
          data: dataForProperty
        })
      } else {
        // Create new bank details
        await this.prisma.propertyBankDetails.create({
          data: dataForProperty
        })
      }
    }
  }

  /**
   * Get all super admin emails
   */
  private async getSuperAdminEmails(): Promise<string[]> {
    const allUsers = await this.prisma.user.findMany({
      where: {
        is_verified: true
      },
      select: {
        id: true,
        email: true,
        role: {
          select: {
            portfolio_permission: true,
            property_permission: true,
            audit_permission: true,
            user_permission: true,
            system_settings_permission: true
          }
        }
      }
    })

    const superAdminEmails: string[] = []

    for (const user of allUsers) {
      const allPermissions = [
        user.role.portfolio_permission,
        user.role.property_permission,
        user.role.audit_permission,
        user.role.user_permission,
        user.role.system_settings_permission
      ]

      const isSuperAdmin = allPermissions.every(
        permission =>
          permission &&
          permission.permission_level === 'all' &&
          permission.access_level === 'all'
      )

      if (isSuperAdmin) {
        superAdminEmails.push(user.email)
      }
    }

    return superAdminEmails
  }

  /**
   * Get users with specific role attributes who have access to a portfolio
   * Matches by permissions/attributes instead of role name
   */
  private async getUsersWithRolesAndPortfolioAccess(
    portfolioId: string,
    _roleNames: string[]
  ): Promise<string[]> {
    const userEmails: string[] = []

    const allUsers = await this.prisma.user.findMany({
      where: {
        is_verified: true
      },
      select: {
        id: true,
        email: true,
        role: {
          select: {
            name: true,
            is_external: true,
            can_access_mis: true,
            bank_details_permission: true,
            portfolio_permission: true,
            property_permission: true,
            audit_permission: true,
            user_permission: true,
            system_settings_permission: true
          }
        }
      }
    })

    const matchingUsers: typeof allUsers = []

    for (const user of allUsers) {
      const role = user.role

      if (isBankDetailsNotificationRecipientRole(role)) {
        matchingUsers.push(user)
      }
    }

    if (matchingUsers.length === 0) {
      return userEmails
    }

    const userIds = matchingUsers.map(u => u.id)
    const userAccesses = await this.prisma.userAccessedProperty.findMany({
      where: {
        user_id: {
          in: userIds
        }
      },
      select: {
        user_id: true,
        portfolio_id: true
      }
    })

    for (const access of userAccesses) {
      const portfolioIds = access.portfolio_id || []
      if (portfolioIds.includes(portfolioId)) {
        const user = matchingUsers.find(u => u.id === access.user_id)
        if (user) {
          userEmails.push(user.email)
        }
      }
    }

    return userEmails
  }

  /**
   * Send email notification when bank details are created, updated, or deleted
   * Sends to super admins and users with Client Portfolio Manager / VNP Admin roles
   */
  private async sendBankDetailsNotification(
    portfolioId: string,
    action: 'created' | 'updated' | 'deleted',
    location?: string | null
  ): Promise<void> {
    try {
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        select: {
          id: true,
          name: true
        }
      })

      if (!portfolio) {
        return
      }

      const allRecipients: string[] = []

      const superAdminEmails = await this.getSuperAdminEmails()
      allRecipients.push(...superAdminEmails)

      const roleUserEmails = await this.getUsersWithRolesAndPortfolioAccess(
        portfolioId,
        ['Client portfolio manager', 'VNP Admin']
      )
      allRecipients.push(...roleUserEmails)

      const uniqueRecipients = [...new Set(allRecipients)]

      if (uniqueRecipients.length === 0) {
        return
      }

      const bankEmailResult = await this.emailUtil.sendBankDetailsUpdateEmail(
        uniqueRecipients,
        [portfolio.name],
        location ?? null,
        new Date()
      )
      if (bankEmailResult.failed.length > 0) {
        this.logger.warn(
          'Portfolio bank details notification email partial failure',
          { failed: bankEmailResult.failed }
        )
      }
    } catch (error) {
      console.error(
        'Error sending portfolio bank details notification:',
        error
      )
    }
  }

  /**
   * Remove bank details from all child properties
   */
  private async removeFromChildProperties(portfolioId: string): Promise<void> {
    // Get all properties under this portfolio
    const properties = await this.prisma.property.findMany({
      where: { portfolio_id: portfolioId },
      select: { id: true }
    })

    if (properties.length === 0) {
      return // No properties to update
    }

    // Delete bank details from each property
    for (const property of properties) {
      await this.prisma.propertyBankDetails.deleteMany({
        where: { property_id: property.id }
      })
    }
  }

  async create(
    data: CreatePortfolioBankDetailsDto,
    user: IUserWithPermissions,
    location?: string | null
  ) {
    // Check permission
    await this.checkPortfolioBankDetailsPermission(
      user,
      data.portfolio_id,
      PermissionAction.CREATE
    )

    // Validate and normalize bank details
    const normalizedData = this.validateAndNormalizeBankDetails(data)

    // If bank_type is "none", check if bank details exist and return appropriate response
    if (normalizedData === null) {
      const existingBankDetails =
        await this.portfolioBankDetailsRepository.findByPortfolioId(
          data.portfolio_id
        )

      if (existingBankDetails) {
        throw new ConflictException(
          'Bank details already exist for this portfolio'
        )
      }

      // No bank details to create - return success
      return {
        id: data.portfolio_id,
        message: 'No bank details to create'
      } as any
    }

    // For other bank types, check if bank details already exist
    const existingBankDetails =
      await this.portfolioBankDetailsRepository.findByPortfolioId(
        data.portfolio_id
      )

    if (existingBankDetails) {
      throw new ConflictException(
        'Bank details already exist for this portfolio'
      )
    }

    // Set associated_user_id to current user
    ;(normalizedData as CreatePortfolioBankDetailsDto).associated_user_id =
      user.id

    const result = await this.portfolioBankDetailsRepository.create(
      normalizedData as CreatePortfolioBankDetailsDto
    )

    // Copy bank details to all child properties
    await this.copyToChildProperties(
      data.portfolio_id,
      normalizedData,
      user.id
    )

    // Send email notification to super admins and role users
    logBankDetailsEmailComparison(
      'portfolio-bank-details create',
      true,
      `portfolioId=${data.portfolio_id}`
    )
    await this.sendBankDetailsNotification(
      data.portfolio_id,
      'created',
      location
    )

    return result
  }

  async findByPortfolioId(portfolioId: string, _user: IUserWithPermissions) {
    const bankDetails =
      await this.portfolioBankDetailsRepository.findByPortfolioId(portfolioId)

    if (!bankDetails) {
      throw new NotFoundException('Bank details not found for this portfolio')
    }

    return bankDetails
  }

  async update(
    portfolioId: string,
    data: UpdatePortfolioBankDetailsDto,
    user: IUserWithPermissions,
    location?: string | null
  ) {
    // Check permission
    await this.checkPortfolioBankDetailsPermission(
      user,
      portfolioId,
      PermissionAction.UPDATE
    )

    // Validate and normalize bank details
    const normalizedData = this.validateAndNormalizeBankDetails(data)

    // If bank_type is "none", delete existing bank details if they exist
    if (normalizedData === null) {
      const bankDetails =
        await this.portfolioBankDetailsRepository.findByPortfolioId(
          portfolioId
        )

      if (bankDetails) {
        // Bank details exist, delete them
        const deleted =
          await this.portfolioBankDetailsRepository.delete(portfolioId)

        // Remove bank details from all child properties
        await this.removeFromChildProperties(portfolioId)

        // Send email notification about deletion
        logBankDetailsEmailComparison(
          'portfolio-bank-details update (delete)',
          true,
          `portfolioId=${portfolioId} action=deleted`
        )
        await this.sendBankDetailsNotification(
          portfolioId,
          'deleted',
          location
        )

        return deleted
      } else {
        // Bank details don't exist, return a success response
        return {
          id: portfolioId,
          message: 'No bank details to remove'
        } as any
      }
    }

    // For other bank types, check if bank details exist
    const bankDetails =
      await this.portfolioBankDetailsRepository.findByPortfolioId(portfolioId)

    if (!bankDetails) {
      throw new NotFoundException(
        'Bank details not found for this portfolio'
      )
    }

    // Update associated_user_id to current user
    ;(normalizedData as UpdatePortfolioBankDetailsDto).associated_user_id =
      user.id

    const beforeComparable = toComparableBankDetails(
      bankDetails as unknown as Record<string, unknown>
    )

    const result = await this.portfolioBankDetailsRepository.update(
      portfolioId,
      normalizedData as UpdatePortfolioBankDetailsDto
    )

    // Copy updated bank details to all child properties
    await this.copyToChildProperties(portfolioId, normalizedData, user.id)

    const afterComparable = toComparableBankDetails(
      result as unknown as Record<string, unknown>
    )
    if (!comparableBankDetailsEqual(beforeComparable, afterComparable)) {
      logBankDetailsEmailComparison(
        'portfolio-bank-details update',
        true,
        `portfolioId=${portfolioId} action=updated`
      )
      await this.sendBankDetailsNotification(
        portfolioId,
        'updated',
        location
      )
    } else {
      logBankDetailsEmailComparison(
        'portfolio-bank-details update',
        false,
        `portfolioId=${portfolioId}`
      )
    }

    return result
  }
}
