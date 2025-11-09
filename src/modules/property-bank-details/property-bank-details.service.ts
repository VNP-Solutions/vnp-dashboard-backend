import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { BankType, BankSubType } from '@prisma/client'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { isUserSuperAdmin, isPropertyManagerFor, isPortfolioManagerFor } from '../../common/utils/permission.util'
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

  /**
   * Validate bank details based on bank type and sub-type
   */
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
        bank_sub_type: undefined,
        hotel_portfolio_name: undefined,
        beneficiary_name: undefined,
        beneficiary_address: undefined,
        account_number: undefined,
        account_name: undefined,
        bank_name: undefined,
        bank_branch: undefined,
        swift_code: undefined,
        iban_number: undefined,
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
      if (!data.account_number || !data.account_number.trim()) {
        missingFields.push('account_number')
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
          if (!data.routing_number || !data.routing_number.trim()) {
            missingFields.push('routing_number')
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
          if (!data.beneficiary_address || !data.beneficiary_address.trim()) {
            missingFields.push('beneficiary_address')
          }
          if (!data.routing_number || !data.routing_number.trim()) {
            missingFields.push('routing_number')
          }
          break

        case BankSubType.international_wire:
          // International Wire required fields
          if (!data.beneficiary_name || !data.beneficiary_name.trim()) {
            missingFields.push('beneficiary_name')
          }
          if (!data.beneficiary_address || !data.beneficiary_address.trim()) {
            missingFields.push('beneficiary_address')
          }
          if (!data.swift_code || !data.swift_code.trim()) {
            missingFields.push('swift_code')
          }
          if (!data.iban_number || !data.iban_number.trim()) {
            missingFields.push('iban_number')
          }
          if (!data.currency || !data.currency.trim()) {
            missingFields.push('currency')
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
   * Check if user has permission to edit bank details for a property
   * Only super admin, property manager, or portfolio manager can edit
   */
  private async checkEditPermission(
    user: IUserWithPermissions,
    propertyId: string
  ): Promise<void> {
    // Super admin can do anything
    if (isUserSuperAdmin(user)) {
      return
    }

    // Get property with portfolio info
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        portfolio_id: true
      }
    })

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Get user's accessible properties and portfolios
    const userAccess = await this.prisma.userAccessedProperty.findFirst({
      where: { user_id: user.id }
    })

    const accessiblePropertyIds = userAccess?.property_id || []
    const accessiblePortfolioIds = userAccess?.portfolio_id || []

    // Check if user is property manager for this property
    if (isPropertyManagerFor(user, propertyId, accessiblePropertyIds)) {
      return
    }

    // Check if user is portfolio manager for the parent portfolio
    if (isPortfolioManagerFor(user, property.portfolio_id, accessiblePortfolioIds)) {
      return
    }

    // User doesn't have permission
    throw new ForbiddenException(
      'You do not have permission to edit bank details for this property. Only super admins, property managers, or portfolio managers can edit bank details.'
    )
  }

  async create(
    data: CreatePropertyBankDetailsDto,
    user: IUserWithPermissions
  ) {
    // Check permission
    await this.checkEditPermission(user, data.property_id)

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

    // Set associated_user_id to current user
    normalizedData.associated_user_id = user.id

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
    user: IUserWithPermissions
  ) {
    // Check permission
    await this.checkEditPermission(user, propertyId)

    const bankDetails =
      await this.propertyBankDetailsRepository.findByPropertyId(propertyId)

    if (!bankDetails) {
      throw new NotFoundException('Bank details not found for this property')
    }

    // Validate and normalize bank details based on type
    const normalizedData = this.validateAndNormalizeBankDetails(
      data
    ) as UpdatePropertyBankDetailsDto

    // Update associated_user_id to current user
    normalizedData.associated_user_id = user.id

    return this.propertyBankDetailsRepository.update(propertyId, normalizedData)
  }

  async bulkUpdate(
    file: Express.Multer.File,
    user: IUserWithPermissions
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

      // Log available columns for debugging
      if (data.length > 0) {
        const firstRow = data[0] as any
        const availableColumns = Object.keys(firstRow)
        console.log(
          'Available Excel columns:',
          JSON.stringify(availableColumns)
        )
        console.log(
          'Sample first row values:',
          JSON.stringify(firstRow, null, 2)
        )
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
            'property_name',
            'Name',
            'Property'
          ])

          // Log row data for debugging
          console.table([{
            'Row #': rowNumber,
            'Property Name': propertyName || 'N/A',
            'Bank Type': findHeaderValue(row, ['Bank Type', 'Bank type', 'bank_type']) || 'N/A',
            'Bank Sub Type': findHeaderValue(row, ['Bank Sub Type', 'Bank sub type', 'bank_sub_type', 'Sub Type', 'SubType']) || 'N/A',
            'Stripe Email': findHeaderValue(row, ['Stripe Account Email', 'Stripe Email', 'Stripe account email', 'stripe_account_email']) || 'N/A'
          }])

          if (!propertyName) {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Property name is required. Available columns: ${Object.keys(row).join(', ')}`
            )
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
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Property '${propertyName}' not found in database`
            )
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: 'Property not found'
            })
            result.failureCount++
            continue
          }

          // Check permission for this property
          try {
            await this.checkEditPermission(user, property.id)
          } catch {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: No permission to edit '${propertyName}'`
            )
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: 'You do not have permission to edit bank details for this property'
            })
            result.failureCount++
            continue
          }

          // Extract bank details fields with comprehensive name matching
          const stripeAccountEmail = findHeaderValue(row, [
            'Stripe Account Email',
            'Stripe account email',
            'stripe_account_email',
            'Stripe Email',
            'Stripe email',
            'stripe_email'
          ])

          const bankSubType = findHeaderValue(row, [
            'Bank Sub Type',
            'Bank sub type',
            'Bank Sub type',
            'bank_sub_type',
            'Sub Type',
            'SubType',
            'Subtype',
            'Bank Subtype'
          ])
          const hotelPortfolioName = findHeaderValue(row, [
            'Hotel Portfolio Name',
            'Hotel portfolio name',
            'hotel_portfolio_name',
            'Hotel Name',
            'Hotel name',
            'Portfolio Name',
            'Portfolio name'
          ])
          const beneficiaryName = findHeaderValue(row, [
            'Beneficiary Name',
            'Beneficiary name',
            'beneficiary_name',
            'Beneficiary',
            'Beneficiary Name (ACH)'
          ])
          const beneficiaryAddress = findHeaderValue(row, [
            'Beneficiary Address',
            'Beneficiary address',
            'beneficiary_address',
            'Address',
            'Beneficiary addr'
          ])
          const accountNumber = findHeaderValue(row, [
            'Account Number',
            'Account number',
            'account_number',
            'Bank Account',
            'Bank Account Number',
            'Account No',
            'Account #'
          ])
          const accountName = findHeaderValue(row, [
            'Account Name',
            'Account name',
            'account_name',
            'Account Holder',
            'Account holder',
            'Account Holder Name'
          ])
          const bankName = findHeaderValue(row, [
            'Bank Name',
            'Bank name',
            'bank_name',
            'Bank'
          ])
          const bankBranch = findHeaderValue(row, [
            'Bank Branch',
            'Bank branch',
            'bank_branch',
            'Branch',
            'Branch Name'
          ])
          const swiftCode = findHeaderValue(row, [
            'Swift Code',
            'Swift code',
            'swift_code',
            'SWIFT',
            'Swift',
            'SWIFT Code',
            'BIC',
            'SWIFT/BIC'
          ])
          const ibanNumber = findHeaderValue(row, [
            'IBAN Number',
            'IBAN number',
            'iban_number',
            'IBAN',
            'Iban'
          ])
          const routingNumber = findHeaderValue(row, [
            'Routing Number',
            'Routing number',
            'routing_number',
            'Routing',
            'Routing No',
            'ABA Number',
            'ABA'
          ])
          const bankAccountType = findHeaderValue(row, [
            'Bank Account Type',
            'Bank account type',
            'bank_account_type',
            'Account Type',
            'Account type',
            'Type'
          ])
          const currency = findHeaderValue(row, [
            'Currency',
            'currency',
            'Currency Code',
            'Currency code'
          ])

          // Check if any bank details are provided
          if (
            !stripeAccountEmail &&
            !bankSubType &&
            !hotelPortfolioName &&
            !beneficiaryName &&
            !beneficiaryAddress &&
            !accountNumber &&
            !accountName &&
            !bankName &&
            !bankBranch &&
            !swiftCode &&
            !ibanNumber &&
            !routingNumber &&
            !bankAccountType &&
            !currency
          ) {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: No bank details provided for '${propertyName}'`
            )
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

          // Prepare update data
          const updateData: any = {}

          // Determine bank type and set fields accordingly
          if (stripeAccountEmail && stripeAccountEmail.trim()) {
            // Stripe account
            updateData.bank_type = BankType.stripe
            updateData.stripe_account_email = stripeAccountEmail.trim()
            // Clear bank fields for stripe
            updateData.bank_sub_type = null
            updateData.hotel_portfolio_name = null
            updateData.beneficiary_name = null
            updateData.beneficiary_address = null
            updateData.account_number = null
            updateData.account_name = null
            updateData.bank_name = null
            updateData.bank_branch = null
            updateData.swift_code = null
            updateData.iban_number = null
            updateData.routing_number = null
            updateData.bank_account_type = null
            updateData.currency = null
          } else {
            // Bank account - update provided fields
            updateData.bank_type = BankType.bank
            updateData.stripe_account_email = null

            // Set bank sub type if provided
            if (bankSubType !== undefined) {
              const normalizedSubType = bankSubType.toLowerCase().replace(/\s+/g, '_')
              if (['ach', 'domestic_wire', 'international_wire'].includes(normalizedSubType)) {
                updateData.bank_sub_type = normalizedSubType
              } else {
                console.log(
                  '\x1b[31m%s\x1b[0m',
                  `❌ Row ${rowNumber} FAILED: Invalid bank sub type '${bankSubType}' for '${propertyName}'`
                )
                result.errors.push({
                  row: rowNumber,
                  property: propertyName,
                  error: `Invalid bank sub type: ${bankSubType}. Must be one of: ach, domestic_wire, international_wire`
                })
                result.failureCount++
                continue
              }
            }

            // Only add fields that are provided
            if (hotelPortfolioName !== undefined) {
              updateData.hotel_portfolio_name = hotelPortfolioName
            }
            if (beneficiaryName !== undefined) {
              updateData.beneficiary_name = beneficiaryName
            }
            if (beneficiaryAddress !== undefined) {
              updateData.beneficiary_address = beneficiaryAddress
            }
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
            if (ibanNumber !== undefined) {
              updateData.iban_number = ibanNumber
            }
            if (routingNumber !== undefined) {
              updateData.routing_number = routingNumber
            }
            if (bankAccountType !== undefined) {
              const normalizedAccountType = bankAccountType.toLowerCase()
              if (['checking', 'savings'].includes(normalizedAccountType)) {
                updateData.bank_account_type = normalizedAccountType
              } else {
                console.log(
                  '\x1b[31m%s\x1b[0m',
                  `❌ Row ${rowNumber} FAILED: Invalid bank account type '${bankAccountType}' for '${propertyName}'`
                )
                result.errors.push({
                  row: rowNumber,
                  property: propertyName,
                  error: `Invalid bank account type: ${bankAccountType}. Must be one of: checking, savings`
                })
                result.failureCount++
                continue
              }
            }
            if (currency !== undefined) {
              updateData.currency = currency
            }

            // Validate based on bank_sub_type (if updating)
            const finalSubType = updateData.bank_sub_type !== undefined
              ? updateData.bank_sub_type
              : existingBankDetails?.bank_sub_type

            if (!finalSubType && !existingBankDetails) {
              console.log(
                '\x1b[31m%s\x1b[0m',
                `❌ Row ${rowNumber} FAILED: bank_sub_type is required for new bank account for '${propertyName}'`
              )
              result.errors.push({
                row: rowNumber,
                property: propertyName,
                error: 'bank_sub_type is required for new bank account'
              })
              result.failureCount++
              continue
            }

            // Validate required fields based on sub-type
            if (finalSubType) {
              const missingFields: string[] = []

              // Merge with existing data for validation
              const mergedData = {
                hotel_portfolio_name:
                  updateData.hotel_portfolio_name !== undefined
                    ? updateData.hotel_portfolio_name
                    : existingBankDetails?.hotel_portfolio_name,
                beneficiary_name:
                  updateData.beneficiary_name !== undefined
                    ? updateData.beneficiary_name
                    : existingBankDetails?.beneficiary_name,
                beneficiary_address:
                  updateData.beneficiary_address !== undefined
                    ? updateData.beneficiary_address
                    : existingBankDetails?.beneficiary_address,
                account_number:
                  updateData.account_number !== undefined
                    ? updateData.account_number
                    : existingBankDetails?.account_number,
                bank_name:
                  updateData.bank_name !== undefined
                    ? updateData.bank_name
                    : existingBankDetails?.bank_name,
                routing_number:
                  updateData.routing_number !== undefined
                    ? updateData.routing_number
                    : existingBankDetails?.routing_number,
                swift_code:
                  updateData.swift_code !== undefined
                    ? updateData.swift_code
                    : existingBankDetails?.swift_code,
                iban_number:
                  updateData.iban_number !== undefined
                    ? updateData.iban_number
                    : existingBankDetails?.iban_number,
                bank_account_type:
                  updateData.bank_account_type !== undefined
                    ? updateData.bank_account_type
                    : existingBankDetails?.bank_account_type,
                currency:
                  updateData.currency !== undefined
                    ? updateData.currency
                    : existingBankDetails?.currency
              }

              // Common required fields
              if (!mergedData.hotel_portfolio_name || !mergedData.hotel_portfolio_name.trim()) {
                missingFields.push('Hotel Portfolio Name')
              }
              if (!mergedData.account_number || !mergedData.account_number.trim()) {
                missingFields.push('Account Number')
              }
              if (!mergedData.bank_name || !mergedData.bank_name.trim()) {
                missingFields.push('Bank Name')
              }

              // Sub-type specific validation
              switch (finalSubType) {
                case BankSubType.ach:
                  if (!mergedData.beneficiary_name || !mergedData.beneficiary_name.trim()) {
                    missingFields.push('Beneficiary Name')
                  }
                  if (!mergedData.routing_number || !mergedData.routing_number.trim()) {
                    missingFields.push('Routing Number')
                  }
                  if (!mergedData.bank_account_type) {
                    missingFields.push('Bank Account Type')
                  }
                  break

                case BankSubType.domestic_wire:
                  if (!mergedData.beneficiary_name || !mergedData.beneficiary_name.trim()) {
                    missingFields.push('Beneficiary Name')
                  }
                  if (!mergedData.beneficiary_address || !mergedData.beneficiary_address.trim()) {
                    missingFields.push('Beneficiary Address')
                  }
                  if (!mergedData.routing_number || !mergedData.routing_number.trim()) {
                    missingFields.push('Routing Number')
                  }
                  break

                case BankSubType.international_wire:
                  if (!mergedData.beneficiary_name || !mergedData.beneficiary_name.trim()) {
                    missingFields.push('Beneficiary Name')
                  }
                  if (!mergedData.beneficiary_address || !mergedData.beneficiary_address.trim()) {
                    missingFields.push('Beneficiary Address')
                  }
                  if (!mergedData.swift_code || !mergedData.swift_code.trim()) {
                    missingFields.push('Swift Code')
                  }
                  if (!mergedData.iban_number || !mergedData.iban_number.trim()) {
                    missingFields.push('IBAN Number')
                  }
                  if (!mergedData.currency || !mergedData.currency.trim()) {
                    missingFields.push('Currency')
                  }
                  break
              }

              if (missingFields.length > 0) {
                console.log(
                  '\x1b[31m%s\x1b[0m',
                  `❌ Row ${rowNumber} FAILED: Missing required fields for ${finalSubType}: ${missingFields.join(', ')} for '${propertyName}'`
                )
                result.errors.push({
                  row: rowNumber,
                  property: propertyName,
                  error: `Missing required fields for ${finalSubType}: ${missingFields.join(', ')}`
                })
                result.failureCount++
                continue
              }
            }
          }

          // Set associated user
          updateData.associated_user_id = user.id

          if (existingBankDetails) {
            // Update existing bank details
            await this.propertyBankDetailsRepository.update(
              property.id,
              updateData
            )
            console.log(
              '\x1b[32m%s\x1b[0m',
              `✅ Row ${rowNumber} SUCCESS: Updated bank details for '${propertyName}'`
            )
          } else {
            // Create new bank details
            updateData.property_id = property.id
            await this.propertyBankDetailsRepository.create(updateData)
            console.log(
              '\x1b[32m%s\x1b[0m',
              `✅ Row ${rowNumber} SUCCESS: Created bank details for '${propertyName}'`
            )
          }

          result.successCount++
          result.successfulUpdates.push(propertyName)
        } catch (error) {
          const propertyName =
            findHeaderValue(row, ['Property Name', 'Property name', 'property_name', 'Name', 'Property']) ||
            'Unknown'

          console.log(
            '\x1b[31m%s\x1b[0m',
            `❌ Row ${rowNumber} FAILED: ${error.message || 'Unknown error occurred'} for '${propertyName}'`
          )
          result.errors.push({
            row: rowNumber,
            property: propertyName,
            error: error.message || 'Unknown error occurred'
          })
          result.failureCount++
        }
      }

      // Final summary report
      console.log(
        '\n\x1b[36m%s\x1b[0m',
        '========================================'
      )
      console.log('\x1b[36m%s\x1b[0m', '📊 BULK UPDATE SUMMARY REPORT')
      console.log(
        '\x1b[36m%s\x1b[0m',
        '========================================'
      )
      console.log(
        '\x1b[33m%s\x1b[0m',
        `📝 Total Rows Processed: ${result.totalRows}`
      )
      console.log(
        '\x1b[32m%s\x1b[0m',
        `✅ Successfully Updated/Created: ${result.successCount}`
      )
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed: ${result.failureCount}`)

      if (result.successCount > 0) {
        console.log('\n\x1b[32m%s\x1b[0m', '✅ Successful Updates:')
        result.successfulUpdates.forEach((property, idx) => {
          console.log('\x1b[32m%s\x1b[0m', `   ${idx + 1}. ${property}`)
        })
      }

      if (result.failureCount > 0) {
        console.log('\n\x1b[31m%s\x1b[0m', '❌ Failed Updates:')
        console.table(result.errors)
      }

      console.log(
        '\x1b[36m%s\x1b[0m',
        '========================================\n'
      )

      return result
    } catch (error) {
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`
      )
    }
  }
}
