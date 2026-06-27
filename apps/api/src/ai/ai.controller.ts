import { Controller, Post, Body, Res, HttpCode } from '@nestjs/common'
import { Response } from 'express'
import { z } from 'zod'
import { AiService } from './ai.service'

const ChatBodySchema = z.object({
  adventureId: z.string().min(1),
  characterId: z.string().min(1),
  message: z.string().min(1).max(1000),
})

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: unknown, @Res() res: Response) {
    const { adventureId, characterId, message } = ChatBodySchema.parse(body)

    const result = await this.aiService.streamChat({ adventureId, characterId, message })

    // Converte o stream do Vercel AI SDK para Server-Sent Events
    const response = result.toDataStreamResponse()
    const reader = response.body!.getReader()

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const pump = async () => {
      const { done, value } = await reader.read()
      if (done) { res.end(); return }
      res.write(value)
      await pump()
    }

    await pump()
  }
}
