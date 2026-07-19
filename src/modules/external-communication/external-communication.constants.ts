export const EXTERNAL_BULK_IMPORT_AUDIT_STATUS = 'Reported to Property'

export const BULK_AUDIT_IMPORT_TYPES = ['ota', 'ota-post'] as const
export type BulkAuditImportType = (typeof BULK_AUDIT_IMPORT_TYPES)[number]

export const BULK_AUDIT_IMPORT_CALLBACK_PATHS: Record<
  BulkAuditImportType,
  string
> = {
  ota: '/qa-panel/import-callback',
  'ota-post': '/qa-panel/ota-post/import-callback'
}

export function isBulkAuditImportType(
  value: string
): value is BulkAuditImportType {
  return (BULK_AUDIT_IMPORT_TYPES as readonly string[]).includes(value)
}
