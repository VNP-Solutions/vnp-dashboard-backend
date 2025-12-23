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

    // Always include essential lookups for display
    columnsUsed.push(
      'propertyName',
      'portfolioName',
      'currency',
      'auditStatus',
      'serviceType'
    )

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
   */
  private addLookupStages(): void {
    // Define lookup order to handle dependencies
    const lookupOrder = [
      'auditStatus',
      'batch',
      'property',
      'credentials',
      'bankDetails',
      'portfolio',
      'currency',
      'serviceType'
    ]

    for (const lookupName of lookupOrder) {
      if (!this.requiredLookups.has(lookupName)) continue

      switch (lookupName) {
        case 'auditStatus':
          this.pipeline.push({
            $lookup: {
              from: 'AuditStatus',
              localField: 'audit_status_id',
              foreignField: '_id',
              as: 'auditStatus'
            }
          })
          break

        case 'batch':
          this.pipeline.push({
            $lookup: {
              from: 'AuditBatch',
              localField: 'batch_id',
              foreignField: '_id',
              as: 'batch'
            }
          })
          break

        case 'property':
          this.pipeline.push({
            $lookup: {
              from: 'Property',
              localField: 'property_id',
              foreignField: '_id',
              as: 'property'
            }
          })
          break

        case 'credentials':
          // Credentials lookup uses property_id from the property subdocument
          this.pipeline.push({
            $lookup: {
              from: 'PropertyCredentials',
              localField: 'property._id',
              foreignField: 'property_id',
              as: 'credentials'
            }
          })
          break

        case 'bankDetails':
          this.pipeline.push({
            $lookup: {
              from: 'PropertyBankDetails',
              localField: 'property._id',
              foreignField: 'property_id',
              as: 'bankDetails'
            }
          })
          break

        case 'portfolio':
          this.pipeline.push({
            $lookup: {
              from: 'Portfolio',
              localField: 'property.portfolio_id',
              foreignField: '_id',
              as: 'portfolio'
            }
          })
          break

        case 'currency':
          this.pipeline.push({
            $lookup: {
              from: 'Currency',
              localField: 'property.currency_id',
              foreignField: '_id',
              as: 'currency'
            }
          })
          break

        case 'serviceType':
          this.pipeline.push({
            $lookup: {
              from: 'ServiceType',
              localField: 'portfolio.service_type_id',
              foreignField: '_id',
              as: 'serviceType'
            }
          })
          break
      }
    }
  }

  /**
   * Add $unwind stages to convert arrays to single objects
   */
  private addUnwindStages(): void {
    const unwindFields = [
      'auditStatus',
      'batch',
      'property',
      'credentials',
      'bankDetails',
      'portfolio',
      'currency',
      'serviceType'
    ]

    for (const field of unwindFields) {
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
    const matchConditions: any = {}

    for (const filter of this.options.filters) {
      const col = REPORT_COLUMNS[filter.column]
      if (!col) continue

      // Only process filters that require lookups here
      if (col.requiresLookup && col.requiresLookup.length > 0) {
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
   * Build a $match condition for a filter
   */
  private buildMatchCondition(col: ColumnMetadata, filter: ColumnFilter): any {
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
        condition[fieldPath] = { $lt: new Date(value) }
        break

      case FilterOperator.AFTER:
        condition[fieldPath] = { $gt: new Date(value) }
        break

      case FilterOperator.BETWEEN:
        if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
          if (col.dataType === ColumnDataType.DATE) {
            condition[fieldPath] = {
              $gte: new Date(value.from),
              $lte: new Date(value.to)
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
   * Build $project stage to exclude sensitive fields and shape output
   */
  private buildProjection(): any {
    return {
      // Audit fields
      _id: 1,
      type_of_ota: 1,
      billing_type: 1,
      amount_collectable: 1,
      amount_confirmed: 1,
      is_archived: 1,
      start_date: 1,
      end_date: 1,
      report_url: 1,
      created_at: 1,
      updated_at: 1,
      property_id: 1,
      audit_status_id: 1,
      batch_id: 1,

      // Audit Status
      'auditStatus._id': 1,
      'auditStatus.status': 1,
      'auditStatus.order': 1,

      // Batch
      'batch._id': 1,
      'batch.batch_no': 1,
      'batch.order': 1,

      // Property - exclude sensitive data
      'property._id': 1,
      'property.name': 1,
      'property.address': 1,
      'property.is_active': 1,
      'property.next_due_date': 1,
      'property.card_descriptor': 1,
      'property.portfolio_id': 1,

      // Credentials - OTA IDs, usernames, and passwords
      'credentials._id': 1,
      'credentials.expedia_id': 1,
      'credentials.expedia_username': 1,
      'credentials.expedia_password': 1,
      'credentials.agoda_id': 1,
      'credentials.agoda_username': 1,
      'credentials.agoda_password': 1,
      'credentials.booking_id': 1,
      'credentials.booking_username': 1,
      'credentials.booking_password': 1,

      // Bank Details - bank_type only, NO account numbers
      'bankDetails._id': 1,
      'bankDetails.bank_type': 1,
      'bankDetails.bank_sub_type': 1,
      // Note: Account numbers, routing numbers etc are NOT included

      // Currency
      'currency._id': 1,
      'currency.code': 1,
      'currency.name': 1,
      'currency.symbol': 1,

      // Portfolio
      'portfolio._id': 1,
      'portfolio.name': 1,
      'portfolio.contact_email': 1,
      'portfolio.is_active': 1,
      'portfolio.is_commissionable': 1,
      'portfolio.sales_agent': 1,

      // Service Type
      'serviceType._id': 1,
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
}
