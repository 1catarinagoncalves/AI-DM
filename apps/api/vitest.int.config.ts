import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'
import { readTestDatabaseUrl } from './test/int-db'

// `ai.controller.ts` importa `Response` de 'express', mas o pnpm não hoista `express`
// para `apps/api` — em runtime ela resolve por dentro de `@nestjs/platform-express`, e o
// resolver do Vite não segue essa cadeia. Achamos o `express` do store a partir da
// plataforma (o mesmo caminho que o Nest usa) e apontamos o alias para lá, em vez de
// trocar o import do controller (produção intocada).
const req = createRequire(import.meta.url)
const expressDir = dirname(req.resolve('express/package.json', { paths: [dirname(req.resolve('@nestjs/platform-express/package.json'))] }))

// US-95: projeto de teste à parte, no mesmo espírito do `vitest.eval.config.ts` do
// ai-engine. Só ele conhece banco; `vitest.config.ts` continua sem.

// URL remota morre AQUI, no carregamento — antes de subir o app e muito antes do
// primeiro TRUNCATE. Ausência não lança neste ponto: o knip (`pnpm dead`) carrega todo
// config do repo sem env nenhuma, e o gate ficaria vermelho. Quem exige o valor é o
// globalSetup, que também roda antes de qualquer escrita.
const DATABASE_URL = readTestDatabaseUrl()

export default defineConfig({
  // O container de DI do Nest lê os tipos do construtor por `emitDecoratorMetadata`, que
  // o esbuild (transpiler default do Vitest) NÃO emite — sem isto o Nest injeta undefined
  // e o controller estoura com `Cannot read ... 'assertCharacterOwner'`. O swc emite a
  // metadata; é a config oficial NestJS+Vitest. Só a suíte de integração precisa (os
  // unitários instanciam os controllers à mão), então vive só neste config.
  plugins: [swc.vite()],
  resolve: { alias: { express: expressDir } },
  test: {
    include: ['**/*.int.test.ts'],
    globalSetup: ['./test/int-setup.ts'],
    // Um banco, testes que escrevem nas mesmas tabelas e limpam entre si.
    fileParallelism: false,
    // Sobe app Nest e fala HTTP de verdade; os 5s do default não bastam.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      // O `PrismaService` lê `process.env['DATABASE_URL']` no construtor
      // (`prisma.service.ts:9`) — o worker precisa dela ANTES de o módulo carregar.
      ...(DATABASE_URL ? { DATABASE_URL } : {}),
      // O `AuthGuard` (US-61) verifica HS256 com esta chave; os testes assinam o
      // token com ela. Valor de teste, não secret: nada fora deste processo o aceita.
      AUTH_SECRET: 'segredo-de-integracao-us95',
    },
  },
})
