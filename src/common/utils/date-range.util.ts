/**
 * Shared date-range helper for "duration"-scoped stats endpoints
 * (portfolio stats, property stats, global audit stats).
 */

export type StatsDuration = 'week' | 'month' | 'year'

/**
 * Compute the [startDate, endDate] window for a given duration.
 * - week/month: rolling window ending now (last 7 / 30 days)
 * - year: calendar year to date - Jan 1 00:00:00 of the current year through now,
 *   so the window automatically rolls to the new year once the calendar flips
 */
export function getDurationDateRange(
  duration: StatsDuration,
  now: Date = new Date()
): { startDate: Date; endDate: Date } {
  let startDate: Date

  switch (duration) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case 'year':
    default:
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
  }

  return { startDate, endDate: now }
}
