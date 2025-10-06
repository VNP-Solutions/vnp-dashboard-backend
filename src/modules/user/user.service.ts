import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import {
  UpdateOwnProfileDto,
  UpdateUserDto,
  UpdateUserRoleDto,
  UserQueryDto
} from './user.dto'
import type { IUserRepository, IUserService } from './user.interface'

@Injectable()
export class UserService implements IUserService {
  constructor(
    @Inject('IUserRepository')
    private userRepository: IUserRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  async updateProfile(userId: string, data: UpdateOwnProfileDto) {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Only allow updating specific fields
    const allowedFields: Partial<UpdateOwnProfileDto> = {
      first_name: data.first_name,
      last_name: data.last_name,
      language: data.language,
      display_image: data.display_image,
      contact_number: data.contact_number
    }

    // Remove undefined fields
    Object.keys(allowedFields).forEach(key => {
      if (allowedFields[key as keyof UpdateOwnProfileDto] === undefined) {
        delete allowedFields[key as keyof UpdateOwnProfileDto]
      }
    })

    return this.userRepository.update(userId, allowedFields)
  }

  async findOne(id: string, currentUser: IUserWithPermissions) {
    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Check if user has permission to view this user
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      currentUser,
      ModuleType.USER
    )

    if (accessibleIds !== 'all' && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to this user')
    }

    return user
  }

  async update(
    id: string,
    data: UpdateUserDto,
    currentUser: IUserWithPermissions
  ) {
    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Check if user has permission to update this user
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      currentUser,
      ModuleType.USER
    )

    if (accessibleIds !== 'all' && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to update this user')
    }

    // Prevent users from updating their own role
    if (currentUser.id === id && data.role_id) {
      throw new BadRequestException('You cannot update your own role')
    }

    // Prepare update data
    const updateData: any = {}
    if (data.first_name) updateData.first_name = data.first_name
    if (data.last_name) updateData.last_name = data.last_name
    if (data.email) updateData.email = data.email
    if (data.language) updateData.language = data.language
    if (data.role_id) updateData.user_role_id = data.role_id
    if (data.display_image !== undefined)
      updateData.display_image = data.display_image
    if (data.contact_number !== undefined)
      updateData.contact_number = data.contact_number

    // Update user access if provided
    if (data.portfolio_ids || data.property_ids) {
      await this.userRepository.updateUserAccess(
        id,
        data.portfolio_ids || [],
        data.property_ids || []
      )
    }

    return this.userRepository.update(id, updateData)
  }

  async updateRole(
    id: string,
    data: UpdateUserRoleDto,
    currentUser: IUserWithPermissions
  ) {
    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Check if user has permission to update this user
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      currentUser,
      ModuleType.USER
    )

    if (accessibleIds !== 'all' && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to update this user')
    }

    // Prevent users from updating their own role
    if (currentUser.id === id) {
      throw new BadRequestException('You cannot update your own role')
    }

    return this.userRepository.updateRole(id, data.role_id)
  }

  async remove(id: string, currentUser: IUserWithPermissions) {
    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Check if user has permission to delete this user
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      currentUser,
      ModuleType.USER
    )

    if (accessibleIds !== 'all' && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to delete this user')
    }

    // Prevent users from deleting themselves
    if (currentUser.id === id) {
      throw new BadRequestException('You cannot delete yourself')
    }

    await this.userRepository.delete(id)

    return { message: 'User deleted successfully' }
  }

  async findAll(query: UserQueryDto, user: IUserWithPermissions) {
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.USER
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
    if (query.user_role_id) {
      additionalFilters.user_role_id = query.user_role_id
    }
    if (query.is_verified) {
      additionalFilters.is_verified = query.is_verified
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
      searchFields: ['first_name', 'last_name', 'email'],
      filterableFields: ['user_role_id', 'is_verified'],
      sortableFields: [
        'first_name',
        'last_name',
        'email',
        'created_at',
        'updated_at',
        'is_verified'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        role_name: 'role.name'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
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
      this.userRepository.findAll({ where, skip, take, orderBy }, undefined),
      this.userRepository.count(where, undefined)
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }
}
