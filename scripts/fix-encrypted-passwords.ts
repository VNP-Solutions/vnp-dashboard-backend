import { PrismaClient } from '@prisma/client'
import { EncryptionUtil } from '../src/common/utils/encryption.util'

const prisma = new PrismaClient()

async function fixEncryptedPasswords() {
  console.log('Starting password encryption fix...')

  const encryptionSecret = process.env.JWT_ACCESS_SECRET
  if (!encryptionSecret) {
    throw new Error('JWT_ACCESS_SECRET is not set in environment variables')
  }

  // Get all property credentials
  const allCredentials = await prisma.propertyCredentials.findMany()
  console.log(`Found ${allCredentials.length} credential records`)

  let fixedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const cred of allCredentials) {
    try {
      const updates: any = {}
      let needsUpdate = false

      // Check and fix expedia_password
      if (cred.expedia_password) {
        if (!isProperlyEncrypted(cred.expedia_password)) {
          console.log(
            `Fixing expedia password for property ${cred.property_id}`
          )
          // If it's a plain text password, re-encrypt it
          updates.expedia_password = EncryptionUtil.encrypt(
            cred.expedia_password,
            encryptionSecret
          )
          needsUpdate = true
        } else {
          // Verify it can be decrypted
          try {
            EncryptionUtil.decrypt(cred.expedia_password, encryptionSecret)
          } catch (error) {
            console.log(
              `Cannot decrypt expedia password for property ${cred.property_id}, setting to null`
            )
            updates.expedia_password = null
            needsUpdate = true
          }
        }
      }

      // Check and fix agoda_password
      if (cred.agoda_password) {
        if (!isProperlyEncrypted(cred.agoda_password)) {
          console.log(`Fixing agoda password for property ${cred.property_id}`)
          updates.agoda_password = EncryptionUtil.encrypt(
            cred.agoda_password,
            encryptionSecret
          )
          needsUpdate = true
        } else {
          try {
            EncryptionUtil.decrypt(cred.agoda_password, encryptionSecret)
          } catch (error) {
            console.log(
              `Cannot decrypt agoda password for property ${cred.property_id}, setting to null`
            )
            updates.agoda_password = null
            needsUpdate = true
          }
        }
      }

      // Check and fix booking_password
      if (cred.booking_password) {
        if (!isProperlyEncrypted(cred.booking_password)) {
          console.log(
            `Fixing booking password for property ${cred.property_id}`
          )
          updates.booking_password = EncryptionUtil.encrypt(
            cred.booking_password,
            encryptionSecret
          )
          needsUpdate = true
        } else {
          try {
            EncryptionUtil.decrypt(cred.booking_password, encryptionSecret)
          } catch (error) {
            console.log(
              `Cannot decrypt booking password for property ${cred.property_id}, setting to null`
            )
            updates.booking_password = null
            needsUpdate = true
          }
        }
      }

      if (needsUpdate) {
        await prisma.propertyCredentials.update({
          where: { id: cred.id },
          data: updates
        })
        fixedCount++
        console.log(`✓ Fixed credentials for property ${cred.property_id}`)
      } else {
        skippedCount++
      }
    } catch (error) {
      errorCount++
      console.error(
        `Error processing property ${cred.property_id}:`,
        error.message
      )
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total records: ${allCredentials.length}`)
  console.log(`Fixed: ${fixedCount}`)
  console.log(`Skipped (already correct): ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)
}

/**
 * Check if a string is properly encrypted (has the iv:encrypted format)
 */
function isProperlyEncrypted(text: string): boolean {
  if (!text || text.length === 0) return false

  const parts = text.split(':')
  if (parts.length !== 2) return false

  const ivHex = parts[0]
  const encrypted = parts[1]

  // IV should be 32 hex characters (16 bytes)
  if (ivHex.length !== 32) return false

  // Encrypted part should exist and be valid hex
  if (!encrypted || encrypted.length === 0) return false

  // Check if both parts are valid hex strings
  const hexRegex = /^[0-9a-fA-F]+$/
  return hexRegex.test(ivHex) && hexRegex.test(encrypted)
}

// Run the script
fixEncryptedPasswords()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
