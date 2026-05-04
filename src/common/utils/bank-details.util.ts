/**
 * Business-meaningful bank fields used for "did anything change?" before notifications.
 * Excludes id, property/portfolio id, associated_user_id, and timestamps.
 */
const BANK_DETAILS_COMPARABLE_FIELDS = [
  'bank_type',
  'bank_sub_type',
  'hotel_portfolio_name',
  'beneficiary_name',
  'beneficiary_address',
  'account_number',
  'account_name',
  'bank_name',
  'bank_branch',
  'iban_number',
  'swift_bic_number',
  'routing_number',
  'bank_wiring_routing_number',
  'bank_account_type',
  'currency',
  'stripe_account_email',
  'contact_name',
  'email_address',
  'bank_address',
  'comments'
] as const

export type ComparableBankDetails = {
  [K in (typeof BANK_DETAILS_COMPARABLE_FIELDS)[number]]: string | null
}

function normalizeComparableValue(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') {
    const t = value.trim()
    return t === '' ? null : t
  }
  return String(value)
}

/**
 * Normalizes a PropertyBankDetails or PortfolioBankDetails record (or null) for equality checks.
 * Missing rows are represented as an object with all fields null.
 */
export function toComparableBankDetails(
  row: Record<string, unknown> | null | undefined
): ComparableBankDetails {
  const out = {} as ComparableBankDetails
  for (const key of BANK_DETAILS_COMPARABLE_FIELDS) {
    out[key] = row ? normalizeComparableValue(row[key]) : null
  }
  return out
}

export function comparableBankDetailsEqual(
  a: ComparableBankDetails,
  b: ComparableBankDetails
): boolean {
  for (const key of BANK_DETAILS_COMPARABLE_FIELDS) {
    if (a[key] !== b[key]) return false
  }
  return true
}

/** ANSI blue for bank-details email decision logging (see logBankDetailsEmailComparison). */
const LOG_BLUE = '\x1b[34m'
const LOG_RESET = '\x1b[0m'

/**
 * Logs whether a bank-details notification will be attempted after comparing
 * before/after persisted data. Call this **before** {@link EmailUtil.sendBankDetailsUpdateEmail}
 * so the next line can be a deployment/skip line from the email util.
 */
export function logBankDetailsEmailComparison(
  context: string,
  willAttemptEmail: boolean,
  detail?: string
): void {
  if (willAttemptEmail) {
    console.log(
      `${LOG_BLUE}Bank details comparison [${context}]: persisted data changed — calling notification email. ` +
        `Next line may be \`[bank details email] Skipping send\` if DEPLOYMENT_ENV disallows it (e.g. staging).` +
        `${LOG_RESET}` +
        (detail ? ` ${detail}` : '')
    )
  } else {
    console.log(
      `${LOG_BLUE}Bank details comparison [${context}]: no change vs stored bank details — notification email not sent.${LOG_RESET}` +
        (detail ? ` ${detail}` : '')
    )
  }
}

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
