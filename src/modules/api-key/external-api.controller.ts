import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags
} from '@nestjs/swagger'
import { ExternalAuditQueryDto } from '../audit/audit.dto'
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

  @Get('audits/properties/:propertyId')
  @ApiOperation({
    summary: 'Get audits for a single property',
    description:
      'Returns audits for a property within the portfolio bound to the x-api-key header. Supports the same query params as GET /external/audits (page, limit, search, sortBy, sortOrder, type_of_ota, expedia_id, send_all). The API key must be valid and active.'
  })
  @ApiResponse({
    status: 200,
    description: 'Audits retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Request successful',
        data: [
          {
            id: '507f1f77bcf86cd799439011',
            property_id: '507f1f77bcf86cd799439012',
            type_of_ota: ['expedia'],
            is_archived: false,
            amount_collectable: 1500,
            amount_confirmed: 1200
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
  @ApiResponse({
    status: 404,
    description: 'Property not found or not in API key portfolio'
  })
  getAuditsByProperty(
    @Param('propertyId') propertyId: string,
    @Query() query: ExternalAuditQueryDto,
    @CurrentApiKey() apiKey: ApiKeyAuthContext
  ) {
    return this.externalApiService.getAuditsByProperty(
      propertyId,
      query,
      apiKey
    )
  }

  @Get('audits/:auditId')
  @ApiOperation({
    summary: 'Get a single audit by ID',
    description:
      'Returns full audit details for an audit within the portfolio bound to the x-api-key header. Matches the regular GET /audit/:id response. The API key must be valid and active.'
  })
  @ApiResponse({
    status: 200,
    description: 'Audit retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Operation successful',
        data: {
          id: '507f1f77bcf86cd799439011',
          property_id: '507f1f77bcf86cd799439012',
          type_of_ota: ['expedia'],
          is_archived: false,
          expedia_amount_collectable: 1500,
          expedia_amount_confirmed: 1200,
          auditStatus: {
            id: '507f1f77bcf86cd799439013',
            status: 'OTA POST Completed'
          },
          property: {
            id: '507f1f77bcf86cd799439012',
            name: 'Grand Hotel'
          }
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
    description: 'Audit not found or not in API key portfolio'
  })
  getAudit(
    @Param('auditId') auditId: string,
    @CurrentApiKey() apiKey: ApiKeyAuthContext
  ) {
    return this.externalApiService.getAudit(auditId, apiKey)
  }

  @Get('audits')
  @ApiOperation({
    summary: 'Get audits for the API key portfolio',
    description:
      'Returns audits for the portfolio bound to the x-api-key header. Supports the same filters as the regular GET /audit endpoint (page, limit, search, sortBy, sortOrder, type_of_ota, expedia_id). Set send_all=true to return all matching results and ignore page/limit. The API key must be valid and active.'
  })
  @ApiResponse({
    status: 200,
    description: 'Audits retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Request successful',
        data: [
          {
            id: '507f1f77bcf86cd799439011',
            property_id: '507f1f77bcf86cd799439012',
            type_of_ota: ['expedia'],
            is_archived: false,
            amount_collectable: 1500,
            amount_confirmed: 1200
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
  getAudits(
    @Query() query: ExternalAuditQueryDto,
    @CurrentApiKey() apiKey: ApiKeyAuthContext
  ) {
    return this.externalApiService.getAudits(query, apiKey)
  }
}
