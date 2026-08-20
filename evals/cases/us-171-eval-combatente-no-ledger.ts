import { describe, it, expect } from 'vitest'
import { buildTurnStateBlock, type DmCharacterSheet } from '@ai-dm/ai-engine'
import type { GeneratedAdventure, WorldEntity } from '@ai-dm/shared'

// Eval US-171 — combatente de encontro (orçado pelo composer, US-152/160/161) chega ao
// bloco de entidades do turno como AMEAÇA no local, mesmo sem sistema de combate por
// turno. Mesmo padrão estático do caso US-170 (sem chamar o modelo, questão 1 daquela
// US): o assert que importa é determinístico — o BLOCO que `buildTurnStateBlock` injeta
// no prompt a cada turno. Se `seedLedgerFromGeneratedAdventure` parar de emitir a
// entrada do combatente, ou a redação OCULTO (dm-system.ts) regredir e vazar a ameaça
// antes da hora, este caso quebra sem gastar uma chamada de API. Cobertura de "o Mestre
// real narra tensão ao entrar no local" fica com a US-94 (harness de N turnos contra
// Mestre real, ainda em backlog).

const sheet: Pick<DmCharacterSheet, 'hp' | 'maxHp' | 'conditions'> = { hp: 10, maxHp: 10, conditions: [] }

const adventure: GeneratedAdventure = {
  id: 'seed-fixture:1',
  levelRange: { min: 3, max: 3 },
  tone: 'sombrio',
  summary: 'Uma emboscada espera na ruína.',
  npcs: [{ id: 'npc-2', name: 'Soldier', role: 'Soldier', interactions: [] }],
  secrets: [],
  locations: [
    { id: 'loc-1', title: 'Ruína afundada', aspects: ['sombras longas'], boxedText: 'A trilha termina na ruína.', description: 'notas do mestre', occupants: [] },
  ],
  encounters: [{ id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-2'] }],
  start: 'A trilha termina na ruína.',
  conclusion: 'A ameaça é contida.',
  followUps: [],
}

// Reimplementado (não importado): `seedLedgerFromGeneratedAdventure` vive em apps/api,
// fora do alias de `evals/cases` (só `@ai-dm/ai-engine`/`@ai-dm/shared`, ver
// vitest.eval.config.ts) — mesma escolha dos casos US-154/US-170.
function seedEncounterEntities(): WorldEntity[] {
  const locationTitleById = new Map(adventure.locations.map((l) => [l.id, l.title]))
  return adventure.encounters.flatMap((encounter) =>
    encounter.npcIds
      .map((id) => adventure.npcs.find((npc) => npc.id === id))
      .filter((npc): npc is (typeof adventure.npcs)[number] => npc !== undefined)
      .map((npc) => ({
        nome: `${npc.role} (${npc.id})`,
        tipo: 'npc' as const,
        local: locationTitleById.get(encounter.locationId),
        nota: npc.role,
        revelado: false,
        atualizadoEm: '2026-08-20T00:00:00.000Z',
      })),
  )
}

function block(): string {
  return buildTurnStateBlock({ sheet, activeQuests: [], inventory: [], entities: seedEncounterEntities() })
}

function lineFor(text: string, needle: string): string | undefined {
  return text.split('\n').find((l) => l.includes(needle))
}

describe('US-171 — combatente de encontro gerado chega ao bloco de entidades do turno', () => {
  it('combatente ainda não engajado: aparece no local do encontro, papel visível, marcado ⚠ OCULTO', () => {
    const b = block()
    const line = lineFor(b, 'Soldier (npc-2)')
    expect(line, 'combatente "Soldier (npc-2)" ausente do bloco de entidades').toBeTruthy()
    expect(line).toContain('Ruína afundada') // local do encontro, pra dar pista de onde a ameaça está
    expect(line).toContain('Soldier') // papel — o que dá calibre de tensão ao Mestre (Q2 da US, resolvida)
    expect(line).toContain('⚠ OCULTO')
    expect(b).toMatch(/NEVER reveal it/) // instrução de não vazar a ameaça antes da hora
  })

  it('nenhuma estatística/CR do combatente vaza no bloco — só o papel (Minion/Soldier/Brute)', () => {
    const b = block()
    const line = lineFor(b, 'Soldier (npc-2)')
    expect(line).not.toMatch(/\bCR\b/)
    expect(line).not.toMatch(/\d\s*\/\s*\d/) // frações de CR (Minion=1/8, Soldier=1/2) nunca aparecem
  })
})
