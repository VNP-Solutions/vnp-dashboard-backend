/**
 * MongoDB Aggregation Pipeline Builder for Global Report API
 *
 * Builds aggregation pipelines dynamically based on:
 * - Filter requirements (determines which $lookup stages are needed)
 * - Sort requirements
 * - Pagination settings
 *
 * Key optimizations:
 * - Only adds $lookup stages when needed by filters/sort
 * - Pre-lookup $match for audit-level filters (better performance)
 * - Uses $facet for pagination + count in a single query
 * - Excludes sensitive fields in $project
 */

import {
  REPORT_COLUMNS,
  ColumnMetadata,
  FilterOperator,
  ColumnDataType,
  getRequiredLookups
} from './column-metadata'

export interface ColumnFilter {
  column: string
  operator: FilterOperator
  value: any
}

export interface SortConfig {
  column: string
  order: 'asc' | 'desc'
}

export interface AggregationOptions {
  filters: ColumnFilter[]
  sort: SortConfig[]
  page: number
  limit: number
  excludeArchived: boolean
}

export class AggregationBuilder {
  private pipeline: any[] = []
  private requiredLookups: Set<string> = new Set()

  constructor(private options: AggregationOptions) {}

  /**
   * Build the complete aggregation pipeline
   */
  build(): any[] {
    this.pipeline = []

    // Step 1: Collect all required lookups from filters and sort
    this.collectRequiredLookups()

    // Step 2: Add initial $match for audit-level filters (before lookups for performance)
    this.addPreLookupMatch()

    // Step 3: Add $lookup stages for required collections
    this.addLookupStages()

    // Step 4: Unwind lookup arrays for single-value relations
    this.addUnwindStages()

    // Step 5: Add $match for filters on joined collections
    this.addPostLookupMatch()

    // Step 6: Add $sort
    this.addSortStage()

    // Step 7: Add $facet for pagination with count
    this.addFacetStage()

    return this.pipeline
  }

  /**
   * Build pipeline for export (no pagination, all matching records)
   */
  buildForExport(): any[] {
    this.pipeline = []

    this.collectRequiredLookups()
    this.addPreLookupMatch()
    this.addLookupStages()
    this.addUnwindStages()
    this.addPostLookupMatch()
    this.addSortStage()

    // For export, just add projection without pagination
    this.pipeline.push({ $project: this.buildProjection() })

    return this.pipeline
  }

  /**
   * Collect all lookups needed based on filters and sort columns
   */
  private collectRequiredLookups(): void {
    const columnsUsed: string[] = []

    // From filters
    for (const filter of this.options.filters) {
      columnsUsed.push(filter.column)
    }

    // From sort
    for (const sort of this.options.sort) {
      columnsUsed.push(sort.column)
    }

    // Always include essential lookups for display of required fields
    columnsUsed.push(
      'propertyName',
      'portfolioName',
      'currency',
      'auditStatus',
      'serviceType',
      'portfolioContactEmail',
      'nextDueDate'
    )

    // Always need credentials for OTA ID/Username/Password
    this.requiredLookups.add('credentials')

    const lookups = getRequiredLookups(columnsUsed)
    lookups.forEach(lookup => this.requiredLookups.add(lookup.as))
  }

  /**
   * Add $match stage for audit-level filters (before lookups)
   */
  private addPreLookupMatch(): void {
    const matchConditions: any = {}

    // Default: exclude archived unless explicitly filtering for them
    if (this.options.excludeArchived) {
      matchConditions.is_archived = false
    }

    for (const filter of this.options.filters) {
      const col = REPORT_COLUMNS[filter.column]
      if (!col) continue

      // Only process audit-level filters here (no lookup required)
      if (col.source === 'audit' && !col.requiresLookup) {
        const condition = this.buildMatchCondition(col, filter)
        if (condition) {
          Object.assign(matchConditions, condition)
        }
      }
    }

    if (Object.keys(matchConditions).length > 0) {
      this.pipeline.push({ $match: matchConditions })
    }
  }

  /**
   * Add $lookup stages for required collections
   * Note: Some lookups depend on prior lookups being unwound first
   */
  private addLookupStages(): void {
    // Stage 1: Lookups that don't depend on other lookups
    if (this.requiredLookups.has('auditStatus')) {
      this.pipeline.push({
        $lookup: {
          from: 'AuditStatus',
          localField: 'audit_status_id',
          foreignField: '_id',
          as: 'auditStatus'
        }
      })
    }

    if (this.requiredLookups.has('property')) {
      this.pipeline.push({
        $lookup: {
          from: 'Property',
          localField: 'property_id',
          foreignField: '_id',
          as: 'property'
        }
      })
      // Unwind property immediately - needed for subsequent lookups
      this.pipeline.push({
        $unwind: {
          path: '$property',
          preserveNullAndEmptyArrays: true
        }
      })
    }

    // Stage 2: Lookups that depend on property being unwound
    if (this.requiredLookups.has('credentials')) {
      this.pipeline.push({
        $lookup: {
          from: 'PropertyCredentials',
          localField: 'property._id',
          foreignField: 'property_id',
          as: 'credentials'
        }
      })
    }

    if (this.requiredLookups.has('portfolio')) {
      this.pipeline.push({
        $lookup: {
          from: 'Portfolio',
          localField: 'property.portfolio_id',
          foreignField: '_id',
          as: 'portfolio'
        }
      })
      // Unwind portfolio immediately - needed for serviceType lookup
      this.pipeline.push({
        $unwind: {
          path: '$portfolio',
          preserveNullAndEmptyArrays: true
        }
      })
    }

    if (this.requiredLookups.has('currency')) {
      this.pipeline.push({
        $lookup: {
          from: 'Currency',
          localField: 'property.currency_id',
          foreignField: '_id',
          as: 'currency'
        }
      })
    }

    // Stage 3: Lookups that depend on portfolio being unwound
    if (this.requiredLookups.has('serviceType')) {
      this.pipeline.push({
        $lookup: {
          from: 'ServiceType',
          localField: 'portfolio.service_type_id',
          foreignField: '_id',
          as: 'serviceType'
        }
      })
    }
  }

  /**
   * Add $unwind stages for remaining arrays
   * Note: property and portfolio are already unwound in addLookupStages
   */
  private addUnwindStages(): void {
    // Only unwind fields that weren't already unwound in addLookupStages
    const fieldsToUnwind = ['auditStatus', 'credentials', 'currency', 'serviceType']

    for (const field of fieldsToUnwind) {
      if (this.requiredLookups.has(field)) {
        this.pipeline.push({
          $unwind: {
            path: `$${field}`,
            preserveNullAndEmptyArrays: true
          }
        })
      }
    }
  }

  /**
   * Add $match stage for filters on joined collections
   */
  private addPostLookupMatch(): void {
    const matchConditions: any[] = []

    for (const filter of this.options.filters) {
      const col = REPORT_COLUMNS[filter.column]
      if (!col) continue

      // Only process filters that require lookups here
      if (col.requiresLookup && col.requiresLookup.length > 0) {
        const condition = this.buildMatchCondition(col, filter)
        if (condition && Object.keys(condition).length > 0) {
          matchConditions.push(condition)
        }
      }
    }

    if (matchConditions.length > 0) {
      // Use $and to combine all conditions (supports both simple and $or conditions)
      this.pipeline.push({ $match: { $and: matchConditions } })
    }
  }

  /**
   * Build a $match condition for a filter
   */
  private buildMatchCondition(col: ColumnMetadata, filter: ColumnFilter): any {
    // Special case: otaId filter needs to search across all OTA ID fields
    if (col.key === 'otaId') {
      return this.buildOtaIdMatchCondition(filter)
    }

    // Special case: otaUsername filter needs to search across all OTA username fields
    if (col.key === 'otaUsername') {
      return this.buildOtaUsernameMatchCondition(filter)
    }

    // Special case: otaPassword filter needs to search across all OTA password fields
    if (col.key === 'otaPassword') {
      return this.buildOtaPasswordMatchCondition(filter)
    }

    const fieldPath = col.fieldPath
    const condition: any = {}

    // Convert value based on data type
    const value = this.convertValue(col, filter.value, filter.operator)

    switch (filter.operator) {
      case FilterOperator.EQ:
        condition[fieldPath] = value
        break

      case FilterOperator.NEQ:
        condition[fieldPath] = { $ne: value }
        break

      case FilterOperator.IN:
        condition[fieldPath] = { $in: Array.isArray(value) ? value : [value] }
        break

      case FilterOperator.NIN:
        condition[fieldPath] = { $nin: Array.isArray(value) ? value : [value] }
        break

      case FilterOperator.CONTAINS:
        condition[fieldPath] = { $regex: this.escapeRegex(String(value)), $options: 'i' }
        break

      case FilterOperator.STARTS_WITH:
        condition[fieldPath] = { $regex: `^${this.escapeRegex(String(value))}`, $options: 'i' }
        break

      case FilterOperator.ENDS_WITH:
        condition[fieldPath] = { $regex: `${this.escapeRegex(String(value))}$`, $options: 'i' }
        break

      case FilterOperator.GT:
        condition[fieldPath] = { $gt: value }
        break

      case FilterOperator.GTE:
        condition[fieldPath] = { $gte: value }
        break

      case FilterOperator.LT:
        condition[fieldPath] = { $lt: value }
        break

      case FilterOperator.LTE:
        condition[fieldPath] = { $lte: value }
        break

      case FilterOperator.BEFORE:
        condition[fieldPath] = { $lt: this.toExtendedJsonDate(value) }
        break

      case FilterOperator.AFTER:
        condition[fieldPath] = { $gt: this.toExtendedJsonDate(value) }
        break

      case FilterOperator.BETWEEN:
        if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
          if (col.dataType === ColumnDataType.DATE) {
            condition[fieldPath] = {
              $gte: this.toExtendedJsonDate(value.from),
              $lte: this.toExtendedJsonDate(value.to)
            }
          } else {
            condition[fieldPath] = {
              $gte: value.from,
              $lte: value.to
            }
          }
        }
        break

      case FilterOperator.IS_NULL:
        condition[fieldPath] = { $in: [null, undefined] }
        break

      case FilterOperator.IS_NOT_NULL:
        condition[fieldPath] = { $nin: [null, undefined], $exists: true }
        break
    }

    return condition
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Build a special $match condition for otaId filter
   * Searches across all three OTA ID fields (expedia_id, agoda_id, booking_id)
   */
  private buildOtaIdMatchCondition(filter: ColumnFilter): any {
    const otaIdFields = [
      'credentials.expedia_id',
      'credentials.agoda_id',
      'credentials.booking_id'
    ]

    switch (filter.operator) {
      case FilterOperator.EQ: {
        // Match if any OTA ID field equals the value
        return {
          $or: otaIdFields.map(field => ({ [field]: filter.value }))
        }
      }

      case FilterOperator.IN: {
        // Match if any OTA ID field is in the array
        const values = Array.isArray(filter.value) ? filter.value : [filter.value]
        return {
          $or: otaIdFields.map(field => ({ [field]: { $in: values } }))
        }
      }

      case FilterOperator.CONTAINS: {
        // Match if any OTA ID field contains the value (case-insensitive)
        const regex = { $regex: this.escapeRegex(String(filter.value)), $options: 'i' }
        return {
          $or: otaIdFields.map(field => ({ [field]: regex }))
        }
      }

      default:
        return {}
    }
  }

  /**
   * Build a special $match condition for otaUsername filter
   * Searches across all three OTA username fields (expedia_username, agoda_username, booking_username)
   */
  private buildOtaUsernameMatchCondition(filter: ColumnFilter): any {
    const otaUsernameFields = [
      'credentials.expedia_username',
      'credentials.agoda_username',
      'credentials.booking_username'
    ]

    switch (filter.operator) {
      case FilterOperator.EQ: {
        return {
          $or: otaUsernameFields.map(field => ({ [field]: filter.value }))
        }
      }

      case FilterOperator.IN: {
        const values = Array.isArray(filter.value) ? filter.value : [filter.value]
        return {
          $or: otaUsernameFields.map(field => ({ [field]: { $in: values } }))
        }
      }

      case FilterOperator.CONTAINS: {
        const regex = { $regex: this.escapeRegex(String(filter.value)), $options: 'i' }
        return {
          $or: otaUsernameFields.map(field => ({ [field]: regex }))
        }
      }

      default:
        return {}
    }
  }

  /**
   * Build a special $match condition for otaPassword filter
   * Searches across all three OTA password fields (expedia_password, agoda_password, booking_password)
   * Note: Passwords are stored encrypted, so filtering works on encrypted values
   */
  private buildOtaPasswordMatchCondition(filter: ColumnFilter): any {
    const otaPasswordFields = [
      'credentials.expedia_password',
      'credentials.agoda_password',
      'credentials.booking_password'
    ]

    switch (filter.operator) {
      case FilterOperator.EQ: {
        return {
          $or: otaPasswordFields.map(field => ({ [field]: filter.value }))
        }
      }

      case FilterOperator.IN: {
        const values = Array.isArray(filter.value) ? filter.value : [filter.value]
        return {
          $or: otaPasswordFields.map(field => ({ [field]: { $in: values } }))
        }
      }

      case FilterOperator.CONTAINS: {
        const regex = { $regex: this.escapeRegex(String(filter.value)), $options: 'i' }
        return {
          $or: otaPasswordFields.map(field => ({ [field]: regex }))
        }
      }

      default:
        return {}
    }
  }

  /**
   * Convert filter value based on column data type
   */
  private convertValue(col: ColumnMetadata, value: any, operator: FilterOperator): any {
    if (value === null || value === undefined) return value

    // For IS_NULL and IS_NOT_NULL, value doesn't matter
    if (operator === FilterOperator.IS_NULL || operator === FilterOperator.IS_NOT_NULL) {
      return value
    }

    switch (col.dataType) {
      case ColumnDataType.OBJECT_ID:
        // Use $oid format for MongoDB extended JSON (required by Prisma aggregateRaw)
        if (Array.isArray(value)) {
          return value.map(v => this.toObjectId(v))
        }
        return this.toObjectId(value)

      case ColumnDataType.NUMBER:
        if (typeof value === 'object' && 'from' in value) {
          return { from: Number(value.from), to: Number(value.to) }
        }
        if (Array.isArray(value)) {
          return value.map(v => Number(v))
        }
        return Number(value)

      case ColumnDataType.BOOLEAN:
        return value === 'true' || value === true

      case ColumnDataType.DATE:
        if (typeof value === 'object' && 'from' in value) {
          return { from: new Date(value.from), to: new Date(value.to) }
        }
        return new Date(value)

      default:
        return value
    }
  }

  /**
   * Add $sort stage
   */
  private addSortStage(): void {
    if (this.options.sort.length === 0) {
      // Default sort by created_at desc
      this.pipeline.push({ $sort: { created_at: -1 } })
      return
    }

    const sortSpec: any = {}
    for (const sort of this.options.sort) {
      const col = REPORT_COLUMNS[sort.column]
      if (col && col.sortable) {
        sortSpec[col.fieldPath] = sort.order === 'asc' ? 1 : -1
      }
    }

    if (Object.keys(sortSpec).length > 0) {
      this.pipeline.push({ $sort: sortSpec })
    } else {
      // Fallback default sort
      this.pipeline.push({ $sort: { created_at: -1 } })
    }
  }

  /**
   * Add $facet stage for pagination with total count
   */
  private addFacetStage(): void {
    const skip = (this.options.page - 1) * this.options.limit

    this.pipeline.push({
      $facet: {
        data: [
          { $skip: skip },
          { $limit: this.options.limit },
          { $project: this.buildProjection() }
        ],
        totalCount: [{ $count: 'count' }]
      }
    })
  }

  /**
   * Build $project stage for the 16 required fields only
   *
   * Fields: portfolio, property, service type, billing type, ota type, ota id,
   * ota review status, start date, end date, next due date, currency,
   * amount collectable, amount confirmed, portfolio contact email,
   * ota username, ota password
   */
  private buildProjection(): any {
    return {
      // Audit fields needed
      type_of_ota: 1,
      billing_type: 1,
      start_date: 1,
      end_date: 1,
      amount_collectable: 1,
      amount_confirmed: 1,

      // Audit Status (OTA Review Status)
      'auditStatus.status': 1,

      // Property
      'property.name': 1,
      'property.next_due_date': 1,

      // Credentials - OTA IDs, usernames, and passwords
      'credentials.expedia_id': 1,
      'credentials.expedia_username': 1,
      'credentials.expedia_password': 1,
      'credentials.agoda_id': 1,
      'credentials.agoda_username': 1,
      'credentials.agoda_password': 1,
      'credentials.booking_id': 1,
      'credentials.booking_username': 1,
      'credentials.booking_password': 1,

      // Currency
      'currency.code': 1,

      // Portfolio
      'portfolio.name': 1,
      'portfolio.contact_email': 1,

      // Service Type
      'serviceType.type': 1
    }
  }

  /**
   * Convert a string ID to MongoDB ObjectId format for aggregateRaw
   * Uses $oid extended JSON format which Prisma aggregateRaw understands
   */
  private toObjectId(value: string): { $oid: string } | string {
    // Validate MongoDB ObjectId format (24 hex characters)
    if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
      return { $oid: value }
    }
    // Return as-is if not a valid ObjectId format
    return value
  }

  /**
   * Convert a date value to MongoDB Extended JSON format for aggregateRaw
   * Prisma's aggregateRaw requires dates in { $date: "ISO_STRING" } format
   */
  private toExtendedJsonDate(value: string | Date): { $date: string } {
    const date = value instanceof Date ? value : new Date(value)
    return { $date: date.toISOString() }
  }
}
