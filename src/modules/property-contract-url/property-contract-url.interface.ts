import { PropertyContractUrl, Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreatePropertyContractUrlDto,
  PropertyContractUrlQueryDto,
  UpdatePropertyContractUrlDto
} from './property-contract-url.dto'

type PropertyContractUrlWithRelations =
  Prisma.PropertyContractUrlGetPayload<{
    include: {
      property: {
        select: {
          id: true
          name: true
        }
      }
      user: {
        select: {
          id: true
          first_name: true
          last_name: true
          email: true
        }
      }
    }
  }>

type PropertyContractUrlWithFullDetails =
  Prisma.PropertyContractUrlGetPayload<{
    include: {
      property: {
        select: {
          id: true
          name: true
          is_active: true
        }
      }
      user: {
        select: {
          id: true
          first_name: true
          last_name: true
          email: true
        }
      }
    }
  }>

export interface IPropertyContractUrlRepository {
  create(
    data: CreatePropertyContractUrlDto & { user_id: string }
  ): Promise<PropertyContractUrlWithRelations>
  findAll(
    queryOptions: any,
    propertyId?: string
  ): Promise<PropertyContractUrlWithRelations[]>
  count(whereClause: any, propertyId?: string): Promise<number>
  findById(id: string): Promise<PropertyContractUrlWithFullDetails | null>
  findByPropertyId(
    propertyId: string,
    userId?: string
  ): Promise<PropertyContractUrlWithRelations[]>
  findByUserId(userId: string): Promise<PropertyContractUrlWithRelations[]>
  update(
    id: string,
    data: UpdatePropertyContractUrlDto
  ): Promise<PropertyContractUrlWithRelations>
  delete(id: string): Promise<PropertyContractUrl>
}

export interface IPropertyContractUrlService {
  create(
    data: CreatePropertyContractUrlDto,
    user: IUserWithPermissions
  ): Promise<PropertyContractUrlWithRelations>
  findAll(
    query: PropertyContractUrlQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PropertyContractUrlWithRelations>>
  findAllForExport(
    query: PropertyContractUrlQueryDto,
    user: IUserWithPermissions
  ): Promise<PropertyContractUrlWithRelations[]>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<PropertyContractUrlWithFullDetails>
  findByProperty(
    propertyId: string,
    user: IUserWithPermissions
  ): Promise<PropertyContractUrlWithRelations[]>
  update(
    id: string,
    data: UpdatePropertyContractUrlDto,
    user: IUserWithPermissions
  ): Promise<PropertyContractUrlWithRelations>
  remove(
    id: string,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
}
