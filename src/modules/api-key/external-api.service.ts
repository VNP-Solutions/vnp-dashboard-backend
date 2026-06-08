import { Inject, Injectable } from '@nestjs/common'
import type { IPropertyService } from '../property/property.interface'
import type { ApiKeyAuthContext } from './api-key.interface'

@Injectable()
export class ExternalApiService {
  constructor(
    @Inject('IPropertyService')
    private readonly propertyService: IPropertyService
  ) {}

  getProperties(apiKey: ApiKeyAuthContext) {
    return this.propertyService.findAllForApiKeyPortfolio(apiKey.portfolio_id)
  }
}
