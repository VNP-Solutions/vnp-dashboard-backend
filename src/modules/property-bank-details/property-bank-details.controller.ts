import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  CreatePropertyBankDetailsDto,
  UpdatePropertyBankDetailsDto
} from './property-bank-details.dto'
import type { IPropertyBankDetailsService } from './property-bank-details.interface'

@ApiTags('Property Bank Details')
@ApiBearerAuth('JWT-auth')
@Controller('property-bank-details')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyBankDetailsController {
  constructor(
    @Inject('IPropertyBankDetailsService')
    private readonly propertyBankDetailsService: IPropertyBankDetailsService
  ) {}

  @Post()
  @RequirePermission(ModuleType.BANK_DETAILS, PermissionAction.CREATE)
  @ApiOperation({
    summary: 'Create property bank details',
    description:
      'Creates bank details for a property. Requires bank_details CREATE permission. ' +
      'For Stripe: Only stripe_account_email is required. ' +
      'For Bank: bank_sub_type is required (ach, domestic_wire, or international_wire). ' +
      'ACH requires: hotel_portfolio_name, beneficiary_name, bank_name, routing_number, account_number, bank_account_type. ' +
      'Domestic Wire requires: hotel_portfolio_name, beneficiary_name, bank_name, routing_number, account_number. ' +
      'International Wire requires: hotel_portfolio_name, beneficiary_name, bank_name, swift_bic_iban, account_number. ' +
      'Optional fields: beneficiary_address, currency, contact_name, email_address, bank_address, comments.'
  })
  @ApiBody({
    type: CreatePropertyBankDetailsDto,
    examples: {
      ach: {
        summary: 'ACH Bank Details',
        description: 'Example for creating ACH bank details',
        value: {
          property_id: '507f1f77bcf86cd799439015',
          bank_type: 'bank',
          bank_sub_type: 'ach',
          hotel_portfolio_name: 'Grand Hotel Portfolio',
          beneficiary_name: 'Grand Hotel LLC',
          account_number: '1234567890',
          bank_name: 'Chase Bank',
          routing_number: '021000021',
          bank_account_type: 'checking',
          contact_name: 'John Smith',
          email_address: 'john.smith@grandhotel.com',
          comments: 'Primary operating account'
        }
      },
      domesticWire: {
        summary: 'Domestic Wire Bank Details',
        description: 'Example for creating Domestic Wire bank details',
        value: {
          property_id: '507f1f77bcf86cd799439015',
          bank_type: 'bank',
          bank_sub_type: 'domestic_wire',
          hotel_portfolio_name: 'Downtown Hotel',
          beneficiary_name: 'Downtown Hotel LLC',
          beneficiary_address: '123 Main Street, New York, NY 10001',
          account_number: '9876543210',
          bank_name: 'Bank of America',
          routing_number: '026009593',
          contact_name: 'Jane Doe',
          email_address: 'jane.doe@downtownhotel.com',
          bank_address: '100 Financial Center, New York, NY 10005',
          comments: 'Wire transfer account for large transactions'
        }
      },
      internationalWire: {
        summary: 'International Wire Bank Details',
        description: 'Example for creating International Wire bank details',
        value: {
          property_id: '507f1f77bcf86cd799439015',
          bank_type: 'bank',
          bank_sub_type: 'international_wire',
          hotel_portfolio_name: 'Global Resorts International',
          beneficiary_name: 'Global Resorts Ltd',
          beneficiary_address: '456 Park Avenue, London, UK',
          account_number: 'GB29NWBK60161331926819',
          bank_name: 'HSBC Bank',
          swift_bic_iban: 'HSBCGB2LXXX',
          currency: 'GBP',
          bank_address: '8 Canada Square, London E14 5HQ, UK',
          contact_name: 'Michael Brown',
          email_address: 'michael.brown@globalresorts.com',
          comments: 'International wire account for European bookings'
        }
      },
      stripe: {
        summary: 'Stripe Payment Details',
        description: 'Example for creating Stripe payment details',
        value: {
          property_id: '507f1f77bcf86cd799439015',
          bank_type: 'stripe',
          stripe_account_email: 'payments@hotel.com'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Bank details created successfully',
    schema: {
      example: {
        success: true,
        message: 'Bank details created successfully',
        data: {
          id: '507f1f77bcf86cd799439011',
          bank_type: 'bank',
          bank_sub_type: 'ach',
          hotel_portfolio_name: 'Grand Hotel Portfolio',
          beneficiary_name: 'Grand Hotel LLC',
          account_number: '1234567890',
          bank_name: 'Chase Bank',
          routing_number: '021000021',
          bank_account_type: 'checking',
          contact_name: 'John Smith',
          email_address: 'john.smith@grandhotel.com',
          comments: 'Primary operating account',
          associated_user_id: '507f1f77bcf86cd799439020',
          property_id: '507f1f77bcf86cd799439015',
          created_at: '2026-02-08T10:30:00.000Z',
          updated_at: '2026-02-08T10:30:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Missing required fields for the selected bank type or sub-type'
  })
  @ApiResponse({
    status: 409,
    description: 'Bank details already exist for this property'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createPropertyBankDetailsDto: CreatePropertyBankDetailsDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyBankDetailsService.create(
      createPropertyBankDetailsDto,
      user
    )
  }

  @Get('property/:propertyId')
  @RequirePermission(ModuleType.BANK_DETAILS, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get bank details by property ID' })
  @ApiResponse({
    status: 200,
    description: 'Bank details retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Bank details retrieved successfully',
        data: {
          id: '507f1f77bcf86cd799439011',
          bank_type: 'bank',
          bank_sub_type: 'international_wire',
          hotel_portfolio_name: 'Luxury Hotels International',
          beneficiary_name: 'Luxury Hotels LLC',
          beneficiary_address: '456 Park Avenue, New York, NY 10022',
          account_number: '9876543210',
          bank_name: 'Bank of America',
          swift_bic_iban: 'BOFAUS3NXXX',
          currency: 'USD',
          bank_address: '100 Financial Center, New York, NY 10005',
          contact_name: 'Jane Doe',
          email_address: 'jane.doe@luxuryhotels.com',
          comments: 'International wire account for Europe bookings',
          associated_user_id: '507f1f77bcf86cd799439020',
          property_id: '507f1f77bcf86cd799439015',
          created_at: '2026-02-08T10:30:00.000Z',
          updated_at: '2026-02-08T10:30:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Bank details not found for this property'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this property'
  })
  findByPropertyId(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyBankDetailsService.findByPropertyId(propertyId, user)
  }

  @Patch('property/:propertyId')
  @RequirePermission(ModuleType.BANK_DETAILS, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update bank details by property ID',
    description:
      'Updates bank details for a property. Requires bank_details UPDATE permission. ' +
      'For Stripe: Only stripe_account_email is required. ' +
      'For Bank: bank_sub_type is required (ach, domestic_wire, or international_wire). ' +
      'ACH requires: hotel_portfolio_name, beneficiary_name, bank_name, routing_number, account_number, bank_account_type. ' +
      'Domestic Wire requires: hotel_portfolio_name, beneficiary_name, bank_name, routing_number, account_number. ' +
      'International Wire requires: hotel_portfolio_name, beneficiary_name, bank_name, swift_bic_iban, account_number. ' +
      'Optional fields: beneficiary_address, currency, contact_name, email_address, bank_address, comments.'
  })
  @ApiBody({
    type: UpdatePropertyBankDetailsDto,
    examples: {
      updateContact: {
        summary: 'Update Contact Information',
        description: 'Example for updating contact details only',
        value: {
          contact_name: 'Sarah Williams',
          email_address: 'sarah.williams@grandhotel.com',
          comments: 'Updated contact person - Sarah is now the primary accounting contact'
        }
      },
      updateAccount: {
        summary: 'Update Bank Account Details',
        description: 'Example for updating bank account information',
        value: {
          bank_name: 'Wells Fargo',
          routing_number: '121000248',
          account_number: '9876543210',
          beneficiary_name: 'Grand Hotel Operations LLC',
          comments: 'Changed to new bank effective March 2026'
        }
      },
      changeSubType: {
        summary: 'Change Bank Sub-Type',
        description: 'Example for changing from ACH to Domestic Wire',
        value: {
          bank_sub_type: 'domestic_wire',
          beneficiary_address: '789 Business Blvd, Chicago, IL 60601',
          bank_account_type: null,
          comments: 'Switching to domestic wire for faster processing'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Bank details updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Bank details updated successfully',
        data: {
          id: '507f1f77bcf86cd799439011',
          bank_type: 'bank',
          bank_sub_type: 'domestic_wire',
          hotel_portfolio_name: 'Grand Hotel Portfolio',
          beneficiary_name: 'Grand Hotel Operations LLC',
          beneficiary_address: '789 Main Street, Los Angeles, CA 90001',
          account_number: '1234567890',
          bank_name: 'Wells Fargo',
          routing_number: '121000248',
          contact_name: 'Robert Johnson',
          email_address: 'robert.johnson@grandhotel.com',
          comments: 'Updated to new operating account - effective March 2026',
          associated_user_id: '507f1f77bcf86cd799439020',
          property_id: '507f1f77bcf86cd799439015',
          created_at: '2026-02-08T10:30:00.000Z',
          updated_at: '2026-02-08T15:45:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Missing required fields for the selected bank type or sub-type'
  })
  @ApiResponse({
    status: 404,
    description: 'Bank details not found for this property'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Insufficient permissions'
  })
  update(
    @Param('propertyId') propertyId: string,
    @Body() updatePropertyBankDetailsDto: UpdatePropertyBankDetailsDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyBankDetailsService.update(
      propertyId,
      updatePropertyBankDetailsDto,
      user
    )
  }

  @Post('bulk-update')
  @RequirePermission(ModuleType.BANK_DETAILS, PermissionAction.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk update property bank details from Excel file (Requires password verification)',
    description:
      'Updates bank details for multiple properties from an Excel file. Requires bank_details UPDATE permission and password verification. ' +
      'The first column must be "Expedia ID" to identify the property. ' +
      'Bank sub-type is AUTO-DETECTED from sheet columns (no Bank Sub Type column needed). ' +
      'Detection: SWIFT/BIC/IBAN columns → International Wire; Bank Account Type column → ACH; Otherwise → Domestic Wire. ' +
      'Common columns: Hotel Portfolio Name, Account Number, Bank Name. ' +
      'ACH: Beneficiary Name, Routing Number, Bank Account Type (Checking/Saving accepted). ' +
      'Domestic Wire: Beneficiary Name, Routing Number (Beneficiary Address optional). ' +
      'International Wire: Beneficiary Name, Swift/BIC/IBAN (Beneficiary Address and Currency optional). ' +
      'Optional fields: Contact Name, Email Address, Bank Address, Comments. ' +
      'After successful update, all users with access to the affected properties will be notified via email.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Excel file (.xlsx or .xls) containing property bank details. ' +
            'Required columns: Expedia ID, Hotel Portfolio Name, Account Number, Bank Name + sub-type specific fields. ' +
            'Bank sub-type is auto-detected from columns present in the sheet.'
        },
        password: {
          type: 'string',
          description: 'User password for verification (required)'
        }
      },
      required: ['file', 'password']
    }
  })
  @ApiResponse({
    status: 200,
    description:
      'Bulk update completed. Returns summary with success/failure counts and details. Email notifications sent to users with property access.',
    schema: {
      example: {
        success: true,
        message: 'Bulk update completed. Processed 10 rows: 8 successful, 2 failed. Email notifications sent to users with property access.',
        data: {
          totalRows: 10,
          successCount: 8,
          failureCount: 2,
          errors: [
            {
              row: 3,
              property: 'EXP123456',
              error: 'Property not found for Expedia ID: EXP123456'
            },
            {
              row: 7,
              property: 'EXP789012',
              error: 'Missing required fields for ach: Bank Account Type'
            }
          ],
          successfulUpdates: [
            'EXP234567',
            'EXP345678',
            'EXP456789',
            'EXP567890',
            'EXP678901',
            'EXP789013',
            'EXP890123',
            'EXP901234'
          ]
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file, file format, or invalid password'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Insufficient permissions'
  })
  bulkUpdate(
    @UploadedFile() file: Express.Multer.File,
    @Body('password') password: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyBankDetailsService.bulkUpdate(file, password, user)
  }
}
