import { Module } from '@nestjs/common'
import { AdventureController } from './adventure.controller'
import { AdventureExportController } from './adventure-export.controller'
import { AdventureService } from './adventure.service'
import { PrismaService } from '../prisma.service'
import { AiModule } from '../ai/ai.module'

// US-202: porta dupla, mesmo molde de `auth-providers.ts` (US-201, lado web) — condição
// calculada uma vez, spread condicional no array `controllers`. `@Get()` do Nest registra a
// rota no load do módulo: não há como "desligar" um método de um controller que já está no
// array sem um `if` dentro do handler (o anti-padrão que o controller separado evita). Em
// produção `AdventureExportController` nunca entra no array — a rota não existe, 404 mesmo
// com `DEV_EXPORT=1` definido.
const devExportEnabled = process.env.NODE_ENV !== 'production' && process.env.DEV_EXPORT === '1'

@Module({
  imports: [AiModule],
  controllers: [AdventureController, ...(devExportEnabled ? [AdventureExportController] : [])],
  providers: [AdventureService, PrismaService],
  exports: [AdventureService],
})
export class AdventureModule {}
