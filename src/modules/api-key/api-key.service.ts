import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { isUserSuperAdmin } from '../../common/utils/permission.util'
import { Configuration } from '../../config/configuration'
import { PrismaService } from '../prisma/prisma.service'
import { CreateApiKeyDto } from './api-key.dto'
import type {
  ApiKeyResponse,
  ApiKeyWithPortfolio,
  IApiKeyRepository,
  IApiKeyService
} from './api-key.interface'

@Injectable()
export class ApiKeyService implements IApiKeyService {
  constructor(
    @Inject('IApiKeyRepository')
    private apiKeyRepository: IApiKeyRepository,
    @Inject(PrismaService)
    private prisma: PrismaService,
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>
  ) {}

  async create(
    data: CreateApiKeyDto,
    user: IUserWithPermissions
  ): Promise<ApiKeyResponse> {
    this.ensureSuperAdmin(user)

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: data.portfolio_id }
    })

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    const plainApiKey = this.generateApiKey()
    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!
    const encryptedApiKey = EncryptionUtil.encrypt(
      plainApiKey,
      encryptionSecret
    )
    const keyHash = this.hashApiKey(plainApiKey)

    const apiKey = await this.apiKeyRepository.create({
      api_key: encryptedApiKey,
      key_hash: keyHash,
      portfolio_id: data.portfolio_id,
      is_active: data.is_active ?? true
    })

    return this.toApiKeyResponse(apiKey, plainApiKey)
  }

  async findAll(user: IUserWithPermissions): Promise<ApiKeyResponse[]> {
    this.ensureSuperAdmin(user)

    const apiKeys = await this.apiKeyRepository.findAll()

    return apiKeys.map(apiKey => this.toApiKeyResponse(apiKey))
  }

  async toggleActive(
    id: string,
    user: IUserWithPermissions
  ): Promise<ApiKeyResponse> {
    this.ensureSuperAdmin(user)

    const apiKey = await this.apiKeyRepository.findById(id)

    if (!apiKey) {
      throw new NotFoundException('API key not found')
    }

    const updatedApiKey = await this.apiKeyRepository.updateActive(
      id,
      !apiKey.is_active
    )

    return this.toApiKeyResponse(updatedApiKey)
  }

  async remove(
    id: string,
    user: IUserWithPermissions
  ): Promise<{ message: string }> {
    this.ensureSuperAdmin(user)

    const apiKey = await this.apiKeyRepository.findById(id)

    if (!apiKey) {
      throw new NotFoundException('API key not found')
    }

    await this.apiKeyRepository.delete(id)

    return { message: 'API key deleted successfully' }
  }

  private ensureSuperAdmin(user: IUserWithPermissions): void {
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only Super Admin can manage API keys')
    }
  }

  private generateApiKey(): string {
    return `vnp_${crypto.randomBytes(32).toString('hex')}`
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex')
  }

  private toApiKeyResponse(
    apiKey: ApiKeyWithPortfolio,
    plainApiKey?: string
  ): ApiKeyResponse {
    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!
    const decryptedApiKey =
      plainApiKey ?? EncryptionUtil.decrypt(apiKey.api_key, encryptionSecret)

    return {
      id: apiKey.id,
      api_key: decryptedApiKey,
      portfolio_id: apiKey.portfolio_id,
      portfolio: apiKey.portfolio,
      is_active: apiKey.is_active,
      created_at: apiKey.created_at,
      updated_at: apiKey.updated_at
    }
  }
}
