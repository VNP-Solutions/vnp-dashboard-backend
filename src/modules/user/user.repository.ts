import { Inject, Injectable } from '@nestjs/common'
import { User } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type {
  IUserRepository,
  UserWithDetails,
  UserWithRole
} from './user.interface'

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(
    queryOptions: any,
    _userIds?: string[]
  ): Promise<UserWithRole[]> {
    const { where, skip, take, orderBy } = queryOptions

    return this.prisma.user.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        language: true,
        user_role_id: true,
        is_verified: true,
        display_image: true,
        contact_number: true,
        created_at: true,
        updated_at: true,
        role: {
          select: {
            id: true,
            name: true,
            is_external: true
          }
        }
      }
    })
  }

  async count(whereClause: any, _userIds?: string[]): Promise<number> {
    return this.prisma.user.count({
      where: whereClause
    })
  }

  async findById(id: string): Promise<UserWithDetails | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        language: true,
        user_role_id: true,
        is_verified: true,
        display_image: true,
        contact_number: true,
        created_at: true,
        updated_at: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            is_external: true
          }
        },
        userAccessedProperties: {
          select: {
            portfolio_id: true,
            property_id: true
          }
        }
      }
    })
  }

  async update(id: string, data: Partial<User>): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        language: true,
        user_role_id: true,
        is_verified: true,
        display_image: true,
        contact_number: true,
        created_at: true,
        updated_at: true,
        role: {
          select: {
            id: true,
            name: true,
            is_external: true
          }
        }
      }
    })
  }

  async updateRole(id: string, roleId: string): Promise<UserWithRole> {
    return this.update(id, { user_role_id: roleId })
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id }
    })
  }

  async updateUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void> {
    // Check if user access record exists
    const existingAccess = await this.prisma.userAccessedProperty.findFirst({
      where: { user_id: userId }
    })

    if (existingAccess) {
      // Update existing record
      await this.prisma.userAccessedProperty.update({
        where: { id: existingAccess.id },
        data: {
          portfolio_id: portfolioIds,
          property_id: propertyIds
        }
      })
    } else {
      // Create new record
      await this.prisma.userAccessedProperty.create({
        data: {
          user_id: userId,
          portfolio_id: portfolioIds,
          property_id: propertyIds
        }
      })
    }
  }
}
