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
  @ApiResponse({
    status: 201,
    description: 'Bank details created successfully'
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
    description: 'Bank details retrieved successfully'
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
  @ApiResponse({
    status: 200,
    description: 'Bank details updated successfully'
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
      'Bulk update completed. Returns summary with success/failure counts and details. Email notifications sent to users with property access.'
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
