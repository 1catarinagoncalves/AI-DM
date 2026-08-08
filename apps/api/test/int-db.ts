import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

// US-95: infraestrutura da camada de integração. Duas responsabilidades: dizer QUAL
// banco o `test:int` pode tocar, e limpá-lo entre testes.

// Hosts aceitos para o banco de teste. A lista existe porque a limpeza abaixo é um
// TRUNCATE CASCADE: apontada para a Neon (US-58), ela apagaria as personagens e as
// aventuras reais da mantenedora. Por isso o `test:int` NÃO lê `DATABASE_URL` — ela
// é a do banco de trabalho, carregada pelo `.env` da raiz em todo script `db:*`.
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * Lê `TEST_DATABASE_URL` sem exigir que ela exista, mas RECUSANDO um host remoto.
 * Ausência não lança porque esta função roda no carregamento do `vitest.int.config.ts`,
 * e ferramentas que só querem ler a config (o knip do `pnpm dead`) carregam todo config
 * do repo sem env nenhuma — lançar ali deixaria o gate de código morto vermelho.
 * Quem exige o valor é o globalSetup, antes de qualquer escrita.
 */
export function readTestDatabaseUrl(): string | undefined {
  const url = process.env['TEST_DATABASE_URL']
  if (!url) return undefined
  const host = new URL(url).hostname
  if (!HOSTS_LOCAIS.has(host)) {
    throw new Error(
      `TEST_DATABASE_URL aponta para "${host}", que não é local. Esperado um dos: ${[...HOSTS_LOCAIS].join(', ')}. ` +
        'A suíte de integração dá TRUNCATE CASCADE nas tabelas de jogo — apontá-la para um banco hospedado apaga dados reais.',
    )
  }
  return url
}

/**
 * Devolve a URL do banco EFÊMERO de teste, ou lança. Fonte é `TEST_DATABASE_URL`,
 * variável separada de propósito: exigir que alguém a defina à mão é o que impede
 * que o `test:int` herde por acidente o banco de trabalho de um `dotenv -e .env`.
 */
export function requireLocalTestDatabaseUrl(): string {
  const url = readTestDatabaseUrl()
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL ausente — o `pnpm test:int` exige um Postgres efêmero explícito. ' +
        'Ex.: TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres. ' +
        'NÃO use a DATABASE_URL do .env: a limpeza entre testes é TRUNCATE CASCADE.',
    )
  }
  return url
}

export function makeTestPrisma(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: requireLocalTestDatabaseUrl() }) })
}

// Tudo que um turno cria, na ordem em que o CASCADE resolve. `System` fica FORA: é o
// que a seed cara produz (SRD, US-47) e os fluxos só o leem — recriá-lo a cada teste
// pagaria a seed inteira por asserção. Sem @@map no schema, o nome da tabela é o nome
// do model, daí as aspas (o Postgres dobraria a caixa sem elas).
const TABELAS_DE_JOGO = ['EventLog', 'Quest', 'AdventureParticipant', 'CharacterState', 'Adventure', 'Character', 'User']

/**
 * Limpa o que os testes criaram. Truncate e não transação revertida: as tools escrevem
 * pelo `this.prisma` que o Nest injetou (`ai.service.ts:408/433/603`), então não há como
 * entregar-lhes o client de uma transação sem mudar produção — ver US-95, *Questões em
 * aberto* #2.
 */
export async function truncateGameTables(prisma: PrismaClient): Promise<void> {
  const alvos = TABELAS_DE_JOGO.map((t) => `"${t}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${alvos} RESTART IDENTITY CASCADE`)
}
