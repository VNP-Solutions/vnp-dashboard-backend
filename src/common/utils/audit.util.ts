/**
 * Audit utility functions
 */

/**
 * List of archivable audit status names (exact match, case-sensitive)
 * These are the status names from the AuditStatus collection
 */
export const ARCHIVABLE_AUDIT_STATUSES = [
  'OTA POST Completed',
  'VCC Invoiced',
  'MOR completed and Invoiced',
  'Direct Bill Invoiced',
  'Nothing To Report'
]

/**
 * Check if an audit can be archived based on its status
 * @param auditStatus - The audit status name from the AuditStatus collection
 * @returns boolean - true if audit can be archived
 */
export function canArchiveAudit(auditStatus: string): boolean {
  const trimmedStatus = auditStatus.trim()
  return ARCHIVABLE_AUDIT_STATUSES.includes(trimmedStatus)
}

/**
 * Get all archivable statuses
 * @returns string[] - List of all archivable statuses
 */
export function getArchivableStatuses(): string[] {
  return [...ARCHIVABLE_AUDIT_STATUSES]
}

/**
 * Get error message for non-archivable audit
 * @param currentStatus - Current audit status
 * @returns string - Error message
 */
export function getArchiveErrorMessage(currentStatus: string): string {
  return `Cannot archive audit. Current status is "${currentStatus}". Audit can only be archived with one of these statuses: ${ARCHIVABLE_AUDIT_STATUSES.join(', ')}.`
}
