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
        invited_by_id: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            is_external: true,
            portfolio_permission: true,
            property_permission: true,
            audit_permission: true,
            user_permission: true,
            system_settings_permission: true
          }
        },
        invitedBy: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
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
    const user = await this.prisma.user.findUnique({
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
        invited_by_id: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            is_external: true,
            portfolio_permission: true,
            property_permission: true,
            audit_permission: true,
            user_permission: true,
            system_settings_permission: true
          }
        },
        invitedBy: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
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

    if (!user) {
      return null
    }

    // Get the first userAccessedProperties record (there should be at most one per user)
    const accessRecord = user.userAccessedProperties[0]

    if (!accessRecord) {
      return {
        ...user,
        userAccessedProperties: null
      }
    }

    // Fetch portfolio and property details
    const [portfolios, properties] = await Promise.all([
      accessRecord.portfolio_id.length > 0
        ? this.prisma.portfolio.findMany({
            where: { id: { in: accessRecord.portfolio_id } },
            select: { id: true, name: true }
          })
        : [],
      accessRecord.property_id.length > 0
        ? this.prisma.property.findMany({
            where: { id: { in: accessRecord.property_id } },
            select: { id: true, name: true }
          })
        : []
    ])

    return {
      ...user,
      userAccessedProperties: {
        portfolios,
        properties
      }
    }
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
        invited_by_id: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            is_external: true,
            portfolio_permission: true,
            property_permission: true,
            audit_permission: true,
            user_permission: true,
            system_settings_permission: true
          }
        },
        invitedBy: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
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

  async clearUserAccess(userId: string): Promise<void> {
    // Delete user access record if it exists
    await this.prisma.userAccessedProperty.deleteMany({
      where: { user_id: userId }
    })
  }

  async findRoleById(roleId: string) {
    return this.prisma.userRole.findUnique({
      where: { id: roleId }
    })
  }

  async addUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void> {
    // Check if user access record exists
    const existingAccess = await this.prisma.userAccessedProperty.findFirst({
      where: { user_id: userId }
    })

    if (existingAccess) {
      // Merge new IDs with existing ones (avoid duplicates)
      const mergedPortfolioIds = [
        ...new Set([...(existingAccess.portfolio_id || []), ...portfolioIds])
      ]
      const mergedPropertyIds = [
        ...new Set([...(existingAccess.property_id || []), ...propertyIds])
      ]

      await this.prisma.userAccessedProperty.update({
        where: { id: existingAccess.id },
        data: {
          portfolio_id: mergedPortfolioIds,
          property_id: mergedPropertyIds
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

  async revokeUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void> {
    // Check if user access record exists
    const existingAccess = await this.prisma.userAccessedProperty.findFirst({
      where: { user_id: userId }
    })

    if (!existingAccess) {
      // Nothing to revoke
      return
    }

    // Remove specified IDs from existing arrays
    const updatedPortfolioIds = (existingAccess.portfolio_id || []).filter(
      id => !portfolioIds.includes(id)
    )
    const updatedPropertyIds = (existingAccess.property_id || []).filter(
      id => !propertyIds.includes(id)
    )

    await this.prisma.userAccessedProperty.update({
      where: { id: existingAccess.id },
      data: {
        portfolio_id: updatedPortfolioIds,
        property_id: updatedPropertyIds
      }
    })
  }
}
