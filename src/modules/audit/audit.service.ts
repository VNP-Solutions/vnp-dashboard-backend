import {
  BadRequestException,
  ForbiddenException,
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
  COMPLETED_AUDIT_STATUSES,
  canArchiveAudit,
  getArchiveErrorMessage
} from '../../common/utils/audit.util'
import { EmailUtil } from '../../common/utils/email.util'
import {
  isUserSuperAdmin,
  isInternalUser
} from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import type { IAuditBatchRepository } from '../audit-batch/audit-batch.interface'
import type { IAuditStatusRepository } from '../audit-status/audit-status.interface'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyRepository } from '../property/property.interface'
import {
  AuditQueryDto,
  BulkArchiveAuditDto,
  BulkImportResultDto,
  BulkUpdateResultDto,
  BulkUploadReportDto,
  CreateAuditDto,
  GlobalStatsResponseDto,
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
    private propertyRepository: IPropertyRepository,
    @Inject('IAuditBatchRepository')
    private auditBatchRepository: IAuditBatchRepository,
    @Inject(PrismaService)
    private prisma: PrismaService,
    @Inject(EmailUtil)
    private emailUtil: EmailUtil
  ) {}

  async create(data: CreateAuditDto, _user: IUserWithPermissions) {
    // Validate date range only if both dates are provided
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date)
      const endDate = new Date(data.end_date)

      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date')
      }
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
    if (query.batch_id) {
      additionalFilters.batch_id = query.batch_id
    }
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

    // For MongoDB: Handle property name and expedia ID search separately since Prisma MongoDB doesn't support nested relation filters
    let propertyIdFilter: string[] | undefined = undefined
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim()
      // Find properties matching the search term (by name or expedia ID in credentials)
      const matchingProperties = await this.prisma.property.findMany({
        where: {
          OR: [
            {
              name: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            },
            {
              credentials: {
                expedia_id: {
                  contains: searchTerm,
                  mode: 'insensitive'
                }
              }
            }
          ]
        },
        select: {
          id: true
        }
      })

      if (matchingProperties.length > 0) {
        propertyIdFilter = matchingProperties.map(p => p.id)
      }
    }

    // Configuration for query builder - remove nested fields for MongoDB compatibility
    const queryConfig = {
      searchFields: ['id', 'batch.batch_no'],
      filterableFields: [
        'batch_id',
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
    const baseWhere: any =
      accessiblePropertyIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessiblePropertyIds
            }
          }

    // Add property ID filter if we found matching properties by name
    if (propertyIdFilter && propertyIdFilter.length > 0) {
      if (baseWhere.property_id && baseWhere.property_id.in) {
        // Intersect with accessible property IDs
        baseWhere.property_id.in = baseWhere.property_id.in.filter(
          (id: string) => propertyIdFilter.includes(id)
        )
      } else {
        // Set property ID filter directly
        baseWhere.property_id = {
          in: propertyIdFilter
        }
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

    // Add status ID filter if provided (supports comma-separated values)
    if (query.status) {
      const statusIds = query.status
        .split(',')
        .map(s => s.trim())
        .filter(s => s)

      if (statusIds.length > 0) {
        finalWhere = {
          ...finalWhere,
          audit_status_id: {
            in: statusIds
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
    if (query.batch_id) {
      additionalFilters.batch_id = query.batch_id
    }
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

    // For MongoDB: Handle property name and expedia ID search separately since Prisma MongoDB doesn't support nested relation filters
    let propertyIdFilter: string[] | undefined = undefined
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim()
      // Find properties matching the search term (by name or expedia ID in credentials)
      const matchingProperties = await this.prisma.property.findMany({
        where: {
          OR: [
            {
              name: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            },
            {
              credentials: {
                expedia_id: {
                  contains: searchTerm,
                  mode: 'insensitive'
                }
              }
            }
          ]
        },
        select: {
          id: true
        }
      })

      if (matchingProperties.length > 0) {
        propertyIdFilter = matchingProperties.map(p => p.id)
      }
    }

    // Configuration for query builder - remove nested fields for MongoDB compatibility
    const queryConfig = {
      searchFields: ['id', 'batch.batch_no'],
      filterableFields: [
        'batch_id',
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
    const baseWhere: any =
      accessiblePropertyIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessiblePropertyIds
            }
          }

    // Add property ID filter if we found matching properties by name
    if (propertyIdFilter && propertyIdFilter.length > 0) {
      if (baseWhere.property_id && baseWhere.property_id.in) {
        // Intersect with accessible property IDs
        baseWhere.property_id.in = baseWhere.property_id.in.filter(
          (id: string) => propertyIdFilter.includes(id)
        )
      } else {
        // Set property ID filter directly
        baseWhere.property_id = {
          in: propertyIdFilter
        }
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

    // Add status ID filter if provided (supports comma-separated values)
    if (query.status) {
      const statusIds = query.status
        .split(',')
        .map(s => s.trim())
        .filter(s => s)

      if (statusIds.length > 0) {
        finalWhere = {
          ...finalWhere,
          audit_status_id: {
            in: statusIds
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

    // Validate batch_id if provided
    if (data.batch_id !== undefined && data.batch_id !== null) {
      const batch = await this.auditBatchRepository.findById(data.batch_id)
      if (!batch) {
        throw new NotFoundException(
          `Audit batch with ID ${data.batch_id} not found`
        )
      }
    }

    // Validate date range if dates are being updated
    // Only validate if we'll have both dates after the update
    if (data.start_date || data.end_date) {
      const startDateStr = data.start_date || audit.start_date
      const endDateStr = data.end_date || audit.end_date

      // Only validate if both dates will be present after update
      if (startDateStr && endDateStr) {
        const startDate = new Date(startDateStr)
        const endDate = new Date(endDateStr)

        if (startDate >= endDate) {
          throw new BadRequestException('Start date must be before end date')
        }
      }
    }

    // Check if status is changing and send email notification
    if (data.audit_status_id && data.audit_status_id !== audit.audit_status_id) {
      await this.sendAuditStatusChangeNotification(audit, data.audit_status_id)
    }

    return this.auditRepository.update(id, data)
  }

  async archive(id: string, user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Only super admins and internal users can archive audits
    if (!isUserSuperAdmin(user) && !isInternalUser(user)) {
      throw new ForbiddenException(
        'External users cannot archive audits'
      )
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

  async bulkUpdate(
    file: Express.Multer.File,
    _user: IUserWithPermissions
  ): Promise<BulkUpdateResultDto> {
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

    const result: BulkUpdateResultDto = {
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      successfulUpdates: []
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
      // Handles column names with asterisks (e.g., "Property*")
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        // First, try to find exact matches
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim()
          }
        }

        // If no exact match, try matching by removing asterisks from Excel column names
        const rowKeys = Object.keys(row)
        for (const name of possibleNames) {
          for (const key of rowKeys) {
            // Remove asterisk and trim from the Excel column name
            const cleanKey = key.split('*')[0].trim()
            if (cleanKey.toLowerCase() === name.toLowerCase()) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return String(value).trim()
              }
            }
          }
        }

        return undefined
      }

      // Helper function to get raw value (preserves type for dates and numbers)
      // Handles column names with asterisks (e.g., "Property*")
      const getRawValue = (row: any, possibleNames: string[]): any => {
        // First, try to find exact matches
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return value
          }
        }

        // If no exact match, try matching by removing asterisks from Excel column names
        const rowKeys = Object.keys(row)
        for (const name of possibleNames) {
          for (const key of rowKeys) {
            // Remove asterisk and trim from the Excel column name
            const cleanKey = key.split('*')[0].trim()
            if (cleanKey.toLowerCase() === name.toLowerCase()) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return value
              }
            }
          }
        }

        return undefined
      }

      // Helper function to parse date in mm/dd/yyyy format or Excel serial number
      const parseDate = (dateValue: any): Date | null => {
        if (!dateValue) return null

        try {
          // If it's already a Date object, return it
          if (dateValue instanceof Date) {
            if (!isNaN(dateValue.getTime())) {
              return dateValue
            }
            return null
          }

          // If it's a number (Excel serial date), convert it
          if (typeof dateValue === 'number') {
            // Excel stores dates as days since January 1, 1900
            // Excel has a bug where it considers 1900 a leap year, so we use December 30, 1899 as epoch
            const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
            const date = new Date(
              excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000
            )
            if (
              !isNaN(date.getTime()) &&
              date.getFullYear() >= 1900 &&
              date.getFullYear() <= 2100
            ) {
              return date
            }
            return null
          }

          // Convert to string for string parsing
          const dateString = String(dateValue)

          // Try to parse mm/dd/yyyy format
          const parts = dateString.trim().split('/')
          if (parts.length === 3) {
            const month = parseInt(parts[0], 10)
            const day = parseInt(parts[1], 10)
            const year = parseInt(parts[2], 10)

            if (
              !isNaN(month) &&
              !isNaN(day) &&
              !isNaN(year) &&
              year >= 1900 &&
              year <= 2100
            ) {
              return new Date(year, month - 1, day)
            }
          }

          // Try to parse as ISO date
          const date = new Date(dateString)
          if (
            !isNaN(date.getTime()) &&
            date.getFullYear() >= 1900 &&
            date.getFullYear() <= 2100
          ) {
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
          // Extract audit ID (required)
          const auditIdValue = findHeaderValue(row, [
            'Audit ID',
            'Audit Id',
            'Audit id',
            'audit_id',
            'ID',
            'Id',
            'id'
          ])

          if (!auditIdValue) {
            result.errors.push({
              row: rowNumber,
              auditId: 'Unknown',
              error: 'Audit ID is required'
            })
            result.failureCount++
            continue
          }

          // Validate MongoDB ObjectId format
          if (!QueryBuilder.isValidObjectId(auditIdValue)) {
            result.errors.push({
              row: rowNumber,
              auditId: auditIdValue,
              error:
                'Invalid audit ID format (must be a valid MongoDB ObjectId)'
            })
            result.failureCount++
            continue
          }

          // Find existing audit
          const existingAudit =
            await this.auditRepository.findById(auditIdValue)
          if (!existingAudit) {
            result.errors.push({
              row: rowNumber,
              auditId: auditIdValue,
              error: 'Audit not found'
            })
            result.failureCount++
            continue
          }

          // Prepare update data (only include fields that have values)
          const updateData: any = {}

          // Extract property name (if provided, find the property)
          const propertyName = findHeaderValue(row, [
            'Property Name',
            'Property name',
            'Property',
            'Name'
          ])
          if (propertyName) {
            const property =
              await this.propertyRepository.findByName(propertyName)
            if (!property) {
              result.errors.push({
                row: rowNumber,
                auditId: auditIdValue,
                error: `Property '${propertyName}' not found`
              })
              result.failureCount++
              continue
            }
            updateData.property_id = property.id
          }

          // Extract OTA type (if provided)
          const otaTypeValue = findHeaderValue(row, [
            'OTA',
            'OTA Type',
            'Ota Type',
            'Ota type',
            'type_of_ota'
          ])
          if (otaTypeValue) {
            const typeOfOta = parseOtaType(otaTypeValue)
            if (typeOfOta) {
              updateData.type_of_ota = typeOfOta
            }
          }

          // Extract audit status (if provided)
          const auditStatusValue = findHeaderValue(row, [
            'Audit Status',
            'Status To',
            'Status to',
            'Status'
          ])
          if (auditStatusValue) {
            // Find or create audit status
            let auditStatus =
              await this.auditStatusRepository.findByStatus(auditStatusValue)
            if (!auditStatus) {
              // Create new audit status
              auditStatus = await this.auditStatusRepository.create({
                status: auditStatusValue
              })
            }
            updateData.audit_status_id = auditStatus.id
          }

          // Extract amount collectable (if provided)
          const amountCollectableValue = findHeaderValue(row, [
            'Amount Collectable',
            'Amount collectable',
            'amount_collectable',
            'Collectable'
          ])
          if (amountCollectableValue) {
            const amountCollectable = parseFloat(amountCollectableValue)
            if (!isNaN(amountCollectable)) {
              updateData.amount_collectable = amountCollectable
            }
          }

          // Extract amount confirmed (if provided)
          const amountConfirmedValue = findHeaderValue(row, [
            'Amount Confirmed',
            'Amount confirmed',
            'amount_confirmed',
            'Confirmed'
          ])
          if (amountConfirmedValue) {
            const amountConfirmed = parseFloat(amountConfirmedValue)
            if (!isNaN(amountConfirmed)) {
              updateData.amount_confirmed = amountConfirmed
            }
          }

          // Extract start date (if provided) - use raw value to preserve Excel date format
          const startDateValue = getRawValue(row, [
            'Start Date',
            'Start date',
            'start_date',
            'From Date',
            'From'
          ])
          if (startDateValue) {
            const startDate = parseDate(startDateValue)
            if (!startDate) {
              result.errors.push({
                row: rowNumber,
                auditId: auditIdValue,
                error: 'Invalid start date format (expected mm/dd/yyyy)'
              })
              result.failureCount++
              continue
            }
            updateData.start_date = startDate.toISOString()
          }

          // Extract end date (if provided) - use raw value to preserve Excel date format
          const endDateValue = getRawValue(row, [
            'End Date',
            'End date',
            'end_date',
            'To Date',
            'To'
          ])
          if (endDateValue) {
            const endDate = parseDate(endDateValue)
            if (!endDate) {
              result.errors.push({
                row: rowNumber,
                auditId: auditIdValue,
                error: 'Invalid end date format (expected mm/dd/yyyy)'
              })
              result.failureCount++
              continue
            }
            updateData.end_date = endDate.toISOString()
          }

          // Validate date range if both dates are provided
          if (updateData.start_date && updateData.end_date) {
            const startDate = new Date(updateData.start_date)
            const endDate = new Date(updateData.end_date)
            if (startDate >= endDate) {
              result.errors.push({
                row: rowNumber,
                auditId: auditIdValue,
                error: 'Start date must be before end date'
              })
              result.failureCount++
              continue
            }
          }

          // Extract report URL (if provided)
          const reportUrl = findHeaderValue(row, [
            'Report URL',
            'Report url',
            'report_url',
            'Report',
            'URL'
          ])
          if (reportUrl) {
            updateData.report_url = reportUrl
          }

          // Extract batch (optional)
          const batchValue = findHeaderValue(row, ['Batch', 'Batch No'])
          if (batchValue) {
            // Find or create batch
            let batch = await this.prisma.auditBatch.findFirst({
              where: { batch_no: batchValue }
            })

            if (!batch) {
              batch = await this.prisma.auditBatch.create({
                data: { batch_no: batchValue }
              })
            }

            updateData.batch_id = batch.id
          }

          // Only update if there's something to update
          if (Object.keys(updateData).length === 0) {
            result.errors.push({
              row: rowNumber,
              auditId: auditIdValue,
              error: 'No fields to update (all fields are empty)'
            })
            result.failureCount++
            continue
          }

          // Update the audit
          await this.auditRepository.update(auditIdValue, updateData)

          result.successCount++
          result.successfulUpdates.push(auditIdValue)
        } catch (error) {
          const auditIdValue =
            findHeaderValue(row, [
              'Audit ID',
              'Audit Id',
              'Audit id',
              'audit_id',
              'ID',
              'Id',
              'id'
            ]) || 'Unknown'

          result.errors.push({
            row: rowNumber,
            auditId: auditIdValue,
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
      // Handles column names with asterisks (e.g., "Property*")
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        // First, try to find exact matches
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim()
          }
        }

        // If no exact match, try matching by removing asterisks from Excel column names
        const rowKeys = Object.keys(row)
        for (const name of possibleNames) {
          for (const key of rowKeys) {
            // Remove asterisk and trim from the Excel column name
            const cleanKey = key.split('*')[0].trim()
            if (cleanKey.toLowerCase() === name.toLowerCase()) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return String(value).trim()
              }
            }
          }
        }

        return undefined
      }

      // Helper function to get raw value (preserves type for dates and numbers)
      // Handles column names with asterisks (e.g., "Property*")
      const getRawValue = (row: any, possibleNames: string[]): any => {
        // First, try to find exact matches
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return value
          }
        }

        // If no exact match, try matching by removing asterisks from Excel column names
        const rowKeys = Object.keys(row)
        for (const name of possibleNames) {
          for (const key of rowKeys) {
            // Remove asterisk and trim from the Excel column name
            const cleanKey = key.split('*')[0].trim()
            if (cleanKey.toLowerCase() === name.toLowerCase()) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return value
              }
            }
          }
        }

        return undefined
      }

      // Helper function to parse date in mm/dd/yyyy format or Excel serial number
      const parseDate = (dateValue: any): Date | null => {
        if (!dateValue) return null

        try {
          // If it's already a Date object, return it
          if (dateValue instanceof Date) {
            if (!isNaN(dateValue.getTime())) {
              return dateValue
            }
            return null
          }

          // If it's a number (Excel serial date), convert it
          if (typeof dateValue === 'number') {
            // Excel stores dates as days since January 1, 1900
            // Excel has a bug where it considers 1900 a leap year, so we use December 30, 1899 as epoch
            const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
            const date = new Date(
              excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000
            )
            if (
              !isNaN(date.getTime()) &&
              date.getFullYear() >= 1900 &&
              date.getFullYear() <= 2100
            ) {
              return date
            }
            return null
          }

          // Convert to string for string parsing
          const dateString = String(dateValue)

          // Try to parse mm/dd/yyyy format
          const parts = dateString.trim().split('/')
          if (parts.length === 3) {
            const month = parseInt(parts[0], 10)
            const day = parseInt(parts[1], 10)
            const year = parseInt(parts[2], 10)

            if (
              !isNaN(month) &&
              !isNaN(day) &&
              !isNaN(year) &&
              year >= 1900 &&
              year <= 2100
            ) {
              return new Date(year, month - 1, day)
            }
          }

          // Try to parse as ISO date
          const date = new Date(dateString)
          if (
            !isNaN(date.getTime()) &&
            date.getFullYear() >= 1900 &&
            date.getFullYear() <= 2100
          ) {
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

      // Log available columns for debugging
      if (data.length > 0) {
        const firstRow = data[0] as any
        const availableColumns = Object.keys(firstRow)
        console.log(
          'Available Excel columns:',
          JSON.stringify(availableColumns)
        )
        console.log(
          'Sample first row values:',
          JSON.stringify(firstRow, null, 2)
        )
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract Expedia ID (required)
          const expediaId = findHeaderValue(row, [
            'Expedia ID',
            'Expedia Id',
            'Expedia id',
            'expedia_id'
          ])

          // Debug log
          console.log(
            `Row ${rowNumber}: expediaId =`,
            expediaId,
            'from row:',
            JSON.stringify(row)
          )

          if (!expediaId) {
            result.errors.push({
              row: rowNumber,
              audit: 'Unknown',
              error:
                'Expedia ID is required. Available columns: ' +
                Object.keys(row).join(', ')
            })
            result.failureCount++
            continue
          }

          // Find property by Expedia ID
          const property =
            await this.propertyRepository.findByExpediaId(expediaId)
          if (!property) {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Property with Expedia ID '${expediaId}' not found in database`
            )
            result.errors.push({
              row: rowNumber,
              audit: expediaId,
              error: 'Property not found with this Expedia ID'
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
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Audit status is required`
            )
            result.errors.push({
              row: rowNumber,
              audit: expediaId,
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

          // Extract start date (use raw value to preserve Excel date format) - optional
          const startDateValue = getRawValue(row, [
            'Start Date',
            'Start date',
            'start_date',
            'From Date',
            'From'
          ])

          let startDate: Date | null = null
          if (startDateValue) {
            startDate = parseDate(startDateValue)
            if (!startDate) {
              console.log(
                '\x1b[31m%s\x1b[0m',
                `❌ Row ${rowNumber} FAILED: Invalid start date format`
              )
              result.errors.push({
                row: rowNumber,
                audit: expediaId,
                error: 'Invalid start date format (expected mm/dd/yyyy)'
              })
              result.failureCount++
              continue
            }
          }

          // Extract end date (use raw value to preserve Excel date format) - optional
          const endDateValue = getRawValue(row, [
            'End Date',
            'End date',
            'end_date',
            'To Date',
            'To'
          ])

          let endDate: Date | null = null
          if (endDateValue) {
            endDate = parseDate(endDateValue)
            if (!endDate) {
              console.log(
                '\x1b[31m%s\x1b[0m',
                `❌ Row ${rowNumber} FAILED: Invalid end date format`
              )
              result.errors.push({
                row: rowNumber,
                audit: expediaId,
                error: 'Invalid end date format (expected mm/dd/yyyy)'
              })
              result.failureCount++
              continue
            }
          }

          // Validate date range only if both dates are provided
          if (startDate && endDate && startDate >= endDate) {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Start date must be before end date`
            )
            result.errors.push({
              row: rowNumber,
              audit: expediaId,
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

          // Extract batch (optional)
          const batchValue = findHeaderValue(row, ['Batch', 'Batch No'])
          let batchId: string | undefined = undefined

          if (batchValue) {
            // Find or create batch
            let batch = await this.prisma.auditBatch.findFirst({
              where: { batch_no: batchValue }
            })

            if (!batch) {
              batch = await this.prisma.auditBatch.create({
                data: { batch_no: batchValue }
              })
            }

            batchId = batch.id
          }

          // Create audit data
          const auditData: CreateAuditDto = {
            property_id: property.id,
            audit_status_id: auditStatus.id,
            start_date: startDate ? startDate.toISOString() : undefined,
            end_date: endDate ? endDate.toISOString() : undefined,
            type_of_ota: typeOfOta || undefined,
            amount_collectable: amountCollectable,
            amount_confirmed: amountConfirmed,
            report_url: reportUrl,
            batch_id: batchId
          }

          // Create the audit
          await this.auditRepository.create(auditData)

          const auditDescription = `${expediaId} - ${typeOfOta ? typeOfOta : 'Unknown OTA'} Audit`
          result.successCount++
          result.successfulImports.push(auditDescription)
          console.log(
            '\x1b[32m%s\x1b[0m',
            `✅ Row ${rowNumber} SUCCESS: Created audit for Expedia ID '${expediaId}' (${typeOfOta || 'Unknown OTA'})`
          )
        } catch (error) {
          const expediaIdValue =
            findHeaderValue(row, [
              'Expedia ID',
              'Expedia Id',
              'Expedia id',
              'expedia_id'
            ]) || 'Unknown'

          console.log(
            '\x1b[31m%s\x1b[0m',
            `❌ Row ${rowNumber} FAILED: ${error.message || 'Unknown error occurred'}`
          )
          result.errors.push({
            row: rowNumber,
            audit: expediaIdValue,
            error: error.message || 'Unknown error occurred'
          })
          result.failureCount++
        }
      }

      // Final summary report
      console.log(
        '\n\x1b[36m%s\x1b[0m',
        '========================================'
      )
      console.log('\x1b[36m%s\x1b[0m', '📊 IMPORT SUMMARY REPORT')
      console.log(
        '\x1b[36m%s\x1b[0m',
        '========================================'
      )
      console.log(
        '\x1b[33m%s\x1b[0m',
        `📝 Total Rows Processed: ${result.totalRows}`
      )
      console.log(
        '\x1b[32m%s\x1b[0m',
        `✅ Successfully Imported: ${result.successCount}`
      )
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed: ${result.failureCount}`)

      if (result.successCount > 0) {
        console.log('\n\x1b[32m%s\x1b[0m', '✅ Successful Imports:')
        result.successfulImports.forEach((audit, idx) => {
          console.log('\x1b[32m%s\x1b[0m', `   ${idx + 1}. ${audit}`)
        })
      }

      if (result.failureCount > 0) {
        console.log('\n\x1b[31m%s\x1b[0m', '❌ Failed Imports:')
        console.table(result.errors)
      }

      console.log(
        '\x1b[36m%s\x1b[0m',
        '========================================\n'
      )

      return result
    } catch (error) {
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`
      )
    }
  }

  async getGlobalStats(
    user: IUserWithPermissions
  ): Promise<GlobalStatsResponseDto> {
    // Get accessible property IDs based on user permissions
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    // If user has no access to any properties, return zeros
    if (
      Array.isArray(accessiblePropertyIds) &&
      accessiblePropertyIds.length === 0
    ) {
      return {
        amount_collectable: {
          total: 0,
          expedia: 0,
          booking: 0,
          agoda: 0
        },
        amount_confirmed: {
          total: 0,
          expedia: 0,
          booking: 0,
          agoda: 0
        },
        completed_audit_count: 0
      }
    }

    // Build where clause for accessible properties
    const whereClause =
      accessiblePropertyIds === 'all'
        ? { is_archived: false }
        : {
            property_id: { in: accessiblePropertyIds },
            is_archived: false
          }

    // Get aggregate data for amount collectable and confirmed by OTA type
    const auditAggregates = await this.prisma.audit.groupBy({
      by: ['type_of_ota'],
      where: whereClause,
      _sum: {
        amount_collectable: true,
        amount_confirmed: true
      }
    })

    // Get count of completed audits
    const completedAuditCount = await this.prisma.audit.count({
      where: {
        ...whereClause,
        auditStatus: {
          status: {
            in: COMPLETED_AUDIT_STATUSES
          }
        }
      }
    })

    // Initialize amounts
    const amountCollectable = {
      total: 0,
      expedia: 0,
      booking: 0,
      agoda: 0
    }

    const amountConfirmed = {
      total: 0,
      expedia: 0,
      booking: 0,
      agoda: 0
    }

    // Process aggregated data
    auditAggregates.forEach(aggregate => {
      const collectableAmount = aggregate._sum.amount_collectable || 0
      const confirmedAmount = aggregate._sum.amount_confirmed || 0

      amountCollectable.total += collectableAmount
      amountConfirmed.total += confirmedAmount

      if (aggregate.type_of_ota === 'expedia') {
        amountCollectable.expedia += collectableAmount
        amountConfirmed.expedia += confirmedAmount
      } else if (aggregate.type_of_ota === 'booking') {
        amountCollectable.booking += collectableAmount
        amountConfirmed.booking += confirmedAmount
      } else if (aggregate.type_of_ota === 'agoda') {
        amountCollectable.agoda += collectableAmount
        amountConfirmed.agoda += confirmedAmount
      }
    })

    return {
      amount_collectable: amountCollectable,
      amount_confirmed: amountConfirmed,
      completed_audit_count: completedAuditCount
    }
  }

  async bulkUploadReport(
    data: BulkUploadReportDto,
    _user: IUserWithPermissions
  ) {
    const { audit_ids, report_url } = data

    if (!audit_ids || audit_ids.length === 0) {
      throw new BadRequestException('No audit IDs provided')
    }

    if (!report_url) {
      throw new BadRequestException('Report URL is required')
    }

    // Validate all audit IDs exist
    const audits = await this.auditRepository.findByIds(audit_ids)
    const foundIds = audits.map(a => a.id)
    const notFoundIds = audit_ids.filter((id: string) => !foundIds.includes(id))

    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Audits not found with IDs: ${notFoundIds.join(', ')}`
      )
    }

    // Update all audits with the report URL
    const result = await this.auditRepository.bulkUpdate(audit_ids, {
      report_url
    })

    return {
      message: `Successfully updated ${result.count} audit(s) with report URL`,
      updated_count: result.count,
      updated_ids: audit_ids
    }
  }

  /**
   * Send email notification when audit status changes
   */
  private async sendAuditStatusChangeNotification(
    audit: any,
    newStatusId: string
  ) {
    try {
      // Get old and new status details
      const oldStatus = await this.auditStatusRepository.findById(
        audit.audit_status_id
      )
      const newStatus = await this.auditStatusRepository.findById(newStatusId)

      if (!oldStatus || !newStatus) {
        console.error('Could not find audit status for email notification')
        return
      }

      // Get property details
      const property = await this.propertyRepository.findById(audit.property_id)

      if (!property) {
        console.error('Property not found for audit status change notification')
        return
      }

      const recipientEmails: string[] = []

      // Get portfolio details with contact_email
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: property.portfolio_id },
        select: { contact_email: true }
      })

      // Add portfolio contact email if exists
      if (portfolio?.contact_email) {
        recipientEmails.push(portfolio.contact_email)
      }

      // Generate audit name (type_of_ota + " Audit")
      const auditName = audit.type_of_ota
        ? `${audit.type_of_ota.charAt(0).toUpperCase() + audit.type_of_ota.slice(1)} Audit`
        : 'Audit'

      // Send the email
      await this.emailUtil.sendAuditStatusChangeEmail(
        recipientEmails,
        auditName,
        oldStatus.status,
        newStatus.status,
        new Date()
      )
    } catch (error) {
      // Log the error but don't fail the status update
      console.error('Failed to send audit status change notification:', error)
    }
  }
}
