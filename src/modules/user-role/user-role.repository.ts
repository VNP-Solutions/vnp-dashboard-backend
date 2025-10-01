import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserRoleDto, UpdateUserRoleDto } from './user-role.dto'
import type { IUserRoleRepository } from './user-role.interface'

@Injectable()
export class UserRoleRepository implements IUserRoleRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateUserRoleDto) {
    return this.prisma.userRole.create({
      data
    })
  }

  async findAll() {
    return this.prisma.userRole.findMany({
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            is_verified: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })
  }

  async findById(id: string) {
    return this.prisma.userRole.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            is_verified: true
          }
        }
      }
    })
  }

  async findByName(name: string) {
    return this.prisma.userRole.findUnique({
      where: { name }
    })
  }

  async update(id: string, data: UpdateUserRoleDto) {
    return this.prisma.userRole.update({
      where: { id },
      data
    })
  }

  async delete(id: string) {
    return this.prisma.userRole.delete({
      where: { id }
    })
  }

  async countUsers(roleId: string): Promise<number> {
    return this.prisma.user.count({
      where: { user_role_id: roleId }
    })
  }
}
