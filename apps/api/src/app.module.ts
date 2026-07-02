import { Module } from '@nestjs/common'
import { GameModule } from './game/game.module'
import { SystemModule } from './system/system.module'
import { AdventureModule } from './adventure/adventure.module'
import { CharacterModule } from './character/character.module'
import { AiModule } from './ai/ai.module'
import { UserModule } from './user/user.module'
import { PrismaService } from './prisma.service'

@Module({
  imports: [GameModule, SystemModule, AdventureModule, CharacterModule, AiModule, UserModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
