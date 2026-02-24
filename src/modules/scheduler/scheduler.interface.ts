export interface PropertyAuditSummary {
  propertyId: string
  propertyName: string
  portfolioId: string
  portfolioName: string
  portfolioContactEmail?: string
  auditCounts: Record<string, number> // Key: OTA type (expedia, agoda, booking), Value: count
  totalAudits: number
}

export interface AuditReportData {
  propertySummaries: PropertyAuditSummary[]
  recipientEmails: string[]
}

export interface WeeklyAuditReportOptions {
  isTestRun?: boolean
  testEmails?: string[]
}
