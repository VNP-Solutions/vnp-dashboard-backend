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
  | 'bankDetails'
  | 'auditStatus'
  | 'batch'
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

const BOOLEAN_OPERATORS = [FilterOperator.EQ]

const OBJECT_ID_OPERATORS = [FilterOperator.EQ, FilterOperator.IN]

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

const CREDENTIALS_LOOKUP: LookupConfig = {
  from: 'PropertyCredentials',
  localField: 'property._id',
  foreignField: 'property_id',
  as: 'credentials'
}

const BANK_DETAILS_LOOKUP: LookupConfig = {
  from: 'PropertyBankDetails',
  localField: 'property._id',
  foreignField: 'property_id',
  as: 'bankDetails'
}

const AUDIT_STATUS_LOOKUP: LookupConfig = {
  from: 'AuditStatus',
  localField: 'audit_status_id',
  foreignField: '_id',
  as: 'auditStatus'
}

const BATCH_LOOKUP: LookupConfig = {
  from: 'AuditBatch',
  localField: 'batch_id',
  foreignField: '_id',
  as: 'batch'
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
 */
export const REPORT_COLUMNS: Record<string, ColumnMetadata> = {
  // ==================== AUDIT FIELDS (no lookup needed) ====================

  auditId: {
    key: 'auditId',
    label: 'Audit ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: '_id',
    allowedOperators: OBJECT_ID_OPERATORS
  },

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

  isArchived: {
    key: 'isArchived',
    label: 'Is Archived',
    dataType: ColumnDataType.BOOLEAN,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: 'is_archived',
    allowedOperators: BOOLEAN_OPERATORS
  },

  auditCreatedAt: {
    key: 'auditCreatedAt',
    label: 'Audit Created At',
    dataType: ColumnDataType.DATE,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: 'created_at',
    allowedOperators: DATE_OPERATORS
  },

  auditUpdatedAt: {
    key: 'auditUpdatedAt',
    label: 'Audit Updated At',
    dataType: ColumnDataType.DATE,
    filterable: true,
    sortable: true,
    source: 'audit',
    fieldPath: 'updated_at',
    allowedOperators: DATE_OPERATORS
  },

  reportUrl: {
    key: 'reportUrl',
    label: 'Report URL',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: false,
    source: 'audit',
    fieldPath: 'report_url',
    allowedOperators: [
      FilterOperator.EQ,
      FilterOperator.CONTAINS,
      FilterOperator.IS_NULL,
      FilterOperator.IS_NOT_NULL
    ]
  },

  // ==================== AUDIT STATUS (requires lookup) ====================

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

  auditStatusId: {
    key: 'auditStatusId',
    label: 'Audit Status ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: false,
    source: 'audit',
    fieldPath: 'audit_status_id',
    allowedOperators: OBJECT_ID_OPERATORS
  },

  // ==================== BATCH (requires lookup) ====================

  batchNo: {
    key: 'batchNo',
    label: 'Batch No',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'batch',
    fieldPath: 'batch.batch_no',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [BATCH_LOOKUP]
  },

  batchId: {
    key: 'batchId',
    label: 'Batch ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: false,
    source: 'audit',
    fieldPath: 'batch_id',
    allowedOperators: [...OBJECT_ID_OPERATORS, FilterOperator.IS_NULL, FilterOperator.IS_NOT_NULL]
  },

  // ==================== PROPERTY (requires lookup) ====================

  propertyId: {
    key: 'propertyId',
    label: 'Property ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: false,
    source: 'audit',
    fieldPath: 'property_id',
    allowedOperators: OBJECT_ID_OPERATORS
  },

  propertyName: {
    key: 'propertyName',
    label: 'Property Name',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'property',
    fieldPath: 'property.name',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP]
  },

  propertyAddress: {
    key: 'propertyAddress',
    label: 'Property Address',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'property',
    fieldPath: 'property.address',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP]
  },

  propertyIsActive: {
    key: 'propertyIsActive',
    label: 'Property Active',
    dataType: ColumnDataType.BOOLEAN,
    filterable: true,
    sortable: false,
    source: 'property',
    fieldPath: 'property.is_active',
    allowedOperators: BOOLEAN_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP]
  },

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

  cardDescriptor: {
    key: 'cardDescriptor',
    label: 'Card Descriptor',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'property',
    fieldPath: 'property.card_descriptor',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP]
  },

  // ==================== CURRENCY (requires property + currency lookup) ====================

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

  currencyName: {
    key: 'currencyName',
    label: 'Currency Name',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: false,
    source: 'currency',
    fieldPath: 'currency.name',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, CURRENCY_LOOKUP]
  },

  // ==================== PORTFOLIO (requires property + portfolio lookup) ====================

  portfolioId: {
    key: 'portfolioId',
    label: 'Portfolio ID',
    dataType: ColumnDataType.OBJECT_ID,
    filterable: true,
    sortable: false,
    source: 'property',
    fieldPath: 'property.portfolio_id',
    allowedOperators: OBJECT_ID_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP]
  },

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

  portfolioIsActive: {
    key: 'portfolioIsActive',
    label: 'Portfolio Active',
    dataType: ColumnDataType.BOOLEAN,
    filterable: true,
    sortable: false,
    source: 'portfolio',
    fieldPath: 'portfolio.is_active',
    allowedOperators: BOOLEAN_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, PORTFOLIO_LOOKUP]
  },

  portfolioIsCommissionable: {
    key: 'portfolioIsCommissionable',
    label: 'Is Commissionable',
    dataType: ColumnDataType.BOOLEAN,
    filterable: true,
    sortable: false,
    source: 'portfolio',
    fieldPath: 'portfolio.is_commissionable',
    allowedOperators: BOOLEAN_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, PORTFOLIO_LOOKUP]
  },

  salesAgent: {
    key: 'salesAgent',
    label: 'Sales Agent',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'portfolio',
    fieldPath: 'portfolio.sales_agent',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, PORTFOLIO_LOOKUP]
  },

  // ==================== SERVICE TYPE (requires property + portfolio + serviceType lookup) ====================

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

  // ==================== CREDENTIALS - OTA IDs and Usernames (NO passwords) ====================

  expediaId: {
    key: 'expediaId',
    label: 'Expedia ID',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'credentials',
    fieldPath: 'credentials.expedia_id',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, CREDENTIALS_LOOKUP]
  },

  expediaUsername: {
    key: 'expediaUsername',
    label: 'Expedia Username',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: false,
    source: 'credentials',
    fieldPath: 'credentials.expedia_username',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, CREDENTIALS_LOOKUP]
  },

  agodaId: {
    key: 'agodaId',
    label: 'Agoda ID',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'credentials',
    fieldPath: 'credentials.agoda_id',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, CREDENTIALS_LOOKUP]
  },

  agodaUsername: {
    key: 'agodaUsername',
    label: 'Agoda Username',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: false,
    source: 'credentials',
    fieldPath: 'credentials.agoda_username',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, CREDENTIALS_LOOKUP]
  },

  bookingId: {
    key: 'bookingId',
    label: 'Booking ID',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: true,
    source: 'credentials',
    fieldPath: 'credentials.booking_id',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, CREDENTIALS_LOOKUP]
  },

  bookingUsername: {
    key: 'bookingUsername',
    label: 'Booking Username',
    dataType: ColumnDataType.STRING,
    filterable: true,
    sortable: false,
    source: 'credentials',
    fieldPath: 'credentials.booking_username',
    allowedOperators: STRING_OPERATORS,
    requiresLookup: [PROPERTY_LOOKUP, CREDENTIALS_LOOKUP]
  },

  // ==================== BANK DETAILS - bank_type only (NO sensitive data) ====================

  bankType: {
    key: 'bankType',
    label: 'Bank Type',
    dataType: ColumnDataType.ENUM,
    filterable: true,
    sortable: false,
    source: 'bankDetails',
    fieldPath: 'bankDetails.bank_type',
    allowedOperators: ENUM_OPERATORS,
    enumValues: ['bank', 'stripe'],
    requiresLookup: [PROPERTY_LOOKUP, BANK_DETAILS_LOOKUP]
  },

  bankSubType: {
    key: 'bankSubType',
    label: 'Bank Sub Type',
    dataType: ColumnDataType.ENUM,
    filterable: true,
    sortable: false,
    source: 'bankDetails',
    fieldPath: 'bankDetails.bank_sub_type',
    allowedOperators: ENUM_OPERATORS,
    enumValues: ['ach', 'domestic_wire', 'international_wire'],
    requiresLookup: [PROPERTY_LOOKUP, BANK_DETAILS_LOOKUP]
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
    'batch',
    'property',
    'credentials',
    'bankDetails',
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
