import { Prisma, User } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AssignUserRoleDto,
  DeleteUserDto,
  UpdateOwnProfileDto,
  UpdateUserDto,
  UserQueryDto
} from './user.dto'

export type InvitedByUser = {
  id: string
  first_name: string
  last_name: string
  email: string
}

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
    invited_by_id: true
    invitation_sent_at: true
    role: {
      select: {
        id: true
        name: true
        description: true
        is_external: true
        can_access_mis: true
        portfolio_permission: true
        property_permission: true
        audit_permission: true
        user_permission: true
        system_settings_permission: true
      }
    }
    invitedBy: {
      select: {
        id: true
        first_name: true
        last_name: true
        email: true
      }
    }
  }
}>

export type UserWithDetailsBase = Prisma.UserGetPayload<{
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
    invited_by_id: true
    invitation_sent_at: true
    role: {
      select: {
        id: true
        name: true
        description: true
        is_external: true
        can_access_mis: true
        portfolio_permission: true
        property_permission: true
        audit_permission: true
        user_permission: true
        system_settings_permission: true
      }
    }
    invitedBy: {
      select: {
        id: true
        first_name: true
        last_name: true
        email: true
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

export type AccessedPortfolio = {
  id: string
  name: string
}

export type AccessedProperty = {
  id: string
  name: string
}

export type UserWithDetails = Omit<
  UserWithDetailsBase,
  'userAccessedProperties'
> & {
  userAccessedProperties: {
    portfolios: AccessedPortfolio[]
    properties: AccessedProperty[]
  } | null
}

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
  getProfile(
    userId: string
  ): Promise<{
    user: {
      id: string
      email: string
      first_name: string
      last_name: string
      role: UserWithDetails['role']
    }
  }>
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
  remove(
    id: string,
    data: DeleteUserDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
}
