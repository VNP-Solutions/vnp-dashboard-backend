import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { BankSubType, BankType } from '@prisma/client'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
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
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(PermissionService) private permissionService: PermissionService
  ) {}

  /**
   * Validate bank details based on bank type and sub-type
   */
  private validateAndNormalizeBankDetails(
    data: CreatePropertyBankDetailsDto | UpdatePropertyBankDetailsDto
  ): CreatePropertyBankDetailsDto | UpdatePropertyBankDetailsDto | null {
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
          if (!data.beneficiary_address || !data.beneficiary_address.trim()) {
            missingFields.push('beneficiary_address')
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
          if (!data.beneficiary_address || !data.beneficiary_address.trim()) {
            missingFields.push('beneficiary_address')
          }
          if (!data.swift_bic_iban || !data.swift_bic_iban.trim()) {
            missingFields.push('swift_bic_iban')
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
   * Check if user has permission to perform an action on bank details for a property
   * Uses the new bank_details_permission from the user's role
   */
  private async checkBankDetailsPermission(
    user: IUserWithPermissions,
    propertyId: string,
    action: PermissionAction
  ): Promise<void> {
    // Verify property exists
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true }
    })

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Use PermissionService to check bank_details permission
    // For partial access, propertyId is used since bank_details access maps to property access
    await this.permissionService.requirePermission(
      user,
      ModuleType.BANK_DETAILS,
      action,
      propertyId
    )
  }

  async create(data: CreatePropertyBankDetailsDto, user: IUserWithPermissions) {
    // Check permission - require CREATE permission on BANK_DETAILS module
    await this.checkBankDetailsPermission(
      user,
      data.property_id,
      PermissionAction.CREATE
    )

    // Validate and normalize bank details based on type
    const normalizedData = this.validateAndNormalizeBankDetails(data)

    // If bank_type is "none", check if bank details exist and return appropriate response
    if (normalizedData === null) {
      const existingBankDetails =
        await this.propertyBankDetailsRepository.findByPropertyId(
          data.property_id
        )

      if (existingBankDetails) {
        throw new ConflictException(
          'Bank details already exist for this property'
        )
      }

      // No bank details to create - return success
      return {
        id: data.property_id,
        message: 'No bank details to create'
      } as any
    }

    // For other bank types, check if bank details already exist
    const existingBankDetails =
      await this.propertyBankDetailsRepository.findByPropertyId(
        data.property_id
      )

    if (existingBankDetails) {
      throw new ConflictException(
        'Bank details already exist for this property'
      )
    }

    // Set associated_user_id to current user
    (normalizedData as CreatePropertyBankDetailsDto).associated_user_id = user.id

    return this.propertyBankDetailsRepository.create(
      normalizedData as CreatePropertyBankDetailsDto
    )
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
    // Check permission - require UPDATE permission on BANK_DETAILS module
    await this.checkBankDetailsPermission(
      user,
      propertyId,
      PermissionAction.UPDATE
    )

    // Validate and normalize bank details based on type
    const normalizedData = this.validateAndNormalizeBankDetails(data)

    // If bank_type is "none", delete existing bank details if they exist
    if (normalizedData === null) {
      const bankDetails =
        await this.propertyBankDetailsRepository.findByPropertyId(propertyId)

      if (bankDetails) {
        // Bank details exist, delete them
        const deleted = await this.prisma.propertyBankDetails.delete({
          where: { property_id: propertyId }
        })
        return deleted
      } else {
        // Bank details don't exist, return a success response
        // This is idempotent - trying to delete something that doesn't exist is a success
        return {
          id: propertyId,
          message: 'No bank details to remove'
        } as any
      }
    }

    // For other bank types, check if bank details exist
    const bankDetails =
      await this.propertyBankDetailsRepository.findByPropertyId(propertyId)

    if (!bankDetails) {
      throw new NotFoundException('Bank details not found for this property')
    }

    // Update associated_user_id to current user
    (normalizedData as UpdatePropertyBankDetailsDto).associated_user_id = user.id

    return this.propertyBankDetailsRepository.update(
      propertyId,
      normalizedData as UpdatePropertyBankDetailsDto
    )
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
      // Handles column names with asterisks (e.g., "Bank Type*")
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        // First, try to find exact matches
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim()
          }
        }

        // If no exact match, try matching by removing asterisks from Excel column names
        const rowKeys = Object.keys(row)
        for (const name of possibleNames) {
          for (const key of rowKeys) {
            // Remove asterisk and trim from the Excel column name
            const cleanKey = key.split('*')[0].trim()
            if (cleanKey.toLowerCase() === name.toLowerCase()) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return String(value).trim()
              }
            }
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
          console.table([
            {
              'Row #': rowNumber,
              'Property Name': propertyName || 'N/A',
              'Bank Type':
                findHeaderValue(row, ['Bank Type', 'Bank type', 'bank_type']) ||
                'N/A',
              'Bank Sub Type':
                findHeaderValue(row, [
                  'Bank Sub Type',
                  'Bank sub type',
                  'bank_sub_type',
                  'Sub Type',
                  'SubType'
                ]) || 'N/A',
              'Stripe Email':
                findHeaderValue(row, [
                  'Stripe Account Email',
                  'Stripe Email',
                  'Stripe account email',
                  'stripe_account_email'
                ]) || 'N/A'
            }
          ])

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

          // Check permission for this property - need UPDATE permission for bulk update
          try {
            await this.checkBankDetailsPermission(
              user,
              property.id,
              PermissionAction.UPDATE
            )
          } catch {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: No permission to edit '${propertyName}'`
            )
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error:
                'You do not have permission to edit bank details for this property'
            })
            result.failureCount++
            continue
          }

          // Extract Bank Type (REQUIRED) - can be "None", "Stripe", or "Bank"
          const bankTypeRaw = findHeaderValue(row, [
            'Bank Type (None / Stripe / Bank)',
            'Bank Type',
            'Bank type',
            'bank_type'
          ])

          if (!bankTypeRaw) {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Bank Type is required for '${propertyName}'`
            )
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: 'Bank Type is required (None / Stripe / Bank)'
            })
            result.failureCount++
            continue
          }

          const bankTypeNormalized = bankTypeRaw.toLowerCase().trim()

          // If bank type is "None", delete existing bank details if any
          if (bankTypeNormalized === 'none') {
            const existingBankDetails =
              await this.propertyBankDetailsRepository.findByPropertyId(
                property.id
              )

            if (existingBankDetails) {
              await this.prisma.propertyBankDetails.delete({
                where: { property_id: property.id }
              })
              console.log(
                '\x1b[32m%s\x1b[0m',
                `✅ Row ${rowNumber} SUCCESS: Deleted bank details for '${propertyName}' (Bank Type = None)`
              )
              result.successCount++
              result.successfulUpdates.push(propertyName)
            } else {
              console.log(
                '\x1b[32m%s\x1b[0m',
                `✅ Row ${rowNumber} SUCCESS: No bank details to delete for '${propertyName}' (Bank Type = None)`
              )
              result.successCount++
              result.successfulUpdates.push(propertyName)
            }
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

          const bankSubTypeRaw = findHeaderValue(row, [
            'Bank Sub Type (ACH / Domestic US Wire / International Wire)',
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
          const swiftBicIban = findHeaderValue(row, [
            'Swift or BIC or IBAN',
            'Swift or Bic or Iban',
            'Swift/BIC/IBAN',
            'Swift/Bic/Iban',
            'swift_bic_iban',
            'Swift Code',
            'Swift code',
            'SWIFT',
            'Swift',
            'SWIFT Code',
            'BIC',
            'SWIFT/BIC',
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

          // Check if bank details already exist
          const existingBankDetails =
            await this.propertyBankDetailsRepository.findByPropertyId(
              property.id
            )

          // Prepare update data
          const updateData: any = {}

          // Process based on Bank Type
          if (bankTypeNormalized === 'stripe') {
            // Validate Stripe Account Email is provided
            if (!stripeAccountEmail || !stripeAccountEmail.trim()) {
              console.log(
                '\x1b[31m%s\x1b[0m',
                `❌ Row ${rowNumber} FAILED: Stripe Account Email is required when Bank Type is Stripe for '${propertyName}'`
              )
              result.errors.push({
                row: rowNumber,
                property: propertyName,
                error: 'Stripe Account Email is required when Bank Type is Stripe'
              })
              result.failureCount++
              continue
            }

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
            updateData.swift_bic_iban = null
            updateData.routing_number = null
            updateData.bank_account_type = null
            updateData.currency = null
          } else if (bankTypeNormalized === 'bank') {
            // Bank account - validate bank_sub_type is provided
            if (!bankSubTypeRaw) {
              console.log(
                '\x1b[31m%s\x1b[0m',
                `❌ Row ${rowNumber} FAILED: Bank Sub Type is required when Bank Type is Bank for '${propertyName}'`
              )
              result.errors.push({
                row: rowNumber,
                property: propertyName,
                error:
                  'Bank Sub Type is required when Bank Type is Bank (ACH / Domestic US Wire / International Wire)'
              })
              result.failureCount++
              continue
            }

            updateData.bank_type = BankType.bank
            updateData.stripe_account_email = null

            // Map bank sub type from Excel values to enum values
            const bankSubTypeNormalized = bankSubTypeRaw.toLowerCase().trim()
            let mappedBankSubType: string

            if (bankSubTypeNormalized === 'ach') {
              mappedBankSubType = 'ach'
            } else if (
              bankSubTypeNormalized === 'domestic us wire' ||
              bankSubTypeNormalized === 'domestic_us_wire' ||
              bankSubTypeNormalized === 'domestic wire'
            ) {
              mappedBankSubType = 'domestic_wire'
            } else if (
              bankSubTypeNormalized === 'international wire' ||
              bankSubTypeNormalized === 'international_wire'
            ) {
              mappedBankSubType = 'international_wire'
            } else {
              console.log(
                '\x1b[31m%s\x1b[0m',
                `❌ Row ${rowNumber} FAILED: Invalid Bank Sub Type '${bankSubTypeRaw}' for '${propertyName}'`
              )
              result.errors.push({
                row: rowNumber,
                property: propertyName,
                error: `Invalid Bank Sub Type '${bankSubTypeRaw}'. Must be one of: ACH, Domestic US Wire, International Wire`
              })
              result.failureCount++
              continue
            }

            updateData.bank_sub_type = mappedBankSubType

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
            if (swiftBicIban !== undefined) {
              updateData.swift_bic_iban = swiftBicIban
            }
            if (routingNumber !== undefined) {
              // Validate routing number has at least 9 digits
              if (routingNumber.trim().length < 9) {
                console.log(
                  '\x1b[33m%s\x1b[0m',
                  `⚠️  Row ${rowNumber} WARNING: Routing number '${routingNumber}' has less than 9 digits for '${propertyName}'. Skipping routing number update.`
                )
                result.errors.push({
                  row: rowNumber,
                  property: propertyName,
                  error:
                    'Routing number must be at least 9 digits. Routing number was not updated.'
                })
                // Don't update routing number, but continue processing other fields
              } else {
                updateData.routing_number = routingNumber
              }
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
          } else {
            // Invalid bank type
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Invalid Bank Type '${bankTypeRaw}' for '${propertyName}'`
            )
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: `Invalid Bank Type '${bankTypeRaw}'. Must be one of: None, Stripe, Bank`
            })
            result.failureCount++
            continue
          }

          // For Bank type, validate required fields based on sub-type
          if (bankTypeNormalized === 'bank') {
            const finalSubType = updateData.bank_sub_type

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
              swift_bic_iban:
                updateData.swift_bic_iban !== undefined
                  ? updateData.swift_bic_iban
                  : existingBankDetails?.swift_bic_iban,
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
            if (
              !mergedData.hotel_portfolio_name ||
              !mergedData.hotel_portfolio_name.trim()
            ) {
              missingFields.push('Hotel Portfolio Name')
            }
            if (
              !mergedData.account_number ||
              !mergedData.account_number.trim()
            ) {
              missingFields.push('Account Number')
            }
            if (!mergedData.bank_name || !mergedData.bank_name.trim()) {
              missingFields.push('Bank Name')
            }

            // Sub-type specific validation
            switch (finalSubType) {
              case BankSubType.ach:
                  if (
                    !mergedData.beneficiary_name ||
                    !mergedData.beneficiary_name.trim()
                  ) {
                    missingFields.push('Beneficiary Name')
                  }
                  if (
                    !mergedData.routing_number ||
                    !mergedData.routing_number.trim()
                  ) {
                    missingFields.push('Routing Number')
                  } else if (mergedData.routing_number.trim().length < 9) {
                    missingFields.push(
                      'Routing Number (must be at least 9 digits)'
                    )
                  }
                  if (!mergedData.bank_account_type) {
                    missingFields.push('Bank Account Type')
                  }
                  break

                case BankSubType.domestic_wire:
                  if (
                    !mergedData.beneficiary_name ||
                    !mergedData.beneficiary_name.trim()
                  ) {
                    missingFields.push('Beneficiary Name')
                  }
                  if (
                    !mergedData.beneficiary_address ||
                    !mergedData.beneficiary_address.trim()
                  ) {
                    missingFields.push('Beneficiary Address')
                  }
                  if (
                    !mergedData.routing_number ||
                    !mergedData.routing_number.trim()
                  ) {
                    missingFields.push('Routing Number')
                  } else if (mergedData.routing_number.trim().length < 9) {
                    missingFields.push(
                      'Routing Number (must be at least 9 digits)'
                    )
                  }
                  break

                case BankSubType.international_wire:
                  if (
                    !mergedData.beneficiary_name ||
                    !mergedData.beneficiary_name.trim()
                  ) {
                    missingFields.push('Beneficiary Name')
                  }
                  if (
                    !mergedData.beneficiary_address ||
                    !mergedData.beneficiary_address.trim()
                  ) {
                    missingFields.push('Beneficiary Address')
                  }
                  if (
                    !mergedData.swift_bic_iban ||
                    !mergedData.swift_bic_iban.trim()
                  ) {
                    missingFields.push('Swift or BIC or IBAN')
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
            findHeaderValue(row, [
              'Property Name',
              'Property name',
              'property_name',
              'Name',
              'Property'
            ]) || 'Unknown'

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
