import {
  generateOtpCode,
  hasExhaustedAttempts,
  MAX_OTP_ATTEMPTS,
  OTP_PURPOSE
} from './otp.policy'

describe('generateOtpCode', () => {
  it('always returns six digits', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateOtpCode()
      expect(code).toBeGreaterThanOrEqual(100000)
      expect(code).toBeLessThanOrEqual(999999)
    }
  })

  it('does not repeat itself over a small sample', () => {
    const codes = new Set(Array.from({ length: 200 }, generateOtpCode))
    // Birthday collisions are possible in a 900k space; a near-constant generator is not.
    expect(codes.size).toBeGreaterThan(190)
  })
})

describe('hasExhaustedAttempts', () => {
  it('allows the configured number of guesses', () => {
    expect(hasExhaustedAttempts(0)).toBe(false)
    expect(hasExhaustedAttempts(MAX_OTP_ATTEMPTS - 2)).toBe(false)
  })

  it('reports exhaustion on the last allowed guess', () => {
    expect(hasExhaustedAttempts(MAX_OTP_ATTEMPTS - 1)).toBe(true)
    expect(hasExhaustedAttempts(MAX_OTP_ATTEMPTS + 10)).toBe(true)
  })

  it('treats a missing counter as no attempts yet', () => {
    // Rows written before the column existed read back as null.
    expect(hasExhaustedAttempts(null)).toBe(false)
    expect(hasExhaustedAttempts(undefined)).toBe(false)
  })
})

describe('OTP_PURPOSE', () => {
  it('keeps every purpose distinct', () => {
    const values = Object.values(OTP_PURPOSE)
    expect(new Set(values).size).toBe(values.length)
  })
})
