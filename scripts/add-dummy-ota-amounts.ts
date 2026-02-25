import { PrismaClient, OtaType } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Generate a random float between min and max with 2 decimal places
 */
function randomAmount(min: number, max: number): number {
  const amount = Math.random() * (max - min) + min
  return Math.round(amount * 100) / 100
}

/**
 * Fisher-Yates shuffle to randomize array
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Generate dummy amounts for an audit based on its OTAs
 */
function generateAmountsForAudit(otaTypes: OtaType[]) {
  const amounts: {
    expedia_amount_collectable?: number
    expedia_amount_confirmed?: number
    agoda_amount_collectable?: number
    agoda_amount_confirmed?: number
    booking_amount_collectable?: number
    booking_amount_confirmed?: number
  } = {}

  const hasExpedia = otaTypes.includes(OtaType.expedia)
  const hasAgoda = otaTypes.includes(OtaType.agoda)
  const hasBooking = otaTypes.includes(OtaType.booking)

  // Generate amounts if OTA is present
  if (hasExpedia) {
    amounts.expedia_amount_collectable = randomAmount(500, 5000)
    amounts.expedia_amount_confirmed = randomAmount(
      amounts.expedia_amount_collectable * 0.7,
      amounts.expedia_amount_collectable * 0.95
    )
  }

  if (hasAgoda) {
    amounts.agoda_amount_collectable = randomAmount(400, 4500)
    amounts.agoda_amount_confirmed = randomAmount(
      amounts.agoda_amount_collectable * 0.7,
      amounts.agoda_amount_collectable * 0.95
    )
  }

  if (hasBooking) {
    amounts.booking_amount_collectable = randomAmount(300, 4000)
    amounts.booking_amount_confirmed = randomAmount(
      amounts.booking_amount_collectable * 0.7,
      amounts.booking_amount_collectable * 0.95
    )
  }

  return amounts
}

async function addDummyOtaAmounts() {
  console.log('🔍 Starting to add dummy OTA amounts to audits...\n')

  try {
    // Get all audits
    const allAudits = await prisma.audit.findMany({
      select: {
        id: true,
        type_of_ota: true,
        expedia_amount_collectable: true,
        expedia_amount_confirmed: true,
        agoda_amount_collectable: true,
        agoda_amount_confirmed: true,
        booking_amount_collectable: true,
        booking_amount_confirmed: true,
        property: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    console.log(`📊 Total audits in database: ${allAudits.length}\n`)

    // Filter audits that need amounts (currently empty)
    const auditsNeedingAmounts = allAudits.filter(
      audit =>
        !audit.expedia_amount_collectable &&
        !audit.expedia_amount_confirmed &&
        !audit.agoda_amount_collectable &&
        !audit.agoda_amount_confirmed &&
        !audit.booking_amount_collectable &&
        !audit.booking_amount_confirmed
    )

    console.log(`📊 Audits with empty OTA amounts: ${auditsNeedingAmounts.length}\n`)

    if (auditsNeedingAmounts.length === 0) {
      console.log('✅ All audits already have OTA amounts. Nothing to update!')
      return
    }

    // Shuffle and take approximately half
    const shuffledAudits = shuffleArray(auditsNeedingAmounts)
    const halfIndex = Math.ceil(shuffledAudits.length / 2)
    const auditsToUpdate = shuffledAudits.slice(0, halfIndex)

    console.log(`📝 Will update ${auditsToUpdate.length} audits (approximately half)\n`)

    // Statistics
    let totalUpdated = 0
    let totalExpedia = 0
    let totalAgoda = 0
    let totalBooking = 0

    // Update each audit
    for (const audit of auditsToUpdate) {
      const amounts = generateAmountsForAudit(audit.type_of_ota as OtaType[])

      await prisma.audit.update({
        where: { id: audit.id },
        data: amounts
      })

      totalUpdated++

      const otaList = audit.type_of_ota.join(', ')
      console.log(
        `  ✓ Updated audit for "${audit.property.name}" (OTAs: ${otaList || 'none'})`
      )

      if (amounts.expedia_amount_collectable) totalExpedia++
      if (amounts.agoda_amount_collectable) totalAgoda++
      if (amounts.booking_amount_collectable) totalBooking++
    }

    console.log('\n✅ Successfully added dummy OTA amounts to audits!')
    console.log(`📊 Summary:`)
    console.log(`  - Total audits updated: ${totalUpdated}`)
    console.log(`  - Audits with Expedia amounts: ${totalExpedia}`)
    console.log(`  - Audits with Agoda amounts: ${totalAgoda}`)
    console.log(`  - Audits with Booking amounts: ${totalBooking}`)
    console.log(`  - Audits left empty: ${auditsNeedingAmounts.length - totalUpdated}`)
  } catch (error) {
    console.error('❌ Error adding dummy OTA amounts:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
addDummyOtaAmounts()
  .then(() => {
    console.log('\n✨ Script completed successfully!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
