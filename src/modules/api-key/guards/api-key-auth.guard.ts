import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import * as crypto from 'crypto'
import type { IApiKeyRepository } from '../api-key.interface'

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    @Inject('IApiKeyRepository')
    private readonly apiKeyRepository: IApiKeyRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>
      apiKey?: {
        id: string
        portfolio_id: string
        is_active: boolean
        portfolio: {
          id: string
          name: string
          is_active: boolean
        }
      }
    }>()

    const rawApiKey = request.headers['x-api-key']

    if (!rawApiKey || typeof rawApiKey !== 'string' || !rawApiKey.trim()) {
      throw new UnauthorizedException('API key is required')
    }

    const keyHash = crypto
      .createHash('sha256')
      .update(rawApiKey.trim())
      .digest('hex')

    const apiKeyRecord = await this.apiKeyRepository.findByKeyHash(keyHash)

    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid API key')
    }

    if (!apiKeyRecord.is_active) {
      throw new UnauthorizedException('API key is inactive')
    }

    request.apiKey = {
      id: apiKeyRecord.id,
      portfolio_id: apiKeyRecord.portfolio_id,
      is_active: apiKeyRecord.is_active,
      portfolio: apiKeyRecord.portfolio
    }

    return true
  }
}
