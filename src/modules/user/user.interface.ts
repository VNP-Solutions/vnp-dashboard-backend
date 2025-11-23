import { Prisma, User } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AssignUserRoleDto,
  UpdateOwnProfileDto,
  UpdateUserDto,
  UserQueryDto
} from './user.dto'

export type UserWithRole = Prisma.UserGetPayload<{
  select: {
    id: true
    first_name: true
    last_name: true
    email: true
    language: true
    user_role_id: true
    is_verified: true
    display_image: true
    contact_number: true
    created_at: true
    updated_at: true
    role: {
      select: {
        id: true
        name: true
        is_external: true
      }
    }
  }
}>

export type UserWithDetails = Prisma.UserGetPayload<{
  select: {
    id: true
    first_name: true
    last_name: true
    email: true
    language: true
    user_role_id: true
    is_verified: true
    display_image: true
    contact_number: true
    created_at: true
    updated_at: true
    role: {
      select: {
        id: true
        name: true
        description: true
        is_external: true
        portfolio_permission: true
        property_permission: true
        audit_permission: true
        user_permission: true
        system_settings_permission: true
      }
    }
    userAccessedProperties: {
      select: {
        portfolio_id: true
        property_id: true
      }
    }
  }
}>

export interface IUserRepository {
  findAll(queryOptions: any, userIds?: string[]): Promise<UserWithRole[]>
  count(whereClause: any, userIds?: string[]): Promise<number>
  findById(id: string): Promise<UserWithDetails | null>
  update(id: string, data: Partial<User>): Promise<UserWithRole>
  updateRole(id: string, roleId: string): Promise<UserWithRole>
  delete(id: string): Promise<User>
  updateUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void>
  clearUserAccess(userId: string): Promise<void>
  findRoleById(roleId: string): Promise<any>
  addUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void>
  revokeUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void>
}

export interface IUserService {
  findAll(
    query: UserQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<UserWithRole>>
  getProfile(userId: string): Promise<UserWithDetails>
  updateProfile(
    userId: string,
    data: UpdateOwnProfileDto
  ): Promise<UserWithRole>
  findOne(id: string, user: IUserWithPermissions): Promise<UserWithDetails>
  update(
    id: string,
    data: UpdateUserDto,
    user: IUserWithPermissions
  ): Promise<UserWithRole>
  updateRole(
    id: string,
    data: AssignUserRoleDto,
    user: IUserWithPermissions
  ): Promise<UserWithRole>
  addAccess(
    id: string,
    data: any,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
  revokeAccess(
    id: string,
    data: any,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
