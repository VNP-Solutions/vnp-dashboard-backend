import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { Configuration } from '../../config/configuration'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import {
  canInviteRole,
  isUserSuperAdmin
} from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import type { IAuthRepository } from '../auth/auth.interface'
import { PrismaService } from '../prisma/prisma.service'
import {
  AdminActivateUserDto,
  AdminResetUserPasswordDto,
  AssignUserRoleDto,
  DeleteUserDto,
  UpdateOwnProfileDto,
  UpdateUserDto,
  UserQueryDto
} from './user.dto'
import type {
  IUserRepository,
  IUserService,
  UserWithDetails
} from './user.interface'

const DB_EMAIL_TX = { maxWait: 10_000, timeout: 60_000 } as const

@Injectable()
export class UserService implements IUserService {
  constructor(
    @Inject('IUserRepository')
    private userRepository: IUserRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService,
    private prisma: PrismaService,
    @Inject('IAuthRepository')
    private authRepository: IAuthRepository,
    private emailUtil: EmailUtil,
    private configService: ConfigService<Configuration>
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Return user data with role in the same format as auth response
    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    }
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
      contact_number: data.contact_number,
      job_title: data.job_title
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
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
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
    // Only super admins can update users
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can update users')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Prepare update data
    const updateData: any = {}
    if (data.first_name) updateData.first_name = data.first_name
    if (data.last_name) updateData.last_name = data.last_name
    if (data.email) updateData.email = data.email
    if (data.language) updateData.language = data.language
    if (data.display_image !== undefined)
      updateData.display_image = data.display_image
    if (data.contact_number !== undefined)
      updateData.contact_number = data.contact_number
    if (data.job_title !== undefined) updateData.job_title = data.job_title

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
    data: AssignUserRoleDto,
    currentUser: IUserWithPermissions
  ) {
    // Only super admins can update user roles
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can update user roles')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Prevent users from updating their own role
    if (currentUser.id === id) {
      throw new BadRequestException('You cannot update your own role')
    }

    // Fetch old and new roles to compare access levels
    const oldRole = user.role
    const newRole = await this.userRepository.findRoleById(data.role_id)

    if (!newRole) {
      throw new NotFoundException('New role not found')
    }

    // Validate access list requirements for new role
    this.validateAccessListForRole(newRole, data)

    // Determine access management strategy
    const accessStrategy = this.determineAccessStrategy(oldRole, newRole)

    // Update the role
    const updatedUser = await this.userRepository.updateRole(id, data.role_id)

    // Handle access list based on strategy
    await this.handleAccessList(id, accessStrategy, data)

    return updatedUser
  }

  /**
   * Validate that required access lists are provided when new role needs them
   */
  private validateAccessListForRole(
    newRole: any,
    data: AssignUserRoleDto
  ): void {
    const newPortfolioAccess = newRole.portfolio_permission?.access_level
    const newPropertyAccess = newRole.property_permission?.access_level

    // Check if new role requires partial access but no IDs provided
    const portfolioNeedsIds =
      newPortfolioAccess === 'partial' &&
      (!data.portfolio_ids || data.portfolio_ids.length === 0)

    const propertyNeedsIds =
      newPropertyAccess === 'partial' &&
      (!data.property_ids || data.property_ids.length === 0)

    if (portfolioNeedsIds && propertyNeedsIds) {
      throw new BadRequestException(
        'New role requires partial access. Please provide portfolio_ids and property_ids in the request.'
      )
    } else if (portfolioNeedsIds) {
      throw new BadRequestException(
        'New role requires partial portfolio access. Please provide portfolio_ids in the request.'
      )
    } else if (propertyNeedsIds) {
      throw new BadRequestException(
        'New role requires partial property access. Please provide property_ids in the request.'
      )
    }
  }

  /**
   * Determine access management strategy based on role transition
   */
  private determineAccessStrategy(
    oldRole: any,
    newRole: any
  ): 'clear' | 'keep' | 'update' {
    const oldPortfolioAccess = oldRole.portfolio_permission?.access_level
    const newPortfolioAccess = newRole.portfolio_permission?.access_level

    const oldPropertyAccess = oldRole.property_permission?.access_level
    const newPropertyAccess = newRole.property_permission?.access_level

    // Check if we need to clear (partial → all/none)
    const portfolioNeedsClear =
      oldPortfolioAccess === 'partial' &&
      (newPortfolioAccess === 'all' || newPortfolioAccess === 'none')

    const propertyNeedsClear =
      oldPropertyAccess === 'partial' &&
      (newPropertyAccess === 'all' || newPropertyAccess === 'none')

    if (portfolioNeedsClear || propertyNeedsClear) {
      return 'clear'
    }

    // Check if we need to update (any → partial or partial → partial)
    const portfolioNeedsUpdate = newPortfolioAccess === 'partial'
    const propertyNeedsUpdate = newPropertyAccess === 'partial'

    if (portfolioNeedsUpdate || propertyNeedsUpdate) {
      return 'update'
    }

    // Otherwise keep as is (though likely no access list exists)
    return 'keep'
  }

  /**
   * Handle access list based on determined strategy
   */
  private async handleAccessList(
    userId: string,
    strategy: 'clear' | 'keep' | 'update',
    data: AssignUserRoleDto
  ): Promise<void> {
    if (strategy === 'clear') {
      // Delete the access list entirely
      await this.userRepository.clearUserAccess(userId)
    } else if (strategy === 'update') {
      // Update or create access list with provided IDs
      await this.userRepository.updateUserAccess(
        userId,
        data.portfolio_ids || [],
        data.property_ids || []
      )
    }
    // If 'keep', do nothing - existing access list remains unchanged
  }

  async addAccess(
    id: string,
    data: any,
    currentUser: IUserWithPermissions
  ): Promise<{ message: string }> {
    // Only super admins can manage user access
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can manage user access')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Validate that at least one array is provided
    if (
      (!data.portfolio_ids || data.portfolio_ids.length === 0) &&
      (!data.property_ids || data.property_ids.length === 0)
    ) {
      throw new BadRequestException(
        'Please provide at least one portfolio_id or property_id to add'
      )
    }

    // Check if user's role supports partial access
    const portfolioAccess = user.role.portfolio_permission?.access_level
    const propertyAccess = user.role.property_permission?.access_level

    // Validate portfolio access
    if (data.portfolio_ids && data.portfolio_ids.length > 0) {
      if (portfolioAccess !== 'partial') {
        throw new BadRequestException(
          `Cannot add portfolio access. User's role has '${portfolioAccess}' access level for portfolios. Only 'partial' access level supports access lists.`
        )
      }
    }

    // Validate property access
    if (data.property_ids && data.property_ids.length > 0) {
      if (propertyAccess !== 'partial') {
        throw new BadRequestException(
          `Cannot add property access. User's role has '${propertyAccess}' access level for properties. Only 'partial' access level supports access lists.`
        )
      }
    }

    // Add access
    await this.userRepository.addUserAccess(
      id,
      data.portfolio_ids || [],
      data.property_ids || []
    )

    return { message: 'User access added successfully' }
  }

  async revokeAccess(
    id: string,
    data: any,
    currentUser: IUserWithPermissions
  ): Promise<{ message: string }> {
    // Only super admins can manage user access
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can manage user access')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Validate that at least one array is provided
    if (
      (!data.portfolio_ids || data.portfolio_ids.length === 0) &&
      (!data.property_ids || data.property_ids.length === 0)
    ) {
      throw new BadRequestException(
        'Please provide at least one portfolio_id or property_id to revoke'
      )
    }

    // Check if user's role supports partial access
    const portfolioAccess = user.role.portfolio_permission?.access_level
    const propertyAccess = user.role.property_permission?.access_level

    // Validate portfolio access
    if (data.portfolio_ids && data.portfolio_ids.length > 0) {
      if (portfolioAccess !== 'partial') {
        throw new BadRequestException(
          `Cannot revoke portfolio access. User's role has '${portfolioAccess}' access level for portfolios. Only 'partial' access level uses access lists.`
        )
      }
    }

    // Validate property access
    if (data.property_ids && data.property_ids.length > 0) {
      if (propertyAccess !== 'partial') {
        throw new BadRequestException(
          `Cannot revoke property access. User's role has '${propertyAccess}' access level for properties. Only 'partial' access level uses access lists.`
        )
      }
    }

    // Revoke access
    await this.userRepository.revokeUserAccess(
      id,
      data.portfolio_ids || [],
      data.property_ids || []
    )

    return { message: 'User access revoked successfully' }
  }

  async remove(
    id: string,
    data: DeleteUserDto,
    currentUser: IUserWithPermissions
  ) {
    // Only super admins can delete users
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can delete users')
    }

    // Prevent users from deleting themselves
    if (currentUser.id === id) {
      throw new BadRequestException('You cannot delete yourself')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Check if the user to be deleted is a super admin
    if (isUserSuperAdmin(user as unknown as IUserWithPermissions)) {
      throw new ForbiddenException('Super admin users cannot be deleted')
    }

    // Verify current user's password
    const currentUserFromDb = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { password: true }
    })

    if (!currentUserFromDb) {
      throw new NotFoundException('Current user not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      data.password,
      currentUserFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    await this.userRepository.delete(id)

    return { message: 'User deleted successfully' }
  }

  async requestAdminPasswordResetOtp(
    id: string,
    currentUser: IUserWithPermissions
  ): Promise<{ message: string }> {
    const targetUser = await this.assertCanAdminResetTargetUser(id, currentUser)

    const otp = EncryptionUtil.generateOtp()
    const expiryMinutes = this.configService.get('auth.otpExpiryMinutes', {
      infer: true
    })!
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    await this.prisma.$transaction(async tx => {
      await this.authRepository.createOtpTx(
        tx,
        currentUser.id,
        otp,
        expiresAt,
        id
      )

      await this.emailUtil.sendAdminUserPasswordResetOtpEmail(
        currentUser.email,
        otp,
        `${targetUser.first_name} ${targetUser.last_name}`.trim(),
        targetUser.email
      )
    }, DB_EMAIL_TX)

    console.log(
      `Admin user password reset OTP for ${currentUser.email} (target ${targetUser.email}): ${otp}`
    )

    return { message: 'An OTP has been sent to your email address' }
  }

  async resetPasswordByAdmin(
    id: string,
    data: AdminResetUserPasswordDto,
    currentUser: IUserWithPermissions
  ): Promise<{ message: string }> {
    await this.assertCanAdminResetTargetUser(id, currentUser)

    const validOtp = await this.authRepository.findValidOtp(
      currentUser.id,
      data.otp,
      { adminPasswordResetForUserId: id }
    )

    if (!validOtp) {
      throw new BadRequestException('Invalid or expired OTP')
    }

    await this.authRepository.markOtpAsUsed(validOtp.id)

    const hashedNewPassword = await EncryptionUtil.hashPassword(
      data.new_password
    )
    await this.userRepository.updatePassword(id, hashedNewPassword)

    return { message: 'Password reset successfully' }
  }

  private async assertCanAdminResetTargetUser(
    id: string,
    currentUser: IUserWithPermissions
  ): Promise<UserWithDetails> {
    if (currentUser.id === id) {
      throw new BadRequestException(
        'Use the password reset flow or profile settings to change your own password'
      )
    }

    const targetUser = await this.userRepository.findById(id)

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    if (!targetUser.is_verified) {
      throw new BadRequestException(
        'Cannot reset the password of an unverified user. Please verify the user account first.'
      )
    }

    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      currentUser,
      ModuleType.USER
    )

    if (accessibleIds !== 'all' && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to this user')
    }

    if (!isUserSuperAdmin(currentUser)) {
      if (!canInviteRole(currentUser, targetUser.role as any)) {
        throw new ForbiddenException(
          "You cannot reset this user's password. Their role is equal to or higher than yours in the permission hierarchy."
        )
      }
    }

    return targetUser
  }

  async requestAdminActivateUserOtp(
    id: string,
    currentUser: IUserWithPermissions
  ): Promise<{ message: string }> {
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException(
        'Only super admins can activate user accounts'
      )
    }

    if (currentUser.id === id) {
      throw new BadRequestException('You cannot activate your own account')
    }

    const targetUser = await this.userRepository.findById(id)

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    if (targetUser.is_verified) {
      throw new BadRequestException('This user is already activated')
    }

    const otp = EncryptionUtil.generateOtp()
    const expiryMinutes = this.configService.get('auth.otpExpiryMinutes', {
      infer: true
    })!
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    await this.prisma.$transaction(async tx => {
      await this.authRepository.createOtpTx(
        tx,
        currentUser.id,
        otp,
        expiresAt,
        null,
        id
      )

      await this.emailUtil.sendAdminUserVerifyOtpEmail(
        currentUser.email,
        otp,
        `${targetUser.first_name} ${targetUser.last_name}`.trim(),
        targetUser.email
      )
    }, DB_EMAIL_TX)

    console.log(
      `Admin user activate OTP for ${currentUser.email} (target ${targetUser.email}): ${otp}`
    )

    return { message: 'An OTP has been sent to your email address' }
  }

  async activateUserByAdmin(
    id: string,
    data: AdminActivateUserDto,
    currentUser: IUserWithPermissions
  ): Promise<{ message: string }> {
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException(
        'Only super admins can activate user accounts'
      )
    }

    const targetUser = await this.userRepository.findById(id)

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    if (targetUser.is_verified) {
      throw new BadRequestException('This user is already activated')
    }

    const validOtp = await this.authRepository.findValidOtp(
      currentUser.id,
      data.otp,
      { adminVerifyForUserId: id }
    )

    if (!validOtp) {
      throw new BadRequestException('Invalid or expired OTP')
    }

    await this.authRepository.markOtpAsUsed(validOtp.id)

    const hashedPassword = await EncryptionUtil.hashPassword(data.new_password)
    await this.userRepository.updatePassword(id, hashedPassword)

    return { message: 'User activated successfully' }
  }

  async findAll(query: UserQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
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
