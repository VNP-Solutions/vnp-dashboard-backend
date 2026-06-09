import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { ApiKeyAuthContext } from '../api-key.interface'

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyAuthContext => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ apiKey: ApiKeyAuthContext }>()
    return request.apiKey
  }
)
