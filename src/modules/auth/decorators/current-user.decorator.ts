import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface RequestWithUser {
  user?: Record<string, unknown>
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>()
    return request.user ?? {}
  }
)
