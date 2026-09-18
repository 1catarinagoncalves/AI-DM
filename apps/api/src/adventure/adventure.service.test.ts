import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { SystemConfig } from '@ai-dm/shared'
import { AdventureService } from './adventure.service'
import { AdventureGenerationService } from './adventure-generation.service'
import { authored, fakeAi, fakePrisma, config } from './adventure.test-helpers'
import type { AiService } from '../ai/ai.service'
import type { PrismaService } from '../prisma.service'

// US-243: mocka só mkdirSync/writeFileSync pro arquivo INTEIRO — sem isto, todo
// `createAndGenerate` abaixo (não só os testes desta US) gravaria de verdade em
// evals/reports/ a cada `pnpm test` (NODE_ENV=test do Vitest não é 'production', então o
// dump dispararia). Preserva o resto do módulo real (`importOriginal`): `lgmrd-tables.ts`
// usa `readFileSync` pra carregar tabelas, e um mock raso derrubaria isso também.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, mkdirSync: vi.fn(), writeFileSync: vi.fn() }
})

// US-235: `createForCharacter` (ramo gerado) devolve a linha GENERATING sem esperar o motor
// — o job roda solto (`void this.runAdventureGeneration(...)`, sem await). Para testar o
// ESTADO FINAL (quest/eventLog/generatedAdventure/sceneState), os testes espiam o método
// público `runAdventureGeneration` (spy sem mockImplementation continua chamando o real) e
// aguardam a promise que ele devolveu — mesma técnica de qualquer spy de método assíncrono,
// sem precisar reconstruir profile/config/opening à mão fora do serviço.
async function createAndGenerate(
  service: AdventureService,
  characterId: string,
  dto: Parameters<AdventureService['createForCharacter']>[1] = {},
) {
  const genSpy = vi.spyOn(service, 'runAdventureGeneration')
  const adventure = await service.createForCharacter(characterId, dto)
  const pending = genSpy.mock.results[0]?.value as Promise<void> | undefined
  if (pending) await pending
  genSpy.mockRestore()
  return adventure
}

describe('AdventureService.createForCharacter (US-232/US-235)', () => {
  const baseChar = {
    id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
    baseAttributes: { constitution: 14 }, system: { config },
  }

  // US-235: a linha nasce GENERATING/placeholder na hora do clique — sem esperar o motor.
  // `generateAdventureSlice` nunca resolve aqui de propósito: se `createForCharacter`
  // esperasse por ele, este teste travaria (timeout do runner) em vez de passar.
  it('devolve a Adventure GENERATING com título placeholder, sem esperar o motor terminar', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    const stuckAi = { generateOpeningNarration: vi.fn(), extractOpeningScene: vi.fn(), extractOpeningEntities: vi.fn(), generateAdventureSlice: () => new Promise(() => {}) } as unknown as AiService
    const adventure = await new AdventureService(prisma, stuckAi).createForCharacter('char-1', {})

    expect(adventure).toMatchObject({ id: 'adv-1', systemId: 'sys-1', creatorId: 'user-1', title: 'Aventura de Elara', order: 1, status: 'GENERATING' })
    expect(recorded.adventureCreate).toMatchObject({ status: 'GENERATING', order: 1 })
    expect(recorded.questCreate).toBeUndefined()
    expect(recorded.eventLogCreate).toBeUndefined()
  })

  it('placeholder do título é locale-aware (en-US)', async () => {
    const { prisma } = fakePrisma({ ...baseChar, user: { locale: 'en-US' } })
    const stuckAi = { generateOpeningNarration: vi.fn(), extractOpeningScene: vi.fn(), extractOpeningEntities: vi.fn(), generateAdventureSlice: () => new Promise(() => {}) } as unknown as AiService
    const adventure = await new AdventureService(prisma, stuckAi).createForCharacter('char-1', {})
    expect(adventure.title).toBe("Elara's Adventure")
  })

  it('título e quest do job em background vêm do artefato gerado (summary/objective), sem conclusionHint', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    const service = new AdventureService(prisma, fakeAi())
    await createAndGenerate(service, 'char-1', {})

    expect(recorded.adventureUpdate).toMatchObject({ status: 'ACTIVE', title: 'Três facções disputam a Enseada Cinzenta.' })
    expect(recorded.questCreate).toMatchObject({
      title: 'Três facções disputam a Enseada Cinzenta.',
      description: 'Três facções disputam a Enseada Cinzenta.',
      objective: 'Impedir o saque da enseada.',
      isPrimary: true,
    })
    expect(recorded.questCreate).not.toHaveProperty('conclusionHint')
    expect(recorded.eventLogCreate).toMatchObject({ type: 'NARRATION', payload: { text: 'A vela curva-se, Elara.' } })
  })

  it('caminho IA: texto do modelo é persistido como abertura', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    const service = new AdventureService(prisma, fakeAi('A chuva fina cai sobre Elara.'))
    await createAndGenerate(service, 'char-1', {})
    expect(recorded.eventLogCreate).toMatchObject({ type: 'NARRATION', payload: { text: 'A chuva fina cai sobre Elara.' } })
  })

  it('US-35: extração devolve patch → sceneState preenchido no CharacterState já existente', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    const patch = { local: 'estrada', ambiente: 'externo', periodo: 'anoitecer', presentes: ['velho'], objetos_em_cena: ['chuva'] }
    const service = new AdventureService(prisma, fakeAi('A chuva cai.', patch))
    await createAndGenerate(service, 'char-1', {})
    expect(recorded.characterStateCreate).not.toHaveProperty('sceneState') // criação síncrona, antes da abertura
    expect((recorded.characterStateUpdate as Record<string, unknown>)['sceneState']).toMatchObject(patch)
  })

  it('US-35: extração null → sem sceneState, sem erro, sem update do CharacterState', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    const service = new AdventureService(prisma, fakeAi('A chuva cai.', null))
    await createAndGenerate(service, 'char-1', {})
    expect(recorded.characterStateUpdate).toBeUndefined()
  })

  // US-232: entities vêm do artefato — facções + NPC narrativo (want+facção) + local (nota com
  // encontro+desafio); SEM antagonista nem segredo.
  it('entities: facções, NPC narrativo com want/facção e local, sem antagonista/segredo', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    const service = new AdventureService(prisma, fakeAi())
    await createAndGenerate(service, 'char-1', {})
    const entities = recorded.adventureUpdate?.['entities'] as Array<{ nome: string; tipo: string; nota?: string; revelado: boolean }>
    expect(entities.filter((e) => e.tipo === 'faccao').map((e) => e.nome)).toEqual(['Guardiões', 'Sindicato'])
    const marta = entities.find((e) => e.nome === 'Marta')!
    expect(marta.nota).toBe('herborista suspeita — Quer: proteger o bosque — Facção: Guardiões')
    // US-246: a única entidade 'outro' agora é a síntese de world/story, não antagonista/segredo.
    const outros = entities.filter((e) => e.tipo === 'outro')
    expect(outros).toHaveLength(1)
    expect(outros[0]!.nome).toBe('Vhel-Toran')
    expect(entities.every((e) => e.revelado === false)).toBe(true)
  })

  it('classe desconhecida cai no gancho default, sem erro', async () => {
    const character = { ...baseChar, name: 'Nyx', class: 'Cartógrafa Estelar' }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())
    const adventure = await createAndGenerate(service, 'char-1', {})
    expect(typeof adventure.title).toBe('string')
    expect(recorded.eventLogCreate).toMatchObject({ payload: { text: 'Alguém pronuncia a tua classe: Cartógrafa Estelar.' } })
  })

  // US-256: OPENING_READY também é aventura "em andamento" — criar outra enquanto a 1B da anterior ainda gera
  // tem de fechar a anterior do mesmo jeito que fecha uma ACTIVE.
  it('criar outra aventura fecha a anterior em ACTIVE ou OPENING_READY', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
    expect(recorded.adventureUpdateMany).toMatchObject({ where: { status: { in: ['ACTIVE', 'OPENING_READY'] } }, data: { status: 'COMPLETED' } })
  })

  it('order é calculado pela contagem de aventuras anteriores', async () => {
    const { prisma, recorded } = fakePrisma(baseChar, 2)
    await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
    expect(recorded.adventureCreate).toMatchObject({ order: 3 })
  })

  it('a abertura recebe o RÓTULO de raça e classe, não a chave', async () => {
    const { prisma } = fakePrisma({ ...baseChar, baseAttributes: { constitution: 10 } })
    const seen: Record<string, unknown> = {}
    const service = new AdventureService(prisma, fakeAi(null, null, seen))
    await createAndGenerate(service, 'char-1', {})
    expect(seen['characterClass']).toBe('Mago')
    expect(seen['characterRace']).toBe('Humano')
  })

  it('seededEntities chega a generateOpeningNarration como entities', async () => {
    const { prisma } = fakePrisma(baseChar)
    const seen: Record<string, unknown> = {}
    const service = new AdventureService(prisma, fakeAi(null, null, seen))
    await createAndGenerate(service, 'char-1', {})
    const entities = seen['entities'] as Array<{ nome: string }>
    expect(entities.some((e) => e.nome === 'Marta')).toBe(true)
    expect(entities.some((e) => e.nome === 'Guardiões')).toBe(true)
  })

  it('generatedAdventure é persistido com o artefato', async () => {
    const { prisma, recorded } = fakePrisma(baseChar)
    const service = new AdventureService(prisma, fakeAi())
    await createAndGenerate(service, 'char-1', {})
    expect(recorded.adventureUpdate?.['generatedAdventure']).toMatchObject({ id: 'char-1:1', summary: expect.any(String), start: expect.any(String) })
  })

  // US-243: dump em evals/reports/ depois da transação confirmar — cobre
  // runAdventureGeneration/AdventureGenerationService (createForCharacter só dispara o job
  // solto, ver `createAndGenerate` acima).
  describe('US-243: dump da aventura gerada em evals/reports (dev-only)', () => {
    const originalNodeEnv = process.env.NODE_ENV

    // US-243: testes FORA deste describe também disparam o dump (NODE_ENV=test do Vitest não
    // é 'production') — limpa antes de cada teste, não só depois, senão a contagem de chamadas
    // herda os `createAndGenerate` de todo o resto do arquivo.
    beforeEach(() => {
      vi.mocked(writeFileSync).mockClear()
      vi.mocked(mkdirSync).mockClear()
    })

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
    })

    it('dev: grava o JSON com o mesmo artefato persistido em generatedAdventure', async () => {
      process.env.NODE_ENV = 'test'
      const { prisma, recorded } = fakePrisma(baseChar)
      const service = new AdventureService(prisma, fakeAi())
      await createAndGenerate(service, 'char-1', {})

      expect(writeFileSync).toHaveBeenCalledTimes(1)
      const [path, contents] = vi.mocked(writeFileSync).mock.calls[0]!
      expect(path).toMatch(/authoring-char-1-.+\.json$/)
      expect(JSON.parse(contents as string)).toEqual(recorded.adventureUpdate?.['generatedAdventure'])
    })

    it('produção: não escreve nada', async () => {
      process.env.NODE_ENV = 'production'
      const { prisma } = fakePrisma(baseChar)
      const service = new AdventureService(prisma, fakeAi())
      await createAndGenerate(service, 'char-1', {})

      expect(writeFileSync).not.toHaveBeenCalled()
    })

    it('falha de escrita não derruba a geração nem propaga', async () => {
      process.env.NODE_ENV = 'test'
      vi.mocked(writeFileSync).mockImplementationOnce(() => { throw new Error('disco cheio') })
      const { prisma, recorded } = fakePrisma(baseChar)
      const service = new AdventureService(prisma, fakeAi())
      await expect(createAndGenerate(service, 'char-1', {})).resolves.toMatchObject({ status: 'GENERATING' })
      expect(recorded.adventureUpdate).toMatchObject({ status: 'ACTIVE' })
    })
  })

  describe('US-235/US-256: teto do gate estourado → FAILED (nunca cai na "Aventura pronta")', () => {
    // US-256: a fatia foi liberada ANTES (OPENING_READY + abertura gravadas); a 1B esgota o gate depois.
    // Estado terminal FAILED, sem Quest (o resto nunca existiu), `authoredSlice` gravado pro retry.
    it('gate da 1B devolve ok:false → FAILED com generationError, sem quest, com authoredSlice gravado', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const ai = fakeAi()
      const generation = new AdventureGenerationService(prisma, ai)
      const service = new AdventureService(prisma, ai, generation)
      vi.spyOn(generation, 'generateGatedRest').mockResolvedValue({ ok: false, reason: 'teto de 3 tentativas esgotado — última falha: x', attempt: 2 })
      await createAndGenerate(service, 'char-1', {})

      expect(recorded.adventureFailedUpdate).toMatchObject({ status: 'FAILED', generationError: 'teto de 3 tentativas esgotado — última falha: x' })
      expect(recorded.adventureUpdate).toMatchObject({ status: 'OPENING_READY', authoredSlice: { slice: { id: 'char-1:1' } } })
      expect(recorded.adventureUpdate).not.toHaveProperty('generatedAdventure')
      expect(recorded.questCreate).toBeUndefined()
    })

    it('1A esgota o reseed (escada falha 3x) → FAILED sem liberação: nem abertura nem authoredSlice', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const ai = { ...fakeAi(), generateAdventureSlice: vi.fn().mockRejectedValue(new Error('escada esgotada')) } as unknown as AiService
      await createAndGenerate(new AdventureService(prisma, ai), 'char-1', {})

      expect(ai.generateAdventureSlice).toHaveBeenCalledTimes(3)
      expect(recorded.adventureFailedUpdate).toMatchObject({ status: 'FAILED', generationError: expect.stringContaining('teto de 3 tentativas da fatia esgotado — última falha: escada esgotada') })
      expect(recorded.adventureUpdate).toBeUndefined()
      expect(recorded.eventLogCreate).toBeUndefined()
    })

    it('exceção inesperada na abertura → FAILED com a mensagem do erro, nunca propaga', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const crashingAi = { ...fakeAi(), generateOpeningNarration: vi.fn().mockRejectedValue(new Error('provider caiu')) } as unknown as AiService
      const service = new AdventureService(prisma, crashingAi)
      await expect(createAndGenerate(service, 'char-1', {})).resolves.toMatchObject({ status: 'GENERATING' })

      expect(recorded.adventureFailedUpdate).toMatchObject({ status: 'FAILED', generationError: 'provider caiu' })
    })
  })

  it('rejeita quando o personagem não existe', async () => {
    const { prisma } = fakePrisma(null)
    await expect(new AdventureService(prisma, fakeAi()).createForCharacter('missing', {})).rejects.toThrow()
  })

  it('background.story é repassado à autoria como characterStory (tom)', async () => {
    const capture: Record<string, unknown> = {}
    const { prisma } = fakePrisma({ ...baseChar, background: { story: 'cresceu nos cais' } })
    await new AdventureService(prisma, fakeAi(null, null, {}, authored(), capture)).createForCharacter('char-1', {})
    expect(capture['characterStory']).toBe('cresceu nos cais')
  })

  // US-232: DTO tone/setting/areaType repassados como registryOverrides; config vai como 5º arg.
  // US-256: o que era `generateGatedAdventure` virou `generateSlice` (1A, com registryOverrides/locale/
  // profile) + `generateGatedRest` (1B). Os três repasses do DTO acontecem na 1A.
  function serviceWithSliceSpy(prisma: PrismaService) {
    const generation = new AdventureGenerationService(prisma, fakeAi())
    return { service: new AdventureService(prisma, fakeAi(), generation), sliceSpy: vi.spyOn(generation, 'generateSlice') }
  }

  it('tone/setting/areaType do DTO são repassados a generateSlice com config', async () => {
    const configComCatalogo: SystemConfig = { ...config, tones: [{ key: 'heroic', label: 'Heroico' }], settings: [{ key: 'urban', label: 'Urbano' }], areaTypes: [{ key: 'dungeon', label: 'Masmorra' }] }
    const { prisma } = fakePrisma({ ...baseChar, system: { config: configComCatalogo } })
    const { service, sliceSpy } = serviceWithSliceSpy(prisma)
    await createAndGenerate(service, 'char-1', { tone: 'heroic', setting: 'urban', areaType: 'dungeon' })
    expect(sliceSpy).toHaveBeenCalledWith(expect.anything(), 'char-1', 1, 'pt-BR', expect.anything(), { tone: 'heroic', setting: 'urban', areaType: 'dungeon' }, 0)
  })

  it('locale de User.locale (en-US) é repassado a generateSlice', async () => {
    const { prisma } = fakePrisma({ ...baseChar, user: { locale: 'en-US' } })
    const { service, sliceSpy } = serviceWithSliceSpy(prisma)
    await createAndGenerate(service, 'char-1', {})
    expect(sliceSpy).toHaveBeenCalledWith(expect.anything(), 'char-1', 1, 'en-US', expect.anything(), expect.anything(), 0)
  })

  it('challenge do DTO chega ao profile (default adventure)', async () => {
    const { prisma } = fakePrisma(baseChar)
    const { service, sliceSpy } = serviceWithSliceSpy(prisma)
    await createAndGenerate(service, 'char-1', {})
    expect(sliceSpy.mock.calls[0]?.[0]).toMatchObject({ challenge: 'adventure' })
    await createAndGenerate(service, 'char-1', { challenge: 'challenge' })
    expect(sliceSpy.mock.calls[1]?.[0]).toMatchObject({ challenge: 'challenge' })
  })

  describe('US-156/US-184: validação de catálogo (tone/setting/areaType)', () => {
    const configComCatalogo: SystemConfig = { ...config, tones: [{ key: 'heroic', label: 'Heroico' }], settings: [{ key: 'urban', label: 'Urbano' }], areaTypes: [{ key: 'dungeon', label: 'Masmorra' }] }

    it('chave válida passa', async () => {
      const { prisma } = fakePrisma({ ...baseChar, system: { config: configComCatalogo } })
      await expect(new AdventureService(prisma, fakeAi()).createForCharacter('char-1', { tone: 'heroic' })).resolves.toMatchObject({ id: 'adv-1' })
    })

    it('tone fora do catálogo: 400 com valor e chaves', async () => {
      const { prisma } = fakePrisma({ ...baseChar, system: { config: configComCatalogo } })
      await expect(new AdventureService(prisma, fakeAi()).createForCharacter('char-1', { tone: 'xpto' }))
        .rejects.toThrow('Tom inválido: "xpto". Esperado uma chave do catálogo do sistema: heroic')
    })

    it('setting fora do catálogo: 400', async () => {
      const { prisma } = fakePrisma({ ...baseChar, system: { config: configComCatalogo } })
      await expect(new AdventureService(prisma, fakeAi()).createForCharacter('char-1', { setting: 'xpto' }))
        .rejects.toThrow('Cenário inválido: "xpto". Esperado uma chave do catálogo do sistema: urban')
    })

    it('config legado sem catálogo aceita qualquer chave', async () => {
      const { prisma } = fakePrisma(baseChar)
      await expect(new AdventureService(prisma, fakeAi()).createForCharacter('char-1', { tone: 'qualquer' })).resolves.toMatchObject({ id: 'adv-1' })
    })
  })

  describe('US-128: memento + equipamento da origem', () => {
    it('origem escolhida (sem memento): kit + equipamento', async () => {
      const { prisma, recorded } = fakePrisma({ ...baseChar, origin: { key: 'a5e-ag_acolyte' } })
      await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
      expect(recorded.characterStateCreate).toMatchObject({ inventory: [{ name: 'Adaga', qty: 1 }, { name: 'Símbolo sagrado', qty: 1, origin: 'equipment' }, { name: 'Túnica', qty: 1, origin: 'equipment' }] })
    })

    it('memento escolhido: item "Memento" com nome fixo', async () => {
      const { prisma, recorded } = fakePrisma({ ...baseChar, origin: { memento: 'O símbolo gasto do mentor.' } })
      await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
      expect(recorded.characterStateCreate).toMatchObject({ inventory: [{ name: 'Adaga', qty: 1 }, { name: 'Memento', qty: 1, origin: 'memento' }] })
    })

    it('sem origem nem memento: só o kit', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      await new AdventureService(prisma, fakeAi()).createForCharacter('char-1', {})
      expect(recorded.characterStateCreate).toMatchObject({ inventory: [{ name: 'Adaga', qty: 1 }] })
    })
  })

  // US-217: ramo "Aventura pronta" — pula o motor de mundo, não chama a autoria (1A/1B).
  describe('ramo "Aventura pronta" (dto.preset)', () => {
    function presetAi(opening: string | null = null, scene: Record<string, unknown> | null = null, intro: string | null = null): AiService {
      return {
        generateOpeningNarration: vi.fn().mockResolvedValue(opening),
        generateIntroNarration: vi.fn().mockResolvedValue(intro),
        extractOpeningScene: vi.fn().mockResolvedValue(scene),
        extractOpeningEntities: vi.fn(),
        generateAdventureSlice: vi.fn(),
        generateAdventureRest: vi.fn(),
      } as unknown as AiService
    }

    it('persiste Adventure/Quest do gancho fixo, sem chamar a autoria', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const ai = presetAi()
      const adventure = await new AdventureService(prisma, ai).createForCharacter('char-1', { preset: true })
      expect(adventure).toMatchObject({ id: 'adv-1', title: 'O Arquivo Que Sussurra', order: 1 })
      expect(recorded.questCreate).toMatchObject({ title: 'Decifrar o Arquivo', isPrimary: true })
      expect(ai.generateAdventureSlice).not.toHaveBeenCalled()
      expect(ai.generateAdventureRest).not.toHaveBeenCalled()
    })

    it('abertura continua gerada pela IA', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const ai = presetAi('A vela responde de um jeito novo.')
      await new AdventureService(prisma, ai).createForCharacter('char-1', { preset: true })
      expect(recorded.eventLogCreate).toMatchObject({ type: 'NARRATION', payload: { text: 'A vela responde de um jeito novo.' } })
    })

    it('IA vazia: cai no texto estático do gancho', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      await new AdventureService(prisma, presetAi(null)).createForCharacter('char-1', { preset: true })
      expect(recorded.eventLogCreate).toMatchObject({ payload: { text: 'A vela curva-se, Elara.' } })
    })

    it('sem generatedAdventure/entities; Quest sem objective/conclusionHint', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      await new AdventureService(prisma, presetAi()).createForCharacter('char-1', { preset: true })
      expect(recorded.adventureCreate).not.toHaveProperty('generatedAdventure')
      expect(recorded.adventureCreate).not.toHaveProperty('entities')
      expect(recorded.questCreate).not.toHaveProperty('objective')
    })

    // US-257: mesmo comportamento do ramo gerado (describe abaixo), verificado aqui pro ramo preset.
    it('generateIntroNarration resolve → EventLog INTRODUCTION gravado ANTES do NARRATION', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const ai = presetAi('A vela responde de um jeito novo.', null, 'Prólogo do Mestre.')
      await new AdventureService(prisma, ai).createForCharacter('char-1', { preset: true })

      const creates = recorded.eventLogCreates as Array<{ type: string; payload: { text: string } }>
      expect(creates.map((c) => c.type)).toEqual(['INTRODUCTION', 'NARRATION'])
      expect(creates[0]).toMatchObject({ payload: { text: 'Prólogo do Mestre.' } })
    })

    it('generateIntroNarration null → nenhum EventLog INTRODUCTION, só NARRATION (idêntico a antes da story)', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const ai = presetAi('A vela responde de um jeito novo.')
      await new AdventureService(prisma, ai).createForCharacter('char-1', { preset: true })

      const creates = recorded.eventLogCreates as Array<{ type: string }>
      expect(creates.map((c) => c.type)).toEqual(['NARRATION'])
    })
  })

  // US-257: introdução do Mestre gerada em PARALELO à abertura (Promise.all), ANTES dela na
  // timeline — cobre o ramo "gerado" (AdventureGenerationService.releaseOpening, via createAndGenerate).
  describe('US-257: introdução do Mestre ANTES da cena de abertura (ramo gerado)', () => {
    it('generateIntroNarration resolve → EventLog INTRODUCTION gravado ANTES do NARRATION, createdAt distintos', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const service = new AdventureService(prisma, fakeAi('A cena de abertura.', null, {}, authored(), undefined, 'A introdução do Mestre.'))
      await createAndGenerate(service, 'char-1', {})

      const creates = recorded.eventLogCreates as Array<{ type: string; payload: { text: string }; createdAt?: Date }>
      expect(creates).toHaveLength(2)
      expect(creates[0]).toMatchObject({ type: 'INTRODUCTION', payload: { text: 'A introdução do Mestre.' } })
      expect(creates[1]).toMatchObject({ type: 'NARRATION', payload: { text: 'A cena de abertura.' } })
      expect((creates[0]!['createdAt'] as Date).getTime()).toBeLessThan((creates[1]!['createdAt'] as Date).getTime())
    })

    it('generateIntroNarration null (falha/timeout) → nenhum EventLog INTRODUCTION, aventura idêntica ao comportamento anterior a esta story', async () => {
      const { prisma, recorded } = fakePrisma(baseChar)
      const service = new AdventureService(prisma, fakeAi('A cena de abertura.'))
      await createAndGenerate(service, 'char-1', {})

      const creates = recorded.eventLogCreates as Array<{ type: string }>
      expect(creates.map((c) => c.type)).toEqual(['NARRATION'])
    })

    it('generateOpeningNarration não muda de parâmetro nenhum com a introdução em paralelo', async () => {
      const { prisma } = fakePrisma(baseChar)
      const seenOpening: Record<string, unknown> = {}
      const service = new AdventureService(prisma, fakeAi('A cena.', null, seenOpening, authored(), undefined, 'Prólogo.'))
      await createAndGenerate(service, 'char-1', {})

      // Mesmos campos que os testes pré-existentes já verificam (seededEntities/mainQuest/etc) —
      // `entities` só existe no caminho de abertura, nunca no de introdução (US-257 §Escopo).
      expect(seenOpening).toHaveProperty('entities')
      expect(seenOpening).not.toHaveProperty('origin')
    })

    it('origin/backgrounds chegam a generateIntroNarration, nunca a generateOpeningNarration', async () => {
      const { prisma } = fakePrisma({ ...baseChar, origin: { key: 'a5e-ag_acolyte', connection: 'O templo' } })
      const seenOpening: Record<string, unknown> = {}
      const seenIntro: Record<string, unknown> = {}
      const service = new AdventureService(prisma, fakeAi('A cena.', null, seenOpening, authored(), undefined, 'Prólogo.', seenIntro))
      await createAndGenerate(service, 'char-1', {})

      expect(seenIntro['origin']).toMatchObject({ key: 'a5e-ag_acolyte', connection: 'O templo' })
      expect(seenIntro['backgrounds']).toEqual(config.backgrounds)
      expect(seenOpening).not.toHaveProperty('origin')
    })
  })
})

describe('AdventureService.getGenerationStatus (US-235)', () => {
  function prismaWithAdventure(adventure: { status: string; generationError?: string | null } | null): PrismaService {
    return { adventure: { findFirst: async () => adventure } } as unknown as PrismaService
  }

  it('devolve status sem error quando não FAILED', async () => {
    const prisma = prismaWithAdventure({ status: 'GENERATING', generationError: null })
    const result = await new AdventureService(prisma, fakeAi()).getGenerationStatus('char-1', 'adv-1')
    expect(result).toEqual({ status: 'GENERATING' })
  })

  it('devolve error junto quando FAILED', async () => {
    const prisma = prismaWithAdventure({ status: 'FAILED', generationError: 'teto esgotado' })
    const result = await new AdventureService(prisma, fakeAi()).getGenerationStatus('char-1', 'adv-1')
    expect(result).toEqual({ status: 'FAILED', error: 'teto esgotado' })
  })

  // US-235 (nota de implementação): mesma disciplina de `getExportData` — adventureId tem de
  // pertencer a ESTE characterId (via participants), senão vazaria estado de outro personagem.
  it('aventura inexistente ou de outro personagem: 404', async () => {
    const prisma = prismaWithAdventure(null)
    await expect(new AdventureService(prisma, fakeAi()).getGenerationStatus('char-1', 'adv-x')).rejects.toThrow('Aventura adv-x não encontrada')
  })
})

describe('AdventureService.getTurns', () => {
  it('mapeia ACTION→user e NARRATION→dm, inclui resumidos, marca última ação editável', async () => {
    const logs = [
      { type: 'ACTION', payload: { text: 'Abro a porta.' }, summarized: true },
      { type: 'NARRATION', payload: { text: 'A porta range.' }, summarized: true },
      { type: 'ACTION', payload: { text: 'Entro.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'Três figuras...' }, summarized: false },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const turns = await new AdventureService(prisma, fakeAi()).getTurns('char-1', 'adv-1')
    expect(turns).toEqual([
      { role: 'user', content: 'Abro a porta.' },
      { role: 'dm', content: 'A porta range.' },
      { role: 'user', content: 'Entro.', editable: true },
      { role: 'dm', content: 'Três figuras...' },
    ])
  })

  it('US-257: mapeia INTRODUCTION→dm, antes da NARRATION da cena de abertura', async () => {
    const logs = [
      { type: 'INTRODUCTION', payload: { text: 'Um prólogo do Mestre.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'A cena de abertura.' }, summarized: false },
      { type: 'ACTION', payload: { text: 'Entro.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'Três figuras...' }, summarized: false },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const turns = await new AdventureService(prisma, fakeAi()).getTurns('char-1', 'adv-1')
    expect(turns).toEqual([
      { role: 'dm', content: 'Um prólogo do Mestre.' },
      { role: 'dm', content: 'A cena de abertura.' },
      { role: 'user', content: 'Entro.', editable: true },
      { role: 'dm', content: 'Três figuras...' },
    ])
  })

  it('US-67: último turno mutou o estado (CHARACTER_UPDATE) → não editável', async () => {
    const logs = [
      { type: 'NARRATION', payload: { text: 'O goblin ataca.' }, summarized: false },
      { type: 'CHARACTER_UPDATE', payload: { field: 'hp', newHp: 4 }, summarized: false },
      { type: 'ACTION', payload: { text: 'Aparo o golpe.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'A lâmina raspa o braço.' }, summarized: false },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const turns = await new AdventureService(prisma, fakeAi()).getTurns('char-1', 'adv-1')
    expect(turns).toEqual([
      { role: 'dm', content: 'O goblin ataca.' },
      { role: 'user', content: 'Aparo o golpe.' },
      { role: 'dm', content: 'A lâmina raspa o braço.' },
    ])
  })
})

describe('AdventureService.buildAdventureProfile', () => {
  function service(): { buildAdventureProfile: (character: Record<string, unknown>, config: SystemConfig, challenge: 'adventure' | 'challenge') => unknown } {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, fakeAi()) as unknown as { buildAdventureProfile: (character: Record<string, unknown>, config: SystemConfig, challenge: 'adventure' | 'challenge') => unknown }
  }

  it('background/origin preenchidos: perfil carrega os campos, hookSeed resolvido', () => {
    const character = {
      name: 'Elara', level: 3, class: 'wizard',
      background: { story: 'Aprendiz fugida', bonds: ['O mentor'], flaws: ['Orgulho'] },
      origin: { key: 'a5e-ag_acolyte', connection: 'O templo', memento: 'Símbolo gasto' },
    }
    const profile = service().buildAdventureProfile(character, config, 'adventure') as Record<string, unknown>
    expect(profile).toEqual({
      level: 3, classKey: 'wizard', background: character.background,
      origin: { adventuresAndAdvancement: 'O templo pede um favor.' },
      hookSeed: 'A vela curva-se, Elara.', challenge: 'adventure',
    })
  })

  it('background {} e origin {}: perfil válido, hookSeed da classe', () => {
    const profile = service().buildAdventureProfile({ name: 'Nyx', level: 1, class: 'wizard', background: {}, origin: {} }, config, 'adventure') as Record<string, unknown>
    expect(profile['level']).toBe(1)
    expect(profile['hookSeed']).toBe('A vela curva-se, Nyx.')
  })
})
