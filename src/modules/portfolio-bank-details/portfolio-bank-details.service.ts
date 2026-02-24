import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { BankSubType, BankType } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
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
  constructor(
    @Inject('IPortfolioBankDetailsRepository')
    private portfolioBankDetailsRepository: IPortfolioBankDetailsRepository,
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(PermissionService) private permissionService: PermissionService
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
          } else if (data.routing_number.trim().length < 9) {
            throw new BadRequestException(
              'Routing number must be at least 9 digits for ACH'
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
          } else if (data.routing_number.trim().length < 9) {
            throw new BadRequestException(
              'Routing number must be at least 9 digits for Domestic Wire'
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

      const propertyBankData = {
        ...bankDetailsData,
        property_id: property.id,
        associated_user_id: userId
      }

      if (existingBankDetails) {
        // Update existing bank details
        await this.prisma.propertyBankDetails.update({
          where: { property_id: property.id },
          data: propertyBankData
        })
      } else {
        // Create new bank details
        await this.prisma.propertyBankDetails.create({
          data: propertyBankData
        })
      }
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

    return result
  }

  async findByPortfolioId(portfolioId: string, user: IUserWithPermissions) {
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

    const result = await this.portfolioBankDetailsRepository.update(
      portfolioId,
      normalizedData as UpdatePortfolioBankDetailsDto
    )

    // Copy updated bank details to all child properties
    await this.copyToChildProperties(portfolioId, normalizedData, user.id)

    return result
  }
}
