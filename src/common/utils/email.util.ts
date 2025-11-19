import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as http from 'http'
import * as https from 'https'
import * as nodemailer from 'nodemailer'
import { URL } from 'url'
import { Configuration } from '../../config/configuration'
import type {
  AttachmentUrlDto,
  EmailAttachment
} from '../../modules/email/email.dto'

@Injectable()
export class EmailUtil {
  private transporter: nodemailer.Transporter

  constructor(private configService: ConfigService<Configuration>) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
      auth: {
        user: this.configService.get('smtp.email', { infer: true }),
        pass: this.configService.get('smtp.password', { infer: true })
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      },
      logger: process.env.NODE_ENV === 'development', // Enable logging in dev
      debug: process.env.NODE_ENV === 'development'
    })

    // Verify transporter configuration on startup
    this.transporter.verify((error) => {
      if (error) {
        console.error('SMTP configuration error:', error)
      } else {
        console.log('SMTP server is ready to send emails')
      }
    })
  }

  async sendOtpEmail(email: string, otp: number): Promise<void> {
    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: email,
      subject: 'Your Login OTP',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Login OTP Verification</h2>
          <p>Your OTP for login is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666;">This OTP is valid for 5 minutes.</p>
          <p style="color: #666;">If you didn't request this OTP, please ignore this email.</p>
        </div>
      `,
      text: `Your OTP for login is: ${otp}. This OTP is valid for 5 minutes.`
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ OTP email sent:', { to: email, messageId: info.messageId })
    } catch (error) {
      console.error('✗ Failed to send OTP email:', error)
      throw new BadRequestException(
        `Failed to send OTP email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async sendInvitationEmail(
    email: string,
    tempPassword: string,
    roleName: string
  ): Promise<void> {
    const redirectUrl = this.configService.get('invitationRedirectUrl', {
      infer: true
    })

    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: email,
      subject: 'You have been invited to join VNP Dashboard',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to VNP Dashboard!</h2>
          <p>You have been invited to join as <strong>${roleName}</strong>.</p>
          <p>Your temporary credentials are:</p>
          <div style="background-color: #f4f4f4; padding: 15px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <code style="background-color: #e0e0e0; padding: 5px 10px;">${tempPassword}</code></p>
          </div>
          <p style="color: #d9534f; font-weight: bold;">⚠️ This temporary password is valid for 7 days only.</p>
          <p>After logging in with your temporary password, you will be required to set a new password.</p>
          ${redirectUrl ? `<p><a href="${redirectUrl}?email=${email}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Login Now</a></p>` : ''}
          <p style="color: #666; margin-top: 30px;">If you didn't expect this invitation, please contact the administrator.</p>
        </div>
      `,
      text: `Welcome to VNP Dashboard! You have been invited to join as ${roleName}. Your temporary password is: ${tempPassword}. This password is valid for 7 days. After logging in, you will be required to set a new password.`
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Invitation email sent:', { to: email, messageId: info.messageId })
    } catch (error) {
      console.error('✗ Failed to send invitation email:', error)
      throw new BadRequestException(
        `Failed to send invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async sendPasswordResetOtpEmail(email: string, otp: number): Promise<void> {
    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: email,
      subject: 'Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You have requested to reset your password. Your OTP is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666;">This OTP is valid for 5 minutes.</p>
          <p style="color: #d9534f;">If you didn't request a password reset, please ignore this email and contact support immediately.</p>
        </div>
      `,
      text: `You have requested to reset your password. Your OTP is: ${otp}. This OTP is valid for 5 minutes.`
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Password reset OTP email sent:', { to: email, messageId: info.messageId })
    } catch (error) {
      console.error('✗ Failed to send password reset OTP email:', error)
      throw new BadRequestException(
        `Failed to send password reset OTP email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    attachments?: EmailAttachment[]
  ): Promise<void> {
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to,
      subject,
      text: body
    }

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      // Calculate total attachment size
      const totalSize = attachments.reduce(
        (sum, att) => sum + att.content.length,
        0
      )
      const totalSizeMB = totalSize / (1024 * 1024)

      console.log(
        `Sending email with ${attachments.length} attachment(s), total size: ${totalSizeMB.toFixed(2)}MB`
      )

      // Warn if approaching Gmail's 25MB limit
      if (totalSizeMB > 20) {
        console.warn(
          `⚠️ Attachment size (${totalSizeMB.toFixed(2)}MB) is approaching Gmail's 25MB limit`
        )
      }

      if (totalSizeMB > 25) {
        throw new BadRequestException(
          `Total attachment size (${totalSizeMB.toFixed(2)}MB) exceeds Gmail's 25MB limit`
        )
      }

      mailOptions.attachments = attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      }))
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Email sent successfully!', {
        messageId: info.messageId,
        to,
        subject,
        response: info.response,
        attachmentCount: attachments?.length || 0
      })
    } catch (error) {
      console.error('✗ Failed to send email:', {
        to,
        subject,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw new BadRequestException(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Fetch a file from a URL and return it as a buffer
   */
  async fetchFileFromUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(url)
        const protocol = parsedUrl.protocol === 'https:' ? https : http

        // Set timeout for the request (30 seconds)
        const timeout = setTimeout(() => {
          reject(
            new BadRequestException(
              `Timeout while fetching file from URL: ${url}`
            )
          )
        }, 30000)

        const request = protocol
          .get(url, response => {
            if (
              response.statusCode &&
              (response.statusCode < 200 || response.statusCode >= 300)
            ) {
              clearTimeout(timeout)
              reject(
                new BadRequestException(
                  `Failed to fetch file from URL: ${url}. Status: ${response.statusCode}`
                )
              )
              return
            }

            const chunks: Buffer[] = []
            let totalSize = 0

            response.on('data', (chunk: Buffer) => {
              chunks.push(chunk)
              totalSize += chunk.length

              // Prevent downloading files larger than 25MB
              if (totalSize > 25 * 1024 * 1024) {
                clearTimeout(timeout)
                request.destroy()
                reject(
                  new BadRequestException(
                    `File from URL is too large (>25MB): ${url}`
                  )
                )
              }
            })

            response.on('end', () => {
              clearTimeout(timeout)
              console.log(`✓ Fetched file from URL: ${url} (${(totalSize / 1024 / 1024).toFixed(2)}MB)`)
              resolve(Buffer.concat(chunks))
            })

            response.on('error', err => {
              clearTimeout(timeout)
              reject(
                new BadRequestException(
                  `Error downloading file from URL: ${err.message}`
                )
              )
            })
          })
          .on('error', err => {
            clearTimeout(timeout)
            reject(
              new BadRequestException(
                `Error fetching file from URL: ${err.message}`
              )
            )
          })
      } catch (error) {
        reject(
          new BadRequestException(
            `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        )
      }
    })
  }

  /**
   * Extract filename from URL or use provided filename
   */
  getFilenameFromUrl(url: string, customFilename?: string): string {
    if (customFilename) {
      return customFilename
    }

    try {
      const parsedUrl = new URL(url)
      const pathname = parsedUrl.pathname
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1)
      return filename || 'attachment'
    } catch {
      return 'attachment'
    }
  }

  /**
   * Fetch attachments from URLs and convert to EmailAttachment format
   */
  async fetchAttachmentsFromUrls(
    attachmentUrls: AttachmentUrlDto[]
  ): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = []

    for (const attachmentUrl of attachmentUrls) {
      try {
        const buffer = await this.fetchFileFromUrl(attachmentUrl.url)
        const filename = this.getFilenameFromUrl(
          attachmentUrl.url,
          attachmentUrl.filename
        )

        // Determine content type based on file extension
        const contentType = this.getContentTypeFromFilename(filename)

        attachments.push({
          filename,
          content: buffer,
          contentType
        })
      } catch (error) {
        throw new BadRequestException(
          `Failed to fetch attachment from URL ${attachmentUrl.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return attachments
  }

  /**
   * Get MIME type based on file extension
   */
  private getContentTypeFromFilename(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop()
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv',
      zip: 'application/zip',
      json: 'application/json'
    }

    return mimeTypes[extension || ''] || 'application/octet-stream'
  }
}
