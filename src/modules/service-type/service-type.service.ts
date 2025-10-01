import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './service-type.dto'
import type {
  IServiceTypeRepository,
  IServiceTypeService
} from './service-type.interface'

@Injectable()
export class ServiceTypeService implements IServiceTypeService {
  constructor(
    @Inject('IServiceTypeRepository')
    private serviceTypeRepository: IServiceTypeRepository
  ) {}

  async create(data: CreateServiceTypeDto, _user: IUserWithPermissions) {
    const existingServiceType = await this.serviceTypeRepository.findByType(
      data.type
    )

    if (existingServiceType) {
      throw new ConflictException('Service type with this name already exists')
    }

    return this.serviceTypeRepository.create(data)
  }

  async findAll(_user: IUserWithPermissions) {
    return this.serviceTypeRepository.findAll()
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const serviceType = await this.serviceTypeRepository.findById(id)

    if (!serviceType) {
      throw new NotFoundException('Service type not found')
    }

    return serviceType
  }

  async update(
    id: string,
    data: UpdateServiceTypeDto,
    _user: IUserWithPermissions
  ) {
    const serviceType = await this.serviceTypeRepository.findById(id)

    if (!serviceType) {
      throw new NotFoundException('Service type not found')
    }

    if (data.type && data.type !== serviceType.type) {
      const existingServiceType = await this.serviceTypeRepository.findByType(
        data.type
      )

      if (existingServiceType) {
        throw new ConflictException(
          'Service type with this name already exists'
        )
      }
    }

    return this.serviceTypeRepository.update(id, data)
  }

  async remove(id: string, _user: IUserWithPermissions) {
    const serviceType = await this.serviceTypeRepository.findById(id)

    if (!serviceType) {
      throw new NotFoundException('Service type not found')
    }

    const portfolioCount = await this.serviceTypeRepository.countPortfolios(id)

    if (portfolioCount > 0) {
      throw new BadRequestException(
        `Cannot delete service type with ${portfolioCount} associated portfolios. Please delete or reassign the portfolios first.`
      )
    }

    await this.serviceTypeRepository.delete(id)

    return { message: 'Service type deleted successfully' }
  }
}
