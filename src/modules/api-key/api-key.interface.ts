import { Prisma } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateApiKeyDto } from './api-key.dto'

export type ApiKeyWithPortfolio = Prisma.ApiKeyGetPayload<{
  include: {
    portfolio: {
      select: {
        id: true
        name: true
        is_active: true
      }
    }
  }
}>

export interface ApiKeyAuthContext {
  id: string
  portfolio_id: string
  is_active: boolean
  portfolio: {
    id: string
    name: string
    is_active: boolean
  }
}

export interface ApiKeyResponse {
  id: string
  api_key: string
  portfolio_id: string
  portfolio: {
    id: string
    name: string
    is_active: boolean
  }
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface IApiKeyRepository {
  create(data: {
    api_key: string
    key_hash: string
    portfolio_id: string
    is_active: boolean
  }): Promise<ApiKeyWithPortfolio>
  findAll(): Promise<ApiKeyWithPortfolio[]>
  findById(id: string): Promise<ApiKeyWithPortfolio | null>
  findByKeyHash(key_hash: string): Promise<ApiKeyWithPortfolio | null>
  updateActive(id: string, is_active: boolean): Promise<ApiKeyWithPortfolio>
  delete(id: string): Promise<ApiKeyWithPortfolio>
}

export interface IApiKeyService {
  create(
    data: CreateApiKeyDto,
    user: IUserWithPermissions
  ): Promise<ApiKeyResponse>
  findAll(user: IUserWithPermissions): Promise<ApiKeyResponse[]>
  toggleActive(id: string, user: IUserWithPermissions): Promise<ApiKeyResponse>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
