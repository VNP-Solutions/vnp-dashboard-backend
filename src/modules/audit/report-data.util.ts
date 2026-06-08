/**
 * Canonical keys and normalization for audit report_data rows.
 * Known sheet headers map to fixed schema keys; unknown headers become snake_case.
 */

import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'
import { filterWhollyEmptySpreadsheetRows } from '../../common/utils/spreadsheet.util'

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

export const parseReportDate = (raw: unknown): Date | null => {
  if (!raw) return null

  const isValidYear = (d: Date): boolean =>
    !isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100

  const fromExcelSerial = (serial: number): Date | null => {
    const date = new Date(
      new Date(1899, 11, 30).getTime() + serial * 24 * 60 * 60 * 1000
    )
    return isValidYear(date) ? date : null
  }

  if (raw instanceof Date) return isValidYear(raw) ? raw : null
  if (typeof raw === 'number') return fromExcelSerial(raw)

  const s = String(raw).trim()
  const slashParts = s.split('/')
  if (slashParts.length === 3) {
    const [a, b, y] = slashParts.map(Number)
    if (!isNaN(a) && !isNaN(b) && !isNaN(y) && y >= 1900 && y <= 2100) {
      if (a > 12) return new Date(y, b - 1, a)
      if (b > 12) return new Date(y, a - 1, b)
      return new Date(y, a - 1, b)
    }
  }

  const numericSerial = Number(s)
  if (Number.isInteger(numericSerial) && numericSerial > 0) {
    const result = fromExcelSerial(numericSerial)
    if (result) return result
  }

  const dt = new Date(s)
  return isValidYear(dt) ? dt : null
}

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
  parseDate: (value: unknown) => Date | null = parseReportDate
): Record<string, unknown> =>
  Object.fromEntries(
    headers.map(header => {
      const key = toReportDataKey(header)
      return [key, serializeReportDataValue(key, row[header], parseDate)]
    })
  )

export const buildReportDataFromSheetRows = (
  rows: Record<string, unknown>[]
): Record<string, unknown>[] => {
  if (rows.length === 0) return []
  const headers = Object.keys(rows[0])
  return rows.map(row => buildReportDataRow(row, headers))
}

export const isMissingReportData = (
  value: Prisma.JsonValue | null | undefined
): boolean => value === null || value === undefined

export async function downloadReportFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download report (${response.status})`)
  }

  return Buffer.from(await response.arrayBuffer())
}

export function parseReportWorkbookFromBuffer(
  buffer: Buffer,
  reportUrl: string
): Record<string, unknown>[] {
  const isCsv = reportUrl.toLowerCase().split('?')[0].endsWith('.csv')
  const workbook = isCsv
    ? XLSX.read(buffer.toString('utf-8'), { type: 'string' })
    : XLSX.read(buffer, { type: 'buffer' })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('Report file contains no worksheets')
  }

  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: null
  }) as Record<string, unknown>[]

  const dataRows = filterWhollyEmptySpreadsheetRows(rows)
  if (dataRows.length === 0) {
    throw new Error('Report file contains no data rows')
  }

  return dataRows
}

export async function buildReportDataFromReportUrl(
  reportUrl: string
): Promise<Record<string, unknown>[]> {
  const buffer = await downloadReportFromUrl(reportUrl)
  const sheetRows = parseReportWorkbookFromBuffer(buffer, reportUrl)
  return buildReportDataFromSheetRows(sheetRows)
}
