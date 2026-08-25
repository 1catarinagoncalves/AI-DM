import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { verifyJwt } from './jwt'
import { payloadToUser, type AuthUser } from './current-user.decorator'
import { PrismaService } from '../prisma.service'

// US-61: guard de verificação. Todo request às rotas de dados do jogador tem de
// trazer `Authorization: Bearer <jwt>`; o guard verifica o HS256 com AUTH_SECRET
// e deriva a identidade em `req.user`. O `userId` do CORPO deixa de ser confiável
// — os controllers passam a ler `@CurrentUser()`. Sem token válido → 401.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(protected readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>()
    const header = req.headers['authorization']
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente')
    }
    let user: AuthUser
    try {
      user = payloadToUser(verifyJwt(header.slice('Bearer '.length), process.env['AUTH_SECRET'] ?? ''))
    } catch {
      throw new UnauthorizedException('Token de autenticação inválido')
    }
    await this.assertUserExists(user)
    req.user = user
    return true
  }

  // 25/08/2026: assinatura válida não é prova de que a conta existe. Um token cujo `sub`
  // não tem linha em `User` (login feito contra outro banco, conta apagada) atravessava o
  // guard e só estourava no INSERT, como 500 de FK (`Character_userId_fkey`). O cookie de
  // sessão vive 30 dias e o `/auth/sync` só roda no PRIMEIRO login (apps/web/src/auth.ts),
  // então nada se re-sincronizava sozinho: o 401 daqui é o sinal que faz o web deslogar.
  // O token de bootstrap do login ainda não tem `sub` — é ele que vai criar a conta.
  private async assertUserExists(user: AuthUser): Promise<void> {
    if (!user.userId) return
    const rows = await this.prisma.user.count({ where: { id: user.userId } })
    if (rows === 0) throw new UnauthorizedException(`Sessão de utilizador desconhecido (${user.userId}) — entre de novo`)
  }
}

// US-99: mesma verificação, sem 401. Rota pública que PERSONALIZA quando há token:
// `GET /systems` é o healthCheckPath do Render (render.yaml) e tem de responder 200
// a um request anônimo — mas serve o `config` no locale do dono quando o token vem.
// Token ausente ou inválido não popula `req.user`: `@CurrentUser()` devolve `{}` e o
// handler cai no locale default. Anônimo, nunca a identidade que o token alegava.
@Injectable()
export class OptionalAuthGuard extends AuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context)
    } catch {
      return true
    }
  }
}
