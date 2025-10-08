import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreatePropertyBankDetailsDto,
  UpdatePropertyBankDetailsDto
} from './property-bank-details.dto'
import type { IPropertyBankDetailsRepository } from './property-bank-details.interface'

@Injectable()
export class PropertyBankDetailsRepository
  implements IPropertyBankDetailsRepository
{
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreatePropertyBankDetailsDto) {
    return this.prisma.propertyBankDetails.create({
      data
    })
  }

  async findByPropertyId(propertyId: string) {
    return this.prisma.propertyBankDetails.findUnique({
      where: { property_id: propertyId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            is_active: true
          }
        }
      }
    })
  }

  async update(propertyId: string, data: UpdatePropertyBankDetailsDto) {
    return this.prisma.propertyBankDetails.update({
      where: { property_id: propertyId },
      data
    })
  }

  async delete(propertyId: string) {
    return this.prisma.propertyBankDetails.delete({
      where: { property_id: propertyId }
    })
  }
}
