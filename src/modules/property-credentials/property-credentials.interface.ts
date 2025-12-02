import { PropertyCredentials } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  BulkUpdatePropertyCredentialsDto,
  BulkUpdatePropertyCredentialsResponseDto,
  CreatePropertyCredentialsDto,
  PropertyCredentialsResponseDto,
  UpdatePropertyCredentialsDto
} from './property-credentials.dto'

// Extended type with decrypted passwords
export type PropertyCredentialsWithDecrypted = {
  id: string
  property_id: string
  created_at: Date
  updated_at: Date
  expedia_id: string
  expedia_username: string | null
  expedia_password: string | null
  agoda_id: string | null
  agoda_username: string | null
  agoda_password: string | null
  booking_id: string | null
  booking_username: string | null
  booking_password: string | null
}

export interface IPropertyCredentialsRepository {
  create(data: any): Promise<PropertyCredentials>
  findByPropertyId(
    propertyId: string
  ): Promise<PropertyCredentialsWithDecrypted | null>
  update(propertyId: string, data: any): Promise<PropertyCredentials>
  findManyByPropertyIds(
    propertyIds: string[]
  ): Promise<PropertyCredentialsWithDecrypted[]>
  bulkUpdate(
    propertyIds: string[],
    data: any
  ): Promise<{ count: number }>
}

export interface IPropertyCredentialsService {
  create(
    data: CreatePropertyCredentialsDto,
    user: IUserWithPermissions
  ): Promise<PropertyCredentialsResponseDto>
  findByPropertyId(
    propertyId: string,
    user: IUserWithPermissions
  ): Promise<PropertyCredentialsResponseDto>
  update(
    propertyId: string,
    data: UpdatePropertyCredentialsDto,
    user: IUserWithPermissions
  ): Promise<PropertyCredentialsResponseDto>
  bulkUpdate(
    data: BulkUpdatePropertyCredentialsDto,
    user: IUserWithPermissions
  ): Promise<BulkUpdatePropertyCredentialsResponseDto>
}
