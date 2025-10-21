import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { BankType } from '@prisma/client'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { PrismaService } from '../prisma/prisma.service'
import {
  BulkUpdateBankDetailsResultDto,
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
    private propertyBankDetailsRepository: IPropertyBankDetailsRepository,
    @Inject(PrismaService) private prisma: PrismaService
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

  async bulkUpdate(
    file: Express.Multer.File,
    _user: IUserWithPermissions
  ): Promise<BulkUpdateBankDetailsResultDto> {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    if (
      !file.originalname.endsWith('.xlsx') &&
      !file.originalname.endsWith('.xls')
    ) {
      throw new BadRequestException(
        'File must be an Excel file (.xlsx or .xls)'
      )
    }

    const result: BulkUpdateBankDetailsResultDto = {
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      successfulUpdates: []
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file is empty')
      }

      result.totalRows = data.length

      // Helper function to find header value with flexible naming
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim()
          }
        }
        return undefined
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract property name (required)
          const propertyName = findHeaderValue(row, [
            'Property Name',
            'Property name',
            'Name'
          ])

          if (!propertyName) {
            result.errors.push({
              row: rowNumber,
              property: 'Unknown',
              error: 'Property name is required'
            })
            result.failureCount++
            continue
          }

          // Find property by name
          const property = await this.prisma.property.findFirst({
            where: { name: propertyName }
          })

          if (!property) {
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: 'Property not found'
            })
            result.failureCount++
            continue
          }

          // Extract bank details fields
          const stripeAccountEmail = findHeaderValue(row, [
            'Stripe Account Email',
            'Stripe Email',
            'Stripe account email'
          ])

          const accountNumber = findHeaderValue(row, [
            'Account Number',
            'Account number',
            'Bank Account'
          ])
          const accountName = findHeaderValue(row, [
            'Account Name',
            'Account name',
            'Account Holder'
          ])
          const bankName = findHeaderValue(row, [
            'Bank Name',
            'Bank name',
            'Bank'
          ])
          const bankBranch = findHeaderValue(row, [
            'Bank Branch',
            'Bank branch',
            'Branch'
          ])
          const swiftCode = findHeaderValue(row, [
            'Swift Code',
            'Swift code',
            'SWIFT'
          ])
          const routingNumber = findHeaderValue(row, [
            'Routing Number',
            'Routing number',
            'Routing'
          ])

          // Check if any bank details are provided
          if (
            !stripeAccountEmail &&
            !accountNumber &&
            !accountName &&
            !bankName &&
            !bankBranch &&
            !swiftCode &&
            !routingNumber
          ) {
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: 'No bank details provided to update'
            })
            result.failureCount++
            continue
          }

          // Check if bank details already exist
          const existingBankDetails =
            await this.propertyBankDetailsRepository.findByPropertyId(
              property.id
            )

          // Prepare update data - only include fields that are provided
          const updateData: any = {}

          // Determine bank type and set fields accordingly
          if (stripeAccountEmail && stripeAccountEmail.trim()) {
            // Stripe account
            updateData.bank_type = BankType.stripe
            updateData.stripe_account_email = stripeAccountEmail.trim()
            // Clear bank fields for stripe
            updateData.account_number = null
            updateData.account_name = null
            updateData.bank_name = null
            updateData.bank_branch = null
            updateData.swift_code = null
            updateData.routing_number = null
          } else {
            // Bank account - only update provided fields
            updateData.bank_type = BankType.bank
            updateData.stripe_account_email = null

            // Only add fields that are provided
            if (accountNumber !== undefined) {
              updateData.account_number = accountNumber
            }
            if (accountName !== undefined) {
              updateData.account_name = accountName
            }
            if (bankName !== undefined) {
              updateData.bank_name = bankName
            }
            if (bankBranch !== undefined) {
              updateData.bank_branch = bankBranch
            }
            if (swiftCode !== undefined) {
              updateData.swift_code = swiftCode
            }
            if (routingNumber !== undefined) {
              updateData.routing_number = routingNumber
            }

            // Validate that all required fields are present (either from existing or new data)
            if (existingBankDetails) {
              // Merge with existing data for validation
              const mergedData = {
                account_number:
                  updateData.account_number !== undefined
                    ? updateData.account_number
                    : existingBankDetails.account_number,
                account_name:
                  updateData.account_name !== undefined
                    ? updateData.account_name
                    : existingBankDetails.account_name,
                bank_name:
                  updateData.bank_name !== undefined
                    ? updateData.bank_name
                    : existingBankDetails.bank_name,
                bank_branch:
                  updateData.bank_branch !== undefined
                    ? updateData.bank_branch
                    : existingBankDetails.bank_branch,
                swift_code:
                  updateData.swift_code !== undefined
                    ? updateData.swift_code
                    : existingBankDetails.swift_code,
                routing_number:
                  updateData.routing_number !== undefined
                    ? updateData.routing_number
                    : existingBankDetails.routing_number
              }

              // Validate merged data
              const missingFields: string[] = []
              if (
                !mergedData.account_number ||
                !mergedData.account_number.trim()
              ) {
                missingFields.push('Account Number')
              }
              if (!mergedData.account_name || !mergedData.account_name.trim()) {
                missingFields.push('Account Name')
              }
              if (!mergedData.bank_name || !mergedData.bank_name.trim()) {
                missingFields.push('Bank Name')
              }
              if (!mergedData.bank_branch || !mergedData.bank_branch.trim()) {
                missingFields.push('Bank Branch')
              }
              if (!mergedData.swift_code || !mergedData.swift_code.trim()) {
                missingFields.push('Swift Code')
              }
              if (
                !mergedData.routing_number ||
                !mergedData.routing_number.trim()
              ) {
                missingFields.push('Routing Number')
              }

              if (missingFields.length > 0) {
                result.errors.push({
                  row: rowNumber,
                  property: propertyName,
                  error: `Missing required fields for bank account: ${missingFields.join(', ')}`
                })
                result.failureCount++
                continue
              }
            } else {
              // New bank details - all fields must be provided
              const missingFields: string[] = []
              if (!accountNumber || !accountNumber.trim()) {
                missingFields.push('Account Number')
              }
              if (!accountName || !accountName.trim()) {
                missingFields.push('Account Name')
              }
              if (!bankName || !bankName.trim()) {
                missingFields.push('Bank Name')
              }
              if (!bankBranch || !bankBranch.trim()) {
                missingFields.push('Bank Branch')
              }
              if (!swiftCode || !swiftCode.trim()) {
                missingFields.push('Swift Code')
              }
              if (!routingNumber || !routingNumber.trim()) {
                missingFields.push('Routing Number')
              }

              if (missingFields.length > 0) {
                result.errors.push({
                  row: rowNumber,
                  property: propertyName,
                  error: `Missing required fields for bank account: ${missingFields.join(', ')}`
                })
                result.failureCount++
                continue
              }
            }
          }

          if (existingBankDetails) {
            // Update existing bank details
            await this.propertyBankDetailsRepository.update(
              property.id,
              updateData
            )
          } else {
            // Create new bank details
            updateData.property_id = property.id
            await this.propertyBankDetailsRepository.create(updateData)
          }

          result.successCount++
          result.successfulUpdates.push(propertyName)
        } catch (error) {
          const propertyName =
            findHeaderValue(row, ['Property Name', 'Property name', 'Name']) ||
            'Unknown'

          result.errors.push({
            row: rowNumber,
            property: propertyName,
            error: error.message || 'Unknown error occurred'
          })
          result.failureCount++
        }
      }

      return result
    } catch (error) {
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`
      )
    }
  }
}
