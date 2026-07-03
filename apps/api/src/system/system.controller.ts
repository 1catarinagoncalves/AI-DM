import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SystemService } from './system.service'

@ApiTags('Sistemas de RPG')
@Controller('systems')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @ApiOperation({ summary: 'Lista todos os sistemas de RPG disponíveis (ex: D&D 5e) com a sua configuração de atributos.' })
  @Get()
  findAll() {
    return this.systemService.findAll()
  }
}
