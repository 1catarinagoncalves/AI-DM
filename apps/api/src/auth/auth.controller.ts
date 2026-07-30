import { Body, Controller, Patch, Post, UnauthorizedException, UseGuards } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { z } from 'zod'
import { LOCALES } from '@ai-dm/shared'
import { AuthService } from './auth.service'
import { AuthGuard } from './auth.guard'
import { zodBody } from '../openapi'
import { CurrentUser, type AuthUser } from './current-user.decorator'

// US-97: só as duas chaves canônicas entram no banco. Tag solta ('en', 'pt-PT') é
// normalizada no cliente antes de chegar aqui; aqui é fronteira de confiança.
const SetLocaleSchema = z.object({ locale: z.enum(LOCALES) })
// No sync a preferência é opcional: o token de bootstrap do web pode não trazer nada
// (login direto, sem escolha prévia) — aí a conta nova nasce no default pt-BR.
const SyncSchema = z.object({ locale: z.enum(LOCALES).optional() })

// US-61: ponto de entrada do login. O web (Auth.js), após verificar o Google,
// assina um token de bootstrap com `{ email, name }` e chama este endpoint. O
// guard verifica a assinatura (prova que veio do nosso web); a identidade sai do
// TOKEN, nunca do corpo. Devolve o `userId` real para o web guardar na sessão.
@ApiTags('Autenticação')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Upsert do utilizador pela identidade Google verificada (do token) e, no primeiro login, reivindicação dos órfãos da era anônima.' })
  @ApiBody({ schema: zodBody(SyncSchema, { locale: 'en-US' }), required: false })
  @Post('sync')
  sync(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    if (!user.email) throw new UnauthorizedException('Token sem email')
    // US-97: o corpo carrega SÓ a preferência de idioma do visitante (semeia a conta
    // nova). A identidade continua vindo do token, nunca do corpo (US-61).
    const { locale } = SyncSchema.parse(body ?? {})
    return this.authService.sync(user.email, user.name ?? 'Jogador', locale)
  }

  @ApiOperation({ summary: 'Troca o idioma ativo da conta (US-97). Aplica ao conteúdo futuro; nada já gravado é reescrito.' })
  @ApiBody({ schema: zodBody(SetLocaleSchema, { locale: 'en-US' }) })
  @Patch('locale')
  setLocale(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    // O token de bootstrap (pré-sync) tem email mas ainda não tem `sub`: sem conta,
    // não há preferência a guardar — o visitante fica no localStorage até logar.
    if (!user.userId) throw new UnauthorizedException('Token sem utilizador')
    const { locale } = SetLocaleSchema.parse(body)
    return this.authService.setLocale(user.userId, locale)
  }
}
