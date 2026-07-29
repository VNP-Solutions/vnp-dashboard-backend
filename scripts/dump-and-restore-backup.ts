/**
 * Dump the current database, then restore from a backup in ./backups.
 *
 * Usage:
 *   yarn backup:restore                              # dry-run (shows plan)
 *   yarn backup:restore -- --apply                   # dump current DB, then restore
 *   yarn backup:restore -- --apply --skip-dump         # restore only
 *   yarn backup:restore -- --apply --backup=./backups/full-backup-...
 */
import { config } from 'dotenv'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'
import backupProductionDatabase from './backup-production-db'
import backupFullDatabaseEjson, {
  FULL_BACKUP_COLLECTION_ORDER
} from './backup-full-ejson'

config({ path: path.resolve(process.cwd(), '.env') })

const execAsync = promisify(exec)
const prisma = new PrismaClient()

type BackupType = 'full-ejson' | 'mongodump' | 'prisma-json'

interface BackupManifest {
  backupType?: string
  collections?: Array<{
    name: string
    file: string
    count: number
  }>
}

interface BackupSource {
  type: BackupType
  dir: string
  restorePath: string
  manifest?: BackupManifest
}

interface CliOptions {
  apply: boolean
  skipDump: boolean
  backupPath?: string
}

const PRISMA_JSON_COLLECTIONS = [
  'UserRole',
  'User',
  'Portfolio',
  'Property',
  'PropertyCredentials',
  'PropertyBankDetails',
  'Audit',
  'Note',
  'Task'
] as const

const MODEL_BY_COLLECTION: Record<string, string> = {
  ApiKey: 'apiKey',
  Audit: 'audit',
  AuditBatch: 'auditBatch',
  AuditStatus: 'auditStatus',
  ConsolidatedReport: 'consolidatedReport',
  ContractUrl: 'contractUrl',
  Currency: 'currency',
  Note: 'note',
  Otp: 'otp',
  PendingAction: 'pendingAction',
  Portfolio: 'portfolio',
  PortfolioBankDetails: 'portfolioBankDetails',
  Property: 'property',
  PropertyBankDetails: 'propertyBankDetails',
  PropertyContractUrl: 'propertyContractUrl',
  PropertyCredentials: 'propertyCredentials',
  SalesAgent: 'salesAgent',
  ServiceType: 'serviceType',
  Task: 'task',
  User: 'user',
  UserAccessedProperty: 'userAccessedProperty',
  UserRole: 'userRole'
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const backupArg = args.find(arg => arg.startsWith('--backup='))

  return {
    apply: args.includes('--apply'),
    skipDump: args.includes('--skip-dump'),
    backupPath: backupArg
      ? path.resolve(process.cwd(), backupArg.slice('--backup='.length))
      : undefined
  }
}

function readManifest(backupDir: string): BackupManifest | undefined {
  const manifestPath = path.join(backupDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    return undefined
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest
}

function getDirectoryTimestamp(name: string): string {
  const match = name.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z?)/)
  return match?.[1] ?? name
}

function detectBackupType(backupDir: string): BackupSource | null {
  const manifest = readManifest(backupDir)
  const collectionsDir = path.join(backupDir, 'collections')

  if (
    manifest?.backupType === 'full-database-ejson' &&
    fs.existsSync(collectionsDir)
  ) {
    return {
      type: 'full-ejson',
      dir: backupDir,
      restorePath: collectionsDir,
      manifest
    }
  }

  const mongodumpDir = path.join(backupDir, 'mongodb-dump')
  if (fs.existsSync(mongodumpDir) && fs.statSync(mongodumpDir).isDirectory()) {
    const dbDirs = fs
      .readdirSync(mongodumpDir)
      .filter(entry =>
        fs.statSync(path.join(mongodumpDir, entry)).isDirectory()
      )

    if (dbDirs.length > 0) {
      return {
        type: 'mongodump',
        dir: backupDir,
        restorePath: mongodumpDir
      }
    }
  }

  const hasJsonBackup = PRISMA_JSON_COLLECTIONS.some(collection =>
    fs.existsSync(path.join(backupDir, `${collection}.json`))
  )

  if (hasJsonBackup) {
    return {
      type: 'prisma-json',
      dir: backupDir,
      restorePath: backupDir
    }
  }

  return null
}

function getLatestFullBackupFromPointer(): string | null {
  const pointerFile = path.join(
    process.cwd(),
    'backups',
    'latest-full-backup.txt'
  )
  if (!fs.existsSync(pointerFile)) {
    return null
  }

  const backupDir = fs.readFileSync(pointerFile, 'utf8').trim()
  return fs.existsSync(backupDir) ? backupDir : null
}

function findLatestFullBackup(backupsRoot: string): BackupSource | null {
  if (!fs.existsSync(backupsRoot)) {
    return null
  }

  const candidates = fs
    .readdirSync(backupsRoot)
    .filter(name => {
      const fullPath = path.join(backupsRoot, name)
      return (
        fs.statSync(fullPath).isDirectory() &&
        name.startsWith('full-backup-') &&
        !name.startsWith('safety-')
      )
    })
    .map(name => {
      const fullPath = path.join(backupsRoot, name)
      const source = detectBackupType(fullPath)
      return source ? { name, source } : null
    })
    .filter(
      (entry): entry is { name: string; source: BackupSource } => entry !== null
    )
    .sort((a, b) =>
      getDirectoryTimestamp(b.name).localeCompare(getDirectoryTimestamp(a.name))
    )

  return candidates[0]?.source ?? null
}

function resolveBackupSource(explicitPath?: string): BackupSource {
  if (explicitPath) {
    if (!fs.existsSync(explicitPath)) {
      throw new Error(`Backup path not found: ${explicitPath}`)
    }

    const source = detectBackupType(explicitPath)
    if (!source) {
      throw new Error(
        `No restorable backup found at ${explicitPath}. Expected full-backup, mongodb-dump, or Prisma JSON files.`
      )
    }

    return source
  }

  const pointerBackup = getLatestFullBackupFromPointer()
  if (pointerBackup) {
    const source = detectBackupType(pointerBackup)
    if (source) {
      return source
    }
  }

  const latestFullBackup = findLatestFullBackup(
    path.join(process.cwd(), 'backups')
  )
  if (latestFullBackup) {
    return latestFullBackup
  }

  throw new Error(
    'No restorable full backup found in ./backups. Add a full-backup-* folder or latest-full-backup.txt pointer.'
  )
}

function listPrismaJsonFiles(backupDir: string): string[] {
  return PRISMA_JSON_COLLECTIONS.filter(collection =>
    fs.existsSync(path.join(backupDir, `${collection}.json`))
  )
}

function listFullEjsonCollections(source: BackupSource): string[] {
  const manifestCollections =
    source.manifest?.collections?.map(collection => collection.name) ?? []

  const available = new Set(
    fs
      .readdirSync(source.restorePath)
      .filter(file => file.endsWith('.ejson'))
      .map(file => file.replace(/\.ejson$/, ''))
  )

  const ordered = FULL_BACKUP_COLLECTION_ORDER.filter(name =>
    available.has(name)
  )
  const extras = [...available].filter(
    name => !FULL_BACKUP_COLLECTION_ORDER.includes(name as never)
  )

  if (manifestCollections.length > 0) {
    const orderedFromManifest = manifestCollections.filter(name =>
      available.has(name)
    )
    const missingFromManifest = [...available].filter(
      name => !orderedFromManifest.includes(name)
    )
    return [...orderedFromManifest, ...missingFromManifest]
  }

  return [...ordered, ...extras]
}

function toRawMongoDocument(
  record: Record<string, unknown>
): Record<string, unknown> {
  const { id, ...rest } = record
  const doc: Record<string, unknown> = {
    _id: { $oid: String(id) },
    ...rest
  }

  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id') continue
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      doc[key] = { $date: value }
    }
  }

  return doc
}

async function isMongodumpAvailable(): Promise<boolean> {
  try {
    await execAsync('mongodump --version', { maxBuffer: 1024 * 1024 })
    return true
  } catch {
    return false
  }
}

async function createSafetyDump(): Promise<void> {
  if (await isMongodumpAvailable()) {
    console.log('Using mongodump for safety backup...')
    await backupProductionDatabase()
    return
  }

  console.log('mongodump not found; using full EJSON safety backup instead...')
  await backupFullDatabaseEjson({
    folderPrefix: 'safety-full-backup',
    updateLatestPointer: false
  })
}

async function restoreFromMongodump(
  restorePath: string,
  dbUrl: string
): Promise<void> {
  console.log('\nRestoring MongoDB dump with mongorestore...')
  console.log(`Source: ${restorePath}`)

  const command = `mongorestore --uri="${dbUrl}" --drop "${restorePath}"`
  const { stdout, stderr } = await execAsync(command, {
    maxBuffer: 1024 * 1024 * 20
  })

  if (stdout) console.log(stdout)
  if (stderr) console.log(stderr)

  console.log('MongoDB restore completed.')
}

async function clearCollection(collectionName: string): Promise<void> {
  await prisma.$runCommandRaw({
    delete: collectionName,
    deletes: [{ q: {}, limit: 0 }]
  })
}

async function insertEjsonDocuments(
  collectionName: string,
  documents: unknown[]
): Promise<void> {
  if (documents.length === 0) {
    return
  }

  await prisma.$runCommandRaw({
    insert: collectionName,
    documents: documents as never,
    ordered: false
  })
}

async function insertPrismaJsonRecords(
  collectionName: string,
  records: Record<string, unknown>[]
): Promise<void> {
  if (records.length === 0) {
    return
  }

  const documents = records.map(record => toRawMongoDocument(record))
  await insertEjsonDocuments(collectionName, documents)
}

async function restoreFromFullEjson(source: BackupSource): Promise<void> {
  const collections = listFullEjsonCollections(source)
  if (collections.length === 0) {
    throw new Error(`No .ejson files found in ${source.restorePath}`)
  }

  console.log('\nRestoring full EJSON backup via Prisma...')
  console.log(`Source: ${source.dir}`)
  console.log(`Collections: ${collections.length}`)

  for (const collectionName of [...collections].reverse()) {
    const fileName =
      source.manifest?.collections?.find(
        collection => collection.name === collectionName
      )?.file ?? `${collectionName}.ejson`
    const filePath = path.join(source.restorePath, fileName)
    const documents = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown[]

    console.log(`  Clearing ${collectionName}...`)
    await clearCollection(collectionName)

    if (documents.length === 0) {
      console.log(`  ${collectionName}: 0 records`)
      continue
    }

    console.log(
      `  Inserting ${documents.length} record(s) into ${collectionName}...`
    )
    await insertEjsonDocuments(collectionName, documents)
  }

  console.log('Full EJSON restore completed.')
}

async function restoreFromPrismaJson(backupDir: string): Promise<void> {
  const collections = listPrismaJsonFiles(backupDir)
  if (collections.length === 0) {
    throw new Error(`No Prisma JSON files found in ${backupDir}`)
  }

  console.log('\nRestoring Prisma JSON backup via Prisma...')
  console.log(`Source: ${backupDir}`)
  console.log(`Collections: ${collections.join(', ')}`)

  for (const collectionName of [...collections].reverse()) {
    const filePath = path.join(backupDir, `${collectionName}.json`)
    const records = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
      string,
      unknown
    >[]

    console.log(`  Clearing ${collectionName}...`)
    await clearCollection(collectionName)

    if (records.length === 0) {
      console.log(`  ${collectionName}: 0 records`)
      continue
    }

    console.log(
      `  Inserting ${records.length} record(s) into ${collectionName}...`
    )
    await insertPrismaJsonRecords(collectionName, records)
  }

  console.log('Prisma JSON restore completed.')
}

async function countCollection(collectionName: string): Promise<number> {
  const result = (await prisma.$runCommandRaw({
    count: collectionName,
    query: {}
  })) as { n?: number }

  return result.n ?? 0
}

async function verifyRestore(source: BackupSource): Promise<void> {
  console.log('\nVerifying restored collections...')

  if (source.type === 'full-ejson') {
    for (const collectionName of listFullEjsonCollections(source)) {
      const expected =
        source.manifest?.collections?.find(
          collection => collection.name === collectionName
        )?.count ?? null
      const actual = await countCollection(collectionName)
      const suffix =
        expected === null
          ? ''
          : expected === actual
            ? ''
            : ` (expected ${expected})`
      console.log(`  ${collectionName.padEnd(25)} : ${actual}${suffix}`)
    }
    return
  }

  if (source.type === 'prisma-json') {
    for (const collection of listPrismaJsonFiles(source.restorePath)) {
      const modelName = MODEL_BY_COLLECTION[collection]
      if (!modelName) continue

      // @ts-ignore - dynamic Prisma model access
      const count = await prisma[modelName].count()
      console.log(`  ${collection.padEnd(25)} : ${count}`)
    }
    return
  }

  const dbDirs = fs
    .readdirSync(source.restorePath)
    .filter(entry =>
      fs.statSync(path.join(source.restorePath, entry)).isDirectory()
    )

  for (const dbDir of dbDirs) {
    const files = fs.readdirSync(path.join(source.restorePath, dbDir))
    const bsonFiles = files.filter(file => file.endsWith('.bson'))
    console.log(`  ${dbDir}: ${bsonFiles.length} collection file(s) in backup`)
  }
}

async function main() {
  const options = parseArgs()
  const dbUrl = process.env.DATABASE_URL

  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const source = resolveBackupSource(options.backupPath)

  console.log('========================================')
  console.log('Database Dump And Restore')
  console.log('========================================')
  console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`Backup source: ${source.dir}`)
  console.log(`Backup type: ${source.type}`)

  if (source.type === 'full-ejson') {
    console.log(`Collections: ${listFullEjsonCollections(source).length}`)
    console.log(
      `Documents: ${source.manifest?.collections?.reduce((sum, item) => sum + item.count, 0) ?? 'unknown'}`
    )
  } else if (source.type === 'prisma-json') {
    console.log(
      `JSON collections: ${listPrismaJsonFiles(source.restorePath).join(', ')}`
    )
  } else {
    console.log(`Mongo dump path: ${source.restorePath}`)
  }

  if (!options.apply) {
    console.log('\nDry-run only. Re-run with --apply to:')
    if (!options.skipDump) {
      console.log(
        '  1. Create a safety dump of the current database in ./backups'
      )
    }
    console.log(`  ${options.skipDump ? '1' : '2'}. Restore from ${source.dir}`)
    console.log('\nExamples:')
    console.log('  yarn backup:restore -- --apply')
    console.log('  yarn backup:restore -- --apply --skip-dump')
    console.log(
      '  yarn backup:restore -- --apply --backup=./backups/full-backup-2026-07-20T07-14-53-682Z'
    )
    return
  }

  if (!options.skipDump) {
    console.log('\nPhase 1: Creating safety dump of current database...')
    await createSafetyDump()
  } else {
    console.log('\nPhase 1: Skipped (--skip-dump)')
  }

  console.log('\nPhase 2: Restoring from backup...')
  if (source.type === 'mongodump') {
    await restoreFromMongodump(source.restorePath, dbUrl)
  } else if (source.type === 'full-ejson') {
    await restoreFromFullEjson(source)
  } else {
    await restoreFromPrismaJson(source.restorePath)
  }

  await verifyRestore(source)

  console.log('\n========================================')
  console.log('Dump and restore completed successfully')
  console.log('========================================\n')
}

main()
  .catch(error => {
    console.error('\nDump and restore failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
