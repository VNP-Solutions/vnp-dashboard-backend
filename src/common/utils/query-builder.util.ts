import { PaginatedResult, QueryDto } from '../dto/query.dto'

export interface QueryBuilderConfig {
  searchFields?: string[]
  filterableFields?: string[]
  sortableFields?: string[]
  defaultSortField?: string
  defaultSortOrder?: 'asc' | 'desc'
  nestedFieldMap?: Record<string, string>
}

export class QueryBuilder {
  /**
   * Check if a value should be ignored
   * Ignores: 'All', 'all', empty string, null, undefined
   */
  static shouldIgnoreValue(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return true
    }
    if (typeof value === 'string' && value.toLowerCase() === 'all') {
      return true
    }
    return false
  }

  /**
   * Parse string value to appropriate type
   */
  static parseValue(value: string): any {
    if (this.shouldIgnoreValue(value)) {
      return undefined
    }

    // Boolean values
    if (value === 'true') return true
    if (value === 'false') return false

    // Numeric values
    if (!isNaN(Number(value)) && value !== '') {
      return Number(value)
    }

    // Array values (comma-separated)
    if (value.includes(',')) {
      return value.split(',').map(v => this.parseValue(v.trim()))
    }

    return value
  }

  /**
   * Build search where clause
   */
  static buildSearchWhere(
    searchTerm: string | undefined,
    searchFields: string[],
    nestedFieldMap?: Record<string, string>
  ): any {
    if (this.shouldIgnoreValue(searchTerm) || searchFields.length === 0) {
      return {}
    }

    const searchConditions = searchFields.map(field => {
      // Check if it's a nested field
      if (nestedFieldMap && nestedFieldMap[field]) {
        const [relation, nestedField] = nestedFieldMap[field].split('.')
        return {
          [relation]: {
            [nestedField]: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        }
      }

      // Regular field
      return {
        [field]: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      }
    })

    return searchConditions.length > 1
      ? { OR: searchConditions }
      : searchConditions[0] || {}
  }

  /**
   * Build filter where clause
   */
  static buildFilterWhere(
    filters: any,
    filterableFields: string[],
    nestedFieldMap?: Record<string, string>
  ): any {
    if (!filters || typeof filters !== 'object') {
      return {}
    }

    const filterConditions: any = {}

    for (const [key, value] of Object.entries(filters)) {
      // Skip if value should be ignored
      if (this.shouldIgnoreValue(value)) {
        continue
      }

      // Skip if field is not filterable
      if (!filterableFields.includes(key)) {
        continue
      }

      // Check if it's a nested field
      if (nestedFieldMap && nestedFieldMap[key]) {
        const [relation, nestedField] = nestedFieldMap[key].split('.')
        if (!filterConditions[relation]) {
          filterConditions[relation] = {}
        }
        filterConditions[relation][nestedField] = this.parseFilterValue(value)
      } else {
        // Regular field
        filterConditions[key] = this.parseFilterValue(value)
      }
    }

    return filterConditions
  }

  /**
   * Parse filter value with operator support
   */
  static parseFilterValue(value: any): any {
    // If value is an object with operator
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const { operator, val } = value
      const parsedVal = this.parseValue(val || value.value)

      switch (operator) {
        case 'contains':
          return { contains: parsedVal, mode: 'insensitive' }
        case 'in':
          return { in: Array.isArray(parsedVal) ? parsedVal : [parsedVal] }
        case 'gte':
          return { gte: parsedVal }
        case 'lte':
          return { lte: parsedVal }
        case 'gt':
          return { gt: parsedVal }
        case 'lt':
          return { lt: parsedVal }
        case 'not':
          return { not: parsedVal }
        default:
          return parsedVal
      }
    }

    // Simple value
    return this.parseValue(value)
  }

  /**
   * Build sort order clause
   */
  static buildOrderBy(
    sortBy: string | undefined,
    sortOrder: 'asc' | 'desc' | undefined,
    sortableFields: string[],
    defaultSortField: string,
    defaultSortOrder: 'asc' | 'desc',
    nestedFieldMap?: Record<string, string>
  ): any {
    // Use default if sortBy is not provided or should be ignored
    const field = this.shouldIgnoreValue(sortBy)
      ? defaultSortField
      : sortableFields.includes(sortBy!)
        ? sortBy
        : defaultSortField

    const order = this.shouldIgnoreValue(sortOrder)
      ? defaultSortOrder
      : sortOrder

    // Check if it's a nested field
    if (nestedFieldMap && nestedFieldMap[field!]) {
      const [relation, nestedField] = nestedFieldMap[field!].split('.')
      return {
        [relation]: {
          [nestedField]: order
        }
      }
    }

    return { [field!]: order }
  }

  /**
   * Build complete Prisma query options
   */
  static buildPrismaQuery(
    queryDto: QueryDto,
    config: QueryBuilderConfig,
    baseWhere: any = {}
  ): {
    where: any
    skip: number
    take: number
    orderBy: any
  } {
    const {
      searchFields = [],
      filterableFields = [],
      sortableFields = [],
      defaultSortField = 'created_at',
      defaultSortOrder = 'desc',
      nestedFieldMap
    } = config

    // Parse query parameters
    const page = queryDto.page || 1
    const limit = queryDto.limit || 10
    const searchTerm = queryDto.search
    const sortBy = queryDto.sortBy
    const sortOrder = queryDto.sortOrder

    // Use search fields from config only (not from query params)
    const searchFieldsArray = searchFields

    // Parse filters
    let filters = queryDto.filters
    if (typeof filters === 'string' && !this.shouldIgnoreValue(filters)) {
      try {
        filters = JSON.parse(filters)
      } catch {
        filters = {}
      }
    }

    // Build where clause
    const searchWhere = this.buildSearchWhere(
      searchTerm,
      searchFieldsArray,
      nestedFieldMap
    )
    const filterWhere = this.buildFilterWhere(
      filters,
      filterableFields,
      nestedFieldMap
    )

    const where = {
      ...baseWhere,
      ...filterWhere,
      ...(Object.keys(searchWhere).length > 0 ? searchWhere : {})
    }

    // Build order by
    const orderBy = this.buildOrderBy(
      sortBy,
      sortOrder,
      sortableFields,
      defaultSortField,
      defaultSortOrder,
      nestedFieldMap
    )

    // Calculate pagination
    const skip = (page - 1) * limit
    const take = limit

    return {
      where,
      skip,
      take,
      orderBy
    }
  }

  /**
   * Build paginated result
   */
  static buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit)

    return {
      data,
      metadata: {
        totalDocuments: total,
        currentPage: page,
        totalPages
      }
    }
  }
}
