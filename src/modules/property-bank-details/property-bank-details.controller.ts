import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common'
import {
  ApiBearerAuth,
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
      'Creates bank details for a property. Automatically determines bank_type based on provided fields: If stripe_account_email is provided, sets type to stripe (only stripe_account_email required). Otherwise, sets type to bank (all bank fields required: account_number, account_name, bank_name, bank_branch, swift_code, routing_number).'
  })
  @ApiResponse({
    status: 201,
    description: 'Bank details created successfully'
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Missing required fields for the selected bank type'
  })
  @ApiResponse({
    status: 409,
    description: 'Bank details already exist for this property'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
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
      'Updates bank details for a property. Automatically determines bank_type based on provided fields: If stripe_account_email is provided, sets type to stripe (only stripe_account_email required). Otherwise, sets type to bank (all bank fields required: account_number, account_name, bank_name, bank_branch, swift_code, routing_number).'
  })
  @ApiResponse({
    status: 200,
    description: 'Bank details updated successfully'
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Missing required fields for the selected bank type'
  })
  @ApiResponse({
    status: 404,
    description: 'Bank details not found for this property'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
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
}
