import { Module } from '@nestjs/common'
import { AdventureController } from './adventure.controller'
import { AdventureService } from './adventure.service'
import { PrismaService } from '../prisma.service'

@Module({
  controllers: [AdventureController],
  providers: [AdventureService, PrismaService],
  exports: [AdventureService],
})
export class AdventureModule {}
