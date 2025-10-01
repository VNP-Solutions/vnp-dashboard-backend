import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { CreatePortfolioDto, UpdatePortfolioDto } from './portfolio.dto'
import type {
  IPortfolioRepository,
  IPortfolioService
} from './portfolio.interface'

@Injectable()
export class PortfolioService implements IPortfolioService {
  constructor(
    @Inject('IPortfolioRepository')
    private portfolioRepository: IPortfolioRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  async create(data: CreatePortfolioDto, _user: IUserWithPermissions) {
    const existingPortfolio = await this.portfolioRepository.findByName(
      data.name
    )

    if (existingPortfolio) {
      throw new ConflictException('Portfolio with this name already exists')
    }

    return this.portfolioRepository.create(data)
  }

  async findAll(user: IUserWithPermissions) {
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )

    if (accessibleIds === 'all') {
      return this.portfolioRepository.findAll()
    }

    if (accessibleIds.length === 0) {
      return []
    }

    return this.portfolioRepository.findAll(accessibleIds)
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const portfolio = await this.portfolioRepository.findById(id)

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    return portfolio
  }

  async update(
    id: string,
    data: UpdatePortfolioDto,
    _user: IUserWithPermissions
  ) {
    const portfolio = await this.portfolioRepository.findById(id)

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    if (data.name && data.name !== portfolio.name) {
      const existingPortfolio = await this.portfolioRepository.findByName(
        data.name
      )

      if (existingPortfolio) {
        throw new ConflictException('Portfolio with this name already exists')
      }
    }

    return this.portfolioRepository.update(id, data)
  }

  async remove(id: string, _user: IUserWithPermissions) {
    const portfolio = await this.portfolioRepository.findById(id)

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    const propertyCount = await this.portfolioRepository.countProperties(id)

    if (propertyCount > 0) {
      throw new BadRequestException(
        `Cannot delete portfolio with ${propertyCount} associated properties. Please delete or reassign the properties first.`
      )
    }

    await this.portfolioRepository.delete(id)

    return { message: 'Portfolio deleted successfully' }
  }
}
