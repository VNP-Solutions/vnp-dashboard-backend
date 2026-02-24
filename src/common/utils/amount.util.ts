/**
 * Utility functions for handling monetary amounts
 * Ensures consistent rounding to 2 decimal places for all financial values
 */

/**
 * Round a number to 2 decimal places
 * Uses Math.round to avoid floating-point precision issues
 * @param value - The number to round
 * @returns The number rounded to 2 decimal places, or null if input is null/undefined
 */
export function roundToDecimals(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  // Handle NaN and Infinity
  if (!Number.isFinite(value)) {
    return null
  }

  // Round to 2 decimal places using Math.round to avoid floating-point issues
  // Example: 123.456 -> 123.46, 123.454 -> 123.45
  return Math.round(value * 100) / 100
}

/**
 * Round all amount fields in an audit object to 2 decimal places
 * @param audit - Audit object with OTA-specific amount fields
 * @returns The same audit object with rounded amounts
 */
export function roundAuditAmounts<T extends {
  expedia_amount_collectable?: number | null
  expedia_amount_confirmed?: number | null
  agoda_amount_collectable?: number | null
  agoda_amount_confirmed?: number | null
  booking_amount_collectable?: number | null
  booking_amount_confirmed?: number | null
}>(audit: T): T {
  if (audit.expedia_amount_collectable !== null && audit.expedia_amount_collectable !== undefined) {
    audit.expedia_amount_collectable = roundToDecimals(audit.expedia_amount_collectable)
  }

  if (audit.expedia_amount_confirmed !== null && audit.expedia_amount_confirmed !== undefined) {
    audit.expedia_amount_confirmed = roundToDecimals(audit.expedia_amount_confirmed)
  }

  if (audit.agoda_amount_collectable !== null && audit.agoda_amount_collectable !== undefined) {
    audit.agoda_amount_collectable = roundToDecimals(audit.agoda_amount_collectable)
  }

  if (audit.agoda_amount_confirmed !== null && audit.agoda_amount_confirmed !== undefined) {
    audit.agoda_amount_confirmed = roundToDecimals(audit.agoda_amount_confirmed)
  }

  if (audit.booking_amount_collectable !== null && audit.booking_amount_collectable !== undefined) {
    audit.booking_amount_collectable = roundToDecimals(audit.booking_amount_collectable)
  }

  if (audit.booking_amount_confirmed !== null && audit.booking_amount_confirmed !== undefined) {
    audit.booking_amount_confirmed = roundToDecimals(audit.booking_amount_confirmed)
  }

  return audit
}

/**
 * Round sum of amounts to 2 decimal places
 * Useful for aggregations and statistics
 * @param values - Array of numbers to sum and round
 * @returns The sum rounded to 2 decimal places
 */
export function roundSum(values: (number | null | undefined)[]): number {
  const sum = values.reduce((acc: number, val) => acc + (val || 0), 0)
  return roundToDecimals(sum) || 0
}

/**
 * Round a single value for display in statistics/response DTOs
 * @param value - The value to round
 * @returns The value rounded to 2 decimal places, or 0 if null/undefined
 */
export function roundAmount(value: number | null | undefined): number {
  return roundToDecimals(value) || 0
}
