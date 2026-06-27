import { Module } from '@nestjs/common'
import { GameModule } from './game/game.module'
import { CampaignModule } from './campaign/campaign.module'
import { CharacterModule } from './character/character.module'
import { AiModule } from './ai/ai.module'

@Module({
  imports: [GameModule, CampaignModule, CharacterModule, AiModule],
})
export class AppModule {}
