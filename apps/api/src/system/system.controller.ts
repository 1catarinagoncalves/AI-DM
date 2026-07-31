import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { OptionalAuthGuard } from '../auth/auth.guard'
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator'
import { SystemService } from './system.service'

@ApiTags('Sistemas de RPG')
@Controller('systems')
// US-99: guard OPCIONAL, não o AuthGuard dos demais controllers. Esta rota é o
// healthCheckPath do Render (render.yaml) e precisa responder 200 sem token; com
// token, serve o `config` no locale do dono. Ver US-99 "Questões em aberto" #2.
@UseGuards(OptionalAuthGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @ApiOperation({ summary: 'Lista todos os sistemas de RPG disponíveis (ex: D&D 5e) com a sua configuração de atributos, no idioma ativo do jogador.' })
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.systemService.findAll(user.userId)
  }
}
