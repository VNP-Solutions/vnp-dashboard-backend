import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { Configuration } from '../../config/configuration'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyCredentialsRepository } from './property-credentials.interface'

@Injectable()
export class PropertyCredentialsRepository
  implements IPropertyCredentialsRepository
{
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(ConfigService) private configService: ConfigService<Configuration>
  ) {}

  async create(data: any) {
    return this.prisma.propertyCredentials.create({
      data
    })
  }

  async findByPropertyId(propertyId: string) {
    const credentials = await this.prisma.propertyCredentials.findUnique({
      where: { property_id: propertyId }
    })

    if (!credentials) {
      return null
    }

    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!

    return {
      ...credentials,
      expedia_password: credentials.expedia_password
        ? EncryptionUtil.decrypt(credentials.expedia_password, encryptionSecret)
        : null,
      agoda_password: credentials.agoda_password
        ? EncryptionUtil.decrypt(credentials.agoda_password, encryptionSecret)
        : null,
      booking_password: credentials.booking_password
        ? EncryptionUtil.decrypt(credentials.booking_password, encryptionSecret)
        : null
    }
  }

  async update(propertyId: string, data: any) {
    return this.prisma.propertyCredentials.update({
      where: { property_id: propertyId },
      data
    })
  }
}
