import * as bcrypt from 'bcryptjs'

export class EncryptionUtil {
  private static readonly SALT_ROUNDS = 10

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  static async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  static generateOtp(): number {
    return Math.floor(100000 + Math.random() * 900000)
  }

  static generateTempPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''

    password += chars.charAt(Math.floor(Math.random() * 26))
    password += chars.charAt(26 + Math.floor(Math.random() * 26))
    password += chars.charAt(52 + Math.floor(Math.random() * 10))
    password += chars.charAt(62 + Math.floor(Math.random() * 8))

    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('')
  }
}
