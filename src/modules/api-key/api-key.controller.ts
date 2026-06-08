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
  ApiKeyResponseDto,
  CreateApiKeyDto,
  DeleteApiKeyResponseDto
} from './api-key.dto'
import type { IApiKeyService } from './api-key.interface'

@ApiTags('API Key')
@ApiBearerAuth('JWT-auth')
@Controller('api-key')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApiKeyController {
  constructor(
    @Inject('IApiKeyService')
    private readonly apiKeyService: IApiKeyService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.CREATE)
  @ApiOperation({
    summary: 'Create a new API key (Super Admin only)',
    description:
      'Generates a new API key bound to a specific portfolio. Only Super Admins with system settings create permission can perform this action. The API key is auto-generated and returned in the response.'
  })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    type: ApiKeyResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Request successful',
        data: {
          id: '507f1f77bcf86cd799439012',
          api_key:
            'vnp_a1b2c3d4e5f6789012345678abcdef9012345678abcdef9012345678abcdef90',
          portfolio_id: '507f1f77bcf86cd799439011',
          portfolio: {
            id: '507f1f77bcf86cd799439011',
            name: 'Drury Hotels',
            is_active: true
          },
          is_active: true,
          created_at: '2026-06-08T10:00:00.000Z',
          updated_at: '2026-06-08T10:00:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can manage API keys'
  })
  @ApiResponse({
    status: 404,
    description: 'Portfolio not found'
  })
  create(
    @Body() createApiKeyDto: CreateApiKeyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.apiKeyService.create(createApiKeyDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all API keys (Super Admin only)',
    description:
      'Retrieves all API keys with populated portfolio details. Only Super Admins with system settings read permission can perform this action.'
  })
  @ApiResponse({
    status: 200,
    description: 'API keys retrieved successfully',
    type: [ApiKeyResponseDto],
    schema: {
      example: {
        success: true,
        message: 'Request successful',
        data: [
          {
            id: '507f1f77bcf86cd799439012',
            api_key:
              'vnp_a1b2c3d4e5f6789012345678abcdef9012345678abcdef9012345678abcdef90',
            portfolio_id: '507f1f77bcf86cd799439011',
            portfolio: {
              id: '507f1f77bcf86cd799439011',
              name: 'Drury Hotels',
              is_active: true
            },
            is_active: true,
            created_at: '2026-06-08T10:00:00.000Z',
            updated_at: '2026-06-08T10:00:00.000Z'
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can manage API keys'
  })
  findAll(@CurrentUser() user: IUserWithPermissions) {
    return this.apiKeyService.findAll(user)
  }

  @Patch(':id/toggle-active')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({
    summary: 'Toggle API key active state (Super Admin only)',
    description:
      'Flips the is_active state of an API key (active becomes inactive and vice versa). Only Super Admins with system settings update permission can perform this action.'
  })
  @ApiResponse({
    status: 200,
    description: 'API key active state toggled successfully',
    type: ApiKeyResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Request successful',
        data: {
          id: '507f1f77bcf86cd799439012',
          api_key:
            'vnp_a1b2c3d4e5f6789012345678abcdef9012345678abcdef9012345678abcdef90',
          portfolio_id: '507f1f77bcf86cd799439011',
          portfolio: {
            id: '507f1f77bcf86cd799439011',
            name: 'Drury Hotels',
            is_active: true
          },
          is_active: false,
          created_at: '2026-06-08T10:00:00.000Z',
          updated_at: '2026-06-08T11:30:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can manage API keys'
  })
  @ApiResponse({
    status: 404,
    description: 'API key not found'
  })
  toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.apiKeyService.toggleActive(id, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({
    summary: 'Delete an API key (Super Admin only)',
    description:
      'Permanently deletes an API key. Only Super Admins with system settings delete permission can perform this action.'
  })
  @ApiResponse({
    status: 200,
    description: 'API key deleted successfully',
    type: DeleteApiKeyResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Request successful',
        data: {
          message: 'API key deleted successfully'
        }
      }
    }
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can manage API keys'
  })
  @ApiResponse({
    status: 404,
    description: 'API key not found'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.apiKeyService.remove(id, user)
  }
}
