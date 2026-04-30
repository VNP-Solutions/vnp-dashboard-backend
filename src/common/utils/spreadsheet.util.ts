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
 * Also expands scientific-notation display labels from Excel (see {@link spreadsheetCellValueToPlainString}).
 */
const SHEET_TO_JSON_OPTS: XLSX.Sheet2JSONOpts = { raw: false, defval: null }

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
 * Parses scientific strings like `2.35E+13` into a plain digit string via BigInteger
 * arithmetic. Returns `null` when the token is not scientific notation.
 */
function expandScientificNotationString(input: string): string | null {
  const trimmed = input.trim().replace(/,/g, '')
  const sci = /^([+-]?)(\d+)\.?(\d*)[eE]([+-]?\d+)$/i.exec(trimmed)
  if (!sci) {
    return null
  }
  const signNeg = sci[1] === '-'
  const fracPart = sci[3] ?? ''
  const coefDigitsJoined = sci[2] + fracPart
  const fracLen = fracPart.length
  let expParsed: bigint
  try {
    expParsed = BigInt(sci[4])
  } catch {
    return null
  }

  let coefDigitsNorm = coefDigitsJoined.replace(/^0+(?=\d)/, '')
  if (!coefDigitsNorm) {
    coefDigitsNorm = '0'
  }
  let coef: bigint
  try {
    coef = BigInt(coefDigitsNorm)
  } catch {
    return null
  }

  const adjustedPow = expParsed - BigInt(fracLen)
  const absPow = adjustedPow >= 0n ? adjustedPow : -adjustedPow

  if (!Number.isSafeInteger(Number(absPow))) {
    return null
  }

  const absPowN = Number(absPow)
  const multiplyMagByPositivePow10 = (magStr: string, pow10: number): string => {
    return magStr + '0'.repeat(pow10)
  }

  const divideMagByPositivePow10 = (magStr: string, pow10: number): string => {
    if (magStr === '0') {
      return '0'
    }
    if (pow10 >= magStr.length) {
      return `0.${'0'.repeat(pow10 - magStr.length)}${magStr}`
    }
    const splitIdx = magStr.length - pow10
    return `${magStr.slice(0, splitIdx)}.${magStr.slice(splitIdx)}`
  }

  const magStr = coef.toString()

  let unsignedResult: string
  if (adjustedPow >= 0n) {
    unsignedResult = multiplyMagByPositivePow10(magStr, absPowN)
  } else {
    unsignedResult = divideMagByPositivePow10(magStr, absPowN)
    if (unsignedResult.endsWith('.')) {
      unsignedResult = unsignedResult.slice(0, -1)
    }
    if (/^\.\d/.test(unsignedResult)) {
      unsignedResult = `0${unsignedResult}`
    }
  }

  if (coef === 0n) {
    return '0'
  }
  return signNeg ? `-${unsignedResult}` : unsignedResult
}

/**
 * Normalizes spreadsheet cell strings for identifiers: strips grouping commas,
 * expands scientific notation to full digit strings where applicable.
 *
 * Cells stored in Excel purely as doubles can still exceed {@link Number.MAX_SAFE_INTEGER}
 * and lose precision prior to SheetJS parsing—format those columns as Text when needed.
 */
export function spreadsheetCellValueToPlainString(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') {
    return ''
  }
  if (typeof raw === 'bigint') {
    return raw.toString()
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return ''
    }
    if (Number.isInteger(raw)) {
      if (Number.isSafeInteger(raw)) {
        return String(raw)
      }
      try {
        return BigInt(raw).toString()
      } catch {
        // continue with string / exponential path
      }
    }
    const plain = String(raw)
    const noComma = plain.replace(/,/g, '').trim()
    if (/[eE][+-]?\d+/.test(noComma)) {
      const expanded = expandScientificNotationString(noComma)
      return expanded ?? noComma
    }
    return noComma
  }
  if (typeof raw === 'boolean') {
    return raw ? 'true' : 'false'
  }
  if (typeof raw === 'object' && raw !== null) {
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      return spreadsheetCellValueToPlainString(raw.getTime())
    }
    return ''
  }

  if (typeof raw === 'string') {
    const s = raw.trim().replace(/,/g, '')
    const expanded = expandScientificNotationString(s)
    return expanded ?? s
  }

  return ''
}

/**
 * Rows SheetJS still emits for blank lines inside the worksheet "used range" (often all
 * `null` / empty strings). These should not be treated as failed import rows.
 */
export function isSpreadsheetRowWhollyEmpty(
  row: Record<string, unknown>
): boolean {
  for (const key of Object.keys(row)) {
    const v = row[key]
    if (v === undefined || v === null) {
      continue
    }
    if (typeof v === 'string') {
      if (v.trim() !== '') {
        return false
      }
      continue
    }
    if (typeof v === 'number' && !Number.isNaN(v)) {
      return false
    }
    if (typeof v === 'bigint') {
      return false
    }
    if (typeof v === 'boolean') {
      return false
    }
    return false
  }
  return true
}

/** Drops header-only / blank placeholder rows from `sheet_to_json` output. */
export function filterWhollyEmptySpreadsheetRows<T extends Record<string, unknown>>(
  rows: T[]
): T[] {
  return rows.filter(row => !isSpreadsheetRowWhollyEmpty(row))
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
