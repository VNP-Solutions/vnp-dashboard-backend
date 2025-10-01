import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateAuditStatusDto, UpdateAuditStatusDto } from './audit-status.dto'
import type {
  IAuditStatusRepository,
  IAuditStatusService
} from './audit-status.interface'

@Injectable()
export class AuditStatusService implements IAuditStatusService {
  constructor(
    @Inject('IAuditStatusRepository')
    private auditStatusRepository: IAuditStatusRepository
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

  async remove(id: string, _user: IUserWithPermissions) {
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
}
