import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.system.findMany({ orderBy: { name: 'asc' } })
  }
}
