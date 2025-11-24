import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAuditStatusDto, ReorderAuditStatusDto, UpdateAuditStatusDto } from './audit-status.dto'
import type {
  IAuditStatusRepository,
  IAuditStatusService
} from './audit-status.interface'

@Injectable()
export class AuditStatusService implements IAuditStatusService {
  constructor(
    @Inject('IAuditStatusRepository')
    private auditStatusRepository: IAuditStatusRepository,
    @Inject(PrismaService)
    private prisma: PrismaService
  ) {}

  async create(data: CreateAuditStatusDto, _user: IUserWithPermissions) {
    const existingAuditStatus = await this.auditStatusRepository.findByStatus(
      data.status
    )

    if (existingAuditStatus) {
      throw new ConflictException('Audit status with this name already exists')
    }

    return this.auditStatusRepository.create(data)
  }

  async findAll(_user: IUserWithPermissions) {
    return this.auditStatusRepository.findAll()
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const auditStatus = await this.auditStatusRepository.findById(id)

    if (!auditStatus) {
      throw new NotFoundException('Audit status not found')
    }

    return auditStatus
  }

  async update(
    id: string,
    data: UpdateAuditStatusDto,
    _user: IUserWithPermissions
  ) {
    const auditStatus = await this.auditStatusRepository.findById(id)

    if (!auditStatus) {
      throw new NotFoundException('Audit status not found')
    }

    if (data.status && data.status !== auditStatus.status) {
      const existingAuditStatus = await this.auditStatusRepository.findByStatus(
        data.status
      )

      if (existingAuditStatus) {
        throw new ConflictException(
          'Audit status with this name already exists'
        )
      }
    }

    return this.auditStatusRepository.update(id, data)
  }

  async remove(id: string, password: string, user: IUserWithPermissions) {
    // Fetch user with password from database for verification
    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userFromDb) {
      throw new NotFoundException('User not found')
    }

    // Verify user password
    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    const auditStatus = await this.auditStatusRepository.findById(id)

    if (!auditStatus) {
      throw new NotFoundException('Audit status not found')
    }

    const auditCount = await this.auditStatusRepository.countAudits(id)

    if (auditCount > 0) {
      throw new BadRequestException(
        `Cannot delete audit status with ${auditCount} associated audits. Please delete or reassign the audits first.`
      )
    }

    await this.auditStatusRepository.delete(id)

    return { message: 'Audit status deleted successfully' }
  }

  async reorder(id: string, data: ReorderAuditStatusDto, _user: IUserWithPermissions) {
    const auditStatus = await this.auditStatusRepository.findById(id)

    if (!auditStatus) {
      throw new NotFoundException('Audit status not found')
    }

    const currentOrder = auditStatus.order
    const newOrder = data.newOrder

    if (currentOrder === newOrder) {
      return { message: 'Audit status order unchanged' }
    }

    // Get all audit statuses sorted by order
    const allStatuses = await this.auditStatusRepository.findAll()

    // Prepare updates
    const updates: Array<{ id: string; order: number }> = []

    if (newOrder > currentOrder) {
      // Moving down: shift items up between currentOrder and newOrder
      allStatuses.forEach(item => {
        if (item.id === id) {
          updates.push({ id: item.id, order: newOrder })
        } else if (item.order > currentOrder && item.order <= newOrder) {
          updates.push({ id: item.id, order: item.order - 1 })
        }
      })
    } else {
      // Moving up: shift items down between newOrder and currentOrder
      allStatuses.forEach(item => {
        if (item.id === id) {
          updates.push({ id: item.id, order: newOrder })
        } else if (item.order >= newOrder && item.order < currentOrder) {
          updates.push({ id: item.id, order: item.order + 1 })
        }
      })
    }

    await this.auditStatusRepository.updateMany(updates)

    return { message: 'Audit status order updated successfully' }
  }
}
