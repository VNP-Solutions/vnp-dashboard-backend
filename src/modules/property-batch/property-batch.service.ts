import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreatePropertyBatchDto,
  PropertyBatchQueryDto,
  ReorderPropertyBatchDto,
  UpdatePropertyBatchDto
} from './property-batch.dto'
import type {
  IPropertyBatchRepository,
  IPropertyBatchService
} from './property-batch.interface'

@Injectable()
export class PropertyBatchService implements IPropertyBatchService {
  constructor(
    @Inject('IPropertyBatchRepository')
    private propertyBatchRepository: IPropertyBatchRepository
  ) {}

  async create(data: CreatePropertyBatchDto, _user: IUserWithPermissions) {
    const existingBatch = await this.propertyBatchRepository.findByBatchNo(
      data.batch_no
    )

    if (existingBatch) {
      throw new ConflictException('Batch with this number already exists')
    }

    return this.propertyBatchRepository.create(data)
  }

  async findAll(query: PropertyBatchQueryDto, _user: IUserWithPermissions) {
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

    return this.propertyBatchRepository.findAll({ where, orderBy })
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const batch = await this.propertyBatchRepository.findById(id)

    if (!batch) {
      throw new NotFoundException('Batch not found')
    }

    return batch
  }

  async update(
    id: string,
    data: UpdatePropertyBatchDto,
    _user: IUserWithPermissions
  ) {
    const batch = await this.propertyBatchRepository.findById(id)

    if (!batch) {
      throw new NotFoundException('Batch not found')
    }

    if (data.batch_no && data.batch_no !== batch.batch_no) {
      const existingBatch = await this.propertyBatchRepository.findByBatchNo(
        data.batch_no
      )

      if (existingBatch) {
        throw new ConflictException('Batch with this number already exists')
      }
    }

    return this.propertyBatchRepository.update(id, data)
  }

  async remove(id: string, _user: IUserWithPermissions) {
    const batch = await this.propertyBatchRepository.findById(id)

    if (!batch) {
      throw new NotFoundException('Batch not found')
    }

    const propertyCount = await this.propertyBatchRepository.countProperties(id)

    if (propertyCount > 0) {
      throw new BadRequestException(
        `Cannot delete batch with ${propertyCount} associated properties. Please delete or reassign the properties first.`
      )
    }

    await this.propertyBatchRepository.delete(id)

    return { message: 'Batch deleted successfully' }
  }

  async reorder(id: string, data: ReorderPropertyBatchDto, _user: IUserWithPermissions) {
    const batch = await this.propertyBatchRepository.findById(id)

    if (!batch) {
      throw new NotFoundException('Batch not found')
    }

    const currentOrder = batch.order
    const newOrder = data.newOrder

    if (currentOrder === newOrder) {
      return { message: 'Batch order unchanged' }
    }

    // Get all batches sorted by order
    const allBatches = await this.propertyBatchRepository.findAll({ 
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

    await this.propertyBatchRepository.updateMany(updates)

    return { message: 'Batch order updated successfully' }
  }
}
