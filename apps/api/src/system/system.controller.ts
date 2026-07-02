import { Controller, Get } from '@nestjs/common'
import { SystemService } from './system.service'

@Controller('systems')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get()
  findAll() {
    return this.systemService.findAll()
  }
}
