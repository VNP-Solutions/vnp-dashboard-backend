import { BadRequestException } from '@nestjs/common'
import * as XLSX from 'xlsx'

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

/**
 * Use formatted cell values (not raw numbers) where SheetJS provides them (`raw: false`),
 * so number formats like nine-digit routing with leading zeros are preserved when the
 * workbook stores them correctly. This does **not** recover leading zeros once Excel has
 * already stored an account-only column as a plain number—in that case format those
 * spreadsheet columns as **Text** before entry, or the value cannot be reconstructed.
 *
 * Matches {@link parseSpreadsheetAllSheetsToJson} and bulk bank/property imports.
 */
const SHEET_TO_JSON_OPTS: XLSX.Sheet2JSONOpts = { raw: false, defval: null }

/**
 * **US routing / wiring routing columns only.** Excel numeric cells drop leading zeros;
 * after import, all-digit strings shorter than 9 are left-padded to 9 (fixed ABA width).
 *
 * Do **not** use this for variable-length fields such as `account_number` — width is unknown
 * and padding would corrupt data.
 */
export function normalizeUsRoutingNumberFromSpreadsheet(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  if (/^\d+$/.test(trimmed) && trimmed.length < 9) {
    return trimmed.padStart(9, '0')
  }
  return trimmed
}

/** True if the value is exactly 9 digits (after trim). */
export function isNineDigitUsRoutingNumber(
  value: string | undefined | null
): boolean {
  if (value === undefined || value === null) {
    return false
  }
  return /^\d{9}$/.test(value.trim())
}

/**
 * Validates that the uploaded file is a supported spreadsheet format (.xlsx, .xls, or .csv).
 * @throws BadRequestException if file format is not supported
 */
export function validateSpreadsheetFile(file: Express.Multer.File): void {
  const nameLower = file.originalname.toLowerCase()
  const hasValidExt = ALLOWED_EXTENSIONS.some(ext => nameLower.endsWith(ext))
  if (!hasValidExt) {
    throw new BadRequestException(
      'File must be an Excel or CSV file (.xlsx, .xls, or .csv)'
    )
  }
}

/**
 * Parses a spreadsheet file (Excel or CSV) and returns rows as array of objects.
 * Uses first row as headers. Works with .xlsx, .xls, and .csv.
 * Only reads the first sheet — use parseSpreadsheetAllSheetsToJson for multi-tab files.
 */
export function parseSpreadsheetToJson(file: Express.Multer.File): any[] {
  const isCsv = file.originalname.toLowerCase().endsWith('.csv')
  let workbook: XLSX.WorkBook

  if (isCsv) {
    workbook = XLSX.read(file.buffer.toString('utf-8'), { type: 'string' })
  } else {
    workbook = XLSX.read(file.buffer, { type: 'buffer' })
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new BadRequestException('File contains no worksheets')
  }

  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, SHEET_TO_JSON_OPTS)

  if (!data || data.length === 0) {
    throw new BadRequestException('File is empty or contains no data rows')
  }

  return data
}

export interface SheetData {
  sheetName: string
  data: any[]
}

/**
 * Parses all sheets from an Excel file and returns each sheet's data with its name.
 * For CSV files (single-sheet only), returns a single entry.
 * Skips sheets that are empty (no data rows).
 */
export function parseSpreadsheetAllSheetsToJson(
  file: Express.Multer.File
): SheetData[] {
  const isCsv = file.originalname.toLowerCase().endsWith('.csv')
  let workbook: XLSX.WorkBook

  if (isCsv) {
    workbook = XLSX.read(file.buffer.toString('utf-8'), { type: 'string' })
  } else {
    workbook = XLSX.read(file.buffer, { type: 'buffer' })
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new BadRequestException('File contains no worksheets')
  }

  const result: SheetData[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, SHEET_TO_JSON_OPTS)

    if (data && data.length > 0) {
      result.push({ sheetName, data })
    }
  }

  if (result.length === 0) {
    throw new BadRequestException('File is empty or contains no data rows')
  }

  return result
}
