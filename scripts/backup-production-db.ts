import { PrismaClient } from '@prisma/client'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)
const prisma = new PrismaClient()

interface CollectionCount {
  name: string
  count: number
}

async function backupProductionDatabase() {
  try {
    console.log('========================================')
    console.log('Production Database Backup Script')
    console.log('========================================\n')

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = path.join(process.cwd(), 'backups', `backup-${timestamp}`)

    // Create backup directory
    if (!fs.existsSync(path.join(process.cwd(), 'backups'))) {
      fs.mkdirSync(path.join(process.cwd(), 'backups'))
    }

    // Step 1: Get database connection string
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set')
    }

    console.log('✓ Database connection string loaded')
    console.log(`✓ Backup directory: ${backupDir}\n`)

    // Step 2: Get collection counts before backup
    console.log('📊 Collecting database statistics...\n')
    
    const collections = [
      'User',
      'UserRole',
      'Portfolio',
      'Property',
      'PropertyCredentials',
      'PropertyBankDetails',
      'Audit',
      'AuditStatus',
      'Note',
      'Task',
      'Otp',
      'ServiceType',
      'Currency',
      'AuditBatch',
      'PendingAction',
      'UserAccessedProperty',
      'ContractUrl',
      'ConsolidatedReport'
    ]

    const counts: CollectionCount[] = []

    for (const collection of collections) {
      try {
        // @ts-ignore - Dynamic collection access
        const count = await prisma[collection.charAt(0).toLowerCase() + collection.slice(1)].count()
        counts.push({ name: collection, count })
        console.log(`  ${collection.padEnd(25)} : ${count}`)
      } catch (error) {
        console.log(`  ${collection.padEnd(25)} : N/A (collection may not exist)`)
      }
    }

    // Save collection counts to file
    const statsFile = path.join(backupDir, 'collection-stats.json')
    fs.mkdirSync(backupDir, { recursive: true })
    fs.writeFileSync(statsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      counts,
      totalRecords: counts.reduce((sum, c) => sum + c.count, 0)
    }, null, 2))

    console.log(`\n✓ Statistics saved to: ${statsFile}`)

    // Step 3: Export current schema
    console.log('\n📋 Exporting current schema...')
    const schemaSource = path.join(process.cwd(), 'prisma', 'schema.prisma')
    const schemaBackup = path.join(backupDir, 'schema.prisma')
    
    if (fs.existsSync(schemaSource)) {
      fs.copyFileSync(schemaSource, schemaBackup)
      console.log(`✓ Schema backed up to: ${schemaBackup}`)
    } else {
      console.log('⚠ Warning: schema.prisma not found')
    }

    // Step 4: Create MongoDB dump
    console.log('\n💾 Creating MongoDB backup with mongodump...')
    console.log('This may take several minutes depending on database size...\n')

    try {
      const { stdout, stderr } = await execAsync(
        `mongodump --uri="${dbUrl}" --out="${backupDir}/mongodb-dump"`,
        { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
      )

      if (stdout) console.log(stdout)
      if (stderr) console.log(stderr)

      console.log(`✓ MongoDB backup completed: ${backupDir}/mongodb-dump`)
    } catch (error: any) {
      console.error('\n❌ mongodump failed:', error.message)
      console.log('\n⚠ Note: Make sure MongoDB Database Tools are installed:')
      console.log('   Download from: https://www.mongodb.com/try/download/database-tools')
      console.log('   Or install via package manager:')
      console.log('     - Windows: choco install mongodb-database-tools')
      console.log('     - Mac: brew install mongodb-database-tools')
      console.log('     - Linux: sudo apt-get install mongodb-database-tools')
      throw error
    }

    // Step 5: Create backup manifest
    console.log('\n📝 Creating backup manifest...')
    const manifest = {
      backupDate: new Date().toISOString(),
      databaseUrl: dbUrl.replace(/:[^:@]+@/, ':***@'), // Hide password
      backupLocation: backupDir,
      totalCollections: counts.length,
      totalRecords: counts.reduce((sum, c) => sum + c.count, 0),
      collections: counts,
      schemaIncluded: fs.existsSync(schemaBackup),
      mongodumpIncluded: true,
      nodeVersion: process.version,
      platform: process.platform
    }

    const manifestFile = path.join(backupDir, 'backup-manifest.json')
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))
    console.log(`✓ Manifest created: ${manifestFile}`)

    // Step 6: Verify backup
    console.log('\n✅ Verifying backup integrity...')
    const dumpDir = path.join(backupDir, 'mongodb-dump')
    
    if (fs.existsSync(dumpDir)) {
      const dbDirs = fs.readdirSync(dumpDir)
      console.log(`✓ Backup contains ${dbDirs.length} database(s)`)
      
      for (const dbDir of dbDirs) {
        const dbPath = path.join(dumpDir, dbDir)
        if (fs.statSync(dbPath).isDirectory()) {
          const files = fs.readdirSync(dbPath)
          const bsonFiles = files.filter(f => f.endsWith('.bson'))
          console.log(`  - ${dbDir}: ${bsonFiles.length} collections`)
        }
      }
    }

    // Final summary
    console.log('\n========================================')
    console.log('✅ BACKUP COMPLETED SUCCESSFULLY!')
    console.log('========================================')
    console.log(`📁 Backup location: ${backupDir}`)
    console.log(`📊 Total records backed up: ${manifest.totalRecords}`)
    console.log(`⏰ Backup timestamp: ${manifest.backupDate}`)
    console.log('\nBackup contents:')
    console.log('  - mongodb-dump/          (MongoDB binary backup)')
    console.log('  - schema.prisma          (Prisma schema)')
    console.log('  - collection-stats.json  (Record counts)')
    console.log('  - backup-manifest.json   (Backup metadata)')
    console.log('\n⚠ IMPORTANT: Keep this backup safe until migration is verified!')
    console.log('========================================\n')

    // Return backup info for use in scripts
    return {
      success: true,
      backupDir,
      manifest
    }

  } catch (error) {
    console.error('\n❌ BACKUP FAILED:', error)
    console.error('Please fix the error and try again before proceeding with migration.')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if executed directly
if (require.main === module) {
  backupProductionDatabase()
}

export default backupProductionDatabase
