import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'

export class EncryptionUtil {
  private static readonly SALT_ROUNDS = 10
  private static readonly ALGORITHM = 'aes-256-cbc'
  private static readonly IV_LENGTH = 16

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  static async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  static encrypt(text: string, secret: string): string {
    const key = crypto.scryptSync(secret, 'salt', 32)
    const iv = crypto.randomBytes(this.IV_LENGTH)
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return iv.toString('hex') + ':' + encrypted
  }

  static decrypt(encryptedText: string, secret: string): string {
    try {
      const parts = encryptedText.split(':')

      // Validate format: must have exactly 2 parts (iv:encrypted)
      if (parts.length !== 2) {
        throw new Error(
          'Invalid encrypted text format: expected "iv:encrypted"'
        )
      }

      const ivHex = parts[0]
      const encrypted = parts[1]

      // Validate IV length (should be 32 hex characters = 16 bytes)
      if (ivHex.length !== this.IV_LENGTH * 2) {
        throw new Error(
          `Invalid IV length: expected ${this.IV_LENGTH * 2} hex characters, got ${ivHex.length}`
        )
      }

      // Validate that encrypted part exists
      if (!encrypted || encrypted.length === 0) {
        throw new Error('Invalid encrypted text: encrypted data is empty')
      }

      const iv = Buffer.from(ivHex, 'hex')
      const key = crypto.scryptSync(secret, 'salt', 32)
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error.message}. This may indicate corrupted data, plain text stored as encrypted, or wrong encryption secret.`
      )
    }
  }

  /**
   * Derive the encryption key from a secret.
   * Call this once and reuse the key for multiple decryptions.
   * This avoids the expensive scryptSync call for each decryption.
   */
  static deriveKey(secret: string): Buffer {
    return crypto.scryptSync(secret, 'salt', 32)
  }

  /**
   * Decrypt using a pre-derived key (much faster for bulk operations)
   */
  static decryptWithKey(encryptedText: string, key: Buffer): string {
    try {
      const parts = encryptedText.split(':')

      // Validate format: must have exactly 2 parts (iv:encrypted)
      if (parts.length !== 2) {
        throw new Error(
          'Invalid encrypted text format: expected "iv:encrypted"'
        )
      }

      const ivHex = parts[0]
      const encrypted = parts[1]

      // Validate IV length (should be 32 hex characters = 16 bytes)
      if (ivHex.length !== this.IV_LENGTH * 2) {
        throw new Error(
          `Invalid IV length: expected ${this.IV_LENGTH * 2} hex characters, got ${ivHex.length}`
        )
      }

      // Validate that encrypted part exists
      if (!encrypted || encrypted.length === 0) {
        throw new Error('Invalid encrypted text: encrypted data is empty')
      }

      const iv = Buffer.from(ivHex, 'hex')
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error.message}. This may indicate corrupted data, plain text stored as encrypted, or wrong encryption secret.`
      )
    }
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
