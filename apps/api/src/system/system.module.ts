import { Module } from '@nestjs/common'
import { SystemController } from './system.controller'
import { SystemService } from './system.service'
import { PrismaService } from '../prisma.service'

@Module({
  controllers: [SystemController],
  providers: [SystemService, PrismaService],
  exports: [SystemService],
})
export class SystemModule {}
