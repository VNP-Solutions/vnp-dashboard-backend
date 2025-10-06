import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import { Configuration } from '../../config/configuration'

@Injectable()
export class EmailUtil {
  private transporter: nodemailer.Transporter

  constructor(private configService: ConfigService<Configuration>) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: this.configService.get('smtp.email', { infer: true }),
        pass: this.configService.get('smtp.password', { infer: true })
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

    await this.transporter.sendMail(mailOptions)
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

    await this.transporter.sendMail(mailOptions)
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

    await this.transporter.sendMail(mailOptions)
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to,
      subject,
      text: body
    }

    await this.transporter.sendMail(mailOptions)
  }
}
