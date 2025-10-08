import { Prisma, PropertyBankDetails } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreatePropertyBankDetailsDto,
  UpdatePropertyBankDetailsDto
} from './property-bank-details.dto'

type PropertyBankDetailsWithProperty = Prisma.PropertyBankDetailsGetPayload<{
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

export interface IPropertyBankDetailsRepository {
  create(data: CreatePropertyBankDetailsDto): Promise<PropertyBankDetails>
  findByPropertyId(
    propertyId: string
  ): Promise<PropertyBankDetailsWithProperty | null>
  update(
    propertyId: string,
    data: UpdatePropertyBankDetailsDto
  ): Promise<PropertyBankDetails>
  delete(propertyId: string): Promise<PropertyBankDetails>
}

export interface IPropertyBankDetailsService {
  create(
    data: CreatePropertyBankDetailsDto,
    user: IUserWithPermissions
  ): Promise<PropertyBankDetails>
  findByPropertyId(
    propertyId: string,
    user: IUserWithPermissions
  ): Promise<PropertyBankDetailsWithProperty>
  update(
    propertyId: string,
    data: UpdatePropertyBankDetailsDto,
    user: IUserWithPermissions
  ): Promise<PropertyBankDetails>
}
