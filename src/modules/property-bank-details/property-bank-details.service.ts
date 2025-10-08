import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { BankType } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreatePropertyBankDetailsDto,
  UpdatePropertyBankDetailsDto
} from './property-bank-details.dto'
import type {
  IPropertyBankDetailsRepository,
  IPropertyBankDetailsService
} from './property-bank-details.interface'

@Injectable()
export class PropertyBankDetailsService implements IPropertyBankDetailsService {
  constructor(
    @Inject('IPropertyBankDetailsRepository')
    private propertyBankDetailsRepository: IPropertyBankDetailsRepository
  ) {}

  private validateAndNormalizeBankDetails(
    data: CreatePropertyBankDetailsDto | UpdatePropertyBankDetailsDto
  ): CreatePropertyBankDetailsDto | UpdatePropertyBankDetailsDto {
    // Check if stripe_account_email is provided
    if (data.stripe_account_email && data.stripe_account_email.trim()) {
      // This is a Stripe account - override bank_type and validate
      const normalizedData: any = {
        ...data,
        bank_type: BankType.stripe,
        stripe_account_email: data.stripe_account_email.trim(),
        // Clear bank-specific fields for stripe
        account_number: undefined,
        account_name: undefined,
        bank_name: undefined,
        bank_branch: undefined,
        swift_code: undefined,
        routing_number: undefined
      }

      return normalizedData
    } else {
      // This is a bank account - validate required fields
      const missingFields: string[] = []

      if (!data.account_number || !data.account_number.trim()) {
        missingFields.push('account_number')
      }
      if (!data.account_name || !data.account_name.trim()) {
        missingFields.push('account_name')
      }
      if (!data.bank_name || !data.bank_name.trim()) {
        missingFields.push('bank_name')
      }
      if (!data.bank_branch || !data.bank_branch.trim()) {
        missingFields.push('bank_branch')
      }
      if (!data.swift_code || !data.swift_code.trim()) {
        missingFields.push('swift_code')
      }
      if (!data.routing_number || !data.routing_number.trim()) {
        missingFields.push('routing_number')
      }

      if (missingFields.length > 0) {
        throw new BadRequestException(
          `Missing required fields for bank account: ${missingFields.join(', ')}`
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

  async create(
    data: CreatePropertyBankDetailsDto,
    _user: IUserWithPermissions
  ) {
    const existingBankDetails =
      await this.propertyBankDetailsRepository.findByPropertyId(
        data.property_id
      )

    if (existingBankDetails) {
      throw new ConflictException(
        'Bank details already exist for this property'
      )
    }

    // Validate and normalize bank details based on type
    const normalizedData = this.validateAndNormalizeBankDetails(
      data
    ) as CreatePropertyBankDetailsDto

    return this.propertyBankDetailsRepository.create(normalizedData)
  }

  async findByPropertyId(propertyId: string, _user: IUserWithPermissions) {
    const bankDetails =
      await this.propertyBankDetailsRepository.findByPropertyId(propertyId)

    if (!bankDetails) {
      throw new NotFoundException('Bank details not found for this property')
    }

    return bankDetails
  }

  async update(
    propertyId: string,
    data: UpdatePropertyBankDetailsDto,
    _user: IUserWithPermissions
  ) {
    const bankDetails =
      await this.propertyBankDetailsRepository.findByPropertyId(propertyId)

    if (!bankDetails) {
      throw new NotFoundException('Bank details not found for this property')
    }

    // Validate and normalize bank details based on type
    const normalizedData = this.validateAndNormalizeBankDetails(
      data
    ) as UpdatePropertyBankDetailsDto

    return this.propertyBankDetailsRepository.update(propertyId, normalizedData)
  }
}
