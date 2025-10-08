import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyCredentialsRepository } from './property-credentials.interface'

@Injectable()
export class PropertyCredentialsRepository
  implements IPropertyCredentialsRepository
{
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.propertyCredentials.create({
      data
    })
  }

  async findByPropertyId(propertyId: string) {
    return this.prisma.propertyCredentials.findUnique({
      where: { property_id: propertyId }
    })
  }

  async update(propertyId: string, data: any) {
    return this.prisma.propertyCredentials.update({
      where: { property_id: propertyId },
      data
    })
  }
}
