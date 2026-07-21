import { Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { AuthGuard } from './auth.guard'
import { CurrentUser, type AuthUser } from './current-user.decorator'

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
  @Post('sync')
  sync(@CurrentUser() user: AuthUser) {
    if (!user.email) throw new UnauthorizedException('Token sem email')
    return this.authService.sync(user.email, user.name ?? 'Jogador')
  }
}
