import { Controller, Post, Body } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { PrismaService } from '../prisma.service'
import { zodBody } from '../openapi'

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(60),
})

@ApiTags('Utilizadores')
@Controller('users')
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Cria ou atualiza um utilizador pelo email (upsert).' })
  @ApiBody({ schema: zodBody(CreateUserSchema, { email: 'jogador@exemplo.com', name: 'Ana' }) })
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
