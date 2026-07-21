import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { verifyJwt } from './jwt'
import { payloadToUser, type AuthUser } from './current-user.decorator'

// US-61: guard de verificação. Todo request às rotas de dados do jogador tem de
// trazer `Authorization: Bearer <jwt>`; o guard verifica o HS256 com AUTH_SECRET
// e deriva a identidade em `req.user`. O `userId` do CORPO deixa de ser confiável
// — os controllers passam a ler `@CurrentUser()`. Sem token válido → 401.
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>()
    const header = req.headers['authorization']
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente')
    }
    try {
      const payload = verifyJwt(header.slice('Bearer '.length), process.env['AUTH_SECRET'] ?? '')
      req.user = payloadToUser(payload)
      return true
    } catch {
      throw new UnauthorizedException('Token de autenticação inválido')
    }
  }
}
