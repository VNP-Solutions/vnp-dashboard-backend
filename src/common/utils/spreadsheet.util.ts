import { BadRequestException } from '@nestjs/common'
import * as XLSX from 'xlsx'

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

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
