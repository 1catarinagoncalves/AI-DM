import { describe, it, expect, vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { GeneratedAdventureSchema, type SystemConfig } from '@ai-dm/shared'
import { AdventureService, type AdventureProfile } from './adventure.service'
import { rollAdventure } from '../adventure-generation/roll-adventure'
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
  const locations = [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-1'] }]
  const npcs = [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
  const secrets = [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
  const closing = { conclusion: 'O culto recua para as sombras.', followUps: ['A dívida volta a assombrar.'] }
  return {
    generateOpeningNarration: async (input: Record<string, unknown>) => { Object.assign(seen, input); return opening },
    extractOpeningScene: async () => scene,
    extractOpeningEntities: async () => entities,
    generateLocationsAndNpcs: async () => ({ locations, npcs }),
    generateSecrets: async () => secrets,
    generateClosing: async () => closing,
    generateOpeningBeat: async () => ({ start: 'A porta racha ao meio antes que alguém grite.' }),
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
    adventureParticipant: { count: async () => participantCount },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
  } as unknown as PrismaService

  return { prisma, recorded }
}

describe('AdventureService.createForCharacter', () => {
  // US-153: título e quest já não vêm do gancho fixo por classe — vêm do artefato do
  // motor de geração (US-164), determinístico por characterId+order (US-146). `rollAdventure`
  // real (não mockado) devolve o mesmo `content.premissa` que `generateAdventure` usou.
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
    expect(adventure).toMatchObject({ id: 'adv-1', systemId: 'sys-1', creatorId: 'user-1', title: content.premissa, order: 1 })
    expect(recorded.participantCreate).toEqual({ adventureId: 'adv-1', characterId: 'char-1' })
    expect(recorded.characterStateCreate).toMatchObject({
      characterId: 'char-1', adventureId: 'adv-1', hp: 12, maxHp: 12,
      inventory: [{ name: 'Adaga', qty: 1 }], // 'Mago'→wizard, e o config só tem kit 'fighter' → default
    })
    // Quest.title = summary (mesma premissa); Quest.description = start — gerado por
    // ai.generateOpeningBeat desde US-172, não mais o hookSeed copiado (US-153 #4).
    expect(recorded.questCreate).toMatchObject({
      adventureId: 'adv-1', title: content.premissa, description: 'A porta racha ao meio antes que alguém grite.', isPrimary: true,
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
  // combate para filtrar neste teste (esse caso já é coberto em seed-ledger.test.ts).
  it('US-151: entities vêm do artefato gerado (secret + NPC narrativo), não mais de extractOpeningEntities', async () => {
    const character = {
      id: 'char-1', userId: 'user-1', systemId: 'sys-1', name: 'Elara', class: 'wizard', race: 'human', level: 1,
      baseAttributes: { constitution: 14 },
      system: { config },
    }
    const { prisma, recorded } = fakePrisma(character)
    const service = new AdventureService(prisma, fakeAi())

    await service.createForCharacter('char-1', {})

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
    expect(recorded.adventureCreate).toMatchObject({ order: 3, title: content.premissa })
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
      generateLocationsAndNpcs: async () => ({
        locations: [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'x', occupants: [] }],
        npcs: [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }], // nunca referenciado → órfão
      }),
      generateSecrets: async () => [{ id: 'secret-1', locationId: 'loc-1', text: 'segredo' }],
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
  // do escopo aqui; esta story só liga o cano). setting/areaType removidos em US-173.
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
      expect.anything(), 'char-1', 1, { tone: 'heroic' },
    )
  })

  // US-156: validação server-side de tone contra o catálogo do sistema — mesmo molde de
  // validateCatalogKey (character.service.ts), reaplicado do lado da aventura. setting/
  // areaType removidos em US-173 (nunca tiveram consumidor fora da geração).
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
  function service(): { buildAdventureProfile: (character: Record<string, unknown>, config: SystemConfig) => unknown } {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, fakeAi()) as unknown as { buildAdventureProfile: (character: Record<string, unknown>, config: SystemConfig) => unknown }
  }

  it('personagem com background e origin preenchidos: perfil carrega os cinco campos, hookSeed resolvido', () => {
    const character = {
      name: 'Elara', level: 3, class: 'wizard',
      background: { story: 'Aprendiz fugida', ideals: ['Conhecimento'], bonds: ['O mentor'], flaws: ['Orgulho'], deity: { name: 'Mystra', portfolio: 'magia' } },
      origin: { key: 'a5e-ag_acolyte', connection: 'O templo que a criou', memento: 'Um símbolo sagrado gasto' },
    }

    const profile = service().buildAdventureProfile(character, config) as Record<string, unknown>

    expect(profile).toEqual({
      level: 3,
      classKey: 'wizard',
      background: character.background,
      origin: {
        adventuresAndAdvancement: 'O templo pede um favor.',
        connection: 'O templo que a criou',
        memento: 'Um símbolo sagrado gasto',
      },
      hookSeed: 'A vela curva-se, Elara.', // placeholder {characterName} resolvido, não cru
    })
  })

  it('background {} e origin {} (rede de segurança): perfil válido, hookSeed da classe não-vazio, sem lançar', () => {
    const character = { name: 'Nyx', level: 1, class: 'wizard', background: {}, origin: {} }

    const profile = service().buildAdventureProfile(character, config) as Record<string, unknown>

    expect(profile['level']).toBe(1)
    expect(profile['classKey']).toBe('wizard')
    expect(profile['background']).toEqual({})
    expect(profile['origin']).toEqual({ adventuresAndAdvancement: undefined, connection: undefined, memento: undefined })
    expect(profile['hookSeed']).toBe('A vela curva-se, Nyx.')
    expect((profile['hookSeed'] as string).length).toBeGreaterThan(0)
  })

  it('origin.key fora do catálogo: adventuresAndAdvancement ausente, sem lançar (mesmo lookup de resolveAdventuresAndAdvancement)', () => {
    const character = { name: 'Elara', level: 1, class: 'wizard', background: {}, origin: { key: 'chave-inexistente' } }

    const profile = service().buildAdventureProfile(character, config) as Record<string, unknown>

    expect((profile['origin'] as Record<string, unknown>)['adventuresAndAdvancement']).toBeUndefined()
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
  }

  function fakeGenAi(overrides: {
    locations?: Record<string, unknown>[]
    npcs?: Record<string, unknown>[]
    secrets?: Record<string, unknown>[]
    closing?: { conclusion: string; followUps: string[] }
    start?: string
    seenOpeningParams?: Record<string, unknown>
  } = {}): AiService {
    const locations = overrides.locations ?? [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: ['maré alta'], boxedText: 'Você chega à enseada.', description: 'notas', occupants: [] }]
    const npcs = overrides.npcs ?? [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
    const secrets = overrides.secrets ?? [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
    const closing = overrides.closing ?? { conclusion: 'O culto recua para as sombras.', followUps: ['A dívida da estalajadeira volta a assombrar.'] }
    const start = overrides.start ?? 'A porta racha ao meio antes que alguém grite.'
    return {
      generateLocationsAndNpcs: async () => ({ locations, npcs }),
      generateSecrets: async () => secrets,
      generateClosing: async () => closing,
      // US-172: captura os params recebidos por generateOpeningBeat — usado pra provar
      // estruturalmente que `hookSeed` NUNCA chega a esta chamada.
      generateOpeningBeat: async (params: Record<string, unknown>) => {
        if (overrides.seenOpeningParams) Object.assign(overrides.seenOpeningParams, params)
        return { start }
      },
    } as unknown as AiService
  }

  function service(ai: AiService) {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, ai)
  }

  it('monta um GeneratedAdventure que passa em .parse() (US-144)', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure(profile, 'char-1', 1)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  it('id = characterId:order; levelRange = { min, max } = profile.level; summary vem do rolado', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure(profile, 'char-1', 2)
    expect(adventure.id).toBe('char-1:2')
    expect(adventure.levelRange).toEqual({ min: 1, max: 1 })
    expect(adventure.summary.length).toBeGreaterThan(0)
  })

  // US-172: `start` deixou de ser `profile.hookSeed` copiado — vem de `ai.generateOpeningBeat`.
  it('start vem de ai.generateOpeningBeat, não mais de profile.hookSeed', async () => {
    const adventure = await service(fakeGenAi({ start: 'A porta racha ao meio.' })).generateAdventure(profile, 'char-1', 2)
    expect(adventure.start).toBe('A porta racha ao meio.')
    expect(adventure.start).not.toBe(profile.hookSeed)
  })

  it('generateOpeningBeat recebe registry/premissa/locations/npcs/secrets — NUNCA hookSeed', async () => {
    const seenOpeningParams: Record<string, unknown> = {}
    await service(fakeGenAi({ seenOpeningParams })).generateAdventure(profile, 'char-1', 1)
    expect(seenOpeningParams).not.toHaveProperty('hookSeed')
    expect(seenOpeningParams.registry).toBeDefined()
    expect(seenOpeningParams.premissa).toBeDefined()
    expect(seenOpeningParams.locations).toBeDefined()
    expect(seenOpeningParams.npcs).toBeDefined()
    expect(seenOpeningParams.secrets).toBeDefined()
  })

  it('encounters[0].locationId referencia locations[0]; npcIds referencia NPCs do próprio npcs[] final', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 1)
    expect(adventure.encounters).toHaveLength(1)
    expect(adventure.encounters[0]!.locationId).toBe('loc-1')
    expect(adventure.encounters[0]!.npcIds.length).toBeGreaterThan(0) // nível 5, modo aventura: limiar > 0
    for (const id of adventure.encounters[0]!.npcIds) {
      expect(adventure.npcs.some((n) => n.id === id)).toBe(true)
    }
  })

  it('nível 1-3 (limiar de soma zero, US-160): encontro existe mas npcIds vazio, sem quebrar o parse', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 1 }, 'char-1', 1)
    expect(adventure.encounters).toHaveLength(1)
    expect(adventure.encounters[0]!.npcIds).toEqual([])
  })

  it('npcs[] final inclui os NPCs do passo 2 (locais/NPCs) e os do passo 4 (combate)', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 1)
    expect(adventure.npcs.some((n) => n.id === 'npc-1')).toBe(true)
    expect(adventure.npcs.length).toBeGreaterThan(1)
  })

  it('mesmo characterId+order: registro e encounters[].npcIds deterministicos entre execuções (parte não-LLM)', async () => {
    const a = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 7)
    const b = await service(fakeGenAi()).generateAdventure({ ...profile, level: 5 }, 'char-1', 7)
    expect(a.tone).toBe(b.tone)
    expect(a.encounters[0]!.npcIds).toEqual(b.encounters[0]!.npcIds)
  })

  it('registryOverrides é repassado ao rollAdventure — registro fixado, não sorteado', async () => {
    const adventure = await service(fakeGenAi()).generateAdventure(profile, 'char-1', 1, { tone: 'heroic' })
    expect(adventure.tone).toBe('heroic')
  })
})

// US-150: gate que envolve generateAdventure. Não repete a matriz de checagens (isso é
// adventure-gate.test.ts) — só confirma que a integração real (rollAdventure + AiService
// mockado) chega no gate e reage certo aos dois desfechos, sem mockar o gate em si.
describe('AdventureService.generateGatedAdventure (US-150)', () => {
  const profile: AdventureProfile = { level: 1, classKey: 'wizard', background: {}, origin: {}, hookSeed: 'A vela curva-se, Elara.' }

  function fakeGenAi(overrides: { locations?: Record<string, unknown>[] } = {}): AiService {
    const locations = overrides.locations ?? [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'x', occupants: [] }]
    const npcs = [{ id: 'npc-1', name: 'Marta', role: 'herborista suspeita', interactions: [] }]
    const secrets = [{ id: 'secret-1', locationId: 'loc-1', text: 'A estalajadeira esconde uma dívida com o culto.' }]
    const closing = { conclusion: 'O culto recua para as sombras.', followUps: ['A dívida volta a assombrar.'] }
    return {
      generateLocationsAndNpcs: vi.fn(async () => ({ locations, npcs })),
      generateSecrets: vi.fn(async () => secrets),
      generateClosing: vi.fn(async () => closing),
      generateOpeningBeat: vi.fn(async () => ({ start: 'abertura' })),
    } as unknown as AiService
  }

  function service(ai: AiService) {
    const { prisma } = fakePrisma(null)
    return new AdventureService(prisma, ai)
  }

  it('grafo fechado (npc ocupa o local): gate passa na 1ª tentativa, sem reseed', async () => {
    const ai = fakeGenAi({ locations: [{ id: 'loc-1', title: 'Enseada Cinzenta', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-1'] }] })

    const result = await service(ai).generateGatedAdventure(profile, 'char-1', 1)

    expect(result.ok).toBe(true)
    expect(ai.generateLocationsAndNpcs).toHaveBeenCalledTimes(1)
  })

  it('NPC órfão (nada aponta pra "Marta"): esgota o teto de tentativas e falha registrada', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ai = fakeGenAi() // occupants: [] — npc-1 nunca referenciado, mesmo resultado em toda tentativa

    const result = await service(ai).generateGatedAdventure(profile, 'char-1', 1)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('npc-1')
      expect(result.reason).toContain('teto de 3 tentativas esgotado')
    }
    expect(ai.generateLocationsAndNpcs).toHaveBeenCalledTimes(3) // teto default
    expect(logSpy).toHaveBeenCalled()
  })
})
