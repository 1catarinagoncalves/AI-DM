import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { requireLocalTestDatabaseUrl } from './int-db'

// US-95: preparo do banco efêmero, UMA vez por execução do `test:int` (globalSetup do
// Vitest roda no processo principal, antes de qualquer worker).
const apiDir = fileURLToPath(new URL('..', import.meta.url))

export default function setup(): void {
  const DATABASE_URL = requireLocalTestDatabaseUrl()
  const env = { ...process.env, DATABASE_URL }

  // `migrate deploy`, NUNCA `migrate dev`: o dev tenta criar um shadow database e
  // pede confirmação interativa — armadilha já registrada em AGENTS.md (US-58).
  // `stdio: inherit` porque quando isto falha (migração inválida, banco fora do ar)
  // a mensagem do Prisma é o diagnóstico; engoli-la deixa "globalSetup failed".
  execSync('pnpm exec prisma migrate deploy', { cwd: apiDir, env, stdio: 'inherit' })

  // A seed é pré-requisito dos três fluxos, não conveniência: eles dependem de dados
  // de sistema do SRD (US-47) e o `truncateGameTables` preserva `System` justamente
  // para não a repetir por teste.
  execSync('pnpm exec ts-node prisma/seed.ts', { cwd: apiDir, env, stdio: 'inherit' })
}
