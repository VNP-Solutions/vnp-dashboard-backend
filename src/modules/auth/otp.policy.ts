import { randomInt } from 'crypto'

/**
 * What a code authorises. Lookups filter on it, so a code minted to reset a password cannot be
 * presented at login, and a payout code cannot log anyone in.
 */
export const OTP_PURPOSE = {
  login: 'login',
  passwordReset: 'password_reset',
  adminPasswordReset: 'admin_password_reset',
  adminVerify: 'admin_verify',
  payout: 'payout'
} as const

export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE]

/** Wrong guesses allowed against one code before it is spent. */
export const MAX_OTP_ATTEMPTS = 5

/** Six digits, from the CSPRNG: `Math.random` is predictable from a few observed codes. */
export function generateOtpCode(): number {
  return randomInt(100000, 1000000)
}

export function hasExhaustedAttempts(
  attempts: number | null | undefined
): boolean {
  return (attempts ?? 0) + 1 >= MAX_OTP_ATTEMPTS
}
