import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { configForLocale, localeOfUser } from './system-locale'

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  // US-99: serve o `config` no locale do jogador. `userId` ausente = request anônimo
  // (o health check do Render bate aqui sem token) → locale default, resposta 200.
  async findAll(userId?: string) {
    const locale = await localeOfUser(this.prisma, userId)
    const systems = await this.prisma.system.findMany({
      // Projeção explícita: sem ela o `configLocales` viajaria junto e o cliente
      // receberia a base EN E o pt-BR no mesmo payload (~2x o `config`). US-99.
      select: { id: true, name: true, version: true, sourceType: true, config: true, configLocales: true },
      orderBy: { name: 'asc' },
    })
    return systems.map(({ configLocales, config, ...system }) => ({
      ...system,
      config: configForLocale({ config, configLocales }, locale),
    }))
  }
}
