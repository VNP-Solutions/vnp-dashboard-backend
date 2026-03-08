import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { isInternalUser, isUserSuperAdmin } from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import {
  CreateSalesAgentDto,
  SalesAgentQueryDto,
  UpdateSalesAgentDto
} from './sales-agent.dto'
import type { ISalesAgentRepository, ISalesAgentService } from './sales-agent.interface'

@Injectable()
export class SalesAgentService implements ISalesAgentService {
  constructor(
    @Inject('ISalesAgentRepository')
    private salesAgentRepository: ISalesAgentRepository
  ) {}

  async create(data: CreateSalesAgentDto, user: IUserWithPermissions) {
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can create sales agents')
    }

    const existing = await this.salesAgentRepository.findByEmail(data.email)
    if (existing) {
      throw new ConflictException('A sales agent with this email already exists')
    }

    return this.salesAgentRepository.create(data)
  }

  async findAll(query: SalesAgentQueryDto, user: IUserWithPermissions) {
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can view sales agents')
    }

    const queryConfig = {
      searchFields: ['full_name', 'email', 'phone'],
      filterableFields: [],
      sortableFields: ['full_name', 'email', 'commission', 'created_at', 'updated_at'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const
    }

    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      query,
      queryConfig,
      {}
    )

    const [data, total] = await Promise.all([
      this.salesAgentRepository.findAll({ where, skip, take, orderBy }),
      this.salesAgentRepository.count(where)
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findOne(id: string, user: IUserWithPermissions) {
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can view sales agents')
    }

    const salesAgent = await this.salesAgentRepository.findById(id)
    if (!salesAgent) {
      throw new NotFoundException('Sales agent not found')
    }

    return salesAgent
  }

  async update(id: string, data: UpdateSalesAgentDto, user: IUserWithPermissions) {
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can update sales agents')
    }

    const salesAgent = await this.salesAgentRepository.findById(id)
    if (!salesAgent) {
      throw new NotFoundException('Sales agent not found')
    }

    if (data.email && data.email !== salesAgent.email) {
      const existing = await this.salesAgentRepository.findByEmail(data.email)
      if (existing) {
        throw new ConflictException('A sales agent with this email already exists')
      }
    }

    return this.salesAgentRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    if (!isUserSuperAdmin(user)) {
      throw new BadRequestException('Only Super Admin can delete sales agents')
    }

    const salesAgent = await this.salesAgentRepository.findById(id)
    if (!salesAgent) {
      throw new NotFoundException('Sales agent not found')
    }

    if (salesAgent.portfolios.length > 0) {
      throw new BadRequestException(
        `Cannot delete sales agent assigned to ${salesAgent.portfolios.length} portfolio(s). Please unassign them first.`
      )
    }

    await this.salesAgentRepository.delete(id)
    return { message: 'Sales agent deleted successfully' }
  }
}
