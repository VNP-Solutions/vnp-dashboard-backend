/**
 * Column Metadata Definitions for Global Report API
 *
 * This file defines all reportable columns declaratively, including:
 * - Data types and allowed filter operators
 * - MongoDB field paths and required lookups
 * - Sortability and filterability flags
 *
 * The column metadata drives the entire filtering/sorting system:
 * - Validates incoming filter/sort requests
 * - Determines which $lookup stages are needed
 * - Builds MongoDB aggregation pipelines dynamically
 */

export enum ColumnDataType {
  STRING = 'string',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
  OBJECT_ID = 'objectId'
}

export enum FilterOperator {
  EQ = 'eq',
  NEQ = 'neq',
  IN = 'in',
  NIN = 'nin',
  CONTAINS = 'contains',
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  BEFORE = 'before',
  AFTER = 'after',
  BETWEEN = 'between',
  IS_NULL = 'isNull',
  IS_NOT_NULL = 'isNotNull'
}

export type LookupSource =
  | 'audit'
  | 'property'
  | 'portfolio'
  | 'credentials'
  | 'auditStatus'
  | 'currency'
  | 'serviceType'

export interface LookupConfig {
  from: string
  localField: string
  foreignField: string
  as: string
}

export interface ColumnMetadata {
  key: string
  label: string
  dataType: ColumnDataType
  filterable: boolean
  sortable: boolean
  source: LookupSource
  fieldPath: string
  allowedOperators: FilterOperator[]
  enumValues?: string[]
  requiresLookup?: LookupConfig[]
  /** If true, this column is only for filtering and won't be returned in columns metadata API */
  filterOnly?: boolean
}

// Common operator sets for reuse
const STRING_OPERATORS = [
  FilterOperator.EQ,
  FilterOperator.NEQ,
  FilterOperator.IN,
  FilterOperator.NIN,
  FilterOperator.CONTAINS,
  FilterOperator.STARTS_WITH,
  FilterOperator.IS_NULL,
  FilterOperator.IS_NOT_NULL
]

const OBJECT_ID_OPERATORS = [
  FilterOperator.EQ,
  FilterOperator.NEQ,
  FilterOperator.IN,
  FilterOperator.NIN
]

const NUMBER_OPERATORS = [
  FilterOperator.EQ,
  FilterOperator.NEQ,
  FilterOperator.GT,
  FilterOperator.GTE,
  FilterOperator.LT,
  FilterOperator.LTE,
  FilterOperator.BETWEEN,
  FilterOperator.IS_NULL,
  FilterOperator.IS_NOT_NULL
]

const DATE_OPERATORS = [
  FilterOperator.EQ,
  FilterOperator.BEFORE,
  FilterOperator.AFTER,
  FilterOperator.BETWEEN,
  FilterOperator.IS_NULL,
  FilterOperator.IS_NOT_NULL
]

const ENUM_OPERATORS = [
  FilterOperator.EQ,
  FilterOperator.NEQ,
  FilterOperator.IN,
  FilterOperator.NIN,
  FilterOperator.IS_NULL,
  FilterOperator.IS_NOT_NULL
]

// Lookup configurations for related collections
const PROPERTY_LOOKUP: LookupConfig = {
  from: 'Property',
  localField: 'property_id',
  foreignField: '_id',
  as: 'property'
}

const PORTFOLIO_LOOKUP: LookupConfig = {
  from: 'Portfolio',
  localField: 'property.portfolio_id',
  foreignField: '_id',
  as: 'portfolio'
}

const AUDIT_STATUS_LOOKUP: LookupConfig = {
  from: 'AuditStatus',
  localField: 'audit_status_id',
  foreignField: '_id',
  as: 'auditStatus'
}

const CURRENCY_LOOKUP: LookupConfig = {
  from: 'Currency',
  localField: 'property.currency_id',
  foreignField: '_id',
  as: 'currency'
}

const SERVICE_TYPE_LOOKUP: LookupConfig = {
  from: 'ServiceType',
  localField: 'portfolio.service_type_id',
  foreignField: '_id',
  as: 'serviceType'
}

/**
 * All reportable columns for the Global Report API
 *
 * Fields included:
 * - portfolio (ID and name)
 * - property (ID and name)
 * - service type (ID and name)
 * - billing type
 * - ota type
 * - ota id
 * - ota review status (ID and name)
 * - start date
 * - end date
 * - next due date
 * - currency (ID and code)
 * - amount collectable
 * - amount confirmed
 * - portfolio contact email
 * - ota username
 * - ota password
 */
export const REPORT_COLUMNS: Record<string, ColumnMetadata> = {
  // Portfolio ID (for filtering only)
  portfolioId: {
    key: 'portfolioId',
    label: 'Portfolio ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: false,
    source: 'property',
    fieldPath: 'property.portfolio_id',
    allowedOperators: OBJECT_ID_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP],
    filterOnly: true
  },

  // Portfolio Name
  portfolioName: {
    key: 'portfolioName',
    label: 'Portfolio',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'portfolio',
    fieldPath: 'portfolio.name',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, PORTFOLIO_LOOKUP]
  },

  // Property ID (for filtering only)
  propertyId: {
    key: 'propertyId',
    label: 'Property ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: false,
    source: 'audit',
    fieldPath: 'property_id',
    allowedOperators: OBJECT_ID_OPERATORS,
    filterOnly: true
  },

  // Property Name
  propertyName: {
    key: 'propertyName',
    label: 'Property',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'property',
    fieldPath: 'property.name',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP]
  },

  // Service Type ID (for filtering only)
  serviceTypeId: {
    key: 'serviceTypeId',
    label: 'Service Type ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: false,
    source: 'portfolio',
    fieldPath: 'portfolio.service_type_id',
    allowedOperators: OBJECT_ID_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, PORTFOLIO_LOOKUP],
    filterOnly: true
  },

  // Service Type (Posting Type)
  serviceType: {
    key: 'serviceType',
    label: 'Service Type',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'serviceType',
    fieldPath: 'serviceType.type',
    allowedOperators: [FilterOperator.EQ, FilterOperator.IN, FilterOperator.NEQ],
    requiresLookup: [PROPERTY_LOOKUP, PORTFOLIO_LOOKUP, SERVICE_TYPE_LOOKUP]
  },

  // Billing Type
  billingType: {
    key: 'billingType',
    label: 'Billing Type',
    dataType: ColumnDataType.ENUM,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: 'billing_type',
    allowedOperators: ENUM_OPERATORS,
    enumValues: ['VCC', 'DB', 'EBS']
  },

  // OTA Type
  otaType: {
    key: 'otaType',
    label: 'OTA Type',
    dataType: ColumnDataType.ENUM,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: 'type_of_ota',
    allowedOperators: ENUM_OPERATORS,
    enumValues: ['expedia', 'agoda', 'booking']
  },

  // OTA ID (computed - not directly filterable)
  otaId: {
    key: 'otaId',
    label: 'OTA ID',
    dataType: ColumnDataType.STRING,
    filterable: false,
    sortable: false,
    source: 'credentials',
    fieldPath: 'credentials.expedia_id',
    allowedOperators: []
  },

  // Audit Status ID (for filtering only)
  auditStatusId: {
    key: 'auditStatusId',
    label: 'Audit Status ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: false,
    source: 'audit',
    fieldPath: 'audit_status_id',
    allowedOperators: OBJECT_ID_OPERATORS,
    filterOnly: true
  },

  // OTA Review Status
  auditStatus: {
    key: 'auditStatus',
    label: 'OTA Review Status',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'auditStatus',
    fieldPath: 'auditStatus.status',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [AUDIT_STATUS_LOOKUP]
  },

  // Start Date
  startDate: {
    key: 'startDate',
    label: 'Start Date',
    dataType: ColumnDataType.DATE,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: 'start_date',
    allowedOperators: DATE_OPERATORS
  },

  // End Date
  endDate: {
    key: 'endDate',
    label: 'End Date',
    dataType: ColumnDataType.DATE,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: 'end_date',
    allowedOperators: DATE_OPERATORS
  },

  // Next Due Date
  nextDueDate: {
    key: 'nextDueDate',
    label: 'Next Due Date',
    dataType: ColumnDataType.DATE,
    filterable: true,
    sortable: true,
    source: 'property',
    fieldPath: 'property.next_due_date',
    allowedOperators: DATE_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP]
  },

  // Currency ID (for filtering only)
  currencyId: {
    key: 'currencyId',
    label: 'Currency ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: false,
    source: 'property',
    fieldPath: 'property.currency_id',
    allowedOperators: OBJECT_ID_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP],
    filterOnly: true
  },

  // Currency
  currency: {
    key: 'currency',
    label: 'Currency',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'currency',
    fieldPath: 'currency.code',
    allowedOperators: [FilterOperator.EQ, FilterOperator.IN, FilterOperator.NEQ],
    requiresLookup: [PROPERTY_LOOKUP, CURRENCY_LOOKUP]
  },

  // Amount Collectable
  amountCollectable: {
    key: 'amountCollectable',
    label: 'Amount Collectable',
    dataType: ColumnDataType.NUMBER,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: 'amount_collectable',
    allowedOperators: NUMBER_OPERATORS
  },

  // Amount Confirmed
  amountConfirmed: {
    key: 'amountConfirmed',
    label: 'Amount Confirmed',
    dataType: ColumnDataType.NUMBER,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: 'amount_confirmed',
    allowedOperators: NUMBER_OPERATORS
  },

  // Portfolio Contact Email
  portfolioContactEmail: {
    key: 'portfolioContactEmail',
    label: 'Portfolio Contact Email',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'portfolio',
    fieldPath: 'portfolio.contact_email',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, PORTFOLIO_LOOKUP]
  },

  // OTA Username (computed - not directly filterable)
  otaUsername: {
    key: 'otaUsername',
    label: 'OTA Username',
    dataType: ColumnDataType.STRING,
    filterable: false,
    sortable: false,
    source: 'credentials',
    fieldPath: 'credentials.expedia_username',
    allowedOperators: []
  },

  // OTA Password (computed - not directly filterable)
  otaPassword: {
    key: 'otaPassword',
    label: 'OTA Password',
    dataType: ColumnDataType.STRING,
    filterable: false,
    sortable: false,
    source: 'credentials',
    fieldPath: 'credentials.expedia_password',
    allowedOperators: []
  }
}

/**
 * Get column metadata by key
 */
export function getColumnMetadata(key: string): ColumnMetadata | undefined {
  return REPORT_COLUMNS[key]
}

/**
 * Get all filterable columns
 */
export function getFilterableColumns(): ColumnMetadata[] {
  return Object.values(REPORT_COLUMNS).filter(col => col.filterable)
}

/**
 * Get all sortable columns
 */
export function getSortableColumns(): ColumnMetadata[] {
  return Object.values(REPORT_COLUMNS).filter(col => col.sortable)
}

/**
 * Get all column keys
 */
export function getAllColumnKeys(): string[] {
  return Object.keys(REPORT_COLUMNS)
}

/**
 * Validate if a column key exists
 */
export function isValidColumnKey(key: string): boolean {
  return key in REPORT_COLUMNS
}

/**
 * Get required lookups for a set of column keys
 * Returns unique lookups in correct dependency order
 */
export function getRequiredLookups(columnKeys: string[]): LookupConfig[] {
  const lookupMap = new Map<string, LookupConfig>()

  for (const key of columnKeys) {
    const col = REPORT_COLUMNS[key]
    if (col?.requiresLookup) {
      for (const lookup of col.requiresLookup) {
        if (!lookupMap.has(lookup.as)) {
          lookupMap.set(lookup.as, lookup)
        }
      }
    }
  }

  // Return lookups in dependency order
  const orderedLookups: LookupConfig[] = []
  const lookupOrder = [
    'auditStatus',
    'property',
    'credentials',
    'portfolio',
    'currency',
    'serviceType'
  ]

  for (const lookupName of lookupOrder) {
    if (lookupMap.has(lookupName)) {
      orderedLookups.push(lookupMap.get(lookupName)!)
    }
  }

  return orderedLookups
}
