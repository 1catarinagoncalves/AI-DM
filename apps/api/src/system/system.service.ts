import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { configForLocale, getSystemsCached, localeOfUser } from './system-locale'

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  // US-99: serve o `config` no locale do jogador. `userId` ausente = request anônimo
  // (o health check do Render bate aqui sem token) → locale default, resposta 200.
  async findAll(userId?: string) {
    const locale = await localeOfUser(this.prisma, userId)
    // Cacheado: esta rota é o healthCheckPath do Render e era batida em loop, arrastando
    // o SRD inteiro pela rede em todo ping (ver nota em system-locale.ts).
    const systems = await getSystemsCached(this.prisma)
    // Projeção explícita no payload: sem ela o `configLocales` sairia junto e o cliente
    // receberia a base EN E o pt-BR (~2x o `config`), e `ragIndexId` vazaria. US-99.
    return systems.map((system) => ({
      id: system.id,
      name: system.name,
      version: system.version,
      sourceType: system.sourceType,
      config: configForLocale(system, locale),
    }))
  }
}
