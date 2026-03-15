import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AccessLevel,
  ModuleType,
  PermissionLevel
} from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { isUserSuperAdmin } from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import {
  CreatePropertyContractUrlDto,
  PropertyContractUrlQueryDto,
  UpdatePropertyContractUrlDto
} from './property-contract-url.dto'
import type {
  IPropertyContractUrlRepository,
  IPropertyContractUrlService
} from './property-contract-url.interface'

@Injectable()
export class PropertyContractUrlService implements IPropertyContractUrlService {
  constructor(
    @Inject('IPropertyContractUrlRepository')
    private propertyContractUrlRepository: IPropertyContractUrlRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  /**
   * Check if user can view property contract URLs
   * - Super admin can always view
   * - Users with property permission level 'update' or 'all' and access level 'partial' or 'all' can view
   */
  private canViewPropertyContractUrls(user: IUserWithPermissions): boolean {
    // Super admin can always view
    if (isUserSuperAdmin(user)) {
      return true
    }

    const propertyPermission = user.role.property_permission

    if (!propertyPermission) {
      return false
    }

    // Check permission level: must be 'update' or 'all'
    const hasUpdatePermission =
      propertyPermission.permission_level === PermissionLevel.update ||
      propertyPermission.permission_level === PermissionLevel.all

    // Check access level: must be 'partial' or 'all'
    const hasPartialAccess =
      propertyPermission.access_level === AccessLevel.partial ||
      propertyPermission.access_level === AccessLevel.all

    return hasUpdatePermission && hasPartialAccess
  }

  async create(
    data: CreatePropertyContractUrlDto,
    user: IUserWithPermissions
  ) {
    // Check if user can upload property contract URLs
    // - Super admin can always upload
    // - Internal users with property permission level 'update' or 'all' and access level 'partial' or 'all' can upload
    if (!isUserSuperAdmin(user)) {
      // Must be internal user
      if (user.role.is_external !== false) {
        throw new ForbiddenException(
          'Only Super Admin or internal users can upload property contract URLs'
        )
      }

      const propertyPermission = user.role.property_permission

      if (!propertyPermission) {
        throw new ForbiddenException('No property permission found')
      }

      // Check permission level: must be 'update' or 'all'
      const hasUpdatePermission =
        propertyPermission.permission_level === PermissionLevel.update ||
        propertyPermission.permission_level === PermissionLevel.all

      if (!hasUpdatePermission) {
        throw new ForbiddenException(
          'Property permission level must be update or all'
        )
      }

      // Check access level: must be 'partial' or 'all'
      const hasPartialAccess =
        propertyPermission.access_level === AccessLevel.partial ||
        propertyPermission.access_level === AccessLevel.all

      if (!hasPartialAccess) {
        throw new ForbiddenException(
          'Property access level must be partial or all'
        )
      }
    }

    // Verify user has access to the property
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    if (
      accessiblePropertyIds !== 'all' &&
      Array.isArray(accessiblePropertyIds) &&
      !accessiblePropertyIds.includes(data.property_id)
    ) {
      throw new BadRequestException('You do not have access to this property')
    }

    // Create property contract URL with the current user's ID
    const propertyContractUrl =
      await this.propertyContractUrlRepository.create({
        ...data,
        user_id: user.id,
        is_active: data.is_active !== undefined ? data.is_active : true
      })

    return propertyContractUrl
  }

  async findAll(
    query: PropertyContractUrlQueryDto,
    user: IUserWithPermissions
  ) {
    // Check if user can view property contract URLs
    if (!this.canViewPropertyContractUrls(user)) {
      throw new ForbiddenException(
        'Only Super Admin or users with property update permission and partial access can view property contract URLs'
      )
    }

    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    if (
      Array.isArray(accessiblePropertyIds) &&
      accessiblePropertyIds.length === 0
    ) {
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
    if (query.is_active) {
      additionalFilters.is_active = query.is_active
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
      searchFields: ['url', 'description'],
      filterableFields: ['property_id', 'is_active', 'user_id'],
      sortableFields: [
        'url',
        'created_at',
        'updated_at',
        'is_active',
        'description'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name',
        user_name: 'user.first_name'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessiblePropertyIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessiblePropertyIds
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
      this.propertyContractUrlRepository.findAll(
        { where, skip, take, orderBy },
        undefined
      ),
      this.propertyContractUrlRepository.count(where, undefined)
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findAllForExport(
    query: PropertyContractUrlQueryDto,
    user: IUserWithPermissions
  ) {
    // Check if user can view property contract URLs
    if (!this.canViewPropertyContractUrls(user)) {
      throw new ForbiddenException(
        'Only Super Admin or users with property update permission and partial access can view property contract URLs'
      )
    }

    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    if (
      Array.isArray(accessiblePropertyIds) &&
      accessiblePropertyIds.length === 0
    ) {
      return []
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.property_id) {
      additionalFilters.property_id = query.property_id
    }
    if (query.is_active) {
      additionalFilters.is_active = query.is_active
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
      searchFields: ['url', 'description'],
      filterableFields: ['property_id', 'is_active', 'user_id'],
      sortableFields: [
        'url',
        'created_at',
        'updated_at',
        'is_active',
        'description'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name',
        user_name: 'user.first_name'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessiblePropertyIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessiblePropertyIds
            }
          }

    // Build Prisma query options (without pagination)
    const { where, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch all data without pagination
    const data = await this.propertyContractUrlRepository.findAll(
      { where, orderBy },
      undefined
    )

    return data
  }

  async findOne(id: string, user: IUserWithPermissions) {
    // Check if user can view property contract URLs
    if (!this.canViewPropertyContractUrls(user)) {
      throw new ForbiddenException(
        'Only Super Admin or users with property update permission and partial access can view property contract URLs'
      )
    }

    const propertyContractUrl =
      await this.propertyContractUrlRepository.findById(id)

    if (!propertyContractUrl) {
      throw new NotFoundException('Property contract URL not found')
    }

    // Verify user has access to the property
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    if (
      accessiblePropertyIds !== 'all' &&
      Array.isArray(accessiblePropertyIds) &&
      !accessiblePropertyIds.includes(propertyContractUrl.property_id)
    ) {
      throw new NotFoundException('Property contract URL not found')
    }

    return propertyContractUrl
  }

  async findByProperty(propertyId: string, user: IUserWithPermissions) {
    // Check if user can view property contract URLs
    if (!this.canViewPropertyContractUrls(user)) {
      throw new ForbiddenException(
        'Only Super Admin or users with property update permission and partial access can view property contract URLs'
      )
    }

    // Verify user has access to the property
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    if (
      accessiblePropertyIds !== 'all' &&
      Array.isArray(accessiblePropertyIds) &&
      !accessiblePropertyIds.includes(propertyId)
    ) {
      throw new NotFoundException('Property not found')
    }

    const isSuperAdmin = isUserSuperAdmin(user)
    const propertyContractUrls =
      await this.propertyContractUrlRepository.findByPropertyId(
        propertyId,
        isSuperAdmin ? undefined : user.id
      )

    return propertyContractUrls
  }

  async update(
    id: string,
    data: UpdatePropertyContractUrlDto,
    user: IUserWithPermissions
  ) {
    // Only super admin can update property contract URLs
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only Super Admin can update property contract URLs'
      )
    }

    const propertyContractUrl =
      await this.propertyContractUrlRepository.findById(id)

    if (!propertyContractUrl) {
      throw new NotFoundException('Property contract URL not found')
    }

    // Verify user has access to the property
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    if (
      accessiblePropertyIds !== 'all' &&
      Array.isArray(accessiblePropertyIds) &&
      !accessiblePropertyIds.includes(propertyContractUrl.property_id)
    ) {
      throw new NotFoundException('Property contract URL not found')
    }

    // If property_id is being changed, verify access to new property
    if (
      data.property_id &&
      data.property_id !== propertyContractUrl.property_id
    ) {
      if (
        accessiblePropertyIds !== 'all' &&
        Array.isArray(accessiblePropertyIds) &&
        !accessiblePropertyIds.includes(data.property_id)
      ) {
        throw new BadRequestException(
          'You do not have access to the new property'
        )
      }
    }

    return this.propertyContractUrlRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    // Only super admin can delete property contract URLs
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only Super Admin can delete property contract URLs'
      )
    }

    const propertyContractUrl =
      await this.propertyContractUrlRepository.findById(id)

    if (!propertyContractUrl) {
      throw new NotFoundException('Property contract URL not found')
    }

    // Verify user has access to the property
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    if (
      accessiblePropertyIds !== 'all' &&
      Array.isArray(accessiblePropertyIds) &&
      !accessiblePropertyIds.includes(propertyContractUrl.property_id)
    ) {
      throw new NotFoundException('Property contract URL not found')
    }

    await this.propertyContractUrlRepository.delete(id)

    return { message: 'Property contract URL deleted successfully' }
  }
}
