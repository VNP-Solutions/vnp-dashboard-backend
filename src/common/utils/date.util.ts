/**
 * Date Utility for Timezone Normalization
 *
 * This utility ensures all dates are stored and retrieved in UTC format,
 * preventing timezone-related issues when data is accessed from different countries.
 */

/**
 * Normalizes a date string or Date object to UTC
 * - For date-only strings (YYYY-MM-DD), sets time to 00:00:00 UTC
 * - For ISO strings with time, preserves the UTC time
 * - For Date objects, converts to UTC
 *
 * @param date - Date string, Date object, or null/undefined
 * @returns Date object in UTC or null
 */
export function normalizeToUTC(date: string | Date | null | undefined): Date | null {
  if (!date) return null

  // If already a Date object, convert to UTC
  if (date instanceof Date) {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    ))
  }

  // If it's a string, parse it
  const dateStr = String(date).trim()

  // Check if it's a date-only string (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number)
    // Create date in UTC (month is 0-indexed in Date constructor)
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  }

  // For ISO strings or other date formats, parse and convert to UTC
  const parsed = new Date(dateStr)
  if (isNaN(parsed.getTime())) {
    return null // Invalid date
  }

  return new Date(parsed.toISOString())
}

/**
 * Converts a Date to ISO 8601 string in UTC format
 * Always returns with 'Z' suffix to indicate UTC
 *
 * @param date - Date object or null/undefined
 * @returns ISO 8601 string or null
 */
export function toISOStringUTC(date: Date | null | undefined): string | null {
  if (!date) return null

  // Ensure we're working with a Date object
  const dateObj = date instanceof Date ? date : new Date(date)

  // Return ISO string with Z suffix (UTC)
  return dateObj.toISOString()
}

/**
 * Converts a Date to ISO 8601 date-only string (YYYY-MM-DD) in UTC
 *
 * @param date - Date object or null/undefined
 * @returns Date-only string (YYYY-MM-DD) or null
 */
export function toISODateOnlyUTC(date: Date | null | undefined): string | null {
  if (!date) return null

  // Ensure we're working with a Date object
  const dateObj = date instanceof Date ? date : new Date(date)

  // Return YYYY-MM-DD format in UTC
  return dateObj.toISOString().split('T')[0]
}

/**
 * Class-transformer transformer for normalizing incoming dates to UTC
 * Use this in DTOs with @Transform decorator
 *
 * @example
 * @ApiProperty()
 * @IsDateString()
 * @Transform(({ value }) => normalizeDateTransform(value))
 * start_date?: Date
 */
export function normalizeDateTransform(
  value: any
): Date | null | undefined {
  if (value === null || value === undefined) {
    return value
  }

  return normalizeToUTC(value)
}

/**
 * Class-transformer transformer for outputting dates in UTC format
 * Use this in DTOs with @Transform decorator for serialization
 *
 * @example
 * @ApiProperty()
 * @Transform(({ value }) => serializeDateTransform(value), { toClassOnly: false })
 * start_date?: string
 */
export function serializeDateTransform(
  value: any
): string | null {
  return toISOStringUTC(value)
}

/**
 * Validates if a date string is in a valid format
 * Accepts YYYY-MM-DD or ISO 8601 formats
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false

  const trimmed = dateStr.trim()

  // Check for date-only format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed)
    return !isNaN(date.getTime())
  }

  // Check for ISO 8601 format
  const date = new Date(trimmed)
  return !isNaN(date.getTime()) && !isNaN(Date.parse(trimmed))
}

/**
 * Gets the current date and time in UTC
 */
export function nowUTC(): Date {
  return new Date()
}

/**
 * Gets the current date (no time) in UTC
 */
export function todayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0
  ))
}
