import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { JwtPayload } from './jwt'

// Identidade derivada do token pelo AuthGuard e anexada em `req.user`.
export interface AuthUser {
  userId?: string
  email?: string
  name?: string
}

// Açúcar para ler a identidade verificada num handler: `@CurrentUser() user`.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>()
    return req.user ?? {}
  },
)

export function payloadToUser(payload: JwtPayload): AuthUser {
  return { userId: payload.sub, email: payload.email, name: payload.name }
}
