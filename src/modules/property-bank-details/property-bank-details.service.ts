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
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { EmailUtil } from '../../common/utils/email.util'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyRepository } from '../property/property.interface'
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
    @Inject('IPropertyRepository')
    private propertyRepository: IPropertyRepository,
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(PermissionService) private permissionService: PermissionService,
    @Inject(EmailUtil) private emailUtil: EmailUtil
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
          // beneficiary_address is now OPTIONAL for Domestic Wire
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
          // beneficiary_address is now OPTIONAL for International Wire
          // currency is now OPTIONAL for International Wire
          if (!data.swift_bic_iban || !data.swift_bic_iban.trim()) {
            missingFields.push('swift_bic_iban')
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

  /**
   * Detect bank sub-type from Excel sheet headers
   * Uses unique column presence to determine the type
   */
  private detectBankSubType(headers: string[]): BankSubType {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim())

    // Check for SWIFT/BIC/IBAN columns → International Wire
    const hasSwiftBicIban = normalizedHeaders.some(h =>
      h.includes('swift') ||
      h.includes('bic') ||
      h.includes('iban')
    )
    if (hasSwiftBicIban) {
      return BankSubType.international_wire
    }

    // Check for "Bank Wiring Routing Number" → Domestic Wire
    const hasBankWiringRoutingNumber = normalizedHeaders.some(h =>
      h.includes('bank wiring routing number') ||
      h.includes('wiring routing number') ||
      h === 'bank wiring routing number'
    )
    if (hasBankWiringRoutingNumber) {
      return BankSubType.domestic_wire
    }

    // Check for Bank Account Type (without Bank Wiring Routing Number) → ACH
    const hasBankAccountType = normalizedHeaders.some(h =>
      h.includes('bank account type') ||
      h === 'bank account type' ||
      h === 'account type'
    )
    if (hasBankAccountType) {
      return BankSubType.ach
    }

    // Default to Domestic Wire
    return BankSubType.domestic_wire
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

    const result = await this.propertyBankDetailsRepository.create(
      normalizedData as CreatePropertyBankDetailsDto
    )

    // Send email notification to super admins
    await this.sendBankDetailsNotificationToSuperAdmins(
      data.property_id,
      'created'
    )

    return result
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

    const result = await this.propertyBankDetailsRepository.update(
      propertyId,
      normalizedData as UpdatePropertyBankDetailsDto
    )

    // Send email notification to super admins
    await this.sendBankDetailsNotificationToSuperAdmins(propertyId, 'updated')

    return result
  }

  async bulkUpdate(
    file: Express.Multer.File,
    password: string,
    user: IUserWithPermissions
  ): Promise<BulkUpdateBankDetailsResultDto> {
    // Verify password first
    if (!password) {
      throw new BadRequestException('Password is required for bulk bank update')
    }

    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userFromDb) {
      throw new NotFoundException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

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

    // Track properties that were successfully updated for alert notifications
    const updatedPropertyIds: string[] = []

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

      // Detect bank sub-type from sheet headers
      const headers = data.length > 0 ? Object.keys(data[0] as Record<string, any>) : []
      const detectedBankSubType = this.detectBankSubType(headers)
      console.log(
        '\x1b[36m%s\x1b[0m',
        `🔍 Detected bank sub-type: ${detectedBankSubType}`
      )

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract Expedia ID (required)
          const expediaId = findHeaderValue(row, [
            'Expedia ID',
            'Expedia id',
            'expedia_id',
            'ExpediaID',
            'Expedia Id'
          ])

          // Log row data for debugging
          console.table([
            {
              'Row #': rowNumber,
              'Expedia ID': expediaId || 'N/A',
              'Detected Sub-Type': detectedBankSubType
            }
          ])

          if (!expediaId) {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Expedia ID is required. Available columns: ${Object.keys(row).join(', ')}`
            )
            result.errors.push({
              row: rowNumber,
              property: 'Unknown',
              error: 'Expedia ID is required'
            })
            result.failureCount++
            continue
          }

          // Find property by Expedia ID
          const property = await this.propertyRepository.findByExpediaId(
            expediaId
          )

          if (!property) {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Property with Expedia ID '${expediaId}' not found in database`
            )
            result.errors.push({
              row: rowNumber,
              property: expediaId,
              error: 'Property not found for this Expedia ID'
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
              `❌ Row ${rowNumber} FAILED: No permission to edit Expedia ID '${expediaId}'`
            )
            result.errors.push({
              row: rowNumber,
              property: expediaId,
              error:
                'You do not have permission to edit bank details for this property'
            })
            result.failureCount++
            continue
          }

          // Extract bank details fields with comprehensive name matching
          const hotelPortfolioName = findHeaderValue(row, [
            'Hotel Or Portfolio Name',
            'Hotel or Portfolio Name',
            'Hotel Portfolio Name',
            'Hotel portfolio name',
            'hotel_portfolio_name',
            'Hotel Name',
            'Hotel name',
            'Portfolio Name',
            'Portfolio name'
          ])
          const beneficiaryName = findHeaderValue(row, [
            'Pay To The Order Of',
            'Pay to the Order Of',
            'Pay to the order of',
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
            'IBAN or Account Number',
            'IBAN or account number',
            'Iban or Account Number',
            'Bank Account Number',
            'Bank account number',
            'Account Number',
            'Account number',
            'account_number',
            'Bank Account',
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
            'SWIFT/BIC Code',
            'Swift/BIC Code',
            'Swift/Bic Code',
            'SWIFT/BIC',
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
            'BIC Code',
            'IBAN',
            'Iban'
          ])
          const routingNumber = findHeaderValue(row, [
            'Bank Routing Number',
            'Bank routing number',
            'Routing Number',
            'Routing number',
            'routing_number',
            'Routing',
            'Routing No',
            'ABA Number',
            'ABA'
          ])
          const bankWiringRoutingNumber = findHeaderValue(row, [
            'Bank Wiring Routing Number',
            'Bank wiring routing number',
            'Wiring Routing Number',
            'Wiring routing number'
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
          const contactName = findHeaderValue(row, [
            'Contact Name',
            'Contact name',
            'contact_name'
          ])
          const emailAddress = findHeaderValue(row, [
            'Email Address',
            'Email address',
            'email_address',
            'Email'
          ])
          const bankAddress = findHeaderValue(row, [
            'Bank Address',
            'Bank address',
            'bank_address'
          ])
          const comments = findHeaderValue(row, [
            'Comments',
            'comments',
            'Comment',
            'comment',
            'Notes',
            'notes'
          ])

          // Check if bank details already exist
          const existingBankDetails =
            await this.propertyBankDetailsRepository.findByPropertyId(
              property.id
            )

          // Prepare update data
          const updateData: any = {}

          // All sheets are for Bank type (not Stripe), set bank_type and detected sub_type
          updateData.bank_type = BankType.bank
          updateData.bank_sub_type = detectedBankSubType
          updateData.stripe_account_email = null

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
                `⚠️  Row ${rowNumber} WARNING: Routing number '${routingNumber}' has less than 9 digits for Expedia ID '${expediaId}'. Skipping routing number update.`
              )
              result.errors.push({
                row: rowNumber,
                property: expediaId,
                error:
                  'Routing number must be at least 9 digits. Routing number was not updated.'
              })
              // Don't update routing number, but continue processing other fields
            } else {
              updateData.routing_number = routingNumber
            }
          }
          if (bankWiringRoutingNumber !== undefined) {
            updateData.bank_wiring_routing_number = bankWiringRoutingNumber
          }
          if (bankAccountType !== undefined) {
            const normalizedAccountType = bankAccountType.toLowerCase().trim()
            // Handle both "Checking/Saving" and "checking/savings"
            if (
              normalizedAccountType === 'checking' ||
              normalizedAccountType === 'check'
            ) {
              updateData.bank_account_type = 'checking'
            } else if (
              normalizedAccountType === 'savings' ||
              normalizedAccountType === 'saving'
            ) {
              updateData.bank_account_type = 'savings'
            } else {
              console.log(
                '\x1b[31m%s\x1b[0m',
                `❌ Row ${rowNumber} FAILED: Invalid bank account type '${bankAccountType}' for Expedia ID '${expediaId}'`
              )
              result.errors.push({
                row: rowNumber,
                property: expediaId,
                error: `Invalid bank account type: ${bankAccountType}. Must be one of: checking, savings, Checking, Saving`
              })
              result.failureCount++
              continue
            }
          }
          if (currency !== undefined) {
            updateData.currency = currency
          }
          // Add new fields
          if (contactName !== undefined) {
            updateData.contact_name = contactName
          }
          if (emailAddress !== undefined) {
            updateData.email_address = emailAddress
          }
          if (bankAddress !== undefined) {
            updateData.bank_address = bankAddress
          }
          if (comments !== undefined) {
            updateData.comments = comments
          }

          // Validate required fields based on detected sub-type
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
            bank_wiring_routing_number:
              updateData.bank_wiring_routing_number !== undefined
                ? updateData.bank_wiring_routing_number
                : existingBankDetails?.bank_wiring_routing_number,
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
                  // beneficiary_address is now OPTIONAL for Domestic Wire
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
                  // beneficiary_address is now OPTIONAL for International Wire
                  // currency is now OPTIONAL for International Wire
                  if (
                    !mergedData.swift_bic_iban ||
                    !mergedData.swift_bic_iban.trim()
                  ) {
                    missingFields.push('Swift or BIC or IBAN')
                  }
                  break
              }

            if (missingFields.length > 0) {
              console.log(
                '\x1b[31m%s\x1b[0m',
                `❌ Row ${rowNumber} FAILED: Missing required fields for ${finalSubType}: ${missingFields.join(', ')} for Expedia ID '${expediaId}'`
              )
              result.errors.push({
                row: rowNumber,
                property: expediaId,
                error: `Missing required fields for ${finalSubType}: ${missingFields.join(', ')}`
              })
              result.failureCount++
              continue
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
              `✅ Row ${rowNumber} SUCCESS: Updated bank details for Expedia ID '${expediaId}'`
            )
            updatedPropertyIds.push(property.id)
          } else {
            // Create new bank details
            updateData.property_id = property.id
            await this.propertyBankDetailsRepository.create(updateData)
            console.log(
              '\x1b[32m%s\x1b[0m',
              `✅ Row ${rowNumber} SUCCESS: Created bank details for Expedia ID '${expediaId}'`
            )
            updatedPropertyIds.push(property.id)
          }

          result.successCount++
          result.successfulUpdates.push(expediaId)
        } catch (error) {
          const expediaIdFromRow =
            findHeaderValue(row, [
              'Expedia ID',
              'Expedia id',
              'expedia_id',
              'ExpediaID'
            ]) || 'Unknown'

          console.log(
            '\x1b[31m%s\x1b[0m',
            `❌ Row ${rowNumber} FAILED: ${error.message || 'Unknown error occurred'} for Expedia ID '${expediaIdFromRow}'`
          )
          result.errors.push({
            row: rowNumber,
            property: expediaIdFromRow,
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

      // Send alert notifications to all users with access to updated properties
      if (updatedPropertyIds.length > 0) {
        await this.sendBulkUpdateAlerts(updatedPropertyIds)
      }

      return result
    } catch (error) {
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`
      )
    }
  }

  /**
   * Send email alerts to all users with access to properties that had bank details updated
   */
  private async sendBulkUpdateAlerts(propertyIds: string[]): Promise<void> {
    try {
      console.log(
        `📧 Sending bank update alerts for ${propertyIds.length} properties...`
      )

      // Get all properties with their names
      const properties = await this.prisma.property.findMany({
        where: {
          id: {
            in: propertyIds
          }
        },
        select: {
          id: true,
          name: true
        }
      })

      // Get all users who have access to these properties
      const userAccesses = await this.prisma.userAccessedProperty.findMany({
        where: {
          property_id: {
            hasSome: propertyIds
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          }
        }
      })

      // Create a map of propertyId -> users with access
      const propertyUserMap = new Map<string, Set<string>>()

      for (const access of userAccesses) {
        for (const propertyId of access.property_id) {
          if (propertyIds.includes(propertyId)) {
            if (!propertyUserMap.has(propertyId)) {
              propertyUserMap.set(propertyId, new Set())
            }
            propertyUserMap.get(propertyId)!.add(access.user.email)
          }
        }
      }

      // Send email for each property to all users with access
      for (const property of properties) {
        const userEmails = propertyUserMap.get(property.id)

        if (userEmails && userEmails.size > 0) {
          const recipients = Array.from(userEmails)

          try {
            await this.emailUtil.sendEmail(
              recipients,
              `Bank Details Updated - ${property.name}`,
              `Bank details have been updated for property "${property.name}".\n\nPlease review the changes in the system.\n\nThis is an automated notification.`
            )

            console.log(
              `✅ Sent bank update alert for "${property.name}" to ${recipients.length} user(s)`
            )
          } catch (emailError) {
            console.error(
              `❌ Failed to send alert for "${property.name}":`,
              emailError
            )
          }
        }
      }

      console.log(
        `✅ Completed sending bank update alerts for ${properties.length} properties`
      )
    } catch (error) {
      console.error('❌ Error sending bulk update alerts:', error)
      // Don't throw - alerts are non-critical
    }
  }

  /**
   * Send email notification to all super admins when bank details are created or updated
   */
  private async sendBankDetailsNotificationToSuperAdmins(
    propertyId: string,
    action: 'created' | 'updated'
  ): Promise<void> {
    try {
      console.log(
        `📧 Sending bank details ${action} notification to super admins...`
      )

      // Get property details
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: {
          id: true,
          name: true
        }
      })

      if (!property) {
        console.warn(
          `Property not found for bank details notification: ${propertyId}`
        )
        return
      }

      // Get all super admin users
      const allUsers = await this.prisma.user.findMany({
        where: {
          is_verified: true
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
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

      // Filter super admins using the isUserSuperAdmin utility
      const superAdminEmails: string[] = []

      for (const user of allUsers) {
        // Check if user is super admin by checking all permissions
        const allPermissions = [
          user.role.portfolio_permission,
          user.role.property_permission,
          user.role.audit_permission,
          user.role.user_permission,
          user.role.system_settings_permission
        ]

        // User is super admin if all permissions have permission_level 'all' and access_level 'all'
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

      if (superAdminEmails.length === 0) {
        console.warn('No super admin users found to notify')
        return
      }

      // Send email to all super admins
      const subject = `Bank Details ${action === 'created' ? 'Added' : 'Updated'} - ${property.name}`
      const body = `Bank details have been ${action} for property "${property.name}".\n\nPlease review the changes in the VNP Solutions Dashboard.\n\nThis is an automated notification.`

      try {
        await this.emailUtil.sendEmail(superAdminEmails, subject, body)

        console.log(
          `✅ Sent bank details ${action} notification to ${superAdminEmails.length} super admin(s)`
        )
      } catch (emailError) {
        console.error(
          `❌ Failed to send bank details ${action} notification:`,
          emailError
        )
      }
    } catch (error) {
      console.error(
        `❌ Error sending bank details ${action} notification:`,
        error
      )
      // Don't throw - email notifications are non-critical
    }
  }
}
