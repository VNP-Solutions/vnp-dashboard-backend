import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreateAuditBatchDto,
  AuditBatchQueryDto,
  ReorderAuditBatchDto,
  UpdateAuditBatchDto
} from './audit-batch.dto'
import type {
  IAuditBatchRepository,
  IAuditBatchService
} from './audit-batch.interface'

@Injectable()
export class AuditBatchService implements IAuditBatchService {
  constructor(
    @Inject('IAuditBatchRepository')
    private auditBatchRepository: IAuditBatchRepository
  ) {}

  async create(data: CreateAuditBatchDto, _user: IUserWithPermissions) {
    const existingBatch = await this.auditBatchRepository.findByBatchNo(
      data.batch_no
    )

    if (existingBatch) {
      throw new ConflictException('Batch with this number already exists')
    }

    return this.auditBatchRepository.create(data)
  }

  async findAll(query: AuditBatchQueryDto, _user: IUserWithPermissions) {
    // Build where clause for search
    const where: any = {}
    if (query.search) {
      where.batch_no = {
        contains: query.search,
        mode: 'insensitive'
      }
    }

    // Build orderBy clause for sorting
    const sortBy = query.sortBy || 'order'
    const sortOrder = query.sortOrder || 'asc'

    const validSortFields = ['batch_no', 'created_at', 'updated_at', 'order']
    const validSortOrders = ['asc', 'desc']

    const orderBy: any = {}
    if (validSortFields.includes(sortBy)) {
      orderBy[sortBy] = validSortOrders.includes(sortOrder) ? sortOrder : 'asc'
    } else {
      orderBy.order = 'asc'
    }

    return this.auditBatchRepository.findAll({ where, orderBy })
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const batch = await this.auditBatchRepository.findById(id)

    if (!batch) {
      throw new NotFoundException('Batch not found')
    }

    return batch
  }

  async update(
    id: string,
    data: UpdateAuditBatchDto,
    _user: IUserWithPermissions
  ) {
    const batch = await this.auditBatchRepository.findById(id)

    if (!batch) {
      throw new NotFoundException('Batch not found')
    }

    if (data.batch_no && data.batch_no !== batch.batch_no) {
      const existingBatch = await this.auditBatchRepository.findByBatchNo(
        data.batch_no
      )

      if (existingBatch) {
        throw new ConflictException('Batch with this number already exists')
      }
    }

    return this.auditBatchRepository.update(id, data)
  }

  async remove(id: string, _user: IUserWithPermissions) {
    const batch = await this.auditBatchRepository.findById(id)

    if (!batch) {
      throw new NotFoundException('Batch not found')
    }

    const auditCount = await this.auditBatchRepository.countAudits(id)

    if (auditCount > 0) {
      throw new BadRequestException(
        `Cannot delete batch with ${auditCount} associated audits. Please delete or reassign the audits first.`
      )
    }

    await this.auditBatchRepository.delete(id)

    return { message: 'Batch deleted successfully' }
  }

  async reorder(id: string, data: ReorderAuditBatchDto, _user: IUserWithPermissions) {
    const batch = await this.auditBatchRepository.findById(id)

    if (!batch) {
      throw new NotFoundException('Batch not found')
    }

    const currentOrder = batch.order
    const newOrder = data.newOrder

    if (currentOrder === newOrder) {
      return { message: 'Batch order unchanged' }
    }

    // Get all batches sorted by order
    const allBatches = await this.auditBatchRepository.findAll({ 
      where: {}, 
      orderBy: { order: 'asc' } 
    })

    // Prepare updates
    const updates: Array<{ id: string; order: number }> = []

    if (newOrder > currentOrder) {
      // Moving down: shift items up between currentOrder and newOrder
      allBatches.forEach(item => {
        if (item.id === id) {
          updates.push({ id: item.id, order: newOrder })
        } else if (item.order > currentOrder && item.order <= newOrder) {
          updates.push({ id: item.id, order: item.order - 1 })
        }
      })
    } else {
      // Moving up: shift items down between newOrder and currentOrder
      allBatches.forEach(item => {
        if (item.id === id) {
          updates.push({ id: item.id, order: newOrder })
        } else if (item.order >= newOrder && item.order < currentOrder) {
          updates.push({ id: item.id, order: item.order + 1 })
        }
      })
    }

    await this.auditBatchRepository.updateMany(updates)

    return { message: 'Batch order updated successfully' }
  }
}

