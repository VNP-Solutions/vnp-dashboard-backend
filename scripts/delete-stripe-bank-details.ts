import { PrismaClient, BankType } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteStripeBankDetails() {
  try {
    console.log('Starting deletion of stripe bank details...')

    // First, let's count how many stripe bank details exist
    const stripeBankDetails = await prisma.propertyBankDetails.findMany({
      where: {
        bank_type: BankType.stripe
      },
      select: {
        id: true,
        property_id: true,
        bank_type: true
      }
    })

    console.log(`Found ${stripeBankDetails.length} bank details with bank_type 'stripe'`)

    if (stripeBankDetails.length === 0) {
      console.log('No stripe bank details found. Nothing to delete.')
      return
    }

    // Log the details of records to be deleted
    console.log('\nRecords to be deleted:')
    stripeBankDetails.forEach((detail, index) => {
      console.log(`  ${index + 1}. ID: ${detail.id}, Property ID: ${detail.property_id}`)
    })

    // Delete all stripe bank details
    const deleteResult = await prisma.propertyBankDetails.deleteMany({
      where: {
        bank_type: BankType.stripe
      }
    })

    console.log(`\nSuccessfully deleted ${deleteResult.count} stripe bank details`)
    console.log('Operation completed successfully!')
  } catch (error) {
    console.error('Error during deletion:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

deleteStripeBankDetails()
