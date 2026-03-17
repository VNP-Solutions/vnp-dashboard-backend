import { Injectable, Logger, Inject } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { EmailUtil } from '../../common/utils/email.util'
import {
  PropertyAuditSummary,
  WeeklyAuditReportOptions
} from './scheduler.interface'

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(
    private prisma: PrismaService,
    @Inject(EmailUtil) private emailUtil: EmailUtil
  ) {}

  /**
   * Cron job that runs every Monday at 10 AM to send audit reports
   * Schedule: Every Monday at 10:00 AM
   * Cron expression: 0 10 * * 1 (minute hour day-of-month month day-of-week)
   */
  @Cron('0 10 * * 1', {
    name: 'weeklyAuditReport',
    timeZone: 'UTC'
  })
  async handleWeeklyAuditReport() {
    this.logger.log('Starting weekly audit report generation...')

    try {
      await this.sendWeeklyAuditReports({})
      this.logger.log('Weekly audit reports sent successfully')
    } catch (error) {
      this.logger.error(
        'Failed to send weekly audit reports:',
        error instanceof Error ? error.stack : error
      )
    }
  }

  /**
   * Main method to gather and send audit reports
   * Can be called manually for testing
   */
  async sendWeeklyAuditReports(options: WeeklyAuditReportOptions = {}) {
    const { isTestRun = false, testEmails = [] } = options

    this.logger.log(
      `${isTestRun ? 'TEST RUN: ' : ''}Fetching reported audits...`
    )

    // Step 1: Fetch all audits with status containing "reported" or "Reported"
    const reportedAudits = await this.fetchReportedAudits()

    if (reportedAudits.length === 0) {
      this.logger.log('No reported audits found. Skipping email sending.')
      return
    }

    this.logger.log(`Found ${reportedAudits.length} reported audits`)

    // Step 2: Group audits by property and count by OTA type
    const propertySummaries = this.groupAuditsByProperty(reportedAudits)

    this.logger.log(
      `Grouped audits into ${propertySummaries.length} property summaries`
    )

    // Step 3: For each property, get recipients and send email
    for (const summary of propertySummaries) {
      const recipients = isTestRun
        ? testEmails
        : await this.getRecipientsForProperty(summary)

      if (recipients.length === 0) {
        this.logger.warn(
          `No recipients found for property: ${summary.propertyName}`
        )
        continue
      }

      await this.sendAuditReportEmail(summary, recipients)
      this.logger.log(
        `Sent audit report for ${summary.propertyName} to ${recipients.length} recipient(s)`
      )
    }
  }

  /**
   * Fetch all audits where status contains "reported" or "Reported"
   */
  private async fetchReportedAudits() {
    // First get all audit statuses that contain "reported"
    const auditStatuses = await this.prisma.auditStatus.findMany({
      where: {
        status: {
          contains: 'reported',
          mode: 'insensitive' // Case-insensitive search
        }
      },
      select: {
        id: true,
        status: true
      }
    })

    if (auditStatuses.length === 0) {
      return []
    }

    const statusIds = auditStatuses.map(as => as.id)

    // Fetch all audits with these statuses
    const audits = await this.prisma.audit.findMany({
      where: {
        audit_status_id: {
          in: statusIds
        },
        is_archived: false // Only include non-archived audits
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true,
            portfolio: {
              select: {
                id: true,
                name: true,
                contact_email: true
              }
            }
          }
        },
        auditStatus: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })

    return audits
  }

  /**
   * Group audits by property and count by OTA type
   */
  private groupAuditsByProperty(
    audits: any[]
  ): PropertyAuditSummary[] {
    const propertyMap = new Map<string, PropertyAuditSummary>()

    for (const audit of audits) {
      const propertyId = audit.property.id

      if (!propertyMap.has(propertyId)) {
        propertyMap.set(propertyId, {
          propertyId: audit.property.id,
          propertyName: audit.property.name,
          portfolioId: audit.property.portfolio.id,
          portfolioName: audit.property.portfolio.name,
          portfolioContactEmail: audit.property.portfolio.contact_email,
          auditCounts: {},
          totalAudits: 0
        })
      }

      const summary = propertyMap.get(propertyId)!

      // Count audits by OTA type
      for (const otaType of audit.type_of_ota) {
        const key = otaType // 'expedia', 'agoda', or 'booking'
        summary.auditCounts[key] = (summary.auditCounts[key] || 0) + 1
      }

      // Also count by status if type_of_ota is empty
      if (!audit.type_of_ota || audit.type_of_ota.length === 0) {
        summary.auditCounts['Other'] = (summary.auditCounts['Other'] || 0) + 1
      }

      summary.totalAudits++
    }

    return Array.from(propertyMap.values())
  }

  /**
   * Get all recipients for a property:
   * 1. Portfolio contact email
   * 2. Users with partial access to this property
   */
  private async getRecipientsForProperty(
    summary: PropertyAuditSummary
  ): Promise<string[]> {
    const recipients: string[] = []

    // DISABLED: Stop sending alerts to portfolio contact emails automatically
    // if (summary.portfolioContactEmail) {
    //   recipients.push(summary.portfolioContactEmail)
    // }

    // Find users with partial access to this property
    const userAccesses = await this.prisma.userAccessedProperty.findMany({
      where: {
        OR: [
          {
            property_id: {
              has: summary.propertyId
            }
          },
          {
            portfolio_id: {
              has: summary.portfolioId
            }
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            is_verified: true,
            role: {
              select: {
                property_permission: true
              }
            }
          }
        }
      }
    })

    // Add verified users who have partial property access
    for (const userAccess of userAccesses) {
      const user = userAccess.user

      // Only include verified users
      if (!user.is_verified) {
        continue
      }

      // Check if user has property permission with partial access
      const propertyPermission = user.role.property_permission

      if (
        propertyPermission &&
        propertyPermission.access_level === 'partial'
      ) {
        // Check if user has access to this specific property
        const hasPropertyAccess =
          userAccess.property_id.includes(summary.propertyId) ||
          userAccess.portfolio_id.includes(summary.portfolioId)

        if (hasPropertyAccess && !recipients.includes(user.email)) {
          recipients.push(user.email)
        }
      }
    }

    return [...new Set(recipients.filter(email => email && email.trim()))]
  }

  /**
   * Send audit report email to recipients
   */
  private async sendAuditReportEmail(
    summary: PropertyAuditSummary,
    recipients: string[]
  ) {
    // Remove duplicates
    const uniqueRecipients = [...new Set(recipients)]

    // Generate audit summary HTML
    const auditCountsHtml = Object.entries(summary.auditCounts)
      .map(([type, count]) => {
        const displayName =
          type === 'expedia'
            ? 'Expedia'
            : type === 'agoda'
              ? 'Agoda'
              : type === 'booking'
                ? 'Booking'
                : type
        return `<li><strong>${displayName}:</strong> ${count} audit(s)</li>`
      })
      .join('')

    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: uniqueRecipients,
      subject: `Audit Status Report – ${summary.propertyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <p><strong>Hi,</strong></p>
          <p>Please find below the audit status report for <strong>${summary.propertyName}</strong> in <strong>${summary.portfolioName}</strong>.</p>

          <p><strong>📊 Audit Summary:</strong></p>
          <ul style="list-style: none; padding-left: 0;">
            <li>🏢 <strong>Property:</strong> ${summary.propertyName}</li>
            <li>🏢 <strong>Portfolio:</strong> ${summary.portfolioName}</li>
            <li>📅 <strong>Total Reported Audits:</strong> ${summary.totalAudits}</li>
          </ul>

          <p><strong>📋 Audit Breakdown by Type:</strong></p>
          <ul style="list-style: none; padding-left: 0;">
            ${auditCountsHtml}
          </ul>

          <p style="color: #666;">This report is automatically generated every Monday for audits with "Reported" status.</p>

          <p>Please log in to your dashboard for more details and to take any necessary actions.</p>

          <div style="margin-top: 30px; color: #666;">
            <p>Warm regards,<br><strong>VNP Solutions Team</strong></p>
          </div>
        </div>
      `,
      text: `
Hi,\n\nPlease find below the audit status report for ${summary.propertyName} in ${summary.portfolioName}.\n\n📊 Audit Summary:\n🏢 Property: ${summary.propertyName}\n🏢 Portfolio: ${summary.portfolioName}\n📅 Total Reported Audits: ${summary.totalAudits}\n\n📋 Audit Breakdown by Type:\n${Object.entries(summary.auditCounts).map(([type, count]) => `- ${type}: ${count} audit(s)`).join('\n')}\n\nThis report is automatically generated every Monday for audits with "Reported" status.\n\nPlease log in to your dashboard for more details and to take any necessary actions.\n\nWarm regards,\nVNP Solutions Team
      `
    }

    try {
      const info = await this.emailUtil['transporter'].sendMail(mailOptions)
      this.logger.log('✓ Audit report email sent:', {
        to: uniqueRecipients,
        messageId: info.messageId
      })
    } catch (error) {
      this.logger.error(
        `✗ Failed to send audit report email to ${uniqueRecipients.join(', ')}:`,
        error
      )
      throw error
    }
  }
}
