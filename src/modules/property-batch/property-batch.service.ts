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
    const sortBy = query.sortBy || 'created_at'
    const sortOrder = query.sortOrder || 'desc'

    const validSortFields = ['batch_no', 'created_at', 'updated_at']
    const validSortOrders = ['asc', 'desc']

    const orderBy: any = {}
    if (validSortFields.includes(sortBy)) {
      orderBy[sortBy] = validSortOrders.includes(sortOrder) ? sortOrder : 'desc'
    } else {
      orderBy.created_at = 'desc'
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
}
