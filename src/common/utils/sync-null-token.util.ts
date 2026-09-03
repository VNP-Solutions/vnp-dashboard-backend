/**
 * The DBMS sends the literal string 'NULL' for a column one of its bulk uploads
 * cleared. Its sync payloads omit any key they don't carry a value for, and an
 * omitted key means "leave the stored value alone" here — so a deliberate clear
 * has to arrive as something other than an absent key, and this token is it.
 */
export const SYNC_NULL_TOKEN = 'NULL'

export function isSyncNullToken(value: unknown): boolean {
  return (
    typeof value === 'string' && value.trim().toUpperCase() === SYNC_NULL_TOKEN
  )
}

/**
 * Normalizes a synced text field for storage: a cleared field and an empty one
 * both become `null`.
 */
export function syncedText(
  value: string | number | null | undefined
): string | null {
  if (value === null || value === undefined || isSyncNullToken(value)) {
    return null
  }
  return String(value).trim() || null
}
