import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// `pnpm eval` roda os eval cases do DM Agent, que vivem em evals/cases na raiz
// do repo e são nomeados por user story (us-03-*.ts), não no padrão *.test.ts.
// Os casos ficam fora dos workspaces, então mapeamos os pacotes @ai-dm/* para
// o código-fonte (testa o source atual, sem depender de um build prévio).
export default defineConfig({
  resolve: {
    alias: {
      '@ai-dm/ai-engine': resolve(__dirname, 'src/index.ts'),
      '@ai-dm/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    include: ['../../evals/cases/**/*.ts'],
  },
})
