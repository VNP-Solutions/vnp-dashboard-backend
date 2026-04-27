import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OtaPasswordPlaintextCacheService } from '../../common/services/ota-password-plaintext-cache.service'
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
    @Inject(ConfigService) private configService: ConfigService<Configuration>,
    private otaPasswordPlaintextCache: OtaPasswordPlaintextCacheService
  ) {}

  async create(data: any) {
    const created = await this.prisma.propertyCredentials.create({
      data
    })
    this.otaPasswordPlaintextCache.invalidate()
    return created
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

    try {
      return {
        ...credentials,
        // Expedia password is now optional - decrypt only if present
        expedia_password: credentials.expedia_password
          ? EncryptionUtil.decrypt(
              credentials.expedia_password,
              encryptionSecret
            )
          : null,
        // Optional fields - decrypt only if present
        agoda_password: credentials.agoda_password
          ? EncryptionUtil.decrypt(credentials.agoda_password, encryptionSecret)
          : null,
        booking_password: credentials.booking_password
          ? EncryptionUtil.decrypt(
              credentials.booking_password,
              encryptionSecret
            )
          : null
      }
    } catch (error) {
      throw new Error(
        `Failed to decrypt credentials for property ${propertyId}: ${error.message}`
      )
    }
  }

  async update(propertyId: string, data: any) {
    const updated = await this.prisma.propertyCredentials.update({
      where: { property_id: propertyId },
      data
    })
    this.otaPasswordPlaintextCache.invalidate()
    return updated
  }

  async findManyByPropertyIds(propertyIds: string[]) {
    const credentials = await this.prisma.propertyCredentials.findMany({
      where: { property_id: { in: propertyIds } }
    })

    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!

    return credentials.map(cred => {
      try {
        return {
          ...cred,
          // Expedia password is now optional - decrypt only if present
          expedia_password: cred.expedia_password
            ? EncryptionUtil.decrypt(cred.expedia_password, encryptionSecret)
            : null,
          agoda_password: cred.agoda_password
            ? EncryptionUtil.decrypt(cred.agoda_password, encryptionSecret)
            : null,
          booking_password: cred.booking_password
            ? EncryptionUtil.decrypt(cred.booking_password, encryptionSecret)
            : null
        }
      } catch (error) {
        throw new Error(
          `Failed to decrypt credentials for property ${cred.property_id}: ${error.message}`
        )
      }
    })
  }

  async bulkUpdate(propertyIds: string[], data: any) {
    const result = await this.prisma.propertyCredentials.updateMany({
      where: { property_id: { in: propertyIds } },
      data
    })
    if (result.count > 0) {
      this.otaPasswordPlaintextCache.invalidate()
    }
    return { count: result.count }
  }
}
