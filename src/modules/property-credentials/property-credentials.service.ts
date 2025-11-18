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
  BulkUpdatePropertyCredentialsDto,
  BulkUpdatePropertyCredentialsResponseDto,
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

    // Replace strategy: Only keep credentials that are provided in the payload
    // If a credential (agoda/booking) is not in the payload, it will be cleared
    const updateData: any = {}

    // Handle Expedia credentials
    if (data.expedia) {
      updateData.expedia_id = data.expedia.id
      updateData.expedia_username = data.expedia.username
      updateData.expedia_password = EncryptionUtil.encrypt(
        data.expedia.password,
        encryptionSecret
      )
    } else {
      // If expedia is not provided, clear it
      updateData.expedia_id = null
      updateData.expedia_username = null
      updateData.expedia_password = null
    }

    // Handle Agoda credentials
    if (data.agoda && data.agoda.username && data.agoda.password) {
      // Agoda credentials provided - update them
      updateData.agoda_id = data.agoda.id || null
      updateData.agoda_username = data.agoda.username
      updateData.agoda_password = EncryptionUtil.encrypt(
        data.agoda.password,
        encryptionSecret
      )
    } else {
      // Agoda not provided or incomplete - clear it
      updateData.agoda_id = null
      updateData.agoda_username = null
      updateData.agoda_password = null
    }

    // Handle Booking credentials
    if (data.booking && data.booking.username && data.booking.password) {
      // Booking credentials provided - update them
      updateData.booking_id = data.booking.id || null
      updateData.booking_username = data.booking.username
      updateData.booking_password = EncryptionUtil.encrypt(
        data.booking.password,
        encryptionSecret
      )
    } else {
      // Booking not provided or incomplete - clear it
      updateData.booking_id = null
      updateData.booking_username = null
      updateData.booking_password = null
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

  async bulkUpdate(
    data: BulkUpdatePropertyCredentialsDto,
    _user: IUserWithPermissions
  ): Promise<BulkUpdatePropertyCredentialsResponseDto> {
    const { property_ids, credentials } = data

    if (property_ids.length === 0) {
      throw new BadRequestException('property_ids array cannot be empty')
    }

    // Validate that at least one credential field is provided
    if (!credentials.expedia && !credentials.agoda && !credentials.booking) {
      throw new BadRequestException(
        'At least one credential (expedia, agoda, or booking) must be provided'
      )
    }

    // Validate properties exist
    const properties = await this.propertyRepository.findByIds(property_ids)
    const foundPropertyIds = properties.map(p => p.id)

    // Get existing credentials for all properties
    const existingCredentials =
      await this.credentialsRepository.findManyByPropertyIds(foundPropertyIds)

    // Create a map of property_id to existing credentials
    const existingCredMap = new Map(
      existingCredentials.map(cred => [cred.property_id, cred])
    )

    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!

    const updatedPropertyIds: string[] = []
    const skippedPropertyIds: string[] = []

    // Process each property individually to handle merging logic
    for (const propertyId of foundPropertyIds) {
      const existingCred = existingCredMap.get(propertyId)

      if (!existingCred) {
        // Skip properties without existing credentials
        skippedPropertyIds.push(propertyId)
        continue
      }

      const updateData: any = {}

      // Handle Expedia credentials
      if (credentials.expedia) {
        // Update ID if provided
        if (credentials.expedia.id !== undefined) {
          updateData.expedia_id = credentials.expedia.id
        }

        // Handle username and password together
        const hasUsername = credentials.expedia.username !== undefined
        const hasPassword = credentials.expedia.password !== undefined

        if (hasUsername && hasPassword) {
          // Both provided - update both
          updateData.expedia_username = credentials.expedia.username
          updateData.expedia_password = EncryptionUtil.encrypt(
            credentials.expedia.password!,
            encryptionSecret
          )
        } else if (hasPassword && !hasUsername) {
          // Only password provided - update password, keep existing username
          updateData.expedia_password = EncryptionUtil.encrypt(
            credentials.expedia.password!,
            encryptionSecret
          )
        } else if (hasUsername && !hasPassword) {
          // Only username provided - update username, keep existing password
          updateData.expedia_username = credentials.expedia.username
        }
      }

      // Handle Agoda credentials
      if (credentials.agoda) {
        const hasId = credentials.agoda.id !== undefined
        const hasUsername = credentials.agoda.username !== undefined
        const hasPassword = credentials.agoda.password !== undefined

        // Update ID independently
        if (hasId) {
          updateData.agoda_id = credentials.agoda.id
        }

        // Username and password must be updated together
        if (hasUsername && hasPassword) {
          // Both provided - update both
          updateData.agoda_username = credentials.agoda.username
          updateData.agoda_password = EncryptionUtil.encrypt(
            credentials.agoda.password!,
            encryptionSecret
          )
        } else if (hasPassword && !hasUsername) {
          // Only password provided - update password if username exists
          if (existingCred.agoda_username) {
            updateData.agoda_password = EncryptionUtil.encrypt(
              credentials.agoda.password!,
              encryptionSecret
            )
          }
          // Otherwise skip (don't save password without username)
        } else if (hasUsername && !hasPassword) {
          // Only username provided - update username if password exists
          if (existingCred.agoda_password) {
            updateData.agoda_username = credentials.agoda.username
          }
          // Otherwise skip (don't save username without password)
        }
      }

      // Handle Booking credentials
      if (credentials.booking) {
        const hasId = credentials.booking.id !== undefined
        const hasUsername = credentials.booking.username !== undefined
        const hasPassword = credentials.booking.password !== undefined

        // Update ID independently
        if (hasId) {
          updateData.booking_id = credentials.booking.id
        }

        // Username and password must be updated together
        if (hasUsername && hasPassword) {
          // Both provided - update both
          updateData.booking_username = credentials.booking.username
          updateData.booking_password = EncryptionUtil.encrypt(
            credentials.booking.password!,
            encryptionSecret
          )
        } else if (hasPassword && !hasUsername) {
          // Only password provided - update password if username exists
          if (existingCred.booking_username) {
            updateData.booking_password = EncryptionUtil.encrypt(
              credentials.booking.password!,
              encryptionSecret
            )
          }
          // Otherwise skip (don't save password without username)
        } else if (hasUsername && !hasPassword) {
          // Only username provided - update username if password exists
          if (existingCred.booking_password) {
            updateData.booking_username = credentials.booking.username
          }
          // Otherwise skip (don't save username without password)
        }
      }

      // Only update if there are fields to update
      if (Object.keys(updateData).length > 0) {
        await this.credentialsRepository.update(propertyId, updateData)
        updatedPropertyIds.push(propertyId)
      } else {
        skippedPropertyIds.push(propertyId)
      }
    }

    // Add properties that don't exist or have no credentials to skipped
    const notFoundPropertyIds = property_ids.filter(
      id => !foundPropertyIds.includes(id)
    )
    skippedPropertyIds.push(...notFoundPropertyIds)

    return {
      updated_count: updatedPropertyIds.length,
      updated_property_ids: updatedPropertyIds,
      skipped_count: skippedPropertyIds.length,
      skipped_property_ids: skippedPropertyIds
    }
  }
}
