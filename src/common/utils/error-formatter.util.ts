/**
 * If the string contains a raw Prisma/DB unique constraint error, returns a formatted user-friendly message.
 * Otherwise returns the string unchanged. Used by ResponseInterceptor for global error sanitization.
 */
export function formatErrorStringIfNeeded(str: string): string {
  if (
    str.includes('Unique constraint failed') ||
    str.includes('duplicate key') ||
    str.includes('Invalid `this.prisma')
  ) {
    return formatErrorForUser(new Error(str))
  }
  return str
}

/**
 * Formats raw error messages into short, user-friendly strings for API responses.
 * Used by bulk operations and the global exception filter.
 */
export function formatErrorForUser(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : error != null && typeof error !== 'object'
        ? String(error as string | number | boolean)
        : 'Unknown error'

  if (
    message.includes('Unique constraint failed') ||
    message.includes('duplicate key')
  ) {
    return formatUniqueConstraintError(message)
  }

  return message
}

/**
 * Formats unique constraint errors into short, user-friendly messages.
 * Handles both Prisma "Unique constraint failed" and MongoDB "duplicate key" formats.
 */
function formatUniqueConstraintError(errorMessage: string): string {
  const fieldLabel = parseUniqueConstraintFromMessage(errorMessage)

  if (fieldLabel !== 'value') {
    return `A record with this ${fieldLabel} already exists. Please use a different value.`
  }

  const duplicateMatch = errorMessage.match(
    /duplicate key error.*?index: (\w+)/i
  )
  if (duplicateMatch) {
    return `A record with this ${toReadableFieldName(duplicateMatch[1])} already exists. Please use a different value.`
  }

  return 'This value is already in use. Please provide a different one.'
}

/**
 * Parses Prisma unique constraint error formats:
 * - `PropertyCredentials_expedia_id_key` (constraint name)
 * - `fields: (\`fieldName\`)` (field name in meta)
 */
function parseUniqueConstraintFromMessage(errorMessage: string): string {
  // Format: Unique constraint failed on the constraint: `ModelName_field_key`
  // Model names are PascalCase (no underscores); field names are snake_case
  const constraintMatch = errorMessage.match(
    /Unique constraint failed on the constraint:\s*`?[A-Z][a-zA-Z0-9]*_([a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*)_key`?/
  )
  if (constraintMatch) {
    return toReadableFieldName(constraintMatch[1])
  }

  // Format: Unique constraint failed on the fields: (`fieldName`)
  const fieldsMatch = errorMessage.match(
    /Unique constraint failed on the fields?:\s*\([`']?(\w+)[`']?\)/
  )
  if (fieldsMatch) {
    return toReadableFieldName(fieldsMatch[1])
  }

  return 'value'
}

/**
 * Converts snake_case field names to readable labels (e.g., expedia_id -> "Expedia ID")
 */
function toReadableFieldName(fieldName: string): string {
  const knownLabels: Record<string, string> = {
    expedia_id: 'Expedia ID',
    agoda_id: 'Agoda ID',
    booking_id: 'Booking ID',
    property_id: 'Property',
    email: 'email',
    portfolio_id: 'Portfolio'
  }

  if (knownLabels[fieldName]) {
    return knownLabels[fieldName]
  }

  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
