import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api/v1')
  app.enableCors({ origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000' })

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
