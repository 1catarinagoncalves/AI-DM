import { Controller, Get, Post, Body, Param } from '@nestjs/common'
import { z } from 'zod'
import { CampaignService } from './campaign.service'

const CreateCampaignSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(80),
  systemId: z.string().min(1),
})

const JoinSchema = z.object({
  characterId: z.string().min(1),
})

const CreateAdventureSchema = z.object({
  title: z.string().min(1).max(120),
})

@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get('systems')
  listSystems() {
    return this.campaignService.listSystems()
  }

  @Post()
  create(@Body() body: unknown) {
    const dto = CreateCampaignSchema.parse(body)
    return this.campaignService.create(dto)
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.campaignService.findAllByUser(userId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignService.findOne(id)
  }

  @Post(':id/join')
  join(@Param('id') campaignId: string, @Body() body: unknown) {
    const dto = JoinSchema.parse(body)
    return this.campaignService.join(campaignId, dto)
  }

  @Post(':id/adventures')
  createAdventure(@Param('id') campaignId: string, @Body() body: unknown) {
    const dto = CreateAdventureSchema.parse(body)
    return this.campaignService.createAdventure(campaignId, dto)
  }
}
