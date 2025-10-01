import { Prisma, UserRole } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateUserRoleDto, UpdateUserRoleDto } from './user-role.dto'

type UserRoleWithUsers = Prisma.UserRoleGetPayload<{
  include: {
    users: {
      select: {
        id: true
        first_name: true
        last_name: true
        email: true
        is_verified: true
      }
    }
  }
}>

export interface IUserRoleRepository {
  create(data: CreateUserRoleDto): Promise<UserRole>
  findAll(): Promise<UserRoleWithUsers[]>
  findById(id: string): Promise<UserRoleWithUsers | null>
  findByName(name: string): Promise<UserRole | null>
  update(id: string, data: UpdateUserRoleDto): Promise<UserRole>
  delete(id: string): Promise<UserRole>
  countUsers(roleId: string): Promise<number>
}

export interface IUserRoleService {
  create(data: CreateUserRoleDto, user: IUserWithPermissions): Promise<UserRole>
  findAll(user: IUserWithPermissions): Promise<UserRoleWithUsers[]>
  findOne(id: string, user: IUserWithPermissions): Promise<UserRoleWithUsers>
  update(
    id: string,
    data: UpdateUserRoleDto,
    user: IUserWithPermissions
  ): Promise<UserRole>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
