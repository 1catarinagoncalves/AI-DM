import { Module } from '@nestjs/common'
import { AdventureController } from './adventure.controller'
import { AdventureService } from './adventure.service'
import { PrismaService } from '../prisma.service'
import { AiModule } from '../ai/ai.module'

@Module({
  imports: [AiModule],
  controllers: [AdventureController],
  providers: [AdventureService, PrismaService],
  exports: [AdventureService],
})
export class AdventureModule {}
