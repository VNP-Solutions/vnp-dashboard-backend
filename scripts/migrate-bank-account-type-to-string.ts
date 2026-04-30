import { config } from 'dotenv'
import { resolve } from 'path'
import { MongoClient } from 'mongodb'

// Load `.env` from project root (same as Prisma CLI); standalone ts-node does not do this by default.
config({ path: resolve(process.cwd(), '.env') })

/**
 * Ensures `bank_account_type` is always a string on PropertyBankDetails and
 * PortfolioBankDetails before Prisma schema requires a non-null String.
 *
 * Run once before `yarn push` / `yarn generate` after pulling the schema change:
 *   yarn migrate:bank-account-type-string
 */
async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL not found. Add it to .env in the project root, or export it before running this script.'
    )
  }

  const client = new MongoClient(dbUrl)

  try {
    await client.connect()
    const db = client.db()

    const collections: Array<{ name: string; label: string }> = [
      { name: 'PropertyBankDetails', label: 'property bank details' },
      { name: 'PortfolioBankDetails', label: 'portfolio bank details' }
    ]

    for (const { name, label } of collections) {
      const collection = db.collection(name)

      const nullOrMissing = await collection.updateMany(
        {
          $or: [
            { bank_account_type: null },
            { bank_account_type: { $exists: false } }
          ]
        },
        { $set: { bank_account_type: '' } }
      )

      console.log(
        `${label}: matched ${nullOrMissing.matchedCount}, modified ${nullOrMissing.modifiedCount}`
      )
    }

    console.log('Done. You can run yarn push && yarn generate.')
  } finally {
    await client.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
