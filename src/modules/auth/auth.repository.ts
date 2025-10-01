import { Inject, Injectable } from '@nestjs/common'
import { Otp, Prisma, User } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { IAuthRepository } from './auth.interface'

type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    role: true
    userAccessedProperties: {
      select: {
        portfolio_id: true
        property_id: true
      }
    }
  }
}>

@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<UserWithRelations | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        userAccessedProperties: {
          select: {
            portfolio_id: true,
            property_id: true
          }
        }
      }
    })
  }

  async createOtp(userId: string, otp: number, expiresAt: Date): Promise<void> {
    await this.prisma.otp.create({
      data: {
        user_id: userId,
        otp,
        expires_at: expiresAt,
        is_used: false
      }
    })
  }

  async findValidOtp(userId: string, otp: number): Promise<Otp | null> {
    return this.prisma.otp.findFirst({
      where: {
        user_id: userId,
        otp,
        is_used: false,
        expires_at: {
          gte: new Date()
        }
      }
    })
  }

  async markOtpAsUsed(otpId: string): Promise<void> {
    await this.prisma.otp.update({
      where: { id: otpId },
      data: { is_used: true }
    })
  }

  async createUser(data: {
    email: string
    first_name: string
    last_name: string
    language: string
    user_role_id: string
    password: string
    temp_password?: string
    is_verified: boolean
  }): Promise<User> {
    return this.prisma.user.create({
      data
    })
  }

  async updateUserPassword(userId: string, password: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password }
    })
  }

  async clearTempPassword(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { temp_password: null, is_verified: true }
    })
  }

  async createUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void> {
    await this.prisma.userAccessedProperty.create({
      data: {
        user_id: userId,
        portfolio_id: portfolioIds,
        property_id: propertyIds
      }
    })
  }
}
