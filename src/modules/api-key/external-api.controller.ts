import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags
} from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { ExternalPropertyQueryDto } from '../property/property.dto'
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
    summary: 'Get properties for the API key portfolio',
    description:
      'Returns properties for the portfolio bound to the x-api-key header. Supports the same filters as the regular GET /property endpoint (page, limit, search, sortBy, sortOrder, bank_sub_type, is_active, credential_type). Set send_all=true to return all matching results and ignore page/limit. The API key must be valid and active.'
  })
  @ApiResponse({
    status: 200,
    description: 'Properties retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Request successful',
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
        ],
        metadata: {
          totalDocuments: 1,
          currentPage: 1,
          totalPages: 1
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or inactive API key'
  })
  getProperties(
    @Query() query: ExternalPropertyQueryDto,
    @CurrentApiKey() apiKey: ApiKeyAuthContext
  ) {
    return this.externalApiService.getProperties(query, apiKey)
  }

  @Get('properties/:id')
  @ApiOperation({
    summary: 'Get a single property by ID',
    description:
      'Returns the full property details for a property within the portfolio bound to the x-api-key header. Matches the regular GET /property/:id response. The API key must be valid and active.'
  })
  @ApiResponse({
    status: 200,
    description: 'Property retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Operation successful',
        data: {
          id: '507f1f77bcf86cd799439011',
          name: 'Grand Hotel',
          address: '123 Main Street, New York, NY 10001',
          is_active: true,
          portfolio_id: '507f1f77bcf86cd799439012',
          access_type: 'owned',
          total_notes: 2,
          total_contract_urls: 1,
          currency: {
            id: '507f1f77bcf86cd799439013',
            code: 'USD',
            name: 'United States Dollar',
            symbol: '$'
          },
          portfolio: {
            id: '507f1f77bcf86cd799439012',
            name: 'Drury Hotels',
            is_active: true
          },
          credentials: {
            expedia_id: '12345',
            agoda_id: '67890',
            booking_id: '11111'
          },
          bankDetails: null,
          audits: []
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or inactive API key'
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found or not in API key portfolio'
  })
  getProperty(
    @Param('id') id: string,
    @CurrentApiKey() apiKey: ApiKeyAuthContext
  ) {
    return this.externalApiService.getProperty(id, apiKey)
  }
}
