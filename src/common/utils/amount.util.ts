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

export type AuditConfirmedAmounts = {
  expedia_amount_confirmed?: number | null
  agoda_amount_confirmed?: number | null
  booking_amount_confirmed?: number | null
}

export type AuditOtaType = 'expedia' | 'agoda' | 'booking'

export type AuditDerivedAmounts = {
  gross_total: number
  due_to_vnp: number
  due_to_property: number
}

function confirmedAmountForOta(
  typeOfOta: AuditOtaType[] | null | undefined,
  ota: AuditOtaType,
  amount: number | null | undefined
): number | null | undefined {
  const activeOtas = new Set(
    (typeOfOta ?? []).map(value => value.toLowerCase() as AuditOtaType)
  )

  if (!activeOtas.has(ota)) {
    return null
  }

  return amount
}

/**
 * Compute derived audit amounts from OTA confirmed amounts.
 * Only OTAs present in type_of_ota contribute to gross_total.
 * Missing confirmed values are treated as 0.
 * due_to_vnp = 15% of gross_total; due_to_property = 85% of gross_total.
 */
export function computeAuditDerivedAmounts(
  amounts: AuditConfirmedAmounts,
  typeOfOta?: AuditOtaType[] | null
): AuditDerivedAmounts {
  const gross_total = roundSum([
    confirmedAmountForOta(typeOfOta, 'expedia', amounts.expedia_amount_confirmed),
    confirmedAmountForOta(typeOfOta, 'agoda', amounts.agoda_amount_confirmed),
    confirmedAmountForOta(typeOfOta, 'booking', amounts.booking_amount_confirmed)
  ])

  return {
    gross_total,
    due_to_vnp: roundAmount(gross_total * 0.15),
    due_to_property: roundAmount(gross_total * 0.85)
  }
}

/**
 * Recalculate derived amounts when confirmed amounts or OTA types change.
 * Super-admin overrides persist until one of these fields is updated.
 */
export function shouldRecalculateAuditDerivedAmounts(data: {
  expedia_amount_confirmed?: number | null
  agoda_amount_confirmed?: number | null
  booking_amount_confirmed?: number | null
  type_of_ota?: unknown
}): boolean {
  return (
    data.expedia_amount_confirmed !== undefined ||
    data.agoda_amount_confirmed !== undefined ||
    data.booking_amount_confirmed !== undefined ||
    data.type_of_ota !== undefined
  )
}

export type ManualDerivedAmountInput = {
  gross_total?: number | null
  due_to_vnp?: number | null
  due_to_property?: number | null
}

/**
 * Apply a super-admin manual override and keep the three fields in balance:
 * - gross_total change → due_to_vnp = 15%, due_to_property = 85%
 * - due_to_vnp change → due_to_property = gross_total - due_to_vnp
 * - due_to_property change → due_to_vnp = gross_total - due_to_property
 * If both due fields are sent without a new gross_total, both values are kept.
 */
export function applyManualDerivedAmountOverrides(
  incoming: ManualDerivedAmountInput,
  current: AuditDerivedAmounts
): AuditDerivedAmounts | null {
  if (
    incoming.gross_total === undefined &&
    incoming.due_to_vnp === undefined &&
    incoming.due_to_property === undefined
  ) {
    return null
  }

  if (incoming.gross_total !== undefined) {
    const gross_total = roundAmount(incoming.gross_total)
    return {
      gross_total,
      due_to_vnp: roundAmount(gross_total * 0.15),
      due_to_property: roundAmount(gross_total * 0.85)
    }
  }

  const gross_total = roundAmount(current.gross_total)

  if (incoming.due_to_vnp !== undefined && incoming.due_to_property !== undefined) {
    return {
      gross_total,
      due_to_vnp: roundAmount(incoming.due_to_vnp),
      due_to_property: roundAmount(incoming.due_to_property)
    }
  }

  if (incoming.due_to_vnp !== undefined) {
    const due_to_vnp = roundAmount(incoming.due_to_vnp)
    return {
      gross_total,
      due_to_vnp,
      due_to_property: roundAmount(gross_total - due_to_vnp)
    }
  }

  const due_to_property = roundAmount(incoming.due_to_property)
  return {
    gross_total,
    due_to_vnp: roundAmount(gross_total - due_to_property),
    due_to_property
  }
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
  gross_total?: number | null
  due_to_vnp?: number | null
  due_to_property?: number | null
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

  if (audit.gross_total !== null && audit.gross_total !== undefined) {
    audit.gross_total = roundToDecimals(audit.gross_total)
  }

  if (audit.due_to_vnp !== null && audit.due_to_vnp !== undefined) {
    audit.due_to_vnp = roundToDecimals(audit.due_to_vnp)
  }

  if (audit.due_to_property !== null && audit.due_to_property !== undefined) {
    audit.due_to_property = roundToDecimals(audit.due_to_property)
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
