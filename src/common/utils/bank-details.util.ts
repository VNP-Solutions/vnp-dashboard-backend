/**
 * Numeric/sensitive bank detail fields that should be masked
 * to show only the last 4 characters in list/detail responses.
 */
const MASKED_BANK_FIELDS = [
  'account_number',
  'iban_number',
  'swift_bic_number',
  'routing_number',
  'bank_wiring_routing_number'
] as const

/**
 * Masks sensitive numeric fields in a bank details object,
 * showing only the last 4 characters prefixed with asterisks.
 * Returns null when bankDetails is null/undefined.
 */
export function maskBankDetails<T extends Record<string, unknown>>(
  bankDetails: T | null | undefined
): T | null {
  if (!bankDetails) return null

  const masked: Record<string, unknown> = { ...bankDetails }

  for (const field of MASKED_BANK_FIELDS) {
    const value = masked[field]
    if (value && typeof value === 'string' && value.length > 0) {
      const last4 = value.slice(-4)
      masked[field] = `****${last4}`
    }
  }

  return masked as T
}
