import { config } from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

config({ path: path.resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()

export const FULL_BACKUP_COLLECTION_ORDER = [
  'ServiceType',
  'Currency',
  'AuditStatus',
  'SalesAgent',
  'UserRole',
  'User',
  'Portfolio',
  'ApiKey',
  'AuditBatch',
  'Property',
  'Otp',
  'PropertyCredentials',
  'PropertyBankDetails',
  'PortfolioBankDetails',
  'PropertyBatch',
  'PropertyContractUrl',
  'UserAccessedProperty',
  'Audit',
  'Note',
  'Task',
  'ContractUrl',
  'ConsolidatedReport',
  'PendingAction'
] as const

interface FullBackupOptions {
  folderPrefix?: string
  updateLatestPointer?: boolean
}

interface BackupManifest {
  backupDate: string
  backupType: 'full-database-ejson'
  databaseName: string
  sourceUrlRedacted: string
  backupDir: string
  totalCollections: number
  totalDocuments: number
  collections: Array<{
    name: string
    file: string
    count: number
  }>
  nodeVersion: string
  platform: string
}

function redactDatabaseUrl(dbUrl: string): string {
  return dbUrl.replace(/:[^:@]+@/, ':***@')
}

function getDatabaseName(dbUrl: string): string {
  const withoutQuery = dbUrl.split('?')[0]
  const parts = withoutQuery.split('/')
  const dbName = parts[parts.length - 1]
  return dbName && !dbName.includes('@') ? dbName : 'unknown'
}

async function listDatabaseCollections(): Promise<string[]> {
  const result = (await prisma.$runCommandRaw({
    listCollections: 1,
    nameOnly: true
  })) as {
    cursor?: { firstBatch?: Array<{ name: string; type?: string }> }
  }

  return (result.cursor?.firstBatch ?? [])
    .map(entry => entry.name)
    .filter(name => !name.startsWith('system.'))
    .sort()
}

async function fetchAllDocuments(collectionName: string): Promise<unknown[]> {
  const documents: unknown[] = []
  const pageSize = 500
  let lastId: unknown | undefined

  while (true) {
    const filter: Record<string, unknown> = lastId
      ? { _id: { $gt: lastId } }
      : {}

    const result = (await prisma.$runCommandRaw({
      find: collectionName,
      filter: filter as never,
      sort: { _id: 1 },
      limit: pageSize,
      batchSize: pageSize,
      singleBatch: true
    })) as {
      cursor?: { firstBatch?: Array<Record<string, unknown>> }
    }

    const batch = result.cursor?.firstBatch ?? []
    if (batch.length === 0) {
      break
    }

    documents.push(...batch)

    const nextLastId = batch[batch.length - 1]._id
    if (nextLastId === lastId) {
      break
    }

    lastId = nextLastId
  }

  return documents
}

async function backupFullDatabaseEjson(options?: FullBackupOptions) {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const folderPrefix = options?.folderPrefix ?? 'full-backup'
  const updateLatestPointer = options?.updateLatestPointer ?? true
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(
    process.cwd(),
    'backups',
    `${folderPrefix}-${timestamp}`
  )
  const collectionsDir = path.join(backupDir, 'collections')

  fs.mkdirSync(collectionsDir, { recursive: true })

  console.log('========================================')
  console.log('Full Database EJSON Backup')
  console.log('========================================')
  console.log(`Backup directory: ${backupDir}\n`)

  const collectionNames = await listDatabaseCollections()
  const orderedCollections = [
    ...FULL_BACKUP_COLLECTION_ORDER.filter(name =>
      collectionNames.includes(name)
    ),
    ...collectionNames.filter(
      name => !FULL_BACKUP_COLLECTION_ORDER.includes(name as never)
    )
  ]

  const manifestCollections: BackupManifest['collections'] = []
  let totalDocuments = 0

  for (const collectionName of orderedCollections) {
    console.log(`Exporting ${collectionName}...`)
    const documents = await fetchAllDocuments(collectionName)
    const fileName = `${collectionName}.ejson`

    fs.writeFileSync(
      path.join(collectionsDir, fileName),
      JSON.stringify(documents)
    )

    manifestCollections.push({
      name: collectionName,
      file: fileName,
      count: documents.length
    })
    totalDocuments += documents.length
    console.log(`  ${documents.length} record(s) exported`)
  }

  const schemaSource = path.join(process.cwd(), 'prisma', 'schema.prisma')
  if (fs.existsSync(schemaSource)) {
    fs.copyFileSync(schemaSource, path.join(backupDir, 'schema.prisma'))
  }

  const manifest: BackupManifest = {
    backupDate: new Date().toISOString(),
    backupType: 'full-database-ejson',
    databaseName: getDatabaseName(dbUrl),
    sourceUrlRedacted: redactDatabaseUrl(dbUrl),
    backupDir,
    totalCollections: manifestCollections.length,
    totalDocuments,
    collections: manifestCollections,
    nodeVersion: process.version,
    platform: process.platform
  }

  fs.writeFileSync(
    path.join(backupDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  )

  if (updateLatestPointer) {
    fs.writeFileSync(
      path.join(process.cwd(), 'backups', 'latest-full-backup.txt'),
      backupDir
    )
  }

  console.log('\n========================================')
  console.log('FULL EJSON BACKUP COMPLETED')
  console.log('========================================')
  console.log(`Location: ${backupDir}`)
  console.log(`Collections: ${manifest.totalCollections}`)
  console.log(`Documents: ${manifest.totalDocuments}\n`)

  return { success: true, backupDir, manifest }
}

if (require.main === module) {
  backupFullDatabaseEjson()
    .catch(error => {
      console.error('\nFULL EJSON BACKUP FAILED:', error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

export default backupFullDatabaseEjson
