import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import type { IServiceTypeRepository } from '../service-type/service-type.interface'
import {
  BulkImportResultDto,
  CreatePortfolioDto,
  PortfolioQueryDto,
  UpdatePortfolioDto
} from './portfolio.dto'
import type {
  IPortfolioRepository,
  IPortfolioService
} from './portfolio.interface'

@Injectable()
export class PortfolioService implements IPortfolioService {
  constructor(
    @Inject('IPortfolioRepository')
    private portfolioRepository: IPortfolioRepository,
    @Inject('IServiceTypeRepository')
    private serviceTypeRepository: IServiceTypeRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService,
    @Inject(EmailUtil)
    private emailUtil: EmailUtil
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

  async findAll(query: PortfolioQueryDto, user: IUserWithPermissions) {
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        query.page || 1,
        query.limit || 10
      )
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.service_type_id) {
      additionalFilters.service_type_id = query.service_type_id
    }
    if (query.is_active) {
      additionalFilters.is_active = query.is_active
    }
    if (query.is_contract_signed) {
      additionalFilters.is_contract_signed = query.is_contract_signed
    }

    // Merge with existing filters
    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    // Configuration for query builder
    const queryConfig = {
      searchFields: ['name'], // Search only by portfolio name
      filterableFields: ['service_type_id', 'is_active', 'is_contract_signed'],
      sortableFields: [
        'name',
        'created_at',
        'updated_at',
        'is_active',
        'is_contract_signed',
        'is_commissionable'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        service_type_name: 'serviceType.type'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
              in: accessibleIds
            }
          }

    // Build Prisma query options
    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.portfolioRepository.findAll(
        { where, skip, take, orderBy },
        undefined
      ),
      this.portfolioRepository.count(where, undefined)
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findAllForExport(query: PortfolioQueryDto, user: IUserWithPermissions) {
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return []
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.service_type_id) {
      additionalFilters.service_type_id = query.service_type_id
    }
    if (query.is_active) {
      additionalFilters.is_active = query.is_active
    }
    if (query.is_contract_signed) {
      additionalFilters.is_contract_signed = query.is_contract_signed
    }

    // Merge with existing filters
    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    // Configuration for query builder
    const queryConfig = {
      searchFields: ['name'], // Search only by portfolio name
      filterableFields: ['service_type_id', 'is_active', 'is_contract_signed'],
      sortableFields: [
        'name',
        'created_at',
        'updated_at',
        'is_active',
        'is_contract_signed',
        'is_commissionable'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        service_type_name: 'serviceType.type'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
              in: accessibleIds
            }
          }

    // Build Prisma query options (without pagination)
    const { where, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch all data without pagination
    const data = await this.portfolioRepository.findAll(
      { where, orderBy },
      undefined
    )

    return data
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

  async sendEmail(
    id: string,
    subject: string,
    body: string,
    _user: IUserWithPermissions
  ) {
    const portfolio = await this.portfolioRepository.findById(id)

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    if (!portfolio.contact_email) {
      throw new BadRequestException(
        'Portfolio does not have a contact email configured'
      )
    }

    await this.emailUtil.sendEmail(portfolio.contact_email, subject, body)

    return { message: 'Email sent successfully' }
  }

  async bulkImport(
    file: Express.Multer.File,
    _user: IUserWithPermissions
  ): Promise<BulkImportResultDto> {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    if (
      !file.originalname.endsWith('.xlsx') &&
      !file.originalname.endsWith('.xls')
    ) {
      throw new BadRequestException(
        'File must be an Excel file (.xlsx or .xls)'
      )
    }

    const result: BulkImportResultDto = {
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      successfulImports: []
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file is empty')
      }

      result.totalRows = data.length

      // Helper function to find header value with flexible naming
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim()
          }
        }
        return undefined
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract portfolio name
          const portfolioName = findHeaderValue(row, [
            'Portfolio Name',
            'Portofolio',
            'Portfolio name',
            'Name'
          ])

          if (!portfolioName) {
            result.errors.push({
              row: rowNumber,
              portfolio: 'Unknown',
              error: 'Portfolio name is required'
            })
            result.failureCount++
            continue
          }

          // Check if portfolio already exists
          const existingPortfolio =
            await this.portfolioRepository.findByName(portfolioName)
          if (existingPortfolio) {
            result.errors.push({
              row: rowNumber,
              portfolio: portfolioName,
              error: 'Portfolio with this name already exists'
            })
            result.failureCount++
            continue
          }

          // Extract service type name
          const serviceTypeName = findHeaderValue(row, [
            'Service Type',
            'Service type'
          ])

          if (!serviceTypeName) {
            result.errors.push({
              row: rowNumber,
              portfolio: portfolioName,
              error: 'Service type is required'
            })
            result.failureCount++
            continue
          }

          // Find or create service type
          let serviceType =
            await this.serviceTypeRepository.findByType(serviceTypeName)

          if (!serviceType) {
            // Create new service type
            serviceType = await this.serviceTypeRepository.create({
              type: serviceTypeName,
              is_active: true
            })
          }

          // Extract contract URL
          const contractUrl = findHeaderValue(row, [
            'Contract URL',
            'Contract Url',
            'Contract url'
          ])

          const isContractSigned = contractUrl ? true : false

          // Extract commissionable status
          const commissionableValue = findHeaderValue(row, ['Commissionable'])
          const isCommissionable =
            commissionableValue?.toLowerCase() === 'yes' ? true : false

          // Extract contact email (optional)
          const contactEmail = findHeaderValue(row, [
            'Contact Email',
            'Contact email',
            'Contact'
          ])

          // Create portfolio
          const portfolioData: CreatePortfolioDto = {
            name: portfolioName,
            service_type_id: serviceType.id,
            is_contract_signed: isContractSigned,
            contract_url: contractUrl || undefined,
            is_active: true,
            contact_email: contactEmail || undefined,
            is_commissionable: isCommissionable
          }

          await this.portfolioRepository.create(portfolioData)

          result.successCount++
          result.successfulImports.push(portfolioName)
        } catch (error) {
          const portfolioName =
            findHeaderValue(row, [
              'Portfolio Name',
              'Portofolio',
              'Portfolio name',
              'Name'
            ]) || 'Unknown'

          result.errors.push({
            row: rowNumber,
            portfolio: portfolioName,
            error: error.message || 'Unknown error occurred'
          })
          result.failureCount++
        }
      }

      return result
    } catch (error) {
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`
      )
    }
  }
}
