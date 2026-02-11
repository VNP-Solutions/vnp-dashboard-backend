import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

/**
 * Alternative backup script using Prisma (no mongodump required)
 * This exports data to JSON files for emergency recovery
 */
async function backupDatabasePrisma() {
  try {
    console.log('========================================')
    console.log('Prisma-Based Database Backup')
    console.log('========================================\n')
    console.log('⚠ Note: This is a JSON export backup.')
    console.log('For production, mongodump is recommended for binary backup.\n')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = path.join(process.cwd(), 'backups', `prisma-backup-${timestamp}`)

    // Create backup directory
    fs.mkdirSync(backupDir, { recursive: true })

    console.log(`📁 Backup directory: ${backupDir}\n`)
    console.log('💾 Exporting collections to JSON...\n')

    // Export PropertyBankDetails (most critical for migration)
    console.log('Exporting PropertyBankDetails...')
    const bankDetails = await prisma.propertyBankDetails.findMany()
    fs.writeFileSync(
      path.join(backupDir, 'PropertyBankDetails.json'),
      JSON.stringify(bankDetails, null, 2)
    )
    console.log(`  ✓ ${bankDetails.length} records exported`)

    // Export other collections
    console.log('Exporting User...')
    const users = await prisma.user.findMany()
    fs.writeFileSync(path.join(backupDir, 'User.json'), JSON.stringify(users, null, 2))
    console.log(`  ✓ ${users.length} records exported`)

    console.log('Exporting UserRole...')
    const roles = await prisma.userRole.findMany()
    fs.writeFileSync(path.join(backupDir, 'UserRole.json'), JSON.stringify(roles, null, 2))
    console.log(`  ✓ ${roles.length} records exported`)

    console.log('Exporting Portfolio...')
    const portfolios = await prisma.portfolio.findMany()
    fs.writeFileSync(path.join(backupDir, 'Portfolio.json'), JSON.stringify(portfolios, null, 2))
    console.log(`  ✓ ${portfolios.length} records exported`)

    console.log('Exporting Property...')
    const properties = await prisma.property.findMany()
    fs.writeFileSync(path.join(backupDir, 'Property.json'), JSON.stringify(properties, null, 2))
    console.log(`  ✓ ${properties.length} records exported`)

    console.log('Exporting PropertyCredentials...')
    const credentials = await prisma.propertyCredentials.findMany()
    fs.writeFileSync(path.join(backupDir, 'PropertyCredentials.json'), JSON.stringify(credentials, null, 2))
    console.log(`  ✓ ${credentials.length} records exported`)

    console.log('Exporting Audit...')
    const audits = await prisma.audit.findMany()
    fs.writeFileSync(path.join(backupDir, 'Audit.json'), JSON.stringify(audits, null, 2))
    console.log(`  ✓ ${audits.length} records exported`)

    console.log('Exporting Note...')
    const notes = await prisma.note.findMany()
    fs.writeFileSync(path.join(backupDir, 'Note.json'), JSON.stringify(notes, null, 2))
    console.log(`  ✓ ${notes.length} records exported`)

    console.log('Exporting Task...')
    const tasks = await prisma.task.findMany()
    fs.writeFileSync(path.join(backupDir, 'Task.json'), JSON.stringify(tasks, null, 2))
    console.log(`  ✓ ${tasks.length} records exported`)

    // Save backup manifest
    const manifest = {
      backupDate: new Date().toISOString(),
      backupType: 'prisma-json',
      backupLocation: backupDir,
      note: 'This is a JSON export. For production, use mongodump for binary backup.'
    }

    fs.writeFileSync(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )

    console.log('\n========================================')
    console.log('✅ PRISMA BACKUP COMPLETED')
    console.log('========================================')
    console.log(`📁 Location: ${backupDir}`)
    console.log('\n⚠ IMPORTANT: For production, install mongodump and use:')
    console.log('  yarn backup:db\n')

    return { success: true, backupDir }

  } catch (error) {
    console.error('\n❌ BACKUP FAILED:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  backupDatabasePrisma()
}

export default backupDatabasePrisma
