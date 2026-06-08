import { Inject, Injectable } from '@nestjs/common'
import { ExternalAuditQueryDto } from '../audit/audit.dto'
import type { IAuditService } from '../audit/audit.interface'
import { ExternalPropertyQueryDto } from '../property/property.dto'
import type { IPropertyService } from '../property/property.interface'
import type { ApiKeyAuthContext } from './api-key.interface'

@Injectable()
export class ExternalApiService {
  constructor(
    @Inject('IPropertyService')
    private readonly propertyService: IPropertyService,
    @Inject('IAuditService')
    private readonly auditService: IAuditService
  ) {}

  getProperties(query: ExternalPropertyQueryDto, apiKey: ApiKeyAuthContext) {
    return this.propertyService.findAllForApiKeyPortfolio(
      apiKey.portfolio_id,
      query
    )
  }

  getProperty(propertyId: string, apiKey: ApiKeyAuthContext) {
    return this.propertyService.findOneForApiKey(
      propertyId,
      apiKey.portfolio_id
    )
  }

  getAudits(query: ExternalAuditQueryDto, apiKey: ApiKeyAuthContext) {
    return this.auditService.findAllForApiKeyPortfolio(
      apiKey.portfolio_id,
      query
    )
  }

  getAuditsByProperty(
    propertyId: string,
    query: ExternalAuditQueryDto,
    apiKey: ApiKeyAuthContext
  ) {
    return this.auditService.findAllForApiKeyProperty(
      propertyId,
      apiKey.portfolio_id,
      query
    )
  }
}
