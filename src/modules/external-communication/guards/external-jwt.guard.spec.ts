import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '../../../config/config.service'
import {
  COMMUNICATION_AUDIENCE,
  REQUIRED_AUDIENCE_KEY
} from './communication-audience'
import { ExternalJwtGuard } from './external-jwt.guard'

const SECRET = 'test-communication-secret-at-least-32-chars'

const jwt = new JwtService({})
const config = { jwt: { communicationSecret: SECRET } } as ConfigService

function contextFor(token?: string, handler: () => void = () => {}) {
  const request: Record<string, any> = {
    method: 'POST',
    url: '/external/audits/a1/payout-status',
    headers: token ? { authorization: `Bearer ${token}` } : {}
  }

  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => class Controller {}
    } as unknown as ExecutionContext
  }
}

const guard = () => new ExternalJwtGuard(config, jwt, new Reflector())

/** A route handler decorated the way the payout-status endpoint is. */
function payoutStatusHandler(): () => void {
  const handler = () => {}
  Reflect.defineMetadata(
    REQUIRED_AUDIENCE_KEY,
    COMMUNICATION_AUDIENCE.payoutService,
    handler
  )
  return handler
}

describe('ExternalJwtGuard', () => {
  it('accepts a service token with no audience requirement on the route', () => {
    const token = jwt.sign(
      { type: 'external-communication' },
      { secret: SECRET }
    )
    const { context, request } = contextFor(token)

    expect(guard().canActivate(context)).toBe(true)
    expect(request.externalAuthPayload.type).toBe('external-communication')
  })

  it('rejects a browser token even though it is correctly signed', () => {
    // What /external/user-generate-token hands any logged-in dashboard user.
    const token = jwt.sign(
      { type: 'external-communication', aud: COMMUNICATION_AUDIENCE.browser },
      { secret: SECRET }
    )

    expect(() => guard().canActivate(contextFor(token).context)).toThrow(
      UnauthorizedException
    )
  })

  it('rejects a token minted for another service when the route names its audience', () => {
    const handler = payoutStatusHandler()
    const token = jwt.sign(
      { type: 'external-communication', aud: 'some-other-service' },
      { secret: SECRET }
    )

    expect(() =>
      guard().canActivate(contextFor(token, handler).context)
    ).toThrow(UnauthorizedException)
  })

  it('accepts the payout service on its own route', () => {
    const handler = payoutStatusHandler()
    const token = jwt.sign(
      {
        type: 'external-communication',
        aud: COMMUNICATION_AUDIENCE.payoutService
      },
      { secret: SECRET }
    )

    expect(
      guard().canActivate(contextFor(token, handler).context)
    ).toBe(true)
  })

  it('rejects a token signed with the wrong secret', () => {
    const token = jwt.sign(
      { type: 'external-communication' },
      { secret: 'other-secret' }
    )

    expect(() => guard().canActivate(contextFor(token).context)).toThrow(
      UnauthorizedException
    )
  })

  it('rejects an unsigned (alg=none) token', () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' })
    ).toString('base64url')
    const body = Buffer.from(
      JSON.stringify({ type: 'external-communication' })
    ).toString('base64url')

    expect(() =>
      guard().canActivate(contextFor(`${header}.${body}.`).context)
    ).toThrow(UnauthorizedException)
  })

  it('rejects a missing header', () => {
    expect(() => guard().canActivate(contextFor().context)).toThrow(
      UnauthorizedException
    )
  })
})
