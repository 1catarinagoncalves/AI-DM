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

// US-99: mesma verificação, sem 401. Rota pública que PERSONALIZA quando há token:
// `GET /systems` é o healthCheckPath do Render (render.yaml) e tem de responder 200
// a um request anônimo — mas serve o `config` no locale do dono quando o token vem.
// Token ausente ou inválido não popula `req.user`: `@CurrentUser()` devolve `{}` e o
// handler cai no locale default. Anônimo, nunca a identidade que o token alegava.
@Injectable()
export class OptionalAuthGuard extends AuthGuard {
  override canActivate(context: ExecutionContext): boolean {
    try {
      return super.canActivate(context)
    } catch {
      return true
    }
  }
}
