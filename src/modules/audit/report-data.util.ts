/**
 * Canonical keys and normalization for audit report_data rows.
 * Known sheet headers map to fixed schema keys; unknown headers become snake_case.
 */

export const REPORT_DATA_SCHEMA_KEYS = [
  'ota',
  'hotel_id',
  'batch',
  'review_collection_date',
  'portfolio',
  'hotel_name',
  'reservation_id',
  'status',
  'name',
  'check_in',
  'check_out',
  'currency',
  'amount_collected',
  'due_to_property',
  'due_to_vnp'
] as const

export type ReportDataSchemaKey = (typeof REPORT_DATA_SCHEMA_KEYS)[number]

const REPORT_DATA_FIELD_ALIASES: Record<string, ReportDataSchemaKey | string> =
  {
    ota: 'ota',

    'hotel id': 'hotel_id',
    hotel_id: 'hotel_id',
    hotelid: 'hotel_id',

    batch: 'batch',
    'batch no': 'batch',
    'batch no.': 'batch',
    batch_no: 'batch',

    'review/collection date': 'review_collection_date',
    'review collection date': 'review_collection_date',
    review_collection_date: 'review_collection_date',

    portfolio: 'portfolio',
    'portfolio name': 'portfolio',
    portfolio_name: 'portfolio',

    'hotel name': 'hotel_name',
    hotel_name: 'hotel_name',
    hotelname: 'hotel_name',
    'property name': 'hotel_name',
    property: 'hotel_name',
    property_name: 'hotel_name',

    'reservation id': 'reservation_id',
    reservation_id: 'reservation_id',
    reservationid: 'reservation_id',

    status: 'status',
    'audit status': 'status',
    audit_status: 'status',
    audit_status_id: 'status',

    name: 'name',
    'guest name': 'name',

    'check in': 'check_in',
    'check in (mm/dd/yyyy)': 'check_in',
    check_in: 'check_in',
    checkin: 'check_in',
    'check-in': 'check_in',
    'start date': 'check_in',

    'check out': 'check_out',
    'check out (mm/dd/yyyy)': 'check_out',
    check_out: 'check_out',
    checkout: 'check_out',
    'check-out': 'check_out',
    'end date': 'check_out',

    currency: 'currency',

    'amount collected': 'amount_collected',
    amount_collected: 'amount_collected',
    amountcollected: 'amount_collected',

    'due to property': 'due_to_property',
    due_to_property: 'due_to_property',

    'due to vnp': 'due_to_vnp',
    due_to_vnp: 'due_to_vnp'
  }

const REPORT_DATA_DATE_FIELDS = new Set<string>([
  'review_collection_date',
  'check_in',
  'check_out'
])

const normalizeHeaderLabel = (header: string): string =>
  header.replace(/\*+$/, '').trim()

const normalizeAliasLookupKey = (header: string): string =>
  normalizeHeaderLabel(header).toLowerCase()

export const toSnakeCaseKey = (header: string): string =>
  normalizeHeaderLabel(header)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s/\-]+/g, '_')
    .replace(/[^\w]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()

export const toReportDataKey = (header: string): string => {
  const aliasKey = normalizeAliasLookupKey(header)
  const mapped = REPORT_DATA_FIELD_ALIASES[aliasKey]
  if (mapped) return mapped
  return toSnakeCaseKey(header)
}

export const isReportDataDateField = (key: string): boolean =>
  REPORT_DATA_DATE_FIELDS.has(key) || key.includes('date')

const parseCurrencyValue = (raw: string): number => {
  const cleaned = raw.replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

export const serializeReportDataValue = (
  key: string,
  raw: unknown,
  parseDate: (value: unknown) => Date | null
): unknown => {
  if (raw === undefined || raw === null || raw === '') return ''

  if (isReportDataDateField(key)) {
    if (raw instanceof Date) return raw.toISOString()
    const parsed = parseDate(raw)
    return parsed ? parsed.toISOString() : String(raw).trim()
  }

  if (typeof raw === 'number') return raw

  const str = String(raw).trim()
  if (str.includes('$')) {
    return parseCurrencyValue(str)
  }

  return str
}

export const buildReportDataRow = (
  row: Record<string, unknown>,
  headers: string[],
  parseDate: (value: unknown) => Date | null
): Record<string, unknown> =>
  Object.fromEntries(
    headers.map(header => {
      const key = toReportDataKey(header)
      return [key, serializeReportDataValue(key, row[header], parseDate)]
    })
  )
