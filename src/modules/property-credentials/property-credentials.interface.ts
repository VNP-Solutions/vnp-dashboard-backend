import { PropertyCredentials } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreatePropertyCredentialsDto,
  PropertyCredentialsResponseDto,
  UpdatePropertyCredentialsDto
} from './property-credentials.dto'

export interface IPropertyCredentialsRepository {
  create(data: any): Promise<PropertyCredentials>
  findByPropertyId(propertyId: string): Promise<PropertyCredentials | null>
  update(propertyId: string, data: any): Promise<PropertyCredentials>
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
}
