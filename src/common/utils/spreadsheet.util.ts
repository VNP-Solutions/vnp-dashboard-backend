import { BadRequestException } from '@nestjs/common'
import * as XLSX from 'xlsx'

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

/**
 * Routing numbers are 9 digits here. Excel often stores them as numeric cells, which
 * drops leading zeros (e.g. 043306826 → 43306826). After sheet_to_json + String(value),
 * that becomes an 8-digit string and fails validation. Left-pad all-digit strings
 * shorter than 9 characters to recover the intended routing number.
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
  const data = XLSX.utils.sheet_to_json(worksheet)

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
    const data = XLSX.utils.sheet_to_json(worksheet)

    if (data && data.length > 0) {
      result.push({ sheetName, data })
    }
  }

  if (result.length === 0) {
    throw new BadRequestException('File is empty or contains no data rows')
  }

  return result
}
