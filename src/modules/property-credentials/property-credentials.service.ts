import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import type { IPropertyRepository } from '../property/property.interface'
import {
  CreatePropertyCredentialsDto,
  PropertyCredentialsQueryDto,
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
    @Inject(PermissionService)
    private permissionService: PermissionService
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
    const encryptedData: any = {
      property_id: data.property_id
    }

    if (data.expedia) {
      encryptedData.expedia_id = data.expedia.id || null
      encryptedData.expedia_username = data.expedia.username || null
      encryptedData.expedia_password = data.expedia.password
        ? await EncryptionUtil.hashPassword(data.expedia.password)
        : null
    }

    if (data.agoda) {
      encryptedData.agoda_id = data.agoda.id || null
      encryptedData.agoda_username = data.agoda.username || null
      encryptedData.agoda_password = data.agoda.password
        ? await EncryptionUtil.hashPassword(data.agoda.password)
        : null
    }

    if (data.booking) {
      encryptedData.booking_id = data.booking.id || null
      encryptedData.booking_username = data.booking.username || null
      encryptedData.booking_password = data.booking.password
        ? await EncryptionUtil.hashPassword(data.booking.password)
        : null
    }

    const credentials = await this.credentialsRepository.create(encryptedData)

    // Return without decrypted passwords (decrypt only on read)
    return this.formatResponse(credentials)
  }

  async findAll(
    query: PropertyCredentialsQueryDto,
    user: IUserWithPermissions
  ): Promise<any> {
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        query.page || 1,
        query.limit || 10
      )
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.property_id) {
      additionalFilters.property_id = query.property_id
    }

    // Merge with existing filters
    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    // Configuration for query builder
    const queryConfig = {
      searchFields: ['property.name'],
      filterableFields: ['property_id'],
      sortableFields: ['created_at', 'updated_at'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessibleIds
            }
          }

    // Build Prisma query options
    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.credentialsRepository.findAll(
        { where, skip, take, orderBy },
        undefined
      ),
      this.credentialsRepository.count(where, undefined)
    ])

    // Decrypt passwords before returning
    const decryptedData = data.map(item => this.formatResponse(item, false))

    return QueryBuilder.buildPaginatedResult(
      decryptedData,
      total,
      query.page || 1,
      query.limit || 10
    )
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

    const updateData: any = {}

    // Handle Expedia credentials
    if (data.expedia) {
      // If username provided but no password, skip this OTA
      if (data.expedia.username && !data.expedia.password) {
        // Skip - don't update expedia credentials
      } else if (data.expedia.username && data.expedia.password) {
        // Both username and password provided - use new password
        updateData.expedia_id =
          data.expedia.id || existingCredentials.expedia_id
        updateData.expedia_username = data.expedia.username
        updateData.expedia_password = await EncryptionUtil.hashPassword(
          data.expedia.password
        )
      } else if (data.expedia.id !== undefined) {
        // Only ID provided
        updateData.expedia_id = data.expedia.id
      }
    }

    // Handle Agoda credentials
    if (data.agoda) {
      // If username provided but no password, skip this OTA
      if (data.agoda.username && !data.agoda.password) {
        // Skip - don't update agoda credentials
      } else if (data.agoda.username && data.agoda.password) {
        // Both username and password provided - use new password
        updateData.agoda_id = data.agoda.id || existingCredentials.agoda_id
        updateData.agoda_username = data.agoda.username
        updateData.agoda_password = await EncryptionUtil.hashPassword(
          data.agoda.password
        )
      } else if (data.agoda.id !== undefined) {
        // Only ID provided
        updateData.agoda_id = data.agoda.id
      }
    }

    // Handle Booking credentials
    if (data.booking) {
      // If username provided but no password, skip this OTA
      if (data.booking.username && !data.booking.password) {
        // Skip - don't update booking credentials
      } else if (data.booking.username && data.booking.password) {
        // Both username and password provided - use new password
        updateData.booking_id =
          data.booking.id || existingCredentials.booking_id
        updateData.booking_username = data.booking.username
        updateData.booking_password = await EncryptionUtil.hashPassword(
          data.booking.password
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

  async remove(
    id: string,
    _user: IUserWithPermissions
  ): Promise<{ message: string }> {
    await this.credentialsRepository.delete(id)
    return { message: 'Property credentials deleted successfully' }
  }

  private formatResponse(
    credentials: any,
    hidePasswords: boolean = true
  ): PropertyCredentialsResponseDto {
    const response: PropertyCredentialsResponseDto = {
      id: credentials.id,
      property_id: credentials.property_id,
      created_at: credentials.created_at,
      updated_at: credentials.updated_at
    }

    // Format Expedia credentials
    if (
      credentials.expedia_id ||
      credentials.expedia_username ||
      credentials.expedia_password
    ) {
      response.expedia = {
        id: credentials.expedia_id,
        username: credentials.expedia_username,
        password: hidePasswords ? '********' : credentials.expedia_password
      }
    }

    // Format Agoda credentials
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

    // Format Booking credentials
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
