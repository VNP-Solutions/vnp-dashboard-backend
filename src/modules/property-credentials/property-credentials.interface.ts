import { Prisma, PropertyCredentials } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreatePropertyCredentialsDto,
  PropertyCredentialsQueryDto,
  PropertyCredentialsResponseDto,
  UpdatePropertyCredentialsDto
} from './property-credentials.dto'

type PropertyCredentialsWithProperty = Prisma.PropertyCredentialsGetPayload<{
  include: {
    property: {
      select: {
        id: true
        name: true
        is_active: true
      }
    }
  }
}>

export interface IPropertyCredentialsRepository {
  create(data: any): Promise<PropertyCredentials>
  findAll(
    queryOptions: any,
    propertyIds?: string[]
  ): Promise<PropertyCredentialsWithProperty[]>
  count(whereClause: any, propertyIds?: string[]): Promise<number>
  findByPropertyId(propertyId: string): Promise<PropertyCredentials | null>
  update(propertyId: string, data: any): Promise<PropertyCredentials>
  delete(id: string): Promise<PropertyCredentials>
}

export interface IPropertyCredentialsService {
  create(
    data: CreatePropertyCredentialsDto,
    user: IUserWithPermissions
  ): Promise<PropertyCredentialsResponseDto>
  findAll(
    query: PropertyCredentialsQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PropertyCredentialsResponseDto>>
  findByPropertyId(
    propertyId: string,
    user: IUserWithPermissions
  ): Promise<PropertyCredentialsResponseDto>
  update(
    propertyId: string,
    data: UpdatePropertyCredentialsDto,
    user: IUserWithPermissions
  ): Promise<PropertyCredentialsResponseDto>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
