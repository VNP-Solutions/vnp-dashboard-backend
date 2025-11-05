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
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @ApiOperation({
    summary: 'Create property bank details',
    description:
      'Creates bank details for a property. Only super admin, property manager, or portfolio manager can create bank details. ' +
      'For Stripe: Only stripe_account_email is required. ' +
      'For Bank: bank_sub_type is required (ach, domestic_wire, or international_wire). ' +
      'ACH requires: hotel_portfolio_name, beneficiary, bank_name, routing_number, account_number, bank_account_type. ' +
      'Domestic Wire requires: hotel_portfolio_name, beneficiary_name, beneficiary_address, bank_name, routing_number, account_number. ' +
      'International Wire requires: hotel_portfolio_name, beneficiary_name, beneficiary_address, bank_name, swift_code, iban_number, account_number, currency.'
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
      'Forbidden - Only super admin, property manager, or portfolio manager can edit bank details'
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
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
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
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update bank details by property ID',
    description:
      'Updates bank details for a property. Only super admin, property manager, or portfolio manager can update bank details. ' +
      'For Stripe: Only stripe_account_email is required. ' +
      'For Bank: bank_sub_type is required (ach, domestic_wire, or international_wire). ' +
      'ACH requires: hotel_portfolio_name, beneficiary, bank_name, routing_number, account_number, bank_account_type. ' +
      'Domestic Wire requires: hotel_portfolio_name, beneficiary_name, beneficiary_address, bank_name, routing_number, account_number. ' +
      'International Wire requires: hotel_portfolio_name, beneficiary_name, beneficiary_address, bank_name, swift_code, iban_number, account_number, currency.'
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
      'Forbidden - Only super admin, property manager, or portfolio manager can edit bank details'
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
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk update property bank details from Excel file',
    description:
      'Updates bank details for multiple properties from an Excel file. Only super admin, property manager, or portfolio manager can update bank details. ' +
      'The first column must be "Property Name" to identify the property. ' +
      'For Stripe: Include "Stripe Account Email" column. ' +
      'For Bank: Include "Bank Sub Type" column (ach, domestic_wire, or international_wire). ' +
      'Common columns: Hotel Portfolio Name, Account Number, Bank Name. ' +
      'ACH: Beneficiary, Routing Number, Bank Account Type (checking/savings). ' +
      'Domestic Wire: Beneficiary Name, Beneficiary Address, Routing Number. ' +
      'International Wire: Beneficiary Name, Beneficiary Address, Swift Code, IBAN Number, Currency.'
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
            'Required columns: Property Name. ' +
            'Stripe: Stripe Account Email. ' +
            'Bank: Bank Sub Type, Hotel Portfolio Name, Account Number, Bank Name + sub-type specific fields.'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description:
      'Bulk update completed. Returns summary with success/failure counts and details.'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file or file format'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only super admin, property manager, or portfolio manager can edit bank details'
  })
  bulkUpdate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyBankDetailsService.bulkUpdate(file, user)
  }
}
