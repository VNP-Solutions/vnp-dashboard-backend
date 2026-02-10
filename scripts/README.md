# Database Fix Scripts

This folder contains utility scripts for fixing and maintaining database data.

## Available Scripts

### Fix Duplicate Expedia IDs

**Script:** `fix-duplicate-expedia-ids.ts`

**Purpose:** Fixes duplicate Expedia IDs in the `PropertyCredentials` table by appending letter suffixes to duplicates.

**How it works:**
- Finds all properties with duplicate Expedia IDs
- Keeps the first occurrence unchanged
- Appends letters (a, b, c, etc.) to subsequent duplicates
- Example:
  - Property 1: Expedia ID `1234` → Remains `1234`
  - Property 2: Expedia ID `1234` → Changes to `1234a`
  - Property 3: Expedia ID `1234` → Changes to `1234b`
  - And so on...

**Usage:**
```bash
# Run the script
yarn fix:expedia-ids

# Or directly with ts-node
ts-node scripts/fix-duplicate-expedia-ids.ts
```

**Output:**
The script will display:
- Total number of properties processed
- List of duplicate Expedia ID groups
- Each property being updated with its new ID
- Summary of total updates made

**Safety:**
- The script runs in a transaction-safe manner
- Uses Prisma's safe update methods
- Logs all changes for review
- Automatically disconnects from database when complete

---

### Fix Encrypted Passwords

**Script:** `fix-encrypted-passwords.ts`

**Purpose:** Fixes encrypted password formats in the database.

**Usage:**
```bash
yarn fix:passwords
```

---

## Best Practices

1. **Always backup your database before running fix scripts**
2. Run scripts in a test environment first
3. Review the console output to verify changes
4. Keep scripts for future reference and potential rollbacks

## Creating New Fix Scripts

When creating new fix scripts:
1. Use TypeScript with PrismaClient
2. Add proper error handling
3. Include detailed console logging
4. Add the script command to `package.json`
5. Document the script in this README
