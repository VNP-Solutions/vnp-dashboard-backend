import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
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
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { IAuthRepository } from '../auth/auth.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  ActivatePropertyDto,
  BulkDeletePropertyDto,
  BulkTransferPropertyDto,
  CompleteCreatePropertyDto,
  CompleteUpdatePropertyDto,
  CreatePropertyDto,
  DeactivatePropertyDto,
  DeletePropertyDto,
  GetPropertiesByPortfoliosDto,
  PropertyQueryDto,
  PropertyStatsResponseDto,
  SharePropertyDto,
  TransferPropertyDto,
  UnsharePropertyDto,
  UpdatePropertyDto
} from './property.dto'
import type { IPropertyService } from './property.interface'

@ApiTags('Property')
@ApiBearerAuth('JWT-auth')
@Controller('property')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyController {
  constructor(
    @Inject('IPropertyService')
    private readonly propertyService: IPropertyService,
    @Inject('IAuthRepository')
    private readonly authRepository: IAuthRepository
  ) {}

  @Post()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Create a new property (Internal users only)' })
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  create(
    @Body() createPropertyDto: CreatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.create(createPropertyDto, user)
  }

  @Post('complete-create')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @ApiOperation({
    summary:
      'Create a property with credentials and bank details in a single transaction (Internal users only)',
    description:
      'Creates a property along with optional credentials and bank details. All operations are performed in a transaction and will be rolled back if any operation fails. ' +
      'Property data is required, while credentials and bank details are optional.'
  })
  @ApiResponse({
    status: 201,
    description:
      'Property with credentials and bank details created successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or validation errors'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Property name already exists'
  })
  completeCreate(
    @Body() completeCreateDto: CompleteCreatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.completeCreate(completeCreateDto, user)
  }

  @Patch(':id/complete-update')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary:
      'Update a property with credentials and bank details in a single transaction',
    description:
      'Updates a property along with optional credentials and bank details. All operations are performed in a transaction and will be rolled back if any operation fails. ' +
      'All fields are optional - only provided fields will be updated.'
  })
  @ApiResponse({
    status: 200,
    description:
      'Property with credentials and bank details updated successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or validation errors'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not property owner'
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Property name already exists'
  })
  completeUpdate(
    @Param('id') id: string,
    @Body() completeUpdateDto: CompleteUpdatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.completeUpdate(id, completeUpdateDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all properties accessible to the user with pagination, search, filter, and sort'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of properties retrieved successfully'
  })
  findAll(
    @Query() query: PropertyQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.findAll(query, user)
  }

  @Get('export/all')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all properties without pagination for export purposes (supports search, filter, and sort)'
  })
  @ApiResponse({
    status: 200,
    description: 'All properties retrieved successfully'
  })
  findAllForExport(
    @Query() query: PropertyQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.findAllForExport(query, user)
  }

  @Post('by-portfolios')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get properties from specific portfolios (used for user invitation flows). If empty array is provided, returns all accessible properties.'
  })
  @ApiResponse({
    status: 200,
    description:
      'Properties from specified portfolios retrieved successfully. Returns all properties if empty array provided.'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid portfolio IDs provided'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  getPropertiesByPortfolios(
    @Body() getPropertiesByPortfoliosDto: GetPropertiesByPortfoliosDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.getPropertiesByPortfolios(
      getPropertiesByPortfoliosDto,
      user
    )
  }

  @Get(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get a property by ID' })
  @ApiResponse({ status: 200, description: 'Property retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this property'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update a property (Internal users only)' })
  @ApiResponse({ status: 200, description: 'Property updated successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.update(id, updatePropertyDto, user)
  }

  @Patch(':id/transfer')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary:
      'Transfer a property to another portfolio or submit transfer request',
    description:
      'Super Admin can directly transfer with password (no reason required). All other users with UPDATE permission can submit transfer request with password and reason.'
  })
  @ApiResponse({
    status: 200,
    description:
      'Property transferred successfully or transfer request submitted for approval'
  })
  @ApiResponse({ status: 404, description: 'Property or Portfolio not found' })
  @ApiResponse({
    status: 400,
    description:
      'Property is already in the target portfolio or invalid password or reason required for non-super admin users'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  async transfer(
    @Param('id') id: string,
    @Body() transferPropertyDto: TransferPropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Password validation is required for all users during transfer
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      transferPropertyDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.propertyService.transfer(id, transferPropertyDto, user)
  }

  @Patch(':id/share')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary:
      'Share a property with other portfolios (Internal users only, view-only access)'
  })
  @ApiResponse({
    status: 200,
    description: 'Property shared successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Property or one of the target portfolios not found'
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot share property with its owner portfolio'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only internal users can share properties'
  })
  share(
    @Param('id') id: string,
    @Body() sharePropertyDto: SharePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.share(id, sharePropertyDto, user)
  }

  @Patch(':id/unshare')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary:
      'Remove property sharing from specified portfolios (Internal users only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Property unshared successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only internal users can unshare properties'
  })
  unshare(
    @Param('id') id: string,
    @Body() unsharePropertyDto: UnsharePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.unshare(id, unsharePropertyDto, user)
  }

  @Post('bulk-transfer')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @ApiOperation({
    summary:
      'Bulk transfer multiple properties to another portfolio (Internal users only, requires password verification)',
    description:
      'Allows bulk transfer of multiple properties to a target portfolio. Only internal users can perform this operation. Password verification is required.'
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk transfer completed with results'
  })
  @ApiResponse({ status: 404, description: 'Target portfolio not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid password or validation errors'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only internal users can perform bulk transfers'
  })
  async bulkTransfer(
    @Body() bulkTransferPropertyDto: BulkTransferPropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      bulkTransferPropertyDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.propertyService.bulkTransfer(bulkTransferPropertyDto, user)
  }

  @Post('bulk-delete')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE)
  @ApiOperation({
    summary:
      'Bulk delete multiple properties (Super Admin only with password verification)',
    description:
      'Allows bulk deletion of multiple properties. Only super admin can perform this operation. ' +
      'Will skip properties that have unarchived audits and add them to the error list. ' +
      'Password verification is required.'
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk delete completed with results',
    schema: {
      example: {
        success: 3,
        failed: 2,
        results: [
          { property_id: '507f1f77bcf86cd799439011', success: true },
          {
            property_id: '507f1f77bcf86cd799439012',
            success: false,
            message:
              'Cannot delete property. It has 3 unarchived audits. Please archive all audits before deleting the property.'
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid password or validation errors'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can bulk delete properties'
  })
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeletePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Password validation
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      bulkDeleteDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.propertyService.bulkDelete(
      bulkDeleteDto.property_ids,
      bulkDeleteDto.password,
      user
    )
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE, true)
  @ApiOperation({
    summary:
      'Delete a property (Super admin only, requires password verification)',
    description:
      'Only super admins can delete properties. The property must not have any unarchived audits. Password verification is required.'
  })
  @ApiResponse({ status: 200, description: 'Property deleted successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid password or property has unarchived audits'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only super admins can delete properties'
  })
  async remove(
    @Param('id') id: string,
    @Body() deletePropertyDto: DeletePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Password validation is required for all users during deletion
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      deletePropertyDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.propertyService.remove(id, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE, true)
  @ApiOperation({
    summary:
      'Delete a property via POST (Super admin only, requires password verification)',
    description:
      'Alternative endpoint for deletion using POST method. Only super admins can delete properties. The property must not have any unarchived audits. Password verification is required.'
  })
  @ApiResponse({ status: 200, description: 'Property deleted successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid password or property has unarchived audits'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only super admins can delete properties'
  })
  async removeViaPost(
    @Param('id') id: string,
    @Body() deletePropertyDto: DeletePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Password validation is required for all users during deletion
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      deletePropertyDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.propertyService.remove(id, user)
  }

  @Post(':id/deactivate')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Deactivate a property or submit deactivation request',
    description:
      'Super Admin can directly deactivate with password (no reason required). All other users with UPDATE permission submit a deactivation request with password and reason.'
  })
  @ApiResponse({
    status: 200,
    description:
      'Property deactivated successfully or deactivation request submitted for approval'
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid password or property already deactivated or reason required for non-super admin users'
  })
  async deactivate(
    @Param('id') id: string,
    @Body() deactivatePropertyDto: DeactivatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Password validation is required for all users during deactivation
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      deactivatePropertyDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.propertyService.deactivate(
      id,
      user,
      deactivatePropertyDto.reason
    )
  }

  @Post(':id/activate')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Activate a property or submit activation request',
    description:
      'Super Admin can directly activate with password (no reason required). All other users with UPDATE permission submit an activation request with password and reason.'
  })
  @ApiResponse({
    status: 200,
    description:
      'Property activated successfully or activation request submitted for approval'
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid password or property already active or reason required for non-super admin users'
  })
  async activate(
    @Param('id') id: string,
    @Body() activatePropertyDto: ActivatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Password validation is required for all users during activation
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      activatePropertyDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.propertyService.activate(id, user, activatePropertyDto.reason)
  }

  @Post('bulk-import')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import properties from Excel file (Internal users only)'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx) containing property data'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk import completed with results'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or missing file'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.bulkImport(file, user)
  }

  @Post('bulk-update')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk update properties from Excel file (Internal users only)',
    description: `
    Upload an Excel file (.xlsx or .xls) to bulk update existing properties.
    Only internal users can use this endpoint.
    
    Required column:
    - Property ID/Property Id/Property id/property_id/ID/Id/id: ID of the property to update (must exist)
    
    Optional columns (only update if provided):
    - Property Name/Property name/Name: Name of the property
    - Address/Property Address: Property address
    - Property Currency/Currency/Currency Code: Currency code (will be created if doesn't exist)
    - Card Descriptor/Card descriptor/Descriptor: Card descriptor
    - Next Due Date/Next due date/Due Date: Next due date (mm/dd/yyyy)
    - Portfolio/Portfolio Name/Portfolio name: Portfolio name (will be created if doesn't exist)
    - Expedia ID/Expedia Id/Expedia id/ExpediaID: Expedia ID
    - Expedia Username/Expedia username/Expedia User: Expedia username
    - Expedia Password/Expedia password/Expedia Pass: Expedia password
    - Agoda ID/Agoda Id/Agoda id/AgodaID: Agoda ID
    - Agoda Username/Agoda username/Agoda User: Agoda username
    - Agoda Password/Agoda password/Agoda Pass: Agoda password
    - Booking ID/Booking Id/Booking id/BookingID: Booking ID
    - Booking Username/Booking username/Booking User: Booking username
    - Booking Password/Booking password/Booking Pass: Booking password
    - Bank Type (None / Stripe / Bank)/Bank Type/Bank type: Bank type
    - Stripe Account Email/Stripe Email/Stripe account email: Stripe email (required if Bank Type is Stripe)
    - Bank Sub Type (ACH / Domestic US Wire / International Wire)/Bank Sub Type: Bank sub type (required if Bank Type is Bank)
    - Hotel Portfolio Name/Hotel portfolio name/Hotel Name: Hotel portfolio name
    - Beneficiary Name/Beneficiary name/Beneficiary: Beneficiary name
    - Beneficiary Address/Beneficiary address/Address (Beneficiary): Beneficiary address
    - Account Number/Account number/Bank Account: Account number
    - Account Name/Account name/Account Holder: Account name
    - Bank Name/Bank name/Bank: Bank name
    - Bank Branch/Bank branch/Branch: Bank branch
    - Swift or BIC or IBAN/Swift/BIC/IBAN: Swift/BIC/IBAN code
    - Routing Number/Routing number/Routing/ABA: Routing number
    - Bank Account Type/Bank account type/Account Type: Bank account type
    - Currency (Bank)/Bank Currency/Currency Code (Bank): Bank currency
    
    Note: Empty cells will keep existing values unchanged.
    `
  })
  @ApiBody({
    description: 'Excel file containing property update data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk update completed successfully',
    schema: {
      example: {
        totalRows: 10,
        successCount: 8,
        failureCount: 2,
        errors: [
          {
            row: 3,
            propertyId: '507f1f77bcf86cd799439011',
            error: 'Property not found'
          }
        ],
        successfulUpdates: [
          '507f1f77bcf86cd799439012',
          '507f1f77bcf86cd799439013'
        ]
      }
    }
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Invalid file or file format or only internal users can bulk update'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  bulkUpdate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.bulkUpdate(file, user)
  }

  @Get(':id/stats')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({
    summary: 'Get property statistics showing total amounts from all audits'
  })
  @ApiResponse({
    status: 200,
    description: 'Property statistics retrieved successfully',
    type: PropertyStatsResponseDto
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this property'
  })
  getStats(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.getStats(id, user)
  }
}
