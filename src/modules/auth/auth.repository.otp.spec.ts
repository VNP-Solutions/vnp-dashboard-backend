import { AuthRepository } from './auth.repository'
import { OTP_PURPOSE } from './otp.policy'
import { PrismaService } from '../prisma/prisma.service'

function prismaStub() {
  return {
    otp: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 })
    }
  }
}

function repository(prisma: ReturnType<typeof prismaStub>) {
  return new AuthRepository(prisma as unknown as PrismaService)
}

describe('OTP lookups are scoped to one purpose', () => {
  it('asks only for codes of the purpose it was given', async () => {
    const prisma = prismaStub()
    await repository(prisma).findValidOtp('user-1', 123456, OTP_PURPOSE.login)

    const where = prisma.otp.findFirst.mock.calls[0][0].where
    expect(where.purpose).toBe(OTP_PURPOSE.login)
    // A payout code carries a scope; a login lookup must not match one.
    expect(where.payout_scope).toBeNull()
    expect(where.is_used).toBe(false)
  })

  it('keeps payout codes out of the login flow and vice versa', async () => {
    const prisma = prismaStub()
    const repo = repository(prisma)

    await repo.findValidOtp('user-1', 123456, OTP_PURPOSE.login)
    await repo.findValidOtp('user-1', 123456, OTP_PURPOSE.payout, {
      payoutScope: 'fingerprint-abc'
    })

    const [loginCall, payoutCall] = prisma.otp.findFirst.mock.calls
    expect(loginCall[0].where.purpose).toBe(OTP_PURPOSE.login)
    expect(payoutCall[0].where.purpose).toBe(OTP_PURPOSE.payout)
    expect(payoutCall[0].where.payout_scope).toBe('fingerprint-abc')
  })

  it('spends older codes of the same purpose when issuing a new one', async () => {
    const prisma = prismaStub()
    await repository(prisma).createOtp(
      'user-1',
      123456,
      new Date(Date.now() + 60_000),
      OTP_PURPOSE.passwordReset
    )

    expect(prisma.otp.updateMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        purpose: OTP_PURPOSE.passwordReset,
        is_used: false
      },
      data: { is_used: true }
    })
    const created = prisma.otp.create.mock.calls[0][0].data
    expect(created.purpose).toBe(OTP_PURPOSE.passwordReset)
    // Mongo does not match an absent field against a `null` filter, and the lookup pins this to
    // null — omitting it here made every non-payout code unmatchable.
    expect(created.payout_scope).toBeNull()
  })
})

describe('registerFailedOtpAttempt', () => {
  it('counts the guess and leaves the code usable while attempts remain', async () => {
    const prisma = prismaStub()
    prisma.otp.findMany.mockResolvedValue([{ id: 'otp-1', attempts: 0 }])

    const exhausted = await repository(prisma).registerFailedOtpAttempt(
      'user-1',
      OTP_PURPOSE.login
    )

    expect(exhausted).toBe(false)
    expect(prisma.otp.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['otp-1'] } },
      data: { attempts: { increment: 1 } }
    })
  })

  it('spends the code once the guesses run out', async () => {
    const prisma = prismaStub()
    prisma.otp.findMany.mockResolvedValue([{ id: 'otp-1', attempts: 4 }])

    const exhausted = await repository(prisma).registerFailedOtpAttempt(
      'user-1',
      OTP_PURPOSE.login
    )

    expect(exhausted).toBe(true)
    expect(prisma.otp.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['otp-1'] } },
      data: { is_used: true }
    })
  })

  it('does nothing when the user has no live code', async () => {
    const prisma = prismaStub()

    expect(
      await repository(prisma).registerFailedOtpAttempt(
        'user-1',
        OTP_PURPOSE.login
      )
    ).toBe(false)
    expect(prisma.otp.updateMany).not.toHaveBeenCalled()
  })
})
