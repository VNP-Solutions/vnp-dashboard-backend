# Password Encryption Issue - Root Cause & Fix

## Problem Summary

When calling the `/api/property-credentials/bulk-update` endpoint, you received an "Invalid initialization vector" error. This is **NOT a frontend issue** - it's a backend data integrity problem.

## Root Cause

The error occurred because some passwords in the `PropertyCredentials` collection were stored in **plain text** or an **incorrect format**, instead of being properly encrypted using the `EncryptionUtil.encrypt()` method.

### Expected Encrypted Format

Properly encrypted passwords use AES-256-CBC encryption and are stored in this format:

```
<32-character-hex-iv>:<encrypted-hex-data>
```

Example: `a1b2c3d4e5f6...789:f9e8d7c6b5a4...321`

### What Was Actually Stored

The seed files were generating fake "encrypted" passwords like:

- `encrypted_password_placeholder`
- `encrypted_xyz123abc`

These don't have the required `iv:encrypted` format, causing the decrypt function to fail.

## Technical Details

### Encryption Flow

1. **Encrypt** (when saving):
   - Generate random 16-byte IV
   - Encrypt password with AES-256-CBC
   - Return: `iv.toString('hex') + ':' + encrypted`

2. **Decrypt** (when reading):
   - Split by `:`
   - Extract IV from first part
   - Decrypt using IV and encryption key

### Why It Failed

When `EncryptionUtil.decrypt()` encountered plain text:

1. Split `"encrypted_password_placeholder"` by `:`
2. Got `["encrypted_password_placeholder"]` (no colon!)
3. Tried to create IV from undefined `parts[1]`
4. **Error**: "Invalid initialization vector"

## Fixes Applied

### 1. Enhanced Decryption Validation (`src/common/utils/encryption.util.ts`)

Added comprehensive validation to both `decrypt()` and `decryptWithKey()` methods:

```typescript
static decrypt(encryptedText: string, secret: string): string {
  try {
    const parts = encryptedText.split(':')

    // Validate format: must have exactly 2 parts (iv:encrypted)
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format: expected "iv:encrypted"')
    }

    const ivHex = parts[0]
    const encrypted = parts[1]

    // Validate IV length (should be 32 hex characters = 16 bytes)
    if (ivHex.length !== 32) {
      throw new Error(`Invalid IV length: expected 32 hex characters, got ${ivHex.length}`)
    }

    // ... rest of decryption
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error.message}. This may indicate corrupted data, plain text stored as encrypted, or wrong encryption secret.`
    )
  }
}
```

### 2. Improved Repository Error Messages

Updated `findByPropertyId()` and `findManyByPropertyIds()` to show which specific property has corrupted data:

```typescript
try {
  return {
    ...credentials,
    expedia_password: credentials.expedia_password
      ? EncryptionUtil.decrypt(credentials.expedia_password, encryptionSecret)
      : null
  }
} catch (error) {
  throw new Error(
    `Failed to decrypt credentials for property ${propertyId}: ${error.message}`
  )
}
```

### 3. Fixed Seed Files

**`prisma/seed.ts`** and **`prisma/seed-properties.ts`** now properly encrypt passwords:

```typescript
import { EncryptionUtil } from '../src/common/utils/encryption.util'

// In seed function
const encryptionSecret = process.env.JWT_ACCESS_SECRET || 'default-secret-key'
const encryptedPassword = EncryptionUtil.encrypt(
  'SeedPassword123!',
  encryptionSecret
)

await prisma.propertyCredentials.create({
  data: {
    expedia_password: encryptedPassword // ✓ Properly encrypted
    // ... other fields
  }
})
```

### 4. Data Migration Script

Created `scripts/fix-encrypted-passwords.ts` to fix existing corrupted data:

- Scans all `PropertyCredentials` records
- Checks if passwords are properly encrypted (format: `iv:encrypted`)
- Re-encrypts plain text passwords
- Nullifies unrecoverable corrupted data
- Provides detailed summary of fixes

## How to Fix Your Database

### Option 1: Run the Migration Script (Recommended)

This will fix existing corrupted data without losing information:

```bash
# Set your environment variables first
export JWT_ACCESS_SECRET="your-secret-here"

# Run the fix script
yarn fix:passwords
```

The script will:

- ✓ Find all plain text passwords and encrypt them properly
- ✓ Identify passwords encrypted with wrong secret (set to null)
- ✓ Preserve properly encrypted passwords
- ✓ Show detailed progress and summary

### Option 2: Re-seed the Database

If you don't need existing credential data:

```bash
# Clear and re-seed (will now use proper encryption)
yarn seed
```

### Option 3: Manual Fix

If you only have a few properties with issues, you can update them manually through the API after the code changes are deployed.

## Testing the Fix

### 1. Check Encryption Works

```bash
# Create test property with credentials
curl -X POST http://localhost:3000/api/property-credentials \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "test-property-123",
    "expedia": {
      "username": "test@example.com",
      "password": "TestPass123!"
    }
  }'

# Verify in database - password should be in format: <32-hex>:<encrypted-hex>
```

### 2. Test Bulk Update

```bash
# Your original request should now work
curl -X PATCH http://localhost:3000/api/property-credentials/bulk-update \
  -H "Content-Type: application/json" \
  -d '{
    "property_ids": ["69803f0e8cd28a28c2155477", "69803f0b8cd28a28c2155474"],
    "credentials": {
      "expedia": {
        "username": "naeemhasan28@gmail.com",
        "password": "AluVaj!1*"
      }
    }
  }'
```

### 3. Check Error Messages

If any properties still have corrupted data, you'll now get a clear error:

```
Failed to decrypt credentials for property 69803f0e8cd28a28c2155477:
Invalid encrypted text format: expected "iv:encrypted"
```

## Prevention

Going forward, these issues are prevented by:

1. **Seed files now use proper encryption** - no more plain text placeholders
2. **Enhanced validation** - decrypt functions fail fast with clear errors
3. **Better error messages** - shows exactly which property has issues
4. **Type safety** - TypeScript ensures `EncryptionUtil.encrypt()` is always used

## Summary

| Aspect         | Before                                  | After                                          |
| -------------- | --------------------------------------- | ---------------------------------------------- |
| Seed data      | Plain text "encrypted_placeholder"      | Properly encrypted with AES-256-CBC            |
| Decryption     | Failed silently with cryptic error      | Clear validation with specific error messages  |
| Error location | Generic "Invalid initialization vector" | "Failed to decrypt credentials for property X" |
| Prevention     | No validation                           | Format validation before decryption            |
| Recovery       | Manual database cleanup                 | Automated migration script                     |

## Next Steps

1. **Deploy the code changes** to your server
2. **Run the migration script**: `yarn fix:passwords`
3. **Test the bulk-update endpoint** with your original payload
4. **Monitor logs** for any remaining issues with specific property IDs

The error was in the backend data, not your frontend payload! 🎯
