import { Controller, Get, UseGuards } from '@nestjs/common'
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags
} from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import type { ApiKeyAuthContext } from './api-key.interface'
import { CurrentApiKey } from './decorators/current-api-key.decorator'
import { ExternalApiService } from './external-api.service'
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard'

@ApiTags('External API')
@ApiSecurity('x-api-key')
@Public()
@Controller('external')
@UseGuards(ApiKeyAuthGuard)
export class ExternalApiController {
  constructor(private readonly externalApiService: ExternalApiService) {}

  @Get('properties')
  @ApiOperation({
    summary: 'Get all properties for the API key portfolio',
    description:
      'Returns all properties for the portfolio bound to the x-api-key header, sorted by name ascending. No pagination or filters are applied. The API key must be valid and active.'
  })
  @ApiResponse({
    status: 200,
    description: 'All properties retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Operation successful',
        data: [
          {
            id: '507f1f77bcf86cd799439011',
            name: 'Grand Hotel',
            address: '123 Main Street, New York, NY 10001',
            is_active: true,
            portfolio_id: '507f1f77bcf86cd799439012',
            access_type: 'owned',
            viewing_portfolio_id: '507f1f77bcf86cd799439012',
            has_pending_action: false,
            pending_actions: [],
            total_audits: 5,
            total_notes: 2,
            total_contract_urls: 1
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or inactive API key'
  })
  getProperties(@CurrentApiKey() apiKey: ApiKeyAuthContext) {
    return this.externalApiService.getProperties(apiKey)
  }
}
