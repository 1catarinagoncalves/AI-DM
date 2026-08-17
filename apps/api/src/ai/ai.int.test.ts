import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import type { SystemConfig } from '@ai-dm/shared'
import { makeTestPrisma, truncateGameTables } from '../../test/int-db'
import type { PrismaClient } from '../generated/prisma/client'

// US-95 — a costura `ação → tool → persistir → estado`, atravessada de HTTP até um
// Postgres de verdade. O que os unitários com `fakePrisma()` NÃO alcançam: contagem de
// linhas, forma de coluna Json, upsert com linha ausente, e o re-read que uma tool faz
// do banco em vez do closure.
//
// O LLM é a única coisa dublada. Substituir o `AiService` apagaria o código sob teste.

// Estado do dublê. `vi.hoisted` porque a factory do `vi.mock` é içada acima dos imports
// e não pode fechar sobre um `const` do módulo.
const dm = vi.hoisted(() => ({ passos: [] as unknown[][] }))

// O modelo NÃO é injetável: `narrationModels` é import de módulo (`ai.service.ts:9`),
// escolhido dentro do método (`:636`). Trocar só esse símbolo evita a mudança de
// produção — ver US-95, *Questões em aberto* #1.
vi.mock('@ai-dm/ai-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-dm/ai-engine')>()

  // Dublê escrito à mão em vez do `MockLanguageModelV1` de `ai/test`: aquele entrypoint
  // só resolve sob `moduleResolution` node16/bundler, e a API está em node10 — importá-lo
  // custaria mexer no tsconfig do app inteiro por causa de um teste. Um LanguageModelV1 é
  // `doStream`/`doGenerate` e metadados; o resto do SDK não olha mais nada.
  const streamDe = (chunks: unknown[]) =>
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    })

  const narrador = {
    specificationVersion: 'v1',
    provider: 'duble-us95',
    modelId: 'duble-de-turno-us95',
    defaultObjectGenerationMode: 'json',
    // Um `shift` por chamada: com `maxSteps: 5` o SDK rechama o modelo depois de cada
    // tool call, então um turno é uma LISTA de passos, não um passo só.
    doStream: async () => ({
      stream: streamDe(dm.passos.shift() ?? [{ type: 'finish', finishReason: 'stop', usage: { promptTokens: 0, completionTokens: 0 } }]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doGenerate: async () => {
      throw new Error('dublê de narração não gera fora de streaming')
    },
  }

  // O `onFinish` dispara `reconcileScene` (extração de cena) quando o turno não chamou
  // `updateScene` — fire-and-forget, mas com o modelo real ele sairia para a internet
  // sem chave. Dublado para a suíte ser offline de verdade.
  const extrator = {
    specificationVersion: 'v1',
    provider: 'duble-us95',
    modelId: 'duble-de-extracao-us95',
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => ({
      text: JSON.stringify({ local: 'pátio do posto avançado', ambiente: 'externo', periodo: 'tarde', presentes: [], objetos_em_cena: [] }),
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doStream: async () => {
      throw new Error('dublê de extração não streama')
    },
  }

  // Cast necessário: `LanguageModelV1` vive em @ai-sdk/provider, que não é dependência
  // direta da API — declarar o tipo aqui exigiria adicioná-la só para um teste.
  //
  // US-114: `reconcileScene` saiu de `summaryModel` para `extractionModel` — o dublê
  // precisa cobrir os dois nomes (o segundo é quem de fato intercepta a chamada agora;
  // `summaryModel` fica dublado por segurança, caso `summarizeOldTurns` dispare).
  return {
    ...actual,
    narrationModels: [narrador as unknown as (typeof actual.narrationModels)[number]],
    summaryModel: extrator as unknown as typeof actual.summaryModel,
    extractionModel: extrator as unknown as typeof actual.extractionModel,
  }
})

// --- chunks do dublê -------------------------------------------------------------

let idDaChamada = 0
const texto = (t: string) => ({ type: 'text-delta', textDelta: t })
const chamaTool = (toolName: string, args: object) => ({
  type: 'tool-call',
  toolCallType: 'function',
  toolCallId: `call_${++idDaChamada}`,
  toolName,
  args: JSON.stringify(args),
})
const fim = (finishReason: 'stop' | 'tool-calls') => ({ type: 'finish', finishReason, usage: { promptTokens: 0, completionTokens: 0 } })

// Toda narração completa termina em lista de opções. Sem ela o guard da US-74 marca o
// turno como truncado, o controller re-amostra e o turno roda DUAS vezes — as asserções
// de contagem quebrariam por um motivo que não é o testado.
const NARRACAO = 'As pegadas levam ao portão lascado.\n\n- 🗡️ Empurrar o portão.\n- 🛡️ Contornar pelo mato.'

/** Turno de um passo: só prosa. */
function turnoSoProsa(narracao = NARRACAO): unknown[][] {
  return [[texto(narracao), fim('stop')]]
}

/** Turno de dois passos: tool call, depois a prosa que a interpreta. */
function turnoComTools(chamadas: Array<{ tool: string; args: object }>, narracao = NARRACAO): unknown[][] {
  return [
    [...chamadas.map((c) => chamaTool(c.tool, c.args)), fim('tool-calls')],
    [texto(narracao), fim('stop')],
  ]
}

/**
 * Turno onde cada tool call vive num STEP próprio, sequencial. Distinto de
 * `turnoComTools([a, b])`, que emite as duas no MESMO step: ali o AI SDK as executa em
 * paralelo, e tanto a trava da US-38 quanto o re-read do `recordEntity` fazem
 * read-modify-write não-atômico — a race é um achado à parte (ver US-95, Progresso). O
 * modelo real que repete uma tool a repete em turnos de raciocínio distintos, que é isto.
 */
function turnoToolsSequencial(chamadas: Array<{ tool: string; args: object }>, narracao = NARRACAO): unknown[][] {
  return [...chamadas.map((c) => [chamaTool(c.tool, c.args), fim('tool-calls')]), [texto(narracao), fim('stop')]]
}

// --- app + fixtures --------------------------------------------------------------

const SECRET = process.env['AUTH_SECRET'] ?? 'segredo-de-integracao-us95'

function assinarToken(userId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ sub: userId, email: 'int@ai-dm.test', name: 'Integração' })).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

let app: INestApplication
let baseUrl: string
let prisma: PrismaClient

interface Mesa {
  userId: string
  characterId: string
  adventureId: string
  token: string
  /** Rótulo da perícia como o config do locale a mostra — é o que o Mestre vê no prompt. */
  labelPercepcao: string
}

// SABEDORIA 16 = modificador +3, e Percepção NÃO proficiente: o valor esperado da
// rolagem é +3, sem depender do bônus de proficiência.
const SABEDORIA = 16
const MOD_ESPERADO = 3

async function montarMesa(comEstado = true): Promise<Mesa> {
  // O config vem do banco semeado (US-47), não de literais: fabricar a ficha à mão com
  // chaves que a seed contradiz é o erro que as *Notas de implementação* avisam.
  const system = await prisma.system.findUniqueOrThrow({ where: { id: 'system-dnd5e' } })
  const config = ((system.configLocales as Record<string, SystemConfig>)['pt-BR'] ?? system.config) as unknown as SystemConfig
  const percepcao = config.skills?.find((s) => s.key === 'perception')
  if (!percepcao) throw new Error('seed sem a perícia `perception` no config pt-BR do system-dnd5e')

  const baseAttributes = Object.fromEntries(config.attributes.map((a) => [a.key, a.key === percepcao.ability ? SABEDORIA : a.default]))
  // Duas proficiências (o config pede 2), nenhuma delas a perícia sob teste.
  const proficientes = (config.skills ?? []).filter((s) => s.key !== percepcao.key).slice(0, 2).map((s) => s.key)

  const user = await prisma.user.create({ data: { email: `int-${Date.now()}-${Math.random()}@ai-dm.test`, name: 'Integração' } })
  const character = await prisma.character.create({
    data: {
      userId: user.id,
      systemId: system.id,
      name: 'Vera do Vau',
      gender: 'feminino',
      race: 'human',
      class: 'ranger',
      level: 1,
      baseAttributes,
      skills: proficientes,
    },
  })
  const adventure = await prisma.adventure.create({
    data: { systemId: system.id, creatorId: user.id, title: 'O portão lascado', order: 1 },
  })
  await prisma.quest.create({
    data: { adventureId: adventure.id, title: 'Achar a trilha', description: 'Seguir as pegadas até a origem.', isPrimary: true },
  })
  // A abertura de toda aventura é uma NARRATION (é a âncora que a US-67 assume).
  await prisma.eventLog.create({
    data: { adventureId: adventure.id, characterId: character.id, type: 'NARRATION', payload: { text: 'Chuva fina no posto avançado.\n\n- 🗡️ Olhar o chão.' } },
  })
  if (comEstado) {
    await prisma.characterState.create({
      data: { characterId: character.id, adventureId: adventure.id, hp: 12, maxHp: 12, attributes: baseAttributes },
    })
  }

  return { userId: user.id, characterId: character.id, adventureId: adventure.id, token: assinarToken(user.id), labelPercepcao: percepcao.label }
}

/** Faz o turno e só volta quando o SSE fecha. Devolve o corpo cru (frames do controller). */
async function jogarTurno(mesa: Mesa, message: string): Promise<string> {
  const res = await fetch(`${baseUrl}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mesa.token}` },
    body: JSON.stringify({ adventureId: mesa.adventureId, characterId: mesa.characterId, message }),
  })
  expect(res.status).toBe(200)
  return await res.text()
}

/**
 * O `onFinish` grava ACTION/NARRATION DEPOIS de o stream fechar (`ai.service.ts:683`) —
 * o fim do SSE não é garantia de que a escrita aconteceu. Sem esta espera o teste é
 * flake, e a flake apareceria como "o banco não persistiu".
 */
async function esperarNarracaoPersistida(mesa: Mesa, quantas: number): Promise<void> {
  const limite = Date.now() + 10_000
  for (;;) {
    const n = await prisma.eventLog.count({ where: { adventureId: mesa.adventureId, type: 'NARRATION' } })
    if (n >= quantas) return
    if (Date.now() > limite) throw new Error(`onFinish não persistiu: esperava ${quantas} NARRATION, achei ${n}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

beforeAll(async () => {
  prisma = makeTestPrisma()
  await prisma.$connect()
  const { AppModule } = await import('../app.module')
  // `NestFactory` e não `Test.createTestingModule`: nenhum provider é sobrescrito aqui
  // (o dublê entra pelo `vi.mock` acima), e `@nestjs/testing` não está instalado —
  // usá-lo seria dependência nova para nada.
  app = await NestFactory.create(AppModule, { logger: process.env['INT_DEBUG'] ? undefined : false })
  // Porta 0 = o SO escolhe. HTTP de verdade, sem supertest: o `fetch` do Node 22 basta.
  await app.listen(0)
  baseUrl = await app.getUrl()
})

afterAll(async () => {
  await app?.close()
  await prisma?.$disconnect()
})

beforeEach(async () => {
  dm.passos = []
  await truncateGameTables(prisma)
})

describe('US-95 fluxo 1 — a rolagem é ancorada na ficha do banco (US-38)', () => {
  it('o modificador gravado vem da ficha, não do que o modelo mandou', async () => {
    const mesa = await montarMesa()
    // O modelo pede um `dice` com bônus embutido: o servidor tem de IGNORÁ-LO.
    dm.passos = turnoComTools([{ tool: 'rollDice', args: { reason: 'Percepção para seguir as pegadas', skill: mesa.labelPercepcao, dice: '1d20+99' } }])

    await jogarTurno(mesa, 'examino as pegadas')
    await esperarNarracaoPersistida(mesa, 2)

    const roll = await prisma.eventLog.findFirstOrThrow({ where: { adventureId: mesa.adventureId, type: 'DICE_ROLL' } })
    const payload = roll.payload as { modifier: number; formula: string; skillLabel?: string; total: number; rolls: number[] }
    expect(payload.modifier).toBe(MOD_ESPERADO)
    expect(payload.formula).toBe(`1d20+${MOD_ESPERADO}`)
    // US-38: o rótulo canônico da perícia usada é gravado — é o que o bloco `D:` mostra.
    expect(payload.skillLabel).toBe(mesa.labelPercepcao)
    expect(payload.total).toBe(payload.rolls[0]! + MOD_ESPERADO)
  })

  it('dois testes ancorados no mesmo turno gravam UMA rolagem', async () => {
    const mesa = await montarMesa()
    // Steps sequenciais: é o cenário que a trava da US-38 cobre (rola, vê, repete).
    dm.passos = turnoToolsSequencial([
      { tool: 'rollDice', args: { reason: 'Percepção', skill: mesa.labelPercepcao } },
      { tool: 'rollDice', args: { reason: 'Percepção de novo', skill: mesa.labelPercepcao } },
    ])

    await jogarTurno(mesa, 'vasculho o chão duas vezes')
    await esperarNarracaoPersistida(mesa, 2)

    // A trava da US-38 (`ai.service.ts:393`) reusa o 1º resultado — e é a CONTAGEM DE
    // LINHAS que prova isso. Um double de Prisma não conta nada.
    const rolagens = await prisma.eventLog.findMany({ where: { adventureId: mesa.adventureId, type: 'DICE_ROLL' } })
    expect(rolagens).toHaveLength(1)
  })
})

describe('US-95 fluxo 2 — o dano persiste no Postgres', () => {
  it('updateCharacterHp reduz o HP e a leitura seguinte devolve o valor novo', async () => {
    const mesa = await montarMesa()
    dm.passos = turnoComTools([{ tool: 'updateCharacterHp', args: { newHp: 6, reason: 'flechada do batedor' } }])

    const corpo = await jogarTurno(mesa, 'avanço na clareira')
    await esperarNarracaoPersistida(mesa, 2)

    const estado = await prisma.characterState.findUniqueOrThrow({
      where: { characterId_adventureId: { characterId: mesa.characterId, adventureId: mesa.adventureId } },
    })
    expect(estado.hp).toBe(6)
    expect(estado.maxHp).toBe(12)
    // O canal de estado da US-19 mostra ao cliente exatamente o que foi persistido.
    expect(corpo).toContain('H:' + JSON.stringify({ hp: 6, maxHp: 12 }))

    const evento = await prisma.eventLog.findFirstOrThrow({ where: { adventureId: mesa.adventureId, type: 'CHARACTER_UPDATE' } })
    expect(evento.payload).toMatchObject({ field: 'hp', newHp: 6 })
  })

  it('CARACTERIZAÇÃO: sem CharacterState prévio o upsert nasce com maxHp 0 e o HP é clampado a 0', async () => {
    // Este teste NÃO afirma que o comportamento é desejável — ele o congela. O `create`
    // do upsert (`ai.service.ts:436`) usa `characterState?.maxHp ?? 0`, e o clamp de
    // `:432` leva qualquer HP a 0 quando maxHp é 0: dano vira morte instantânea. Nenhum
    // `fakePrisma()` reprovaria isto, porque o double concorda com o código.
    const mesa = await montarMesa(false)
    dm.passos = turnoComTools([{ tool: 'updateCharacterHp', args: { newHp: 9, reason: 'arranhão' } }])

    await jogarTurno(mesa, 'tropeço na raiz')
    await esperarNarracaoPersistida(mesa, 2)

    const estado = await prisma.characterState.findUniqueOrThrow({
      where: { characterId_adventureId: { characterId: mesa.characterId, adventureId: mesa.adventureId } },
    })
    expect(estado.maxHp).toBe(0)
    expect(estado.hp).toBe(0)
  })
})

describe('US-95 fluxo 3 — a entidade sobrevive ao turno (US-87)', () => {
  it('recordEntity grava em Adventure.entities e o ledger volta no turno seguinte', async () => {
    const mesa = await montarMesa()

    // Turno 1: o Mestre registra a entidade.
    dm.passos = turnoComTools([{ tool: 'recordEntity', args: { entidades: [{ nome: 'Marta', tipo: 'npc', nota: 'batedora do posto' }] } }])
    await jogarTurno(mesa, 'converso com a batedora')
    await esperarNarracaoPersistida(mesa, 2)

    const depoisDoTurno1 = await prisma.adventure.findUniqueOrThrow({ where: { id: mesa.adventureId } })
    expect(depoisDoTurno1.entities).toMatchObject([{ nome: 'Marta', tipo: 'npc' }])

    // Turno 2: sem tool nenhuma — o ledger tem de reaparecer no prompt, vindo do banco.
    dm.passos = turnoSoProsa()
    await jogarTurno(mesa, 'sigo andando')
    await esperarNarracaoPersistida(mesa, 3)

    const depoisDoTurno2 = await prisma.adventure.findUniqueOrThrow({ where: { id: mesa.adventureId } })
    expect(depoisDoTurno2.entities).toMatchObject([{ nome: 'Marta' }])
  })

  it('duas chamadas no mesmo turno ACUMULAM (o merge relê do banco, não do closure)', async () => {
    const mesa = await montarMesa()
    // Steps sequenciais: o re-read de `:596` acumula quando as chamadas não correm em
    // paralelo. É o que o comentário do código descreve ("relê do banco para acumular").
    dm.passos = turnoToolsSequencial([
      { tool: 'recordEntity', args: { entidades: [{ nome: 'Marta', tipo: 'npc' }] } },
      { tool: 'recordEntity', args: { entidades: [{ nome: 'moinho ao norte', tipo: 'local' }] } },
    ])

    await jogarTurno(mesa, 'olho em volta e pergunto sobre o moinho')
    await esperarNarracaoPersistida(mesa, 2)

    const adventure = await prisma.adventure.findUniqueOrThrow({ where: { id: mesa.adventureId } })
    const entidades = adventure.entities as Array<{ nome: string }>
    // O re-read de `:596` é literalmente uma query; sem banco a segunda chamada
    // sobrescreveria a primeira e este teste não teria como existir.
    expect(entidades.map((e) => e.nome).sort()).toEqual(['Marta', 'moinho ao norte'])
  })

  it('aventura sem entidades: turno roda e o ledger continua vazio (US-87, caso vazio)', async () => {
    const mesa = await montarMesa()
    dm.passos = turnoSoProsa()

    await jogarTurno(mesa, 'fico em silêncio')
    await esperarNarracaoPersistida(mesa, 2)

    const adventure = await prisma.adventure.findUniqueOrThrow({ where: { id: mesa.adventureId } })
    expect(adventure.entities).toBeNull()
  })

  it('recordEntity NÃO grava CHARACTER_UPDATE (senão a edição da US-67 trava)', async () => {
    const mesa = await montarMesa()
    dm.passos = turnoComTools([{ tool: 'recordEntity', args: { entidades: [{ nome: 'Marta', tipo: 'npc' }] } }])

    await jogarTurno(mesa, 'converso com a batedora')
    await esperarNarracaoPersistida(mesa, 2)

    const mutacoes = await prisma.eventLog.count({ where: { adventureId: mesa.adventureId, type: 'CHARACTER_UPDATE' } })
    expect(mutacoes).toBe(0)
  })
})

// US-116 (ADR 011, Camada 0): a taxa de `cenaTocada` só existe se a linha `arc_signal`
// sair de verdade no `onFinish` real — o que os unitários com `fakePrisma()` não
// alcançam (mesmo motivo do comentário em `ai.service.test.ts:201`).
describe('US-116 (ADR 011) — sinal arc_signal', () => {
  function sinaisArc(logSpy: ReturnType<typeof vi.spyOn>): Array<Record<string, unknown>> {
    return logSpy.mock.calls
      .map(([linha]) => {
        try {
          return JSON.parse(linha as string) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter((o): o is Record<string, unknown> => o?.['event'] === 'arc_signal')
  }

  it('turno que chama updateScene → cenaTocada true, sem acionar o reconciliador', async () => {
    const mesa = await montarMesa()
    dm.passos = turnoComTools([{ tool: 'updateScene', args: { local: 'pátio do posto avançado' } }])
    const logSpy = vi.spyOn(console, 'log')

    await jogarTurno(mesa, 'avanço até o pátio')
    await esperarNarracaoPersistida(mesa, 2)

    const [sinal] = sinaisArc(logSpy)
    expect(sinal).toMatchObject({ adventureId: mesa.adventureId, characterId: mesa.characterId, cenaTocada: true })
    expect(typeof sinal?.['turnId']).toBe('string')
    logSpy.mockRestore()
  })

  it('turno sem updateScene → cenaTocada false (o mesmo turno que aciona o reconciliador da US-73)', async () => {
    const mesa = await montarMesa()
    dm.passos = turnoSoProsa()
    const logSpy = vi.spyOn(console, 'log')

    await jogarTurno(mesa, 'sigo andando')
    await esperarNarracaoPersistida(mesa, 2)

    const [sinal] = sinaisArc(logSpy)
    expect(sinal).toMatchObject({ adventureId: mesa.adventureId, characterId: mesa.characterId, cenaTocada: false })
    logSpy.mockRestore()
  })
})
