# Portfolio Stats "YTD Reported" Under-reporting - Investigation & Fix

**Date:** 2026-08-29
**Endpoint:** `GET /portfolio/:id/stats`
**Files changed:** `portfolio.service.ts`, `portfolio.controller.ts`, `portfolio.dto.ts`

## Problem Summary

A client reported that the **YTD Reported** card on the portfolio details page showed a value that was too low for **MCR Property Group** (`694a86089e2273523b48087a`), and that a recent Auto Audit Import was not reflected in it.

The card was showing **$1,377,003.67** while the portfolio actually held **$1,436,541.42** of non-archived audit value. **$59,537.75** was invisible.

## Root Cause

Three separate issues combined. Only the first is fixed by this change.

### 1. The amounts were bound to a date window (fixed)

`getStats()` restricted the amount aggregation to a rolling window derived from the `duration` query param (`week` / `month` / `year`, defaulting to a trailing 365 days). Inside the window it used `review_collection_date` when set, and fell back to `created_at` when it was not.

This made the portfolio card the **only** YTD Reported surface in the system with a date filter:

| Surface | Source | Date filter |
| --- | --- | --- |
| Portfolio details card | `PortfolioService.getStats()` | **Rolling window** |
| Property list / details rows | `PropertyService.getAuditAggregatesForProperties()` | None |
| Dashboard global banner | `AuditService.getGlobalStats()` | None |

For MCR this produced two different numbers for the same label: **$1,377,003.67** on the card versus **$1,417,547.30** when summing the YTD Reported column of its own property rows.

### 2. `review_collection_date` is parsed from free text and silently fabricates dates (not fixed)

`AuditService.autoImport()` parses the `Review/Collection Date` column with `parseDate()`, which falls through to a bare `new Date(string)` guarded only by a year range of 1900-2100:

```typescript
// Generic ISO or other parseable string - guard year range to prevent
// new Date("46087") silently producing year 46087
const dt = new Date(s)
return isValidYear(dt) ? dt : null
```

V8's legacy date parser accepts almost anything and **defaults a missing year to 2001**. Observed results:

| Sheet value | Parsed as | Effect under the old window |
| --- | --- | --- |
| `Jul-26` (meaning July 2026) | `2001-07-26` | Excluded - outside the window |
| `Upto December 2026` | `2026-12-01` | Excluded - `lte: now` rejects future dates |
| `Upto February 2026` | `2026-02-01` | Included |
| `January - February 2026` | `2026-02-01` | Included (`January -` is ignored) |

No error is raised in any of these cases. The import succeeds and writes the wrong date.

This is what actually hid the money. Across the whole database, **122 audits worth $53,469.47** carry a year-2001 `review_collection_date`:

- MCR Property Group - 102 audits, **$40,543.63**, batch `MCR 2025-2026`, imported 2026-08-03
- Texas Western Hospitality - 20 audits, **$12,925.84**, batch `Mar-26`, imported 2026-07-03

Comparing the card against the property-row sum for every portfolio in the database, **only these two disagreed**. No legitimately old audit was being excluded anywhere, so 100% of the harm caused by the date window came from this parsing bug.

### 3. Audits on deactivated properties are excluded from the card (not fixed - intentional)

`getStats()` only considers properties where `is_active` is true, but `autoImport()` does not check `is_active` (nor whether the property belongs to the portfolio named in the sheet). An audit can therefore be created against a deactivated property and never appear on the card.

For MCR this accounts for **$18,994.12** on a single audit attached to *The Luxury Collection Hotel Manhattan Midtown* (deactivated 2026-06-22). Database-wide this hides 6 audits worth $24,210.43.

This behaviour was reviewed and **deliberately kept**: the card should continue to report active properties only.

## Not a Regression

The date binding was checked against the full git history and is **not** something a merge reintroduced:

- `8fd648a` (2026-04-26) introduced it. Before that commit the window ran on `created_at`, so the amounts were always date-bound, just by a different field.
- `62b744e` (2026-05-12, PR #158, branch `u/portfolio-stats-from-started-at-fallback`) refined it by adding `{ review_collection_date: { isSet: false } }`, because on MongoDB Prisma's `{ field: null }` does not match documents where the field was never stored. That fix is still intact and is preserved by this change.

Across all local and remote branches, exactly those two commits ever changed the number of `review_collection_date` occurrences in `portfolio.service.ts`. Nothing ever removed the binding.

## Fix Applied

The single where-clause used for both the amounts and the recent-audits list was split in two. Amounts are now unbounded; the recent-audits list keeps its window.

### `src/modules/portfolio/portfolio.service.ts` - `getStats()`

```typescript
// Amounts are lifetime totals for the portfolio's active properties. They must not be bound to
// a date window: review_collection_date is free text on import and routinely parses to a wrong
// year, which silently drops audits from the cards. Property rows and the global banner sum the
// same amounts unbounded, so this keeps all three surfaces in agreement.
const auditAmountsWhere: Prisma.AuditWhereInput = {
  property_id: { in: propertyIds },
  is_archived: false
}

// The recent-audits list stays inside the requested duration: use review_collection_date when
// set; fall back to created_at when it is not (legacy rows). On MongoDB, `field: null` does not
// match documents where the field was never stored; include `isSet: false` so omitted
// review_collection_date still uses created_at for the window.
const auditInDurationWhere: Prisma.AuditWhereInput = {
  ...auditAmountsWhere,
  OR: [
    { review_collection_date: { gte: startDate, lte: now } },
    {
      AND: [
        {
          OR: [
            { review_collection_date: null },
            { review_collection_date: { isSet: false } }
          ]
        },
        { created_at: { gte: startDate, lte: now } }
      ]
    }
  ]
}
```

The amount aggregation switched from `auditInDurationWhere` to `auditAmountsWhere`:

```typescript
const auditAggregates = await this.prisma.audit.groupBy({
  by: ['type_of_ota'],
  where: auditAmountsWhere,
  _sum: { /* ... */ }
})
```

`recent_audits` still uses `auditInDurationWhere`, because the UI renders it as a recent-activity table (`recent-audits-table.tsx`).

### Documentation updates

Three Swagger descriptions incorrectly stated that the amounts were duration-bound:

- `PortfolioController.getStats()` `@ApiOperation` summary
- `PortfolioStatsQueryDto.duration` - now states it scopes the recent-audits list only
- `PortfolioStatsResponseDto.amount_collectable` / `amount_confirmed` - now state they are lifetime totals across active properties

## Behaviour Change

| | Before | After |
| --- | --- | --- |
| Amount scope | Active properties, non-archived, within the `duration` window | Active properties, non-archived, **all time** |
| Responds to the dashboard date picker | Yes | No |
| Agrees with property rows and global banner | No | Yes |
| `recent_audits` | Windowed | Windowed (unchanged) |
| `total_audit_count` | `ConsolidatedReport` count | Unchanged |

The `duration` query param is still required and still drives `recent_audits`, so this is not a breaking API change.

## Verification

Verified read-only against production using the application's own Prisma client and the exact new where-clause, for MCR Property Group:

```
Active properties: 135

NEW  YTD Reported : $1,417,547.30  (1,447 audits)
     expedia $818,332.90 | agoda $324,307.91 | booking $274,906.49
NEW  YTD Confirmed: $1,417,547.30

OLD  YTD Reported : $1,377,003.67  (1,345 audits)

Delta restored    : +$40,543.63    (+102 audits)
```

The recovered amount is exactly the 102 year-2001 audits and nothing else. `recent_audits` still returns its 10 rows.

- `npx tsc --noEmit` - 0 errors
- `npx nest build` - succeeds
- ESLint on the changed files - only a pre-existing unused `ServiceTokenGuard` import in `portfolio.controller.ts`, untouched by this change

No test suite exists for this module.

## Known Remaining Issues

These were identified during the investigation and are **not** addressed by this change.

1. **`parseDate()` still fabricates dates.** Any free text V8 can coerce into a year between 1900 and 2100 is accepted without error. The 122 existing year-2001 audits keep their wrong values; they are simply no longer excluded from the totals. Those dates remain visibly wrong wherever `review_collection_date` is displayed or sorted, including the recent-audits table, which is still windowed. A future-dated import (for example `Upto December 2026`) would still be missing from `recent_audits` because of the `lte: now` bound.

2. **Existing bad data has not been backfilled.** 122 audits across MCR Property Group and Texas Western Hospitality still hold `2001-xx-xx` dates.

3. **Deactivated properties still hide audits.** $24,210.43 across 6 audits database-wide, $18,994.12 of it on MCR. Intentional, but the import does not warn when it writes an audit to an inactive property.

4. **Auto Audit Import never de-duplicates.** It always inserts. Re-running the same file creates a second complete set of audits and would double the card.

5. **Import validation is all-or-nothing and unmatched hotel IDs abort the run.** In the MCR case five hotel IDs (`80246`, `2651763`, `1364976`, `10627700`, `80324`) did not exist as properties, and the corresponding rows appear to have been manually stripped from the sheet before upload. This is the most likely explanation for the ~$2,289.02 difference between the client's expected total and the $671,510.97 actually present in the imported file.
