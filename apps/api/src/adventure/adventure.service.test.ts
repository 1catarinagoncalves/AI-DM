import { describe, it, expect, vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { GeneratedAdventureSchema, type SystemConfig } from '@ai-dm/shared'
import { AdventureService, type AdventureProfile } from './adventure.service'
import { rollAdventure } from '../adventure-generation/roll-adventure'
import { chooseAntagonistRole, MONSTER_ROLE_CR, totalCr } from '../adventure-generation/monster-roles'
import { encounterDeadlyThreshold } from '../adventure-generation/lazy-encounter-benchmark'
import type { PrismaService } from '../prisma.service'
import type { AiService } from '../ai/ai.service'

// Fake do AiService: por padrão devolve null pra abertura (força o fallback estático,
// preservando as asserções de texto abaixo). `opening` != null exercita o caminho IA.
// `scene` (US-35) default null → extração falha/vazia, sceneState nulo (fallback).
// `entities` (US-75) default null → ledger vazio, igual ao comportamento pré-US-75.
// `seen` (US-105) recebe o input da geração — é como se afirma que o Mestre viu o RÓTULO
// de raça/classe, e não a chave crua guardada na ficha.
// US-153: generateLocationsAndNpcs/generateSecrets/generateClosing sempre respondem com um
// grafo FECHADO (npc-1 ocupa loc-1) — o gate (US-150) exige isso pra passar na 1ª tentativa,
// sem reseed, mantendo os testes deste ficheiro determinísticos.
function fakeAi(
  opening: string | null = null,
  scene: Record<string, unknown> | null = null,
  entities: Record<string, unknown>[] | null = null,
  seen: Record<string, unknown> = {},
): AiService {
  const locations = [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-1'], vibe: 'combat' as const }]
  const npcs = [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
  const secrets = [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
  // US-166: generateClosing devolve encounterSituations posicional, 8 itens.
  // US-193: encounterId ecoa o id do esqueleto (encounter-${i+1}) + unlocks novo.
  const encounterSituations = Array.from({ length: 8 }, (_, i) => ({
    encounterId: `encounter-${i + 1}`, behaviors: `behaviors-${i + 1}`, goal: `goal-${i + 1}`, complications: `complications-${i + 1}`, unlocks: `unlocks-${i + 1}`,
  }))
  const closing = { objective: 'Impedir que Malvora reúna um exército para tomar a Enseada Cinzenta.', conclusion: 'O culto recua para as sombras.', followUps: ['A dívida volta a assombrar.'], encounterSituations }
  const antagonist = { name: 'Malvora', want: 'poder sobre a região', method: 'reunir um exército', trait: 'fala em sussurros', weakness: 'vaidade', connection: 'já cruzou caminho com o grupo antes' }
  return {
    generateOpeningNarration: async (input: Record<string, unknown>) => { Object.assign(seen, input); return opening },
    extractOpeningScene: async () => scene,
    extractOpeningEntities: async () => entities,
    // US-192: fake ecoa o 1º candidato — sem elaboração real (fora de escopo do fake), mas
    // função dos `candidates` recebidos, pra continuar variando por characterId/order/background
    // como o `content.premissa` cru variava antes desta story (testes de diferenciação abaixo).
    generatePremissa: async (params: { candidates: string[] }) => ({ premissa: params.candidates[0] ?? '' }),
    generateLocationsAndNpcs: async () => ({ locations, npcs }),
    generateSecrets: async () => secrets,
    generateAntagonist: async () => antagonist,
    generateClosing: async () => closing,
    generateOpeningBeat: async () => ({ start: 'A porta racha ao meio antes que alguém grite.' }),
    // US-191, Parte 2: 3ª perna do Promise.all — devolve boxedText/description fixos, sem
    // depender de nenhum estado do teste (nenhum teste deste bloco é SOBRE esta chamada).
    generateAntagonistLocationProse: async () => ({ boxedText: 'x', description: 'x' }),
  } as unknown as AiService
}

const config: SystemConfig = {
  attributes: [{ key: 'constitution', label: 'Con', min: 1, max: 20, default: 10 }],
  startingKits: { fighter: [{ name: 'Espada longa', qty: 1 }], default: [{ name: 'Adaga', qty: 1 }] },
  // US-105: a ficha guarda a chave; o catálogo é quem sabe o rótulo do locale.
  races: [{ key: 'human', label: 'Humano' }],
  classes: [{ key: 'wizard', label: 'Mago' }],
  // US-128: equipamento da origem, chave = SystemBackground.key (Character.origin.key).
  backgroundEquipment: { 'a5e-ag_acolyte': [{ name: 'Símbolo sagrado', qty: 1 }, { name: 'Túnica', qty: 1 }] },
  // US-148: catálogo de origem narrativa — usado por resolveAdventuresAndAdvancement no perfil.
  backgrounds: [
    {
      key: 'a5e-ag_acolyte', name: 'Acólito', source: 'a5e-ag',
      benefits: [{ type: 'adventures_and_advancement', name: 'Chamado', description: 'O templo pede um favor.' }],
    },
  ],
  initialAdventures: {
    hooks: [
      {
        id: 'mago-arquivo', classKey: 'wizard', title: 'O Arquivo Que Sussurra',
        pitch: 'Um grimório reconhece {characterName}.',
        openingNarration: 'A vela curva-se, {characterName}.',
        tags: [],
      },
      {
        id: 'default-sinal', classKey: 'default', title: 'O Primeiro Sinal de {characterClass}',
        pitch: 'Algo reconhece {characterName}.',
        openingNarration: 'Alguém pronuncia a tua classe: {characterClass}.', tags: [],
      },
    ],
  },
}

interface Recorded {
  adventureCreate?: Record<string, unknown>
  adventureUpdateMany?: Record<string, unknown>
  participantCreate?: Record<string, unknown>
  characterStateCreate?: Record<string, unknown>
  questCreate?: Record<string, unknown>
  eventLogCreate?: Record<string, unknown>
}

// Test double mínimo: só os métodos que AdventureService.createForCharacter chama,
// incluindo um $transaction que executa o callback com um "tx" que grava as chamadas.
// US-153: `adventureParticipant.count` sai da `tx` pro `prisma` de topo — o `order` agora é
// calculado ANTES de abrir a transação (this.prisma, não tx.prisma).
function fakePrisma(character: Record<string, unknown> | null, participantCount = 0): { prisma: PrismaService; recorded: Recorded } {
  const recorded: Recorded = {}
  const tx = {
    adventureParticipant: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.participantCreate = data
        return { id: 'participant-1', ...data }
      },
    },
    adventure: {
      updateMany: async (args: Record<string, unknown>) => {
        recorded.adventureUpdateMany = args
        return { count: 0 }
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.adventureCreate = data
        return { id: 'adv-1', ...data }
      },
    },
    characterState: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.characterStateCreate = data
        return data
      },
    },
    quest: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.questCreate = data
        return { id: 'quest-1', ...data }
      },
    },
    eventLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recorded.eventLogCreate = data
        return { id: 'evt-1', ...data }
      },
    },
  }

  const prisma = {
    character: { findUnique: async () => character },
    // getSystemCached (via getSystemsCached) busca a lista inteira e filtra por id — os
    // fixtures embutem `system` direto no character (sem systemId próprio, ambos undefined
    // aqui), então o double devolve UM item cujo id casa com o que o service vai procurar.
    system: {
      findMany: async () => {
        const c = character as { system?: unknown; systemId?: string } | null
        return c?.system ? [{ id: c.systemId, ...(c.system as object) }] : []
      },
    },
    adventureParticipant: { count: async () => participantCount },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
  } as unknown as PrismaService

  return { prisma, recorded }
}

describe('AdventureService.createForCharacter', () => {
  // US-153: título e quest já não vêm do gancho fixo por classe — vêm do artefato do
  // motor de geração (US-164), determinístico por characterId+order (US-146). `rollAdventure`
  // real (não mockado) rola os candidatos; `fakeAi` (US-192) ecoa o 1º como premissa
  // "elaborada" — mesmo valor que `generateAdventure` usou.
  it('título e quest vêm do artefato gerado (summary/start), não mais do gancho fixo por classe', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    const adventure = await service.createForCharacter('char-1', {})

    const { content } = rollAdventure('char-1', 1)
    expect(adventure).toMatchObject({ id: 'adv-1', systemId: 'sys-1', creatorId: 'user-1', title: content.premissaCandidates[0], order: 1 })
    expect(recorded.participantCreate).toEqual({ adventureId: 'adv-1', characterId: 'char-1' })
    expect(recorded.characterStateCreate).toMatchObject({
      characterId: 'char-1', adventureId: 'adv-1', hp: 12, maxHp: 12,
      inventory: [{ name: 'Adaga', qty: 1 }], // 'Mago'→wizard, e o config só tem kit 'fighter' → default
    })
    // Quest.title = summary (mesma premissa); Quest.description = start — gerado por
    // ai.generateOpeningBeat desde US-172, não mais o hookSeed copiado (US-153 #4).
    // US-169: objective/conclusionHint gravados também — conclusionHint = generated.conclusion
    // (US-153 Questões em aberto #4: NUNCA exposto em turno passivo, só via completeQuest).
    expect(recorded.questCreate).toMatchObject({
      adventureId: 'adv-1', title: content.premissaCandidates[0], description: 'A porta racha ao meio antes que alguém grite.', isPrimary: true,
      objective: 'Impedir que Malvora reúna um exército para tomar a Enseada Cinzenta.',
      conclusionHint: 'O culto recua para as sombras.',
    })
    // Placeholder {characterName} resolvido antes de persistir (hookSeed continua vindo do gancho).
    expect(recorded.eventLogCreate).toMatchObject({
      adventureId: 'adv-1', characterId: 'char-1', type: 'NARRATION',
      payload: { text: 'A vela curva-se, Elara.' },
    })
  })

  it('caminho IA: quando a geração devolve texto, a abertura persiste esse texto, não o template estático', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const gerado = 'A chuva fina cai sobre Elara enquanto o grimório desperta.'
    const service = new AdventureService(prisma, fakeAi(gerado))

    await service.createForCharacter('char-1', {})

    expect(recorded.eventLogCreate).toMatchObject({
      type: 'NARRATION',
      payload: { text: gerado },
    })
  })

  it('US-35: extração devolve patch → CharacterState nasce com sceneState preenchido e coerente', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const patch = {
      local: 'estrada de terra ao pé da colina', ambiente: 'externo', periodo: 'anoitecer',
      presentes: ['velho ajoelhado'], objetos_em_cena: ['chuva fina', 'archote apagado'],
    }
    const service = new AdventureService(prisma, fakeAi('A chuva cai sobre a estrada.', patch))

    await service.createForCharacter('char-1', {})

    const state = recorded.characterStateCreate as Record<string, unknown>
    expect(state['sceneState']).toMatchObject({
      local: 'estrada de terra ao pé da colina', ambiente: 'externo', periodo: 'anoitecer',
      presentes: ['velho ajoelhado'], objetos_em_cena: ['chuva fina', 'archote apagado'],
    })
    // mergeSceneState carimba o timestamp — o snapshot é completo, não parcial.
    expect((state['sceneState'] as Record<string, unknown>)['atualizadoEm']).toBeTruthy()
  })

  it('US-35: extração devolve null → CharacterState criado sem sceneState, sem erro (fallback US-34)', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi('A chuva cai sobre a estrada.', null))

    const adventure = await service.createForCharacter('char-1', {})

    expect(adventure).toMatchObject({ id: 'adv-1' })
    expect(recorded.characterStateCreate).not.toHaveProperty('sceneState')
  })

  // US-151: `extractOpeningEntities` (fake sempre devolve null aqui) deixou de ser a fonte —
  // o ledger vem de `seedLedgerFromGeneratedAdventure(generated)`, lido do artefato do motor
  // (Marta/secret-1, fixos em `fakeAi`). Nível 1 → `composeEncounterRoles` vazio, sem NPC de
  // combate para filtrar neste teste (esse caso já é coberto em seed-ledger.test.ts). Único
  // local (`fakeAi`) hospeda os 8 encontros — `nota` ganha um segmento por encontro (US-166).
  it('US-151: entities vêm do artefato gerado (secret + NPC narrativo), não mais de extractOpeningEntities', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', {})

    const encounterNota = (recorded.adventureCreate?.['entities'] as Array<{ nome: string; nota: string }>)
      .find((e) => e.nome === 'Enseada Cinzenta')!.nota
    expect(encounterNota.startsWith('x | ')).toBe(true)
    expect(encounterNota.split(' | ')).toHaveLength(9) // boxedText + 8 segmentos de encontro

    expect(recorded.adventureCreate?.['entities']).toEqual([
      {
        nome: 'secret-1', tipo: 'outro', local: 'Enseada Cinzenta',
        nota: 'A estalajadeira esconde uma dívida com o culto.',
        sabido: 'publico', revelado: false, atualizadoEm: expect.any(String),
      },
      {
        nome: 'Marta', tipo: 'npc', local: 'Enseada Cinzenta',
        nota: 'herborista suspeita', revelado: true, atualizadoEm: expect.any(String),
      },
      {
        nome: 'Enseada Cinzenta', tipo: 'local',
        nota: encounterNota, revelado: false, atualizadoEm: expect.any(String),
      },
      // US-189/US-191: antagonista some de npcEntities (excluído por `id`, nível 1/'adventure'
      // cai no caso `role === antagonist.trait` texto livre que vazaria sem essa exclusão) e
      // chega como DUAS entradas próprias — pública (nome/local, revelado true) e oculta
      // (want/method/trait/weakness/connection, revelado false) — últimas no ledger.
      {
        nome: 'Malvora', tipo: 'npc', local: 'Enseada Cinzenta',
        revelado: true, atualizadoEm: expect.any(String),
      },
      {
        nome: 'Malvora', tipo: 'npc', local: 'Enseada Cinzenta',
        nota: 'Quer: poder sobre a região — Método: reunir um exército — Traço: fala em sussurros — Fraqueza: vaidade — Conexão: já cruzou caminho com o grupo antes',
        revelado: false, atualizadoEm: expect.any(String),
      },
    ])
  })

  it('classe desconhecida: cai no gancho default (hookSeed), sem erro', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Nyx', class: 'Cartógrafa Estelar', level: 1,
      baseAttributes: { constitution: 10 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    const adventure = await service.createForCharacter('char-1', {})

    // US-153: título já não é o template do gancho ('O Primeiro Sinal de...') — vem do artefato.
    expect(typeof adventure.title).toBe('string')
    expect((adventure.title as string).length).toBeGreaterThan(0)
    expect(recorded.eventLogCreate).toMatchObject({
      payload: { text: 'Alguém pronuncia a tua classe: Cartógrafa Estelar.' },
    })
  })

  it('order é calculado ANTES da transação e numera pela contagem de aventuras anteriores do personagem', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 10 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character, 2)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', {})

    // Mesmo `order` nos dois lugares: generateGatedAdventure (registro/conteúdo rolados
    // para order=3) e tx.adventure.create — sem recomputar (achado 2026-08-18, US-153).
    const { content } = rollAdventure('char-1', 3)
    expect(recorded.adventureCreate).toMatchObject({ order: 3, title: content.premissaCandidates[0] })
  })

  // US-105: a chave vai ao lookup, o rótulo vai ao Mestre. Falha se a chave crua vazar
  // para a primeira cena ("Elara, a wizard").
  it('a abertura recebe o RÓTULO de raça e classe, não a chave', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 10 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const seen: Record<string, unknown> = {}
    const service = new AdventureService(prisma, fakeAi(null, null, null, seen))

    await service.createForCharacter('char-1', {})

    expect(seen['characterClass']).toBe('Mago')
    expect(seen['characterRace']).toBe('Humano')
  })

  // US-168: a abertura passa a ver o mesmo ledger que a transação persiste — antes,
  // `entities` nunca chegava a `generateOpeningNarration`, então a abertura escrevia
  // cega ao elenco já gerado (Marta/secret-1, fixos em `fakeAi`).
  it('US-168: seededEntities (Marta/secret-1) chega a generateOpeningNarration como entities', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const seen: Record<string, unknown> = {}
    const service = new AdventureService(prisma, fakeAi(null, null, null, seen))

    await service.createForCharacter('char-1', {})

    expect(seen['entities']).toEqual([
      expect.objectContaining({ nome: 'secret-1' }),
      expect.objectContaining({ nome: 'Marta' }),
      expect.objectContaining({ nome: 'Enseada Cinzenta' }),
      expect.objectContaining({ nome: 'Malvora' }), // US-191: entrada pública do antagonista
      expect.objectContaining({ nome: 'Malvora' }), // US-189: entrada oculta, ver teste US-151 acima
    ])
  })

  // US-168: `tone` (registo da aventura gerada) chega direto de `generated.tone`, sem
  // esperar o round-trip pelo banco — a abertura já nasce coerente.
  it('US-168: generated.tone chega a generateOpeningNarration como tone', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const seen: Record<string, unknown> = {}
    const service = new AdventureService(prisma, fakeAi(null, null, null, seen))

    await service.createForCharacter('char-1', {})

    const { registry } = rollAdventure('char-1', 1)
    expect(seen['tone']).toBe(registry.tone)
  })

  // US-168: a coluna `generatedAdventure` (ADR 012/US-144), reservada e nunca escrita
  // até esta story, passa a persistir o artefato inteiro.
  it('US-168: tx.adventure.create grava generatedAdventure com o artefato gerado', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', {})

    expect(recorded.adventureCreate?.['generatedAdventure']).toMatchObject({
      id: 'char-1:1',
      summary: expect.any(String),
      start: expect.any(String),
    })
  })

  it('rejeita quando o personagem não existe', async () => {
    const { prisma } = fakePrisma(null)
    const service = new AdventureService(prisma, fakeAi())
    await expect(service.createForCharacter('missing', {})).rejects.toThrow()
  })

  // US-153: dois personagens da mesma classe, characterIds diferentes → premissas roladas
  // diferentes (seed por characterId+order, US-146/US-147) — título e Quest.title diferem.
  it('dois personagens da mesma classe, backgrounds diferentes: recebem aventuras (título) diferentes', async () => {
    const charA = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config }, background: { story: 'Aprendiz fugida' },
    }
    const charB = {
      id: 'char-2', userId: 'user-1', systemId: 'sys-1', name: 'Nyx', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config }, background: { story: 'Órfã do porto' },
    }
    const runA = fakePrisma(charA)
    const runB = fakePrisma(charB)

    const adventureA = await new AdventureService(runA.prisma, fakeAi()).createForCharacter('char-1', {})
    const adventureB = await new AdventureService(runB.prisma, fakeAi()).createForCharacter('char-2', {})

    expect(adventureA.title).not.toBe(adventureB.title)
  })

  // US-146: mesmo personagem, mesmo order → mesma aventura (determinismo ponta a ponta).
  it('mesmo personagem, mesmo order: recriar a aventura devolve o mesmo título e a mesma quest', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const run1 = fakePrisma(character)
    const run2 = fakePrisma(character)

    const adventure1 = await new AdventureService(run1.prisma, fakeAi()).createForCharacter('char-1', {})
    const adventure2 = await new AdventureService(run2.prisma, fakeAi()).createForCharacter('char-1', {})

    expect(adventure1.title).toBe(adventure2.title)
    expect(run1.recorded.questCreate).toEqual(run2.recorded.questCreate)
  })

  // US-150: teto de tentativas do gate esgotado (grafo nunca fecha: npc-1 nunca referenciado)
  // → Error genérico com o motivo da última falha, NUNCA BadRequestException, sem fallback
  // estático (ao contrário de generateOpeningNarration, não existe aventura fixa pra cair).
  it('gate esgota o teto de tentativas: lança Error genérico com o motivo, sem BadRequestException', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const orphanAi = {
      generateOpeningNarration: async () => null,
      extractOpeningScene: async () => null,
      extractOpeningEntities: async () => null,
      generatePremissa: async () => ({ premissa: 'Um portão amaldiçoado se abre na Enseada Cinzenta.' }),
      generateLocationsAndNpcs: async () => ({
        locations: [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'combat' }],
        npcs: [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }], // nunca referenciado → órfão
      }),
      generateSecrets: async () => [{ id: 'secret-1', locationId: 'loc-1', text: 'segredo' }],
      generateAntagonist: async () => ({ name: 'Malvora', want: 'poder', method: 'exército', trait: 'sussurra', weakness: 'vaidade', connection: 'x' }),
      generateClosing: async () => ({ conclusion: 'fim', followUps: [] }),
      generateOpeningBeat: async () => ({ start: 'abertura' }),
    } as unknown as AiService
    const service = new AdventureService(prisma, orphanAi)

    const err: unknown = await service.createForCharacter('char-1', {}).catch((e) => e)

    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(BadRequestException)
    expect((err as Error).message).toContain('teto de 3 tentativas esgotado')
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
  })

  // US-153: DTO consome tone opcional (US-156) — repassado como registryOverrides ao
  // motor, fixando o registro em vez de sortear (a UI que o preenche é a US-157, fora
  // do escopo aqui; esta story só liga o cano). setting/areaType voltaram na US-184
  // (ver teste abaixo).
  it('tone do DTO é repassado a generateGatedAdventure como registryOverrides', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())
    const gateSpy = vi.spyOn(service, 'generateGatedAdventure')

    await service.createForCharacter('char-1', { tone: 'heroic' })

    expect(gateSpy).toHaveBeenCalledWith(
      expect.anything(), 'char-1', 1, 'pt-BR', { tone: 'heroic' },
    )
  })

  // US-184: mesmo cano do teste acima, agora para setting/areaType — revert do corte da US-173.
  it('setting/areaType do DTO são repassados a generateGatedAdventure como registryOverrides', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())
    const gateSpy = vi.spyOn(service, 'generateGatedAdventure')

    await service.createForCharacter('char-1', { setting: 'urban', areaType: 'dungeon' })

    expect(gateSpy).toHaveBeenCalledWith(
      expect.anything(), 'char-1', 1, 'pt-BR', { setting: 'urban', areaType: 'dungeon' },
    )
  })

  // US-167: challenge do DTO chega ao profile que generateGatedAdventure recebe — sem esta
  // story o motor sempre empacota contra encounterDeadlyThreshold, nunca singleMonsterCrCap.
  it('challenge ausente no DTO: profile.challenge é "adventure" (default, sem regressão)', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())
    const gateSpy = vi.spyOn(service, 'generateGatedAdventure')

    await service.createForCharacter('char-1', {})

    expect(gateSpy.mock.calls[0]?.[0]).toMatchObject({ challenge: 'adventure' })
  })

  it('challenge "challenge" no DTO: profile.challenge chega como "challenge" a generateGatedAdventure (US-167)', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())
    const gateSpy = vi.spyOn(service, 'generateGatedAdventure')

    await service.createForCharacter('char-1', { challenge: 'challenge' })

    expect(gateSpy.mock.calls[0]?.[0]).toMatchObject({ challenge: 'challenge' })
  })

  // US-167: fim a fim — nível 1 com challenge 'challenge' produz encontro com NPC de combate
  // (hoje vazio nesse nível, US-159/US-160, independente do que o jogador escolhe na tela).
  // US-166: o encontro `combat` GARANTIDO é sempre a posição 8 (índice 7) — as posições 1-7
  // são sorteadas, então checar `encounters[0]` não é mais confiável.
  it('challenge "challenge" em nível 1: aventura persistida tem encounters[7] (combat, posição 8) com npcIds não vazio (US-167)', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', { challenge: 'challenge' })

    const generated = recorded.adventureCreate?.['generatedAdventure'] as { encounters: Array<{ type: string; npcIds: string[] }> }
    expect(generated.encounters[7]!.type).toBe('combat')
    expect(generated.encounters[7]!.npcIds.length).toBeGreaterThan(0)
  })

  // US-178: locale do jogador (User.locale, já resolvido na linha 230) chega ao motor de
  // geração — mesma variável que generateOpeningNarration já usava antes desta story.
  it('locale de User.locale (en-US) é repassado a generateGatedAdventure (US-178)', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config }, user: { locale: 'en-US' },
    }
    const { prisma } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())
    const gateSpy = vi.spyOn(service, 'generateGatedAdventure')

    await service.createForCharacter('char-1', {})

    expect(gateSpy).toHaveBeenCalledWith(expect.anything(), 'char-1', 1, 'en-US', expect.anything())
  })

  // US-156: validação server-side de tone contra o catálogo do sistema — mesmo molde de
  // validateCatalogKey (character.service.ts), reaplicado do lado da aventura. setting/
  // areaType ganham o mesmo tratamento no describe seguinte (US-184).
  describe('US-156: catálogo de registro (tone)', () => {
    const configComCatalogo: SystemConfig = {
      ...config,
      tones: [{ key: 'heroic', label: 'Heroico' }],
    }

    it('chave válida do catálogo: passa a validação, sem 400', async () => {
      const character = {
        id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
        baseAttributes: { constitution: 14 }, system: { config: configComCatalogo },
      }
      const { prisma } = fakePrisma(character)
      const service = new AdventureService(prisma, fakeAi())

      await expect(service.createForCharacter('char-1', { tone: 'heroic' }))
        .resolves.toMatchObject({ id: 'adv-1' })
    })

    it('tone fora do catálogo: 400 com o valor ofensor e as chaves esperadas', async () => {
      const character = {
        id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
        baseAttributes: { constitution: 14 }, system: { config: configComCatalogo },
      }
      const { prisma } = fakePrisma(character)
      const service = new AdventureService(prisma, fakeAi())

      await expect(service.createForCharacter('char-1', { tone: 'chave-inexistente' }))
        .rejects.toThrow('Tom inválido: "chave-inexistente". Esperado uma chave do catálogo do sistema: heroic')
    })

    it('campo ausente: não gera erro, segue para o motor sortear', async () => {
      const character = {
        id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
        baseAttributes: { constitution: 14 }, system: { config: configComCatalogo },
      }
      const { prisma } = fakePrisma(character)
      const service = new AdventureService(prisma, fakeAi())

      await expect(service.createForCharacter('char-1', {})).resolves.toMatchObject({ id: 'adv-1' })
    })

    it('sistema sem catálogo (config legado): aceita qualquer chave, sem 400', async () => {
      const character = {
        id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
        baseAttributes: { constitution: 14 }, system: { config }, // config sem tones
      }
      const { prisma } = fakePrisma(character)
      const service = new AdventureService(prisma, fakeAi())

      await expect(service.createForCharacter('char-1', { tone: 'qualquer-coisa' }))
        .resolves.toMatchObject({ id: 'adv-1' })
    })
  })

  // US-184: mesmo molde do describe acima, reaplicado a setting/areaType (revert do corte da US-173).
  describe('US-184: catálogo de registro (setting/areaType)', () => {
    const configComCatalogo: SystemConfig = {
      ...config,
      settings: [{ key: 'urban', label: 'Urbano' }],
      areaTypes: [{ key: 'dungeon', label: 'Masmorra' }],
    }

    it('chaves válidas do catálogo: passam a validação, sem 400', async () => {
      const character = {
        id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
        baseAttributes: { constitution: 14 }, system: { config: configComCatalogo },
      }
      const { prisma } = fakePrisma(character)
      const service = new AdventureService(prisma, fakeAi())

      await expect(service.createForCharacter('char-1', { setting: 'urban', areaType: 'dungeon' }))
        .resolves.toMatchObject({ id: 'adv-1' })
    })

    it('setting fora do catálogo: 400 com o valor ofensor e as chaves esperadas', async () => {
      const character = {
        id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
        baseAttributes: { constitution: 14 }, system: { config: configComCatalogo },
      }
      const { prisma } = fakePrisma(character)
      const service = new AdventureService(prisma, fakeAi())

      await expect(service.createForCharacter('char-1', { setting: 'chave-inexistente' }))
        .rejects.toThrow('Cenário inválido: "chave-inexistente". Esperado uma chave do catálogo do sistema: urban')
    })

    it('areaType fora do catálogo: 400 com o valor ofensor e as chaves esperadas', async () => {
      const character = {
        id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
        baseAttributes: { constitution: 14 }, system: { config: configComCatalogo },
      }
      const { prisma } = fakePrisma(character)
      const service = new AdventureService(prisma, fakeAi())

      await expect(service.createForCharacter('char-1', { areaType: 'chave-inexistente' }))
        .rejects.toThrow('Tipo de Área inválido: "chave-inexistente". Esperado uma chave do catálogo do sistema: dungeon')
    })

    it('campos ausentes: não gera erro, segue para o motor sortear', async () => {
      const character = {
        id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
        baseAttributes: { constitution: 14 }, system: { config: configComCatalogo },
      }
      const { prisma } = fakePrisma(character)
      const service = new AdventureService(prisma, fakeAi())

      await expect(service.createForCharacter('char-1', {})).resolves.toMatchObject({ id: 'adv-1' })
    })

    it('sistema sem catálogo (config legado): aceita qualquer chave, sem 400', async () => {
      const character = {
        id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
        baseAttributes: { constitution: 14 }, system: { config }, // config sem settings/areaTypes
      }
      const { prisma } = fakePrisma(character)
      const service = new AdventureService(prisma, fakeAi())

      await expect(service.createForCharacter('char-1', { setting: 'qualquer-coisa', areaType: 'qualquer-coisa' }))
        .resolves.toMatchObject({ id: 'adv-1' })
    })
  })

  // --- US-128: memento + equipamento da origem no inventário inicial ---

  it('origem escolhida (sem memento): kit da classe + itens de equipamento, sem item de memento', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
      origin: { key: 'a5e-ag_acolyte' },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', {})

    expect(recorded.characterStateCreate).toMatchObject({
      inventory: [
        { name: 'Adaga', qty: 1 },
        { name: 'Símbolo sagrado', qty: 1, origin: 'equipment' },
        { name: 'Túnica', qty: 1, origin: 'equipment' },
      ],
    })
  })

  it('memento escolhido (sem origem mecanizada): kit da classe + item "Memento", nome fixo — não o texto completo', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
      origin: { memento: 'O símbolo sagrado gasto pelo tempo que seu mentor lhe deixou.' },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', {})

    expect(recorded.characterStateCreate).toMatchObject({
      inventory: [
        { name: 'Adaga', qty: 1 },
        { name: 'Memento', qty: 1, origin: 'memento' },
      ],
    })
  })

  it('origem + memento juntos: kit + equipamento da origem + Memento, nessa ordem', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
      origin: { key: 'a5e-ag_acolyte', memento: 'O símbolo sagrado gasto pelo tempo.' },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', {})

    expect(recorded.characterStateCreate).toMatchObject({
      inventory: [
        { name: 'Adaga', qty: 1 },
        { name: 'Símbolo sagrado', qty: 1, origin: 'equipment' },
        { name: 'Túnica', qty: 1, origin: 'equipment' },
        { name: 'Memento', qty: 1, origin: 'memento' },
      ],
    })
  })

  it('sem origem escolhida e sem memento: inventário só com o kit da classe, sem item vazio (sem regressão)', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', {})

    expect(recorded.characterStateCreate).toMatchObject({ inventory: [{ name: 'Adaga', qty: 1 }] })
  })

  it('origem sem catálogo de equipamento (chave desconhecida): sem item extra, sem lançar', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 }, system: { config },
      origin: { key: 'a5e-ag_urchin' },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', {})

    expect(recorded.characterStateCreate).toMatchObject({ inventory: [{ name: 'Adaga', qty: 1 }] })
  })
})

describe('AdventureService.getTurns', () => {
  it('devolve N turnos em ordem, mapeando ACTION→user e NARRATION→dm (inclui resumidos)', async () => {
    const logs = [
      { type: 'ACTION', payload: { text: 'Abro a porta.' }, summarized: true },
      { type: 'NARRATION', payload: { text: 'A porta range.' }, summarized: true },
      { type: 'ACTION', payload: { text: 'Entro.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'Três figuras...' }, summarized: false },
    ]
    let captured: Record<string, unknown> = {}
    const prisma = {
      eventLog: {
        findMany: async (args: Record<string, unknown>) => { captured = args; return logs },
      },
    } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    // Não filtra por summarized: o histórico visível não some com a condensação.
    expect((captured['where'] as Record<string, unknown>)['summarized']).toBeUndefined()
    expect(turns).toEqual([
      { role: 'user', content: 'Abro a porta.' },
      { role: 'dm', content: 'A porta range.' },
      // US-67: só a ÚLTIMA ação (não-resumida, sem mutação) é marcada editável.
      { role: 'user', content: 'Entro.', editable: true },
      { role: 'dm', content: 'Três figuras...' },
    ])
  })

  it('US-67: última ação sem mutação → marcada editável; a anterior não', async () => {
    const logs = [
      { type: 'ACTION', payload: { text: 'Olho em volta.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'Uma taberna vazia.' }, summarized: false },
      { type: 'ACTION', payload: { text: 'Sento-me.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'A cadeira range.' }, summarized: false },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    expect(turns[0]).toEqual({ role: 'user', content: 'Olho em volta.' }) // sem editable
    expect(turns[2]).toEqual({ role: 'user', content: 'Sento-me.', editable: true })
  })

  it('US-67: último turno mutou o estado (CHARACTER_UPDATE) → não editável', async () => {
    // O CHARACTER_UPDATE é gravado no stream, ANTES do ACTION (onFinish) — depois da
    // narração anterior. Ele não é renderizado, só decide a editabilidade.
    const logs = [
      { type: 'NARRATION', payload: { text: 'O goblin ataca.' }, summarized: false },
      { type: 'CHARACTER_UPDATE', payload: { field: 'hp', newHp: 4 }, summarized: false },
      { type: 'ACTION', payload: { text: 'Aparo o golpe.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'A lâmina raspa o teu braço.' }, summarized: false },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    // CHARACTER_UPDATE não vira turno; a última ação NÃO leva o flag editable.
    expect(turns).toEqual([
      { role: 'dm', content: 'O goblin ataca.' },
      { role: 'user', content: 'Aparo o golpe.' },
      { role: 'dm', content: 'A lâmina raspa o teu braço.' },
    ])
  })

  it('US-67: última ação já resumida → não editável', async () => {
    const logs = [
      { type: 'ACTION', payload: { text: 'Durmo.' }, summarized: true },
      { type: 'NARRATION', payload: { text: 'Amanhece.' }, summarized: true },
    ]
    const prisma = { eventLog: { findMany: async () => logs } } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    expect(turns).toEqual([
      { role: 'user', content: 'Durmo.' }, // sem editable
      { role: 'dm', content: 'Amanhece.' },
    ])
  })

  it('US-38: reordena o DICE_ROLL (gravado no streaming, antes do ACTION do onFinish) para logo após a ação', async () => {
    // Ordem crua por createdAt: rolagem ANTES da ação do mesmo turno.
    const logs = [
      { type: 'NARRATION', payload: { text: 'Abertura.' }, summarized: false },
      { type: 'DICE_ROLL', payload: { formula: '1d20+5', reason: 'Percepção', rolls: [7], modifier: 5, total: 12 }, summarized: false },
      { type: 'ACTION', payload: { text: 'Examino o riacho.' }, summarized: false },
      { type: 'NARRATION', payload: { text: 'Marcas sutis nas pedras.' }, summarized: false },
    ]
    const prisma = {
      eventLog: { findMany: async () => logs },
    } as unknown as PrismaService
    const service = new AdventureService(prisma, fakeAi())

    const turns = await service.getTurns('char-1', 'adv-1')

    expect(turns).toEqual([
      { role: 'dm', content: 'Abertura.' },
      { role: 'user', content: 'Examino o riacho.', editable: true },
      { role: 'roll', label: 'Percepção', formula: '1d20+5', rolls: [7], modifier: 5, total: 12 },
      { role: 'dm', content: 'Marcas sutis nas pedras.' },
    ])
  })
})

// US-148: perfil de entrada do motor de geração. Método privado — acessado via cast
// (mesmo padrão de teste direto dos outros métodos privados não existe ainda no
// arquivo; este é o primeiro, daí o cast explícito em vez de invenção de helper).
describe('AdventureService.buildAdventureProfile', () => {
  function service(): { buildAdventureProfile: (character: Record<string, unknown>, config: SystemConfig, challenge: 'adventure' | 'challenge') => unknown } {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, fakeAi()) as unknown as { buildAdventureProfile: (character: Record<string, unknown>, config: SystemConfig, challenge: 'adventure' | 'challenge') => unknown }
  }

  it('personagem com background e origin preenchidos: perfil carrega os cinco campos, hookSeed resolvido', () => {
    const character = {
      name: 'Elara', level: 3, class: 'wizard',
      background: { story: 'Aprendiz fugida', ideals: ['Conhecimento'], bonds: ['O mentor'], flaws: ['Orgulho'], deity: { name: 'Mystra', portfolio: 'magia' } },
      origin: { key: 'a5e-ag_acolyte', connection: 'O templo que a criou', memento: 'Um símbolo sagrado gasto' },
    }

    const profile = service().buildAdventureProfile(character, config, 'adventure') as Record<string, unknown>

    expect(profile).toEqual({
      level: 3,
      classKey: 'wizard',
      background: character.background,
      // connection/memento ficam de fora do perfil de propósito (só adventuresAndAdvancement
      // alimenta o motor) — continuam intactos em Character.origin, só não entram aqui.
      origin: {
        adventuresAndAdvancement: 'O templo pede um favor.',
      },
      hookSeed: 'A vela curva-se, Elara.', // placeholder {characterName} resolvido, não cru
      challenge: 'adventure',
    })
  })

  it('background {} e origin {} (rede de segurança): perfil válido, hookSeed da classe não-vazio, sem lançar', () => {
    const character = { name: 'Nyx', level: 1, class: 'wizard', background: {}, origin: {} }

    const profile = service().buildAdventureProfile(character, config, 'adventure') as Record<string, unknown>

    expect(profile['level']).toBe(1)
    expect(profile['classKey']).toBe('wizard')
    expect(profile['background']).toEqual({})
    expect(profile['origin']).toEqual({ adventuresAndAdvancement: undefined })
    expect(profile['hookSeed']).toBe('A vela curva-se, Nyx.')
    expect((profile['hookSeed'] as string).length).toBeGreaterThan(0)
  })

  it('origin.key fora do catálogo: adventuresAndAdvancement ausente, sem lançar (mesmo lookup de resolveAdventuresAndAdvancement)', () => {
    const character = { name: 'Elara', level: 1, class: 'wizard', background: {}, origin: { key: 'chave-inexistente' } }

    const profile = service().buildAdventureProfile(character, config, 'adventure') as Record<string, unknown>

    expect((profile['origin'] as Record<string, unknown>)['adventuresAndAdvancement']).toBeUndefined()
  })

  // US-167: terceiro parâmetro só é escrito no profile — createForCharacter resolve o default.
  it('challenge repassado tal qual — função não decide default', () => {
    const character = { name: 'Elara', level: 1, class: 'wizard', background: {}, origin: {} }

    const profile = service().buildAdventureProfile(character, config, 'challenge') as Record<string, unknown>

    expect(profile['challenge']).toBe('challenge')
  })
})

// US-164: orquestrador — `AiService` mockado com locations/npcs/secrets/closing FIXOS (eval/teste
// de regressão do critério de aceite); a parte determinística (registro, encounters[].npcIds) vem
// do código real (rollAdventure/composeEncounterRoles), nunca mockada.
describe('AdventureService.generateAdventure (US-164)', () => {
  const profile: AdventureProfile = {
    level: 1,
    classKey: 'wizard',
    background: {},
    origin: {},
    hookSeed: 'A vela curva-se, Elara.',
    challenge: 'adventure',
  }

  // US-166: default 8 locations/npcs — piso instruído por prompt, mas o teste real precisa de
  // material suficiente pra round-robin/occupants não colapsarem tudo no mesmo local/NPC.
  // US-187: vibe cicla pelos 3 valores — garante pelo menos 1 local de cada vibe disponível
  // pra distribuição filtrada nunca cair no fallback nos testes que usam este fixture default.
  const VIBE_CYCLE = ['combat', 'skill', 'social'] as const
  const defaultLocations = Array.from({ length: 8 }, (_, i) => ({
    id: `loc-${i + 1}`, title: `Local ${i + 1}`, aspects: ['maré alta'], boxedText: 'Você chega.', description: 'notas',
    occupants: i === 0 ? ['npc-1'] : [],
    vibe: VIBE_CYCLE[i % 3],
  }))
  const defaultNpcs = [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]

  function fakeGenAi(overrides: {
    locations?: Record<string, unknown>[]
    npcs?: Record<string, unknown>[]
    secrets?: Record<string, unknown>[]
    antagonist?: { name: string; want: string; method: string; trait: string; weakness: string; connection: string }
    closing?: { objective: string; conclusion: string; followUps: string[] }
    encounterSituations?: Array<{ encounterId: string; behaviors: string; goal: string; complications: string; unlocks: string }>
    start?: string
    premissa?: string
    locationProse?: { boxedText: string; description: string }
    seenOpeningParams?: Record<string, unknown>
    seenPremissaParams?: Record<string, unknown>
    seenLocationsParams?: Record<string, unknown>
    seenSecretsParams?: Record<string, unknown>
    seenAntagonistParams?: Record<string, unknown>
    seenClosingParams?: Record<string, unknown>
    seenLocationProseParams?: Record<string, unknown>
  } = {}): AiService {
    const locations = overrides.locations ?? defaultLocations
    const npcs = overrides.npcs ?? defaultNpcs
    const secrets = overrides.secrets ?? [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
    const antagonist = overrides.antagonist ?? { name: 'Malvora', want: 'poder sobre a região', method: 'reunir um exército', trait: 'fala em sussurros', weakness: 'vaidade', connection: 'já cruzou caminho com o grupo antes' }
    // US-166: encounterSituations posicional, 8 itens — generateAdventure quebra sem isto.
    // US-193: encounterId ecoa o id do esqueleto (encounter-${i+1}) + unlocks novo.
    const encounterSituations = overrides.encounterSituations ?? Array.from({ length: 8 }, (_, i) => ({
      encounterId: `encounter-${i + 1}`, behaviors: `behaviors-${i + 1}`, goal: `goal-${i + 1}`, complications: `complications-${i + 1}`, unlocks: `unlocks-${i + 1}`,
    }))
    // US-169: objective obrigatório — generateAdventure quebra em GeneratedAdventureSchema.parse sem isto.
    const closing = { ...(overrides.closing ?? { objective: 'Impedir que Malvora reúna um exército para tomar a região.', conclusion: 'O culto recua para as sombras.', followUps: ['A dívida da estalajadeira volta a assombrar.'] }), encounterSituations }
    const start = overrides.start ?? 'A porta racha ao meio antes que alguém grite.'
    const premissa = overrides.premissa ?? 'Malvora já sabe o nome de quem vem impedi-la.'
    return {
      // US-192: passo 1 do motor — captura os params recebidos (candidates/complicacao/
      // registry/background/origin/locale) e devolve a premissa "elaborada" fixa do teste.
      generatePremissa: async (params: Record<string, unknown>) => {
        if (overrides.seenPremissaParams) Object.assign(overrides.seenPremissaParams, params)
        return { premissa }
      },
      // US-174: captura os params recebidos por generateLocationsAndNpcs/generateSecrets —
      // prova estruturalmente que `hookSeed` NUNCA chega a essas duas chamadas.
      generateLocationsAndNpcs: async (params: Record<string, unknown>) => {
        if (overrides.seenLocationsParams) Object.assign(overrides.seenLocationsParams, params)
        return { locations, npcs }
      },
      generateSecrets: async (params: Record<string, unknown>) => {
        if (overrides.seenSecretsParams) Object.assign(overrides.seenSecretsParams, params)
        return secrets
      },
      // US-181/US-190: captura os params recebidos por generateAntagonist — roda ANTES do
      // Promise.all, sequencial, mesma disciplina de captura dos outros passos.
      generateAntagonist: async (params: Record<string, unknown>) => {
        if (overrides.seenAntagonistParams) Object.assign(overrides.seenAntagonistParams, params)
        return antagonist
      },
      // US-175: `hookSeed` para de ser insumo de generateClosing — último ponto do motor
      // ainda ancorado no catálogo fixo por classe.
      generateClosing: async (params: Record<string, unknown>) => {
        if (overrides.seenClosingParams) Object.assign(overrides.seenClosingParams, params)
        return closing
      },
      // US-172: captura os params recebidos por generateOpeningBeat — usado pra provar
      // estruturalmente que `hookSeed` NUNCA chega a esta chamada.
      generateOpeningBeat: async (params: Record<string, unknown>) => {
        if (overrides.seenOpeningParams) Object.assign(overrides.seenOpeningParams, params)
        return { start }
      },
      // US-191, Parte 2: 3ª perna do Promise.all — captura params (location/antagonist/
      // registry) e devolve boxedText/description fixos ou o override do teste.
      generateAntagonistLocationProse: async (params: Record<string, unknown>) => {
        if (overrides.seenLocationProseParams) Object.assign(overrides.seenLocationProseParams, params)
        return overrides.locationProse ?? { boxedText: 'O salão range com passos que não são seus.', description: 'Sombras longas cruzam o piso rachado.' }
      },
    } as unknown as AiService
  }

  function service(ai: AiService) {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, ai)
  }

  it('monta um GeneratedAdventure que passa em .parse() (US-144)', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  it('id = characterId:order; levelRange = { min, max } = profile.level; summary não vazio', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure(profile, 'char-1', 2, 'pt-BR')
    expect(adventure.id).toBe('char-1:2')
    expect(adventure.levelRange).toEqual({ min: 1, max: 1 })
    expect(adventure.summary.length).toBeGreaterThan(0)
  })

  // US-192: passo 1 do motor — generatePremissa roda com os candidatos/complicação/registry
  // rolados, e o resultado ELABORADO (não content.premissa cru) é o que chega às 4 chamadas
  // seguintes e ao summary final — critério de aceite central desta story.
  it('generatePremissa recebe candidates/complicacao/registry/background/origin; resultado elaborado (não cru) alimenta summary + demais chamadas (US-192)', async () => {
    const seenPremissaParams: Record<string, unknown> = {}
    const seenLocationsParams: Record<string, unknown> = {}
    const seenAntagonistParams: Record<string, unknown> = {}
    const seenClosingParams: Record<string, unknown> = {}
    const seenOpeningParams: Record<string, unknown> = {}
    const premissa = 'Malvora já sabe o nome de quem vem impedi-la.'

    const adventure = await service(
      fakeGenAi({ premissa, seenPremissaParams, seenLocationsParams, seenAntagonistParams, seenClosingParams, seenOpeningParams }),
    ).generateAdventure(profile, 'char-1', 1, 'pt-BR')

    expect(seenPremissaParams.candidates).toBeDefined()
    expect(seenPremissaParams.complicacao).toBeDefined()
    expect(seenPremissaParams.registry).toBeDefined()
    expect(seenPremissaParams.background).toBeDefined()
    expect(seenPremissaParams.origin).toBeDefined()

    expect(adventure.summary).toBe(premissa)
    expect(seenLocationsParams.premissa).toBe(premissa)
    expect(seenAntagonistParams.premissa).toBe(premissa)
    expect(seenClosingParams.premissa).toBe(premissa)
    expect(seenOpeningParams.premissa).toBe(premissa)
  })

  // US-172: `start` deixou de ser `profile.hookSeed` copiado — vem de `ai.generateOpeningBeat`.
  it('start vem de ai.generateOpeningBeat, não mais de profile.hookSeed', async () => {
    const adventure = await service(fakeGenAi({ start: 'A porta racha ao meio.' })).generateAdventure(profile, 'char-1', 2, 'pt-BR')
    expect(adventure.start).toBe('A porta racha ao meio.')
    expect(adventure.start).not.toBe(profile.hookSeed)
  })

  it('generateOpeningBeat recebe registry/premissa/locations/npcs/secrets — NUNCA hookSeed', async () => {
    const seenOpeningParams: Record<string, unknown> = {}
    await service(fakeGenAi({ seenOpeningParams })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    expect(seenOpeningParams).not.toHaveProperty('hookSeed')
    expect(seenOpeningParams.registry).toBeDefined()
    expect(seenOpeningParams.premissa).toBeDefined()
    expect(seenOpeningParams.locations).toBeDefined()
    expect(seenOpeningParams.npcs).toBeDefined()
    expect(seenOpeningParams.secrets).toBeDefined()
  })

  // US-180: generateOpeningBeat ganha background/origin/complicacao — mesmo padrão de
  // encanamento que generateSecrets (background/origin) e generateClosing (complicacao)
  // já tinham antes desta story.
  it('generateOpeningBeat recebe background/origin/complicacao (US-180)', async () => {
    const seenOpeningParams: Record<string, unknown> = {}
    await service(fakeGenAi({ seenOpeningParams })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    expect(seenOpeningParams.background).toBeDefined()
    expect(seenOpeningParams.origin).toBeDefined()
    expect(seenOpeningParams.complicacao).toBeDefined()
  })

  // US-174: `hookSeed` para de ser insumo de generateLocationsAndNpcs/generateSecrets —
  // mesma garantia estrutural que a US-172 já trouxe pra generateOpeningBeat.
  // 2026-08-23: nem `background`/`origin` são mais insumo destas duas (reversão do mesmo
  // dia — só generatePremissa/generateOpeningBeat continuam recebendo vínculo pessoal).
  it('generateLocationsAndNpcs recebe rolled/registry — NUNCA hookSeed nem background/origin (US-174)', async () => {
    const seenLocationsParams: Record<string, unknown> = {}
    await service(fakeGenAi({ seenLocationsParams })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    expect(seenLocationsParams).not.toHaveProperty('hookSeed')
    expect(seenLocationsParams.rolled).toBeDefined()
    expect(seenLocationsParams.premissa).toBeDefined() // US-192
    expect(seenLocationsParams.registry).toBeDefined()
    expect(seenLocationsParams).not.toHaveProperty('background')
    expect(seenLocationsParams).not.toHaveProperty('origin')
  })

  it('generateSecrets recebe locations/npcs/secretPrompts — NUNCA hookSeed nem background/origin (US-174)', async () => {
    const seenSecretsParams: Record<string, unknown> = {}
    await service(fakeGenAi({ seenSecretsParams })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    expect(seenSecretsParams).not.toHaveProperty('hookSeed')
    expect(seenSecretsParams.locations).toBeDefined()
    expect(seenSecretsParams.npcs).toBeDefined()
    expect(seenSecretsParams.secretPrompts).toBeDefined()
    expect(seenSecretsParams).not.toHaveProperty('background')
    expect(seenSecretsParams).not.toHaveProperty('origin')
  })

  it('generateClosing recebe locations/npcs/secrets/registry/complicacao/premissa — NUNCA hookSeed (US-175)', async () => {
    const seenClosingParams: Record<string, unknown> = {}
    await service(fakeGenAi({ seenClosingParams })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    expect(seenClosingParams).not.toHaveProperty('hookSeed')
    expect(seenClosingParams.locations).toBeDefined()
    expect(seenClosingParams.npcs).toBeDefined()
    expect(seenClosingParams.secrets).toBeDefined()
    expect(seenClosingParams.registry).toBeDefined()
    expect(seenClosingParams.complicacao).toBeDefined()
    expect(seenClosingParams.premissa).toBeDefined()
  })

  // US-181/US-190: antagonista é passo próprio, sequencial — roda com locations/npcs/secrets
  // já prontos, ANTES do Promise.all, e o RESULTADO chega a generateClosing como `antagonist`.
  // 2026-08-23: background/origin NÃO chegam mais aqui (ver comentário em
  // AiService.generateAntagonist) — `connection` do vilão nunca ancora em vínculo permanente
  // da ficha, só no que já foi rolado para esta aventura.
  it('generateAntagonist recebe locations/npcs/secrets/registry/complicacao/premissa, nunca background/origin (US-181/US-190)', async () => {
    const seenAntagonistParams: Record<string, unknown> = {}
    await service(fakeGenAi({ seenAntagonistParams })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    expect(seenAntagonistParams.locations).toBeDefined()
    expect(seenAntagonistParams.npcs).toBeDefined()
    expect(seenAntagonistParams.secrets).toBeDefined()
    expect(seenAntagonistParams.registry).toBeDefined()
    expect(seenAntagonistParams.complicacao).toBeDefined()
    expect(seenAntagonistParams.premissa).toBeDefined()
    expect(seenAntagonistParams.background).toBeUndefined()
    expect(seenAntagonistParams.origin).toBeUndefined()
  })

  it('generateClosing recebe o antagonist devolvido por generateAntagonist (US-190)', async () => {
    const antagonist = { name: 'Vaerix', want: 'vingança', method: 'espalhar um boato', trait: 'usa máscara', weakness: 'obsessão', connection: 'x' }
    const seenClosingParams: Record<string, unknown> = {}
    const adventure = await service(fakeGenAi({ antagonist, seenClosingParams })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    // US-188: `antagonist` chega a generateClosing já com `npcId` — mintado ANTES do
    // Promise.all, mesmo momento em que name/id do AdventureNpc já são conhecidos.
    expect(seenClosingParams.antagonist).toEqual({ ...antagonist, npcId: adventure.antagonist.npcId })
  })

  // US-190: generateOpeningBeat também recebe o antagonist pronto, não só generateClosing —
  // o motivo inteiro desta story é a abertura deixar de ser cega ao vilão.
  it('generateOpeningBeat recebe o antagonist devolvido por generateAntagonist (US-190)', async () => {
    const antagonist = { name: 'Vaerix', want: 'vingança', method: 'espalhar um boato', trait: 'usa máscara', weakness: 'obsessão', connection: 'x' }
    const seenOpeningParams: Record<string, unknown> = {}
    const adventure = await service(fakeGenAi({ antagonist, seenOpeningParams })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    // US-188: mesma disciplina do teste equivalente de generateClosing acima — npcId já presente.
    expect(seenOpeningParams.antagonist).toEqual({ ...antagonist, npcId: adventure.antagonist.npcId })
  })

  // US-181/US-183: critério de aceite — artefato final tem antagonist com os seis campos não vazios.
  it('artefato final tem antagonist com name/want/method/trait/weakness/connection não vazios (US-181/US-183)', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    expect(adventure.antagonist.name.length).toBeGreaterThan(0)
    expect(adventure.antagonist.want.length).toBeGreaterThan(0)
    expect(adventure.antagonist.method.length).toBeGreaterThan(0)
    expect(adventure.antagonist.trait.length).toBeGreaterThan(0)
    expect(adventure.antagonist.weakness.length).toBeGreaterThan(0)
    expect(adventure.antagonist.connection.length).toBeGreaterThan(0)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  // US-169 AC: artefato final tem `objective` — vem de generateClosing, não é derivado de summary/start.
  it('artefato final tem objective vindo de generateClosing (US-169)', async () => {
    const adventure = await service(fakeGenAi({ closing: { objective: 'Impedir Vaerix.', conclusion: 'fecho', followUps: ['x'] } })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
    expect(adventure.objective).toBe('Impedir Vaerix.')
  })

  // US-166/US-187: 8 encontros, locationId referencia local existente e (quando existe local
  // do vibe pedido, o que sempre existe aqui — VIBE_CYCLE cobre os 3 valores) bate com o
  // vibe do encontro — posição 8 (índice 7) é o único type GARANTIDO 'combat' quando viável.
  it('8 encontros; locationId referencia local existente cujo vibe bate com o type; npcIds referencia NPCs do npcs[] final', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
    expect(adventure.encounters).toHaveLength(8)
    adventure.encounters.forEach((encounter, i) => {
      expect(encounter.id).toBe(`encounter-${i + 1}`)
      const location = adventure.locations.find((l) => l.id === encounter.locationId)
      expect(location).toBeDefined()
      expect(location!.vibe).toBe(encounter.type) // VIBE_CYCLE garante candidato de todo vibe, nunca cai no fallback
      for (const id of encounter.npcIds) {
        expect(adventure.npcs.some((n) => n.id === id)).toBe(true)
      }
    })
    expect(adventure.encounters[7]!.type).toBe('combat') // posição 8, nível 5: limiar > 0
    expect(adventure.encounters[7]!.npcIds.length).toBeGreaterThan(0)
  })

  it('nível 1-3 (limiar de soma zero, US-160): nenhum encontro é type combat, sem quebrar o parse', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 1, challenge: 'adventure' }, 'char-1', 1, 'pt-BR')
    expect(adventure.encounters).toHaveLength(8)
    expect(adventure.encounters.every((e) => e.type !== 'combat')).toBe(true)
    expect(adventure.encounters[7]!.type).toBe('social') // posição 8 cai pra social (fallback, US-166)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  // US-167: critério de aceite — challenge: 'challenge' usa singleMonsterCrCap (US-161), sempre
  // > 0, então nível 1-3 deixa de ser combate zerado quando o jogador escolheu Modo desafio.
  it('nível 1-3 com challenge "challenge" (US-167): posição 8 é combat com npcIds não vazio', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 1, challenge: 'challenge' }, 'char-1', 1, 'pt-BR')
    expect(adventure.encounters[7]!.type).toBe('combat')
    expect(adventure.encounters[7]!.npcIds.length).toBeGreaterThan(0)
  })

  it('npcs[] final inclui os NPCs do passo 2 (locais/NPCs) e os do passo 4 (combate)', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
    expect(adventure.npcs.some((n) => n.id === 'npc-1')).toBe(true)
    expect(adventure.npcs.length).toBeGreaterThan(1)
  })

  it('mesmo characterId+order: registro e encounters[].type/npcIds/locationId deterministicos entre execuções (parte não-LLM)', async () => {
    const a = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 7, 'pt-BR')
    const b = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 7, 'pt-BR')
    expect(a.registry.tone).toBe(b.registry.tone)
    expect(a.encounters.map((e) => e.type)).toEqual(b.encounters.map((e) => e.type))
    expect(a.encounters.map((e) => e.npcIds)).toEqual(b.encounters.map((e) => e.npcIds))
    expect(a.encounters.map((e) => e.locationId)).toEqual(b.encounters.map((e) => e.locationId)) // US-187
  })

  // US-187: locationId deixa de ser round-robin cego (US-166) — passa a respeitar o `vibe`
  // do local quando existe candidato, com fallback pro round-robin original quando não há.
  describe('locationId distribuído por vibe (US-187)', () => {
    // Só 2 locations: loc-1 (vibe combat) e loc-2 (vibe social) — NENHUM local tem vibe
    // 'skill', então todo encontro `skill` cai no fallback round-robin `i % locations.length`.
    const mixedVibeLocations = [
      { id: 'loc-1', title: 'Arena', aspects: [], boxedText: 'x', description: 'x', occupants: [] as string[], vibe: 'combat' as const },
      { id: 'loc-2', title: 'Salão', aspects: [], boxedText: 'x', description: 'x', occupants: [] as string[], vibe: 'social' as const },
    ]

    it('encontro combat/social recebe local do vibe compatível; encontro skill (sem local do vibe) cai no fallback round-robin', async () => {
      const adventure = await service(fakeGenAi({ locations: mixedVibeLocations, npcs: [] })).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
      for (const [i, encounter] of adventure.encounters.entries()) {
        const location = adventure.locations.find((l) => l.id === encounter.locationId)!
        if (encounter.type === 'skill') {
          expect(location.id).toBe(mixedVibeLocations[i % mixedVibeLocations.length]!.id) // fallback: nenhum local vibe:'skill'
        } else {
          expect(location.vibe).toBe(encounter.type) // combat/social: sempre tem candidato
        }
      }
      expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
    })

    it('fallback na posição 8 (final, sem local vibe:combat disponível) gera console.warn; posição 8 com vibe disponível não loga', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // Só locais 'social' — posição 8 (sempre 'combat' em nível 5) nunca tem candidato.
      const socialOnlyLocations = [
        { id: 'loc-1', title: 'Salão 1', aspects: [], boxedText: 'x', description: 'x', occupants: [] as string[], vibe: 'social' as const },
        { id: 'loc-2', title: 'Salão 2', aspects: [], boxedText: 'x', description: 'x', occupants: [] as string[], vibe: 'social' as const },
      ]
      await service(fakeGenAi({ locations: socialOnlyLocations, npcs: [] })).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0]![0]).toContain("posição 8, type='combat'")
      warnSpy.mockRestore()

      // defaultLocations tem local vibe:'combat' disponível (VIBE_CYCLE) — nenhum warn.
      const warnSpy2 = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
      expect(warnSpy2).not.toHaveBeenCalled()
      warnSpy2.mockRestore()
    })
  })

  // US-166 AC: personagens/aventuras diferentes produzem sequências de type diferentes.
  it('characterId diferente: sequência de encounters[].type diferente', async () => {
    const a = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
    const b = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-2', 1, 'pt-BR')
    expect(a.encounters.map((e) => e.type)).not.toEqual(b.encounters.map((e) => e.type))
  })

  // US-166 AC: type alternando sem repetição adjacente (posições 1-8).
  it('encounters[].type: nenhuma posição repete o type da posição anterior', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
    for (let i = 1; i < adventure.encounters.length; i++) {
      expect(adventure.encounters[i]!.type).not.toBe(adventure.encounters[i - 1]!.type)
    }
  })

  // US-166 AC: behaviors/goal/complications presentes (não-vazios) em TODO encontro.
  it('behaviors/goal/complications presentes e não-vazios em todo encontro, incluindo combat', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
    for (const encounter of adventure.encounters) {
      expect(encounter.behaviors.length).toBeGreaterThan(0)
      expect(encounter.goal.length).toBeGreaterThan(0)
      expect(encounter.complications.length).toBeGreaterThan(0)
    }
  })

  // US-193 AC: unlocks presente e não-vazio em TODO encontro, mesmo padrão de behaviors/goal/complications.
  it('unlocks presente e não-vazio em todo encontro', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
    for (const encounter of adventure.encounters) {
      expect(encounter.unlocks.length).toBeGreaterThan(0)
    }
  })

  // US-193 AC: array fora de ordem (modelo emitiu de trás pra frente) é detectado pelo eco
  // de encounterId — generateAdventure lança em vez de montar o encontro errado silenciosamente.
  it('lança quando encounterSituations[i].encounterId não bate com o esqueleto (array fora de ordem)', async () => {
    const reversedEncounterSituations = Array.from({ length: 8 }, (_, i) => ({
      encounterId: `encounter-${8 - i}`, behaviors: `behaviors-${i + 1}`, goal: `goal-${i + 1}`, complications: `complications-${i + 1}`, unlocks: `unlocks-${i + 1}`,
    }))

    await expect(
      service(fakeGenAi({ encounterSituations: reversedEncounterSituations })).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR'),
    ).rejects.toThrow(/encounterSituations\[0\]\.encounterId "encounter-8" != esqueleto "encounter-1"/)
  })

  // US-166: generateClosing recebe o encounterSkeleton (8 posições resolvidas) — antes do
  // Promise.all, o esqueleto já precisa estar pronto (locationId/npcIds → location/npcs reais).
  it('generateClosing recebe encounterSkeleton com 8 posições, location/npcs resolvidos', async () => {
    const seenClosingParams: Record<string, unknown> = {}
    await service(fakeGenAi({ seenClosingParams })).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
    const skeleton = seenClosingParams.encounterSkeleton as Array<{ id: string; type: string; location: { id: string }; npcs: unknown[] }>
    expect(skeleton).toHaveLength(8)
    expect(skeleton[0]!.id).toBe('encounter-1')
    expect(defaultLocations.some((loc) => loc.id === skeleton[0]!.location.id)).toBe(true) // US-187: locationId já não é fixo em loc-1 (round-robin filtrado por vibe)
    expect(skeleton[7]!.type).toBe('combat')
  })

  it('registryOverrides é repassado ao rollAdventure — registro fixado, não sorteado', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure(profile, 'char-1', 1, 'pt-BR', { tone: 'heroic' })
    expect(adventure.registry.tone).toBe('heroic')
  })

  // US-188: antagonista vira NPC rastreável — teste de regressão do critério de aceite.
  describe('antagonista como NPC rastreável (US-188)', () => {
    it('nível 5 (com capangas): antagonist.npcId aponta pra um AdventureNpc real presente em npcIds do encontro final, role bate com chooseAntagonistRole, soma de CR não excede o limiar', async () => {
      const highLevelProfile = { ...profile, level: 5 }
      const adventure = await service(fakeGenAi()).generateAdventure(highLevelProfile, 'char-1', 1, 'pt-BR')

      const antagonistNpc = adventure.npcs.find((n) => n.id === adventure.antagonist.npcId)
      expect(antagonistNpc).toBeDefined()
      expect(antagonistNpc!.name).toBe(adventure.antagonist.name)

      const finalEncounter = adventure.encounters[adventure.encounters.length - 1]!
      expect(finalEncounter.npcIds).toContain(adventure.antagonist.npcId)

      const expectedRole = chooseAntagonistRole(highLevelProfile.level, highLevelProfile.challenge)
      expect(expectedRole).toBeDefined()
      expect(antagonistNpc!.role).toBe(expectedRole)

      // Verificação 3 do gate (US-150): soma de CR do encontro final (capangas + antagonista)
      // não excede o limiar do dial — cobre a reserva de orçamento (reservedCr).
      const rolesInFinalEncounter = finalEncounter.npcIds
        .map((id) => adventure.npcs.find((n) => n.id === id)!.role)
        .filter((role): role is keyof typeof MONSTER_ROLE_CR => role in MONSTER_ROLE_CR)
      expect(totalCr(rolesInFinalEncounter)).toBeLessThan(encounterDeadlyThreshold(highLevelProfile.level))

      expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
    })

    it("nível 1-3, modo 'adventure' (chooseAntagonistRole undefined): encontro final nunca fica vazio de antagonista, role === antagonist.trait, sem CR", async () => {
      const lowLevelProfile = { ...profile, level: 1, challenge: 'adventure' as const }
      // npcs/locations mínimos, sem occupants — isola o fallback social do antagonista.
      const adventure = await service(
        fakeGenAi({
          locations: [{ id: 'loc-1', title: 'Local 1', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'combat' }],
          npcs: [],
        }),
      ).generateAdventure(lowLevelProfile, 'char-1', 1, 'pt-BR')

      expect(chooseAntagonistRole(lowLevelProfile.level, lowLevelProfile.challenge)).toBeUndefined()

      const finalEncounter = adventure.encounters[adventure.encounters.length - 1]!
      expect(finalEncounter.npcIds.length).toBeGreaterThan(0)
      expect(finalEncounter.npcIds).toContain(adventure.antagonist.npcId)

      const antagonistNpc = adventure.npcs.find((n) => n.id === adventure.antagonist.npcId)!
      expect(antagonistNpc.role).toBe(adventure.antagonist.trait)
      expect(antagonistNpc.role in MONSTER_ROLE_CR).toBe(false)

      expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
    })

    it('generateClosing e generateOpeningBeat recebem o MESMO antagonist.npcId que o artefato final expõe', async () => {
      const seenClosingParams: Record<string, unknown> = {}
      const seenOpeningParams: Record<string, unknown> = {}
      const adventure = await service(fakeGenAi({ seenClosingParams, seenOpeningParams })).generateAdventure({ ...profile, level: 5 }, 'char-1', 1, 'pt-BR')
      expect((seenClosingParams.antagonist as { npcId: string }).npcId).toBe(adventure.antagonist.npcId)
      expect((seenOpeningParams.antagonist as { npcId: string }).npcId).toBe(adventure.antagonist.npcId)
    })
  })

  // US-191: antagonista vira occupant do local do confronto final + prosa desse local
  // reescrita citando o nome dele.
  describe('antagonista ocupa e nomeia o local do confronto final (US-191)', () => {
    it('generateAntagonistLocationProse recebe location (do encontro final)/antagonist (com npcId)/registry', async () => {
      const seenLocationProseParams: Record<string, unknown> = {}
      const adventure = await service(fakeGenAi({ seenLocationProseParams })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
      const finalEncounter = adventure.encounters[adventure.encounters.length - 1]!
      expect((seenLocationProseParams.location as { id: string }).id).toBe(finalEncounter.locationId)
      expect((seenLocationProseParams.antagonist as { npcId: string }).npcId).toBe(adventure.antagonist.npcId)
      expect(seenLocationProseParams.registry).toBeDefined()
    })

    // Teste de regressão — patch combinado: UM único teste verifica, no MESMO local, que
    // occupants (Parte 1) E boxedText/description (Parte 2) mudaram JUNTOS. Dois testes
    // isolados não pegariam um "last-write-wins" — se os dois `.map` partissem de `locations`
    // original em vez de encadear, um patch apagaria o outro sem nenhum teste isolado notar.
    it('local do confronto final ganha occupants (antagonist.npcId) E boxedText/description novos, ao mesmo tempo; outros locais não mudam', async () => {
      const locationProse = { boxedText: 'Malvora aguarda no trono partido, sussurrando ordens.', description: 'O ar cheira aos sussurros dela.' }
      const adventure = await service(fakeGenAi({ locationProse })).generateAdventure(profile, 'char-1', 1, 'pt-BR')

      const finalEncounter = adventure.encounters[adventure.encounters.length - 1]!
      const finalLocation = adventure.locations.find((loc) => loc.id === finalEncounter.locationId)!
      expect(finalLocation.occupants).toContain(adventure.antagonist.npcId)
      expect(finalLocation.boxedText).toBe(locationProse.boxedText)
      expect(finalLocation.description).toBe(locationProse.description)

      const otherLocations = adventure.locations.filter((loc) => loc.id !== finalEncounter.locationId)
      expect(otherLocations.length).toBeGreaterThan(0)
      for (const loc of otherLocations) {
        expect(loc.boxedText).toBe('Você chega.')
        expect(loc.description).toBe('notas')
        expect(loc.occupants).not.toContain(adventure.antagonist.npcId)
      }

      expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
    })

    it('sem duplicata se antagonist.npcId já estivesse em occupants', async () => {
      // profile (nível 1, 'adventure') não gera combatente antes do antagonista — com
      // defaultNpcs = [npc-1], antagonistNpc.id é sempre 'npc-2' (determinístico), o que
      // permite pré-popular occupants do local final com ele e provar que o patch não duplica.
      const locations = defaultLocations.map((loc) => (loc.id === 'loc-8' ? { ...loc, occupants: ['npc-2'] } : loc))
      const adventure = await service(fakeGenAi({ locations })).generateAdventure(profile, 'char-1', 1, 'pt-BR')
      expect(adventure.antagonist.npcId).toBe('npc-2')
      const finalEncounter = adventure.encounters[adventure.encounters.length - 1]!
      const finalLocation = adventure.locations.find((loc) => loc.id === finalEncounter.locationId)!
      const occurrences = finalLocation.occupants.filter((id) => id === adventure.antagonist.npcId)
      expect(occurrences.length).toBe(1)
    })
  })
})

// US-150: gate que envolve generateAdventure. Não repete a matriz de checagens (isso é
// adventure-gate.test.ts) — só confirma que a integração real (rollAdventure + AiService
// mockado) chega no gate e reage certo aos dois desfechos, sem mockar o gate em si.
describe('AdventureService.generateGatedAdventure (US-150)', () => {
  const profile: AdventureProfile = { level: 1, classKey: 'wizard', background: {}, origin: {}, hookSeed: 'A vela curva-se, Elara.', challenge: 'adventure' }

  function fakeGenAi(overrides: { locations?: Record<string, unknown>[]; npcs?: Record<string, unknown>[] } = {}): AiService {
    const locations = overrides.locations ?? [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'x', occupants: [], vibe: 'combat' }]
    const npcs = overrides.npcs ?? [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
    const secrets = [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
    // US-166: encounterSituations posicional obrigatório, 8 itens.
    // US-193: encounterId ecoa o id do esqueleto (encounter-${i+1}) + unlocks novo.
    const encounterSituations = Array.from({ length: 8 }, (_, i) => ({
      encounterId: `encounter-${i + 1}`, behaviors: `behaviors-${i + 1}`, goal: `goal-${i + 1}`, complications: `complications-${i + 1}`, unlocks: `unlocks-${i + 1}`,
    }))
    const closing = { objective: 'Impedir que Malvora reúna um exército para tomar a região.', conclusion: 'O culto recua para as sombras.', followUps: ['A dívida volta a assombrar.'], encounterSituations }
    const antagonist = { name: 'Malvora', want: 'poder sobre a região', method: 'reunir um exército', trait: 'fala em sussurros', weakness: 'vaidade', connection: 'já cruzou caminho com o grupo antes' }
    return {
      generatePremissa: vi.fn(async () => ({ premissa: 'Malvora ameaça abrir um portão amaldiçoado na Enseada Cinzenta.' })),
      generateLocationsAndNpcs: vi.fn(async () => ({ locations, npcs })),
      generateSecrets: vi.fn(async () => secrets),
      generateAntagonist: vi.fn(async () => antagonist),
      generateClosing: vi.fn(async () => closing),
      generateOpeningBeat: vi.fn(async () => ({ start: 'abertura' })),
      generateAntagonistLocationProse: vi.fn(async () => ({ boxedText: 'x', description: 'x' })),
    } as unknown as AiService
  }

  function service(ai: AiService) {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, ai)
  }

  it('grafo fechado (npc ocupa o local): gate passa na 1ª tentativa, sem reseed', async () => {
    const ai = fakeGenAi({ locations: [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-1'], vibe: 'combat' }] })

    const result = await service(ai).generateGatedAdventure(profile, 'char-1', 1, 'pt-BR')

    expect(result.ok).toBe(true)
    expect(ai.generateLocationsAndNpcs).toHaveBeenCalledTimes(1)
  })

  // US-166: com só 1 local e occupants preenchidos, todo encontro `social` (a maioria, nível 1
  // modo 'adventure' nunca gera `combat`) referencia npc-1 via occupants — o antigo cenário de
  // órfão (encontro único com npcIds sempre vazio) não existe mais. Pra reproduzir um NPC
  // realmente órfão, npc-2 nunca entra em occupants NEM é alcançado pelo fallback round-robin
  // (occupants não-vazio faz os encontros `social` usarem SÓ occupants, nunca o fallback).
  it('NPC órfão (npc-2 nunca em occupants nem referenciado): esgota o teto de tentativas e falha registrada', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ai = fakeGenAi({
      locations: [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-1'], vibe: 'combat' }],
      npcs: [
        { id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] },
        { id: 'npc-2', name: 'Órfão', role: 'coadjuvante', interactions: [] },
      ],
    })

    const result = await service(ai).generateGatedAdventure(profile, 'char-1', 1, 'pt-BR')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('npc-2')
      expect(result.reason).toContain('teto de 3 tentativas esgotado')
    }
    expect(ai.generateLocationsAndNpcs).toHaveBeenCalledTimes(3) // teto default
    expect(logSpy).toHaveBeenCalled()
  })
})
