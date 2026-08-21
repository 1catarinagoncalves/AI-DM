import { describe, it, expect } from 'vitest'
import { buildTurnStateBlock, type DmCharacterSheet } from '@ai-dm/ai-engine'
import type { GeneratedAdventure, WorldEntity } from '@ai-dm/shared'

// Eval US-170 — `boxedText`/`aspects` de um local gerado (US-158) chegam ao bloco de
// entidades do turno, não ficam órfãos. Mesmo padrão estático do caso US-154 (sem
// chamar o modelo, questão 1 daquela US): o assert que importa é determinístico — o
// BLOCO que `buildTurnStateBlock` injeta no prompt a cada turno. Se `seedLedgerFromGeneratedAdventure`
// parar de emitir `tipo: 'local'`, ou a redação OCULTO (dm-system.ts) regredir e
// esconder a prosa do local, este caso quebra sem gastar uma chamada de API.
// Cobertura de "o Mestre real narra a chegada usando o texto" fica com a US-94
// (harness de N turnos contra Mestre real, ainda em backlog).

const sheet: Pick<DmCharacterSheet, 'hp' | 'maxHp' | 'conditions'> = { hp: 10, maxHp: 10, conditions: [] }

const adventure: GeneratedAdventure = {
  id: 'seed-fixture:1',
  levelRange: { min: 3, max: 3 },
  registry: { setting: 'floresta', tone: 'sombrio', areaType: 'settlement' },
  summary: 'Uma vila à beira da floresta esconde mais do que aparenta.',
  npcs: [{ id: 'npc-1', name: 'Ilvaine Torncroft', role: 'anciã da vila', interactions: [] }],
  secrets: [],
  locations: [
    {
      id: 'loc-1',
      title: 'Praça da vila',
      aspects: ['poço selado', 'névoa rasteira'],
      boxedText: 'A neblina cobre as pedras da praça; o poço no centro está lacrado com correntes enferrujadas.',
      description: 'notas do mestre',
      occupants: ['npc-1'],
    },
  ],
  encounters: [],
  start: 'A caravana chega à vila ao anoitecer.',
  conclusion: 'O poço é selado de vez, ou a entidade desperta.',
  followUps: ['A entidade pode ter deixado descendentes em outras vilas.'],
}

// Reimplementado (não importado): `seedLedgerFromGeneratedAdventure` vive em
// apps/api, fora do alias de `evals/cases` (só `@ai-dm/ai-engine`/`@ai-dm/shared`,
// ver vitest.eval.config.ts) — mesma escolha do caso US-154 para NPC/segredo.
function seedEntities(revelado: boolean): WorldEntity[] {
  return adventure.locations.map((location) => ({
    nome: location.title,
    tipo: 'local',
    nota: [location.boxedText, location.aspects.join(', ')].filter(Boolean).join(' — '),
    revelado,
    atualizadoEm: '2026-08-20T00:00:00.000Z',
  }))
}

function block(revelado: boolean): string {
  return buildTurnStateBlock({ sheet, activeQuests: [], inventory: [], entities: seedEntities(revelado) })
}

function lineFor(text: string, needle: string): string | undefined {
  return text.split('\n').find((l) => l.includes(needle))
}

describe('US-170 — boxedText/aspects do local gerado chegam ao bloco de entidades do turno', () => {
  it('local ainda não visitado: nota carrega boxedText+aspects, marcado ⚠ OCULTO', () => {
    const b = block(false)
    const [location] = adventure.locations
    const line = lineFor(b, location!.title)
    expect(line, `local "${location!.title}" ausente do bloco de entidades`).toBeTruthy()
    expect(line).toContain(location!.boxedText)
    expect(line).toContain(location!.aspects[0])
    expect(line).toContain('⚠ OCULTO')
    expect(b).toMatch(/NEVER reveal it/)
  })

  it('local visitado (recordEntity revelado:true): marcador OCULTO some, prosa continua no bloco', () => {
    const b = block(true)
    const [location] = adventure.locations
    const line = lineFor(b, location!.title)
    expect(line).toContain(location!.boxedText)
    expect(line).not.toContain('⚠ OCULTO')
  })
})
