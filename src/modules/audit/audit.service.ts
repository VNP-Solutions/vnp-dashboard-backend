import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { OtaType } from '@prisma/client'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import {
  canArchiveAudit,
  getArchiveErrorMessage
} from '../../common/utils/audit.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import type { IAuditStatusRepository } from '../audit-status/audit-status.interface'
import type { IPropertyRepository } from '../property/property.interface'
import {
  AuditQueryDto,
  BulkArchiveAuditDto,
  BulkImportResultDto,
  BulkUpdateAuditDto,
  CreateAuditDto,
  UpdateAuditDto
} from './audit.dto'
import type { IAuditRepository, IAuditService } from './audit.interface'

@Injectable()
export class AuditService implements IAuditService {
  constructor(
    @Inject('IAuditRepository')
    private auditRepository: IAuditRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService,
    @Inject('IAuditStatusRepository')
    private auditStatusRepository: IAuditStatusRepository,
    @Inject('IPropertyRepository')
    private propertyRepository: IPropertyRepository
  ) {}

  async create(data: CreateAuditDto, _user: IUserWithPermissions) {
    // Validate date range
    const startDate = new Date(data.start_date)
    const endDate = new Date(data.end_date)

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date')
    }

    return this.auditRepository.create(data)
  }

  async findAll(query: AuditQueryDto, user: IUserWithPermissions) {
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.AUDIT
      )

    if (
      Array.isArray(accessiblePropertyIds) &&
      accessiblePropertyIds.length === 0
    ) {
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        query.page || 1,
        query.limit || 10
      )
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.type_of_ota) {
      additionalFilters.type_of_ota = query.type_of_ota
    }
    if (query.audit_status_id) {
      additionalFilters.audit_status_id = query.audit_status_id
    }
    if (query.property_id) {
      additionalFilters.property_id = query.property_id
    }
    // Handle is_archived filter: true/false/All/empty
    if (
      query.is_archived !== undefined &&
      query.is_archived !== null &&
      query.is_archived !== 'All' &&
      query.is_archived !== ''
    ) {
      additionalFilters.is_archived = query.is_archived === 'true'
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
      searchFields: [
        'ota_id',
        'property.name',
        'id',
        'property.credentials.expedia_id'
      ], // Added expedia_id to search
      filterableFields: [
        'type_of_ota',
        'audit_status_id',
        'property_id',
        'is_archived'
      ],
      sortableFields: [
        'created_at',
        'updated_at',
        'start_date',
        'end_date',
        'type_of_ota',
        'amount_collectable',
        'amount_confirmed',
        'is_archived'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name',
        audit_status: 'auditStatus.status',
        expedia_id: 'property.credentials.expedia_id'
      }
    }

    // Build base where clause
    const baseWhere =
      accessiblePropertyIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessiblePropertyIds
            }
          }

    // Build Prisma query options
    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Add expedia_id filter if provided
    let finalWhere = where
    if (query.expedia_id) {
      finalWhere = {
        ...where,
        property: {
          credentials: {
            expedia_id: {
              contains: query.expedia_id,
              mode: 'insensitive'
            }
          }
        }
      }
    }

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.auditRepository.findAll(
        { where: finalWhere, skip, take, orderBy },
        Array.isArray(accessiblePropertyIds) ? accessiblePropertyIds : undefined
      ),
      this.auditRepository.count(
        finalWhere,
        Array.isArray(accessiblePropertyIds) ? accessiblePropertyIds : undefined
      )
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findAllForExport(query: AuditQueryDto, user: IUserWithPermissions) {
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.AUDIT
      )

    if (
      Array.isArray(accessiblePropertyIds) &&
      accessiblePropertyIds.length === 0
    ) {
      return []
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.type_of_ota) {
      additionalFilters.type_of_ota = query.type_of_ota
    }
    if (query.audit_status_id) {
      additionalFilters.audit_status_id = query.audit_status_id
    }
    if (query.property_id) {
      additionalFilters.property_id = query.property_id
    }
    // Handle is_archived filter: true/false/All/empty
    if (
      query.is_archived !== undefined &&
      query.is_archived !== null &&
      query.is_archived !== 'All' &&
      query.is_archived !== ''
    ) {
      additionalFilters.is_archived = query.is_archived === 'true'
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
      searchFields: [
        'ota_id',
        'property.name',
        'id',
        'property.credentials.expedia_id'
      ], // Added expedia_id to search
      filterableFields: [
        'type_of_ota',
        'audit_status_id',
        'property_id',
        'is_archived'
      ],
      sortableFields: [
        'created_at',
        'updated_at',
        'start_date',
        'end_date',
        'type_of_ota',
        'amount_collectable',
        'amount_confirmed',
        'is_archived'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name',
        audit_status: 'auditStatus.status',
        expedia_id: 'property.credentials.expedia_id'
      }
    }

    // Build base where clause
    const baseWhere =
      accessiblePropertyIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessiblePropertyIds
            }
          }

    // Build Prisma query options (without pagination)
    const { where, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Add expedia_id filter if provided
    let finalWhere = where
    if (query.expedia_id) {
      finalWhere = {
        ...where,
        property: {
          credentials: {
            expedia_id: {
              contains: query.expedia_id,
              mode: 'insensitive'
            }
          }
        }
      }
    }

    // Fetch all data without pagination
    const data = await this.auditRepository.findAll(
      { where: finalWhere, orderBy },
      Array.isArray(accessiblePropertyIds) ? accessiblePropertyIds : undefined
    )

    return data
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    return audit
  }

  async update(id: string, data: UpdateAuditDto, _user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Validate date range if dates are being updated
    if (data.start_date || data.end_date) {
      const startDate = new Date(data.start_date || audit.start_date)
      const endDate = new Date(data.end_date || audit.end_date)

      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date')
      }
    }

    return this.auditRepository.update(id, data)
  }

  async remove(id: string, _user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    await this.auditRepository.delete(id)

    return { message: 'Audit deleted successfully' }
  }

  async archive(id: string, _user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Check if audit is already archived
    if (audit.is_archived) {
      throw new BadRequestException('Audit is already archived')
    }

    // Get the audit status
    const auditStatus = audit.auditStatus.status

    // Check if audit can be archived based on status
    if (!canArchiveAudit(auditStatus)) {
      const errorMessage = getArchiveErrorMessage(auditStatus)
      throw new BadRequestException(errorMessage)
    }

    // If all validations pass, archive the audit
    return this.auditRepository.archive(id)
  }

  async bulkUpdate(data: BulkUpdateAuditDto, _user: IUserWithPermissions) {
    const { audit_ids, ...updateData } = data

    if (!audit_ids || audit_ids.length === 0) {
      throw new BadRequestException('No audit IDs provided')
    }

    // Validate date range if dates are being updated
    if (updateData.start_date || updateData.end_date) {
      const startDate = new Date(updateData.start_date || new Date())
      const endDate = new Date(updateData.end_date || new Date())

      if (
        updateData.start_date &&
        updateData.end_date &&
        startDate >= endDate
      ) {
        throw new BadRequestException('Start date must be before end date')
      }
    }

    const result = await this.auditRepository.bulkUpdate(audit_ids, updateData)

    return {
      message: `Successfully updated ${result.count} audit(s)`,
      updated_count: result.count
    }
  }

  async unarchive(id: string, _user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Check if audit is not archived
    if (!audit.is_archived) {
      throw new BadRequestException('Audit is not archived')
    }

    // Unarchive the audit (no conditions to check)
    return this.auditRepository.unarchive(id)
  }

  async bulkArchive(data: BulkArchiveAuditDto, _user: IUserWithPermissions) {
    const { audit_ids } = data

    if (!audit_ids || audit_ids.length === 0) {
      throw new BadRequestException('No audit IDs provided')
    }

    // Fetch all audits
    const audits = await this.auditRepository.findByIds(audit_ids)

    const successfulIds: string[] = []
    const failedAudits: Array<{ id: string; reason: string }> = []

    // Check each audit individually
    for (const auditId of audit_ids) {
      const audit = audits.find(a => a.id === auditId)

      // Audit not found
      if (!audit) {
        failedAudits.push({
          id: auditId,
          reason: 'Audit not found'
        })
        continue
      }

      // Already archived
      if (audit.is_archived) {
        failedAudits.push({
          id: auditId,
          reason: 'Audit is already archived'
        })
        continue
      }

      // Check if can be archived based on status
      const auditStatus = audit.auditStatus.status
      if (!canArchiveAudit(auditStatus)) {
        const errorMessage = getArchiveErrorMessage(auditStatus)
        failedAudits.push({
          id: auditId,
          reason: errorMessage
        })
        continue
      }

      // Passed all validations
      successfulIds.push(auditId)
    }

    // Archive all successful audits
    let archivedCount = 0
    if (successfulIds.length > 0) {
      const result = await this.auditRepository.bulkArchive(successfulIds)
      archivedCount = result.count
    }

    return {
      message: `Successfully archived ${archivedCount} audit(s), ${failedAudits.length} failed`,
      successfully_archived: archivedCount,
      failed_to_archive: failedAudits.length,
      failed_audits: failedAudits
    }
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

      // Helper function to parse date in mm/dd/yyyy format
      const parseDate = (dateString: string): Date | null => {
        if (!dateString) return null

        try {
          // Try to parse mm/dd/yyyy format
          const parts = dateString.trim().split('/')
          if (parts.length === 3) {
            const month = parseInt(parts[0], 10)
            const day = parseInt(parts[1], 10)
            const year = parseInt(parts[2], 10)

            if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
              return new Date(year, month - 1, day)
            }
          }

          // Try to parse as ISO date
          const date = new Date(dateString)
          if (!isNaN(date.getTime())) {
            return date
          }

          return null
        } catch {
          return null
        }
      }

      // Helper function to parse OTA type
      const parseOtaType = (otaString: string): OtaType | null => {
        if (!otaString) return null

        const normalized = otaString.toLowerCase().trim()
        switch (normalized) {
          case 'expedia':
          case 'exp':
            return OtaType.expedia
          case 'agoda':
          case 'ago':
            return OtaType.agoda
          case 'booking':
          case 'booking.com':
          case 'book':
            return OtaType.booking
          default:
            return null
        }
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract property name
          const propertyName = findHeaderValue(row, [
            'Property Name',
            'Property name',
            'Property',
            'Name'
          ])

          if (!propertyName) {
            result.errors.push({
              row: rowNumber,
              audit: 'Unknown',
              error: 'Property name is required'
            })
            result.failureCount++
            continue
          }

          // Find property by name
          const property =
            await this.propertyRepository.findByName(propertyName)
          if (!property) {
            result.errors.push({
              row: rowNumber,
              audit: propertyName,
              error: 'Property not found'
            })
            result.failureCount++
            continue
          }

          // Extract OTA type
          const otaTypeValue = findHeaderValue(row, [
            'OTA',
            'OTA Type',
            'Ota Type',
            'Ota type',
            'type_of_ota'
          ])
          const typeOfOta = otaTypeValue ? parseOtaType(otaTypeValue) : null

          // Extract audit status
          const auditStatusValue = findHeaderValue(row, [
            'Audit Status',
            'Audit status',
            'Status',
            'audit_status_id'
          ])
          if (!auditStatusValue) {
            result.errors.push({
              row: rowNumber,
              audit: propertyName,
              error: 'Audit status is required'
            })
            result.failureCount++
            continue
          }

          // Find or create audit status
          let auditStatus =
            await this.auditStatusRepository.findByStatus(auditStatusValue)
          if (!auditStatus) {
            // Create new audit status
            auditStatus = await this.auditStatusRepository.create({
              status: auditStatusValue
            })
          }

          // Extract amount collectable
          const amountCollectableValue = findHeaderValue(row, [
            'Amount Collectable',
            'Amount collectable',
            'amount_collectable',
            'Collectable'
          ])
          const amountCollectable = amountCollectableValue
            ? parseFloat(amountCollectableValue)
            : undefined

          // Extract amount confirmed
          const amountConfirmedValue = findHeaderValue(row, [
            'Amount Confirmed',
            'Amount confirmed',
            'amount_confirmed',
            'Confirmed'
          ])
          const amountConfirmed = amountConfirmedValue
            ? parseFloat(amountConfirmedValue)
            : undefined

          // Extract start date
          const startDateValue = findHeaderValue(row, [
            'Start Date',
            'Start date',
            'start_date',
            'From Date',
            'From'
          ])
          if (!startDateValue) {
            result.errors.push({
              row: rowNumber,
              audit: propertyName,
              error: 'Start date is required'
            })
            result.failureCount++
            continue
          }

          const startDate = parseDate(startDateValue)
          if (!startDate) {
            result.errors.push({
              row: rowNumber,
              audit: propertyName,
              error: 'Invalid start date format (expected mm/dd/yyyy)'
            })
            result.failureCount++
            continue
          }

          // Extract end date
          const endDateValue = findHeaderValue(row, [
            'End Date',
            'End date',
            'end_date',
            'To Date',
            'To'
          ])
          if (!endDateValue) {
            result.errors.push({
              row: rowNumber,
              audit: propertyName,
              error: 'End date is required'
            })
            result.failureCount++
            continue
          }

          const endDate = parseDate(endDateValue)
          if (!endDate) {
            result.errors.push({
              row: rowNumber,
              audit: propertyName,
              error: 'Invalid end date format (expected mm/dd/yyyy)'
            })
            result.failureCount++
            continue
          }

          // Validate date range
          if (startDate >= endDate) {
            result.errors.push({
              row: rowNumber,
              audit: propertyName,
              error: 'Start date must be before end date'
            })
            result.failureCount++
            continue
          }

          // Extract report URL
          const reportUrl = findHeaderValue(row, [
            'Report URL',
            'Report url',
            'report_url',
            'Report',
            'URL'
          ])

          // Create audit data
          const auditData: CreateAuditDto = {
            property_id: property.id,
            audit_status_id: auditStatus.id,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            type_of_ota: typeOfOta || undefined,
            amount_collectable: amountCollectable,
            amount_confirmed: amountConfirmed,
            report_url: reportUrl
          }

          // Create the audit
          await this.auditRepository.create(auditData)

          const auditDescription = `${propertyName} - ${typeOfOta ? typeOfOta : 'Unknown OTA'} Audit`
          result.successCount++
          result.successfulImports.push(auditDescription)
        } catch (error) {
          const propertyName =
            findHeaderValue(row, [
              'Property Name',
              'Property name',
              'Property',
              'Name'
            ]) || 'Unknown'

          result.errors.push({
            row: rowNumber,
            audit: propertyName,
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
