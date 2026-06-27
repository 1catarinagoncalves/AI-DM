import { Controller, Post, Body } from '@nestjs/common'
import { z } from 'zod'
import { PrismaService } from '../prisma.service'

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(60),
})

@Controller('users')
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() body: unknown) {
    const { email, name } = CreateUserSchema.parse(body)
    return this.prisma.user.upsert({
      where: { email },
      update: { name },
      create: { email, name },
    })
  }
}
