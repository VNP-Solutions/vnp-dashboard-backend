import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { Configuration } from '../../config/configuration'
import type { IPropertyRepository } from '../property/property.interface'
import {
  CreatePropertyCredentialsDto,
  PropertyCredentialsResponseDto,
  UpdatePropertyCredentialsDto
} from './property-credentials.dto'
import type {
  IPropertyCredentialsRepository,
  IPropertyCredentialsService
} from './property-credentials.interface'

@Injectable()
export class PropertyCredentialsService implements IPropertyCredentialsService {
  constructor(
    @Inject('IPropertyCredentialsRepository')
    private credentialsRepository: IPropertyCredentialsRepository,
    @Inject('IPropertyRepository')
    private propertyRepository: IPropertyRepository,
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>
  ) {}

  async create(
    data: CreatePropertyCredentialsDto,
    _user: IUserWithPermissions
  ): Promise<PropertyCredentialsResponseDto> {
    // Validate property exists
    const property = await this.propertyRepository.findById(data.property_id)
    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check if credentials already exist for this property
    const existingCredentials =
      await this.credentialsRepository.findByPropertyId(data.property_id)
    if (existingCredentials) {
      throw new ConflictException(
        'Credentials already exist for this property. Use update endpoint instead.'
      )
    }

    // Encrypt passwords before saving
    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!

    const encryptedData: any = {
      property_id: data.property_id,
      // Expedia is required
      expedia_id: data.expedia.id,
      expedia_username: data.expedia.username,
      expedia_password: EncryptionUtil.encrypt(
        data.expedia.password,
        encryptionSecret
      )
    }

    if (data.agoda) {
      encryptedData.agoda_id = data.agoda.id || null
      encryptedData.agoda_username = data.agoda.username || null
      encryptedData.agoda_password = data.agoda.password
        ? EncryptionUtil.encrypt(data.agoda.password, encryptionSecret)
        : null
    }

    if (data.booking) {
      encryptedData.booking_id = data.booking.id || null
      encryptedData.booking_username = data.booking.username || null
      encryptedData.booking_password = data.booking.password
        ? EncryptionUtil.encrypt(data.booking.password, encryptionSecret)
        : null
    }

    const credentials = await this.credentialsRepository.create(encryptedData)

    // Return without decrypted passwords (decrypt only on read)
    return this.formatResponse(credentials)
  }

  async findByPropertyId(
    propertyId: string,
    _user: IUserWithPermissions
  ): Promise<PropertyCredentialsResponseDto> {
    // Validate property exists
    const property = await this.propertyRepository.findById(propertyId)
    if (!property) {
      throw new NotFoundException('Property not found')
    }

    const credentials =
      await this.credentialsRepository.findByPropertyId(propertyId)

    if (!credentials) {
      throw new NotFoundException('Credentials not found for this property')
    }

    // Return with passwords marked as encrypted (don't decrypt)
    return this.formatResponse(credentials, false)
  }

  async update(
    propertyId: string,
    data: UpdatePropertyCredentialsDto,
    _user: IUserWithPermissions
  ): Promise<PropertyCredentialsResponseDto> {
    // Validate property exists
    const property = await this.propertyRepository.findById(propertyId)
    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check if credentials exist
    const existingCredentials =
      await this.credentialsRepository.findByPropertyId(propertyId)
    if (!existingCredentials) {
      throw new NotFoundException(
        'Credentials not found for this property. Use create endpoint instead.'
      )
    }

    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!

    const updateData: any = {}

    // Handle Expedia credentials (required fields)
    if (data.expedia) {
      if (data.expedia.id !== undefined) {
        updateData.expedia_id = data.expedia.id
      }
      if (data.expedia.username !== undefined) {
        updateData.expedia_username = data.expedia.username
      }
      if (data.expedia.password !== undefined) {
        updateData.expedia_password = EncryptionUtil.encrypt(
          data.expedia.password,
          encryptionSecret
        )
      }
    }

    // Handle Agoda credentials
    if (data.agoda) {
      if (data.agoda.username && !data.agoda.password) {
        // Skip - don't update agoda credentials
      } else if (data.agoda.username && data.agoda.password) {
        // Both username and password provided - use new password
        updateData.agoda_id = data.agoda.id || existingCredentials.agoda_id
        updateData.agoda_username = data.agoda.username
        updateData.agoda_password = EncryptionUtil.encrypt(
          data.agoda.password,
          encryptionSecret
        )
      } else if (data.agoda.id !== undefined) {
        // Only ID provided
        updateData.agoda_id = data.agoda.id
      }
    }

    // Handle Booking credentials
    if (data.booking) {
      if (data.booking.username && !data.booking.password) {
        // Skip - don't update booking credentials
      } else if (data.booking.username && data.booking.password) {
        // Both username and password provided - use new password
        updateData.booking_id =
          data.booking.id || existingCredentials.booking_id
        updateData.booking_username = data.booking.username
        updateData.booking_password = EncryptionUtil.encrypt(
          data.booking.password,
          encryptionSecret
        )
      } else if (data.booking.id !== undefined) {
        // Only ID provided
        updateData.booking_id = data.booking.id
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No valid fields to update')
    }

    const updatedCredentials = await this.credentialsRepository.update(
      propertyId,
      updateData
    )

    return this.formatResponse(updatedCredentials, false)
  }

  private formatResponse(
    credentials: any,
    hidePasswords: boolean = true
  ): PropertyCredentialsResponseDto {
    const response: PropertyCredentialsResponseDto = {
      id: credentials.id,
      property_id: credentials.property_id,
      created_at: credentials.created_at,
      updated_at: credentials.updated_at,
      // Expedia is required
      expedia: {
        id: credentials.expedia_id,
        username: credentials.expedia_username,
        password: hidePasswords ? '********' : credentials.expedia_password
      }
    }

    // Format Agoda credentials (optional)
    if (
      credentials.agoda_id ||
      credentials.agoda_username ||
      credentials.agoda_password
    ) {
      response.agoda = {
        id: credentials.agoda_id,
        username: credentials.agoda_username,
        password: hidePasswords ? '********' : credentials.agoda_password
      }
    }

    // Format Booking credentials (optional)
    if (
      credentials.booking_id ||
      credentials.booking_username ||
      credentials.booking_password
    ) {
      response.booking = {
        id: credentials.booking_id,
        username: credentials.booking_username,
        password: hidePasswords ? '********' : credentials.booking_password
      }
    }

    return response
  }
}
