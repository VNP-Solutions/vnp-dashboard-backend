import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { CreateUserRoleDto, UpdateUserRoleDto } from './user-role.dto'
import type {
  IUserRoleRepository,
  IUserRoleService
} from './user-role.interface'

@Injectable()
export class UserRoleService implements IUserRoleService {
  private readonly logger = new Logger(UserRoleService.name)

  constructor(
    @Inject('IUserRoleRepository')
    private userRoleRepository: IUserRoleRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  async create(data: CreateUserRoleDto, _user: IUserWithPermissions) {
    const existingRole = await this.userRoleRepository.findByName(data.name)

    if (existingRole) {
      throw new ConflictException('Role with this name already exists')
    }

    // Validate role configuration and log warnings
    const warnings = this.permissionService.validateRoleConfiguration({
      portfolio_permission: data.portfolio_permission || null,
      property_permission: data.property_permission || null,
      audit_permission: data.audit_permission || null,
      user_permission: data.user_permission || null,
      system_settings_permission: data.system_settings_permission || null
    })

    if (warnings.length > 0) {
      this.logger.warn(`Creating role "${data.name}" with potential issues:`)
      warnings.forEach(warning => this.logger.warn(`  - ${warning}`))
    }

    return this.userRoleRepository.create(data)
  }

  async findAll(_user: IUserWithPermissions) {
    return this.userRoleRepository.findAll()
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const userRole = await this.userRoleRepository.findById(id)

    if (!userRole) {
      throw new NotFoundException('Role not found')
    }

    return userRole
  }

  async update(
    id: string,
    data: UpdateUserRoleDto,
    _user: IUserWithPermissions
  ) {
    const userRole = await this.userRoleRepository.findById(id)

    if (!userRole) {
      throw new NotFoundException('Role not found')
    }

    if (data.name && data.name !== userRole.name) {
      const existingRole = await this.userRoleRepository.findByName(data.name)

      if (existingRole) {
        throw new ConflictException('Role with this name already exists')
      }
    }

    // Validate updated role configuration
    const warnings = this.permissionService.validateRoleConfiguration({
      portfolio_permission:
        data.portfolio_permission || userRole.portfolio_permission || null,
      property_permission:
        data.property_permission || userRole.property_permission || null,
      audit_permission:
        data.audit_permission || userRole.audit_permission || null,
      user_permission: data.user_permission || userRole.user_permission || null,
      system_settings_permission:
        data.system_settings_permission ||
        userRole.system_settings_permission ||
        null
    })

    if (warnings.length > 0) {
      this.logger.warn(
        `Updating role "${userRole.name}" with potential issues:`
      )
      warnings.forEach(warning => this.logger.warn(`  - ${warning}`))
    }

    return this.userRoleRepository.update(id, data)
  }

  async remove(id: string, _user: IUserWithPermissions) {
    const userRole = await this.userRoleRepository.findById(id)

    if (!userRole) {
      throw new NotFoundException('Role not found')
    }

    const userCount = await this.userRoleRepository.countUsers(id)

    if (userCount > 0) {
      throw new BadRequestException(
        `Cannot delete role with ${userCount} assigned users. Please reassign the users first.`
      )
    }

    await this.userRoleRepository.delete(id)

    return { message: 'Role deleted successfully' }
  }
}
