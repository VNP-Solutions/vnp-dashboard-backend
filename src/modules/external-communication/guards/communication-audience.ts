import { SetMetadata } from '@nestjs/common'

/**
 * Audiences for tokens signed with JWT_COMMUNICATION_SECRET.
 *
 * The secret is not a server-only credential: `POST /external/user-generate-token` hands a token
 * signed with it to any logged-in browser so the dashboard can call DBMS. Without an audience,
 * that browser token also opens every service route here. The audience says who a token was minted
 * for, so a browser token cannot be replayed against a service seam.
 */
export const COMMUNICATION_AUDIENCE = {
  /** Minted here for the dashboard frontend to call DBMS. Never accepted by our own guards. */
  browser: 'vnp-dashboard-browser',
  /** Minted by the payout service for its calls to us. */
  payoutService: 'vnps-payout-service'
} as const

export const REQUIRED_AUDIENCE_KEY = 'requiredCommunicationAudience'

/** Restricts a route to tokens carrying this audience. */
export const RequireAudience = (audience: string) =>
  SetMetadata(REQUIRED_AUDIENCE_KEY, audience)
