import { Inject, Injectable } from '@nestjs/common'
import { ExternalPropertyQueryDto } from '../property/property.dto'
import type { IPropertyService } from '../property/property.interface'
import type { ApiKeyAuthContext } from './api-key.interface'

@Injectable()
export class ExternalApiService {
  constructor(
    @Inject('IPropertyService')
    private readonly propertyService: IPropertyService
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
}
