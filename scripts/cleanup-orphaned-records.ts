import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupOrphanedRecords() {
  try {
    console.log(
      'Starting cleanup of orphaned notes, tasks, and user access rows...'
    )

    // Get all user IDs that exist
    const users = await prisma.user.findMany({
      select: { id: true }
    })
    const validUserIds = users.map(u => u.id)
    console.log(`Found ${validUserIds.length} valid users`)

    // Find and delete notes with non-existent users
    const notesWithInvalidUsers = await prisma.note.findMany({
      where: {
        user_id: {
          not: {
            in: validUserIds
          }
        }
      }
    })
    console.log(`Found ${notesWithInvalidUsers.length} orphaned notes`)

    if (notesWithInvalidUsers.length > 0) {
      const deletedNotes = await prisma.note.deleteMany({
        where: {
          id: {
            in: notesWithInvalidUsers.map(n => n.id)
          }
        }
      })
      console.log(`Deleted ${deletedNotes.count} orphaned notes`)
    }

    // Find and delete tasks with non-existent users
    const tasksWithInvalidUsers = await prisma.task.findMany({
      where: {
        user_id: {
          not: {
            in: validUserIds
          }
        }
      }
    })
    console.log(`Found ${tasksWithInvalidUsers.length} orphaned tasks`)

    if (tasksWithInvalidUsers.length > 0) {
      const deletedTasks = await prisma.task.deleteMany({
        where: {
          id: {
            in: tasksWithInvalidUsers.map(t => t.id)
          }
        }
      })
      console.log(`Deleted ${deletedTasks.count} orphaned tasks`)
    }

    // UserAccessedProperty rows whose user was removed (orphan user_id breaks Prisma user includes)
    if (validUserIds.length === 0) {
      console.log(
        'No users in database — skipping UserAccessedProperty orphan cleanup'
      )
    } else {
      const orphanedAccess = await prisma.userAccessedProperty.findMany({
        where: {
          user_id: {
            not: {
              in: validUserIds
            }
          }
        },
        select: { id: true, user_id: true }
      })
      console.log(
        `Found ${orphanedAccess.length} UserAccessedProperty row(s) with missing user`
      )

      if (orphanedAccess.length > 0) {
        const deletedAccess = await prisma.userAccessedProperty.deleteMany({
          where: {
            id: {
              in: orphanedAccess.map(r => r.id)
            }
          }
        })
        console.log(
          `Deleted ${deletedAccess.count} orphaned UserAccessedProperty row(s)`
        )
      }
    }

    console.log('Cleanup completed successfully!')
  } catch (error) {
    console.error('Error during cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

void cleanupOrphanedRecords()
