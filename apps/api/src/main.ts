import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { NextFunction, Request, Response } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api/v1')
  app.enableCors({ origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000' })

  // US-93 gate 3: identifica QUAL commit está respondendo, para o smoke pós-deploy saber
  // que a API nova subiu em vez de colher 200 do processo antigo ainda no ar. Header e
  // não campo no corpo: o corpo de /api/v1/systems é contrato tipado em @ai-dm/shared e
  // consumido pelo front — mudar contrato de produto por causa de CI sai caro.
  // RENDER_GIT_COMMIT é injetada pelo Render; fora dele (dev, teste) responde 'dev'.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Commit', process.env['RENDER_GIT_COMMIT'] ?? 'dev')
    next()
  })

  const config = new DocumentBuilder()
    .setTitle('AI DM API')
    .setDescription('Game Server + REST API do AI Dungeon Master')
    .setVersion('1.0')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config))

  await app.listen(process.env['PORT'] ?? 3001)
  console.log(`API running on http://localhost:${process.env['PORT'] ?? 3001}`)
  console.log(`API docs on http://localhost:${process.env['PORT'] ?? 3001}/api/docs`)
}

bootstrap()
