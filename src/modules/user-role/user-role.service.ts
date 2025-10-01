import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateUserRoleDto, UpdateUserRoleDto } from './user-role.dto'
import type {
  IUserRoleRepository,
  IUserRoleService
} from './user-role.interface'

@Injectable()
export class UserRoleService implements IUserRoleService {
  constructor(
    @Inject('IUserRoleRepository')
    private userRoleRepository: IUserRoleRepository
  ) {}

  async create(data: CreateUserRoleDto, _user: IUserWithPermissions) {
    const existingRole = await this.userRoleRepository.findByName(data.name)

    if (existingRole) {
      throw new ConflictException('Role with this name already exists')
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
