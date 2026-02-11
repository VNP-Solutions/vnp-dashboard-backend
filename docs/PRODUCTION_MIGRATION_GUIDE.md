# Production Migration Execution Guide

## Overview

This guide provides step-by-step instructions for safely migrating the VNP Dashboard Backend production database from the main branch schema to the staging branch schema.

**IMPORTANT**: Read this entire guide before starting the migration.

## Pre-Migration Requirements

### 1. Prerequisites Checklist

Before starting, ensure:

- [ ] MongoDB Database Tools installed on your system
  - Windows: `choco install mongodb-database-tools`
  - Mac: `brew install mongodb-database-tools`
  - Linux: `sudo apt-get install mongodb-database-tools`
- [ ] Production database URL configured in `.env` file
- [ ] All team members notified of scheduled downtime
- [ ] You have sufficient disk space for backup (estimate 2x current DB size)
- [ ] You have tested migration scripts on staging/local database
- [ ] Rollback procedure understood and documented
- [ ] Backup restoration tested at least once

### 2. Environment Setup

Verify your `.env` file contains the correct production database URL:

```bash
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority"
```

### 3. Test Connection

Test database connectivity:

```bash
yarn generate
```

If this succeeds, your database connection is working.

## Migration Timeline

**Estimated Total Time: 45-60 minutes**

- Pre-migration backup: 5-10 minutes
- Data transformation: 5-10 minutes  
- Schema push: 2-5 minutes
- Validation: 5-10 minutes
- Application rebuild and test: 10-15 minutes
- Buffer for issues: 10-20 minutes

## Step-by-Step Migration Procedure

### Phase 1: Pre-Migration Backup (Critical!)

**⏰ Estimated time: 5-10 minutes**

1. **Stop the production application**
   
   This prevents any new data writes during migration.
   
   ```bash
   # Stop your production server
   # Method depends on your deployment (PM2, Docker, systemd, etc.)
   pm2 stop vnp-dashboard-backend
   # OR
   docker stop vnp-dashboard-backend
   # OR
   systemctl stop vnp-dashboard-backend
   ```

2. **Create production database backup**

   ```bash
   yarn backup:db
   ```

   **Expected output:**
   ```
   ========================================
   Production Database Backup Script
   ========================================

   ✓ Database connection string loaded
   ✓ Backup directory: /path/to/backups/backup-2026-02-11T10-30-00-000Z

   📊 Collecting database statistics...

     User                      : 15
     Portfolio                 : 8
     Property                  : 45
     PropertyBankDetails       : 42
     ...

   ✓ Statistics saved
   ✓ Schema backed up
   💾 Creating MongoDB backup with mongodump...
   ✓ MongoDB backup completed
   
   ✅ BACKUP COMPLETED SUCCESSFULLY!
   ```

3. **Verify backup was created**

   ```bash
   # Check backup directory
   ls -la backups/
   ```

   You should see a new directory with timestamp like `backup-2026-02-11T10-30-00-000Z`.

4. **Review backup manifest**

   ```bash
   cat backups/backup-*/backup-manifest.json
   ```

   Verify the `totalRecords` count looks reasonable for your database.

**🛑 CHECKPOINT: Do not proceed if backup failed or looks incomplete!**

### Phase 2: Data Transformation

**⏰ Estimated time: 5-10 minutes**

This step migrates existing PropertyBankDetails records from the old schema to the new schema structure.

1. **Run data transformation script**

   ```bash
   yarn migrate:bank-details
   ```

   **Expected output:**
   ```
   ========================================
   PropertyBankDetails Schema Migration
   ========================================

   📊 Found 42 PropertyBankDetails records to migrate

   🔄 Processing records...

     ✓ 507f1f77... | HSBCGB2LXXX → SWIFT: HSBCGB2LXXX
     ✓ 507f1f78... | GB82WEST12345698765432 → IBAN: GB82WEST12345698765432
     ✓ 507f1f79... | (empty) → (both null)
     ...

   ========================================
   Migration Summary
   ========================================
   Total records:         42
   Successfully migrated: 42
   Skipped:              0
   Errors:               0
   ========================================

   ✅ All records migrated successfully!
   You can now proceed with: yarn push
   ```

2. **Review migration log**

   A detailed log file is saved in `backups/migration-log-*.json`. Review it for any warnings or issues.

   ```bash
   cat backups/migration-log-*.json
   ```

3. **If errors occurred**

   - Review the error messages
   - Check if any records need manual intervention
   - If errors are critical, STOP and restore from backup
   - If errors are minor (e.g., null values), document and proceed

**🛑 CHECKPOINT: Do not proceed if migration had critical errors!**

### Phase 3: Schema Push

**⏰ Estimated time: 2-5 minutes**

This updates the MongoDB schema to match the new Prisma schema (adds new fields, removes old field).

1. **Push new schema to database**

   ```bash
   yarn push
   ```

   **Expected output:**
   ```
   Prisma schema loaded from prisma/schema.prisma
   Datasource "db": MongoDB database

   🚀  Your database is now in sync with your Prisma schema.
   ```

   **⚠️ Warning messages are normal:**
   - Warnings about fields being renamed or removed
   - Warnings about adding new fields

2. **Regenerate Prisma Client**

   ```bash
   yarn generate
   ```

   This updates the TypeScript types to match the new schema.

### Phase 4: Validation

**⏰ Estimated time: 5-10 minutes**

Validate that the migration was successful and data integrity is maintained.

1. **Run validation script**

   ```bash
   yarn validate:migration
   ```

   **Expected output:**
   ```
   ========================================
   Post-Migration Validation
   ========================================

   1️⃣ Verifying PropertyBankDetails record count...
      ✓ Found 42 PropertyBankDetails records

   2️⃣ Verifying new schema fields are accessible...
      ✓ All new fields accessible

   3️⃣ Verifying old field (swift_bic_iban) is removed...
      ✓ Old field removed from schema

   4️⃣ Checking data integrity...
      ✓ All records have valid IDs

   5️⃣ Verifying foreign key relationships...
      ✓ All foreign key relationships valid

   6️⃣ Analyzing IBAN and SWIFT distribution...
      ℹ Records with IBAN: 15
      ℹ Records with SWIFT: 25
      ℹ Records with both: 0
      ℹ Records with neither: 2

   7️⃣ Sample data review...
      [Sample records displayed]

   8️⃣ Verifying all collections are intact...
      [Collection counts displayed]

   ========================================
   Validation Summary
   ========================================
   Total checks: 8
   Passed: 8 ✓
   Failed: 0
   ========================================

   ✅ ALL VALIDATION CHECKS PASSED!
   Migration completed successfully.
   ```

2. **Review validation report**

   ```bash
   cat backups/validation-report-*.json
   ```

3. **If validation failed**

   - Review which checks failed
   - If critical (foreign keys, missing data), **STOP and restore from backup**
   - If minor issues, document them and assess impact

**🛑 CHECKPOINT: Do not proceed if validation failed critical checks!**

### Phase 5: Application Rebuild and Testing

**⏰ Estimated time: 10-15 minutes**

1. **Rebuild the application**

   ```bash
   yarn build
   ```

   Ensure build completes without errors.

2. **Test application startup**

   ```bash
   yarn start:prod
   ```

   The application should start without errors. Look for:
   - ✓ Server started successfully
   - ✓ Database connected
   - ✓ No schema errors in logs

3. **Quick smoke test**

   Test critical endpoints (use curl, Postman, or your API testing tool):

   ```bash
   # Health check
   curl http://localhost:3000/

   # Get property bank details (replace :id with actual ID)
   curl http://localhost:3000/property-bank-details/:id \
     -H "Authorization: Bearer YOUR_TOKEN"

   # Create bank details (test POST)
   # Update bank details (test PUT)
   ```

4. **Monitor application logs**

   Watch for any errors or warnings in the first few minutes of operation.

**🛑 CHECKPOINT: If application won't start or critical endpoints fail, STOP and restore from backup!**

### Phase 6: Resume Production

**⏰ Estimated time: 2-5 minutes**

If all tests passed:

1. **Restart production server**

   ```bash
   # Restart your production server
   pm2 restart vnp-dashboard-backend
   # OR
   docker start vnp-dashboard-backend
   # OR  
   systemctl start vnp-dashboard-backend
   ```

2. **Monitor production**

   - Check application logs for errors
   - Monitor server resources (CPU, memory, disk)
   - Test a few user flows manually
   - Watch for any error reports

3. **Notify team**

   Inform the team that migration is complete and production is live.

## Rollback Procedure

If something goes wrong at any stage, follow this procedure immediately:

### Step 1: Stop Everything

```bash
# Stop the application
pm2 stop vnp-dashboard-backend
```

### Step 2: Restore Database from Backup

```bash
# Get the backup directory path from the backup:db output
mongorestore --uri="YOUR_PRODUCTION_DATABASE_URL" \
  --drop \
  /path/to/backups/backup-TIMESTAMP/mongodb-dump
```

**⚠️ Important:** The `--drop` flag will drop existing collections before restoring.

### Step 3: Switch to Main Branch

```bash
git checkout main
```

### Step 4: Rebuild and Restart

```bash
yarn generate
yarn build
yarn start:prod
```

### Step 5: Verify Rollback

- Check that application starts
- Test critical endpoints
- Verify data is restored

### Step 6: Investigate

- Review error logs
- Identify what went wrong
- Test fix in staging environment before retrying

## Post-Migration Tasks

### Immediate (Within 1 hour)

- [ ] Monitor application logs
- [ ] Test all PropertyBankDetails CRUD operations
- [ ] Verify user-reported issues are minimal
- [ ] Check database performance metrics

### Short-term (Within 24 hours)

- [ ] Review all system logs for anomalies
- [ ] Test all major user workflows
- [ ] Monitor database query performance
- [ ] Verify no data integrity issues reported

### Medium-term (Within 1 week)

- [ ] Create PR to merge staging → main
- [ ] Update deployment documentation
- [ ] Archive backup files (retain for 30+ days)
- [ ] Document lessons learned
- [ ] Update team on schema changes

## Code Merge to Main Branch

Once migration is validated and production is stable:

```bash
# Ensure you're on staging branch
git checkout staging

# Create PR from staging to main
gh pr create \
  --title "Production Migration: Merge Staging to Main" \
  --body "$(cat <<'EOF'
## Production Migration Complete

This PR merges all staging changes to main after successful production database migration.

### Schema Changes
- Updated PropertyBankDetails model with new fields
- Split swift_bic_iban into iban_number and swift_bic_number
- Added 5 new optional fields for enhanced bank details

### Migration Details
- Migration completed: [DATE/TIME]
- Records migrated: [COUNT]
- Validation: All checks passed
- Downtime: [DURATION]

### Testing
- [x] Production database migrated successfully
- [x] All validation checks passed
- [x] Application running without errors
- [x] Critical endpoints tested and functional

### Deployment Notes
Future deployments to production can use the standard deployment process. Database schema is now in sync with staging.

EOF
)"

# After approval, merge the PR
# Then deploy to production if needed
```

## Troubleshooting

### Issue: mongodump not found

**Solution:** Install MongoDB Database Tools
- Windows: `choco install mongodb-database-tools`
- Mac: `brew install mongodb-database-tools`
- Linux: `sudo apt-get install mongodb-database-tools`

### Issue: Out of disk space during backup

**Solution:** 
- Free up disk space
- Use external storage for backups
- Compress old backups

### Issue: Migration script fails with Prisma errors

**Solution:**
- Ensure `yarn generate` was run
- Check DATABASE_URL is correct
- Verify database connectivity

### Issue: Validation shows data loss

**Solution:**
- **STOP immediately**
- Do NOT proceed with deployment
- Restore from backup
- Investigate data transformation logic

### Issue: Application won't start after migration

**Solution:**
- Check application logs for specific errors
- Verify `yarn build` completed successfully
- Ensure all environment variables are set
- If critical, restore from backup

## Support Contacts

- **Technical Lead:** [NAME/CONTACT]
- **Database Admin:** [NAME/CONTACT]
- **DevOps:** [NAME/CONTACT]
- **Emergency Escalation:** [CONTACT]

## Appendix: Commands Quick Reference

```bash
# Full migration sequence
yarn backup:db                    # 1. Create backup
yarn migrate:bank-details         # 2. Transform data
yarn push                         # 3. Push schema
yarn generate                     # 4. Regenerate client
yarn validate:migration           # 5. Validate
yarn build                        # 6. Build app
yarn start:prod                   # 7. Start app

# Rollback sequence
mongorestore --uri="..." --drop /path/to/backup
git checkout main
yarn generate && yarn build && yarn start:prod
```

## Notes

- Keep all backup files until migration is verified stable (minimum 30 days)
- Document actual downtime and any issues encountered
- Update this guide based on real migration experience
- Share lessons learned with the team

---

**Last Updated:** 2026-02-11  
**Version:** 1.0  
**Author:** Migration Script Generator
