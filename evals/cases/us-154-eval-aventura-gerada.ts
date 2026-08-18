import { describe, it, expect } from 'vitest'
import { buildTurnStateBlock, type DmCharacterSheet } from '@ai-dm/ai-engine'
import type { GeneratedAdventure, WorldEntity } from '@ai-dm/shared'

// Eval US-154 — o Mestre respeita o que o motor gerou: segredo `revelado: false` não
// vaza no bloco de entidades do turno, e nenhum NPC extra aparece quando o artefato já
// trouxe os seus.
//
// Estático, sem chamar o modelo (questão 1 da US-154, resolvida 2026-08-18): não há
// harness de "N turnos contra Mestre real" pronto (US-94 está em backlog), e o assert
// que importa aqui é determinístico — o BLOCO DE ENTIDADES que `buildTurnStateBlock`
// (US-56) injeta no prompt a cada turno. Se o guard OCULTO (`dm-system.ts`) ou a
// redação da seção regredirem, este caso quebra sem gastar uma chamada de API. Ancorado
// no artefato (secretId / nome de NPC), nunca na leitura de quem jogou — disciplina da
// US-77. Cobertura de "o Mestre real também obedece isso jogando" fica com a US-94.

const sheet: Pick<DmCharacterSheet, 'hp' | 'maxHp' | 'conditions'> = { hp: 10, maxHp: 10, conditions: [] }

// Fixture "seed pinado": 7 NPCs — NPC_ROLL_COUNT do motor (roll-content.ts) é 7, mesmo
// piso que a história cita ("quando ~7 NPCs já existem") — 1 deles de combate (role
// 'Brute', ver MONSTER_ROLE_CR em apps/api/src/adventure-generation/monster-roles.ts),
// e 4 segredos (um por categoria dos 40 prompts do LGMRD, US-149).
const adventure: GeneratedAdventure = {
  id: 'seed-fixture:1',
  levelRange: { min: 3, max: 3 },
  setting: 'floresta',
  tone: 'sombrio',
  areaType: 'ruína',
  summary: 'Uma vila à beira da floresta esconde mais do que aparenta.',
  npcs: [
    { id: 'npc-1', name: 'Ilvaine Torncroft', role: 'anciã da vila', interactions: [] },
    { id: 'npc-2', name: 'Doran Ashwick', role: 'ferreiro rude', interactions: [] },
    { id: 'npc-3', name: 'Sable Winterhollow', role: 'caçadora desconfiada', interactions: [] },
    { id: 'npc-4', name: 'Corvin Halewood', role: 'sacerdote itinerante', interactions: [] },
    { id: 'npc-5', name: 'Wrenna Duskfell', role: 'criança órfã', interactions: [] },
    { id: 'npc-6', name: 'Garrick Nightbrook', role: 'estalajadeiro nervoso', interactions: [] },
    { id: 'npc-7', name: 'Brute', role: 'Brute', interactions: [] },
  ],
  secrets: [
    { id: 'secret-vila-1', locationId: 'loc-1', text: 'A anciã Ilvaine sacrificou o filho para selar o poço.' },
    { id: 'secret-vila-2', locationId: 'loc-1', text: 'Doran forja armas para os saqueadores à noite.' },
    { id: 'secret-vila-3', locationId: 'loc-2', text: 'Wrenna já esteve neste lugar antes — ela é a órfã da lenda local.' },
    { id: 'secret-vila-4', locationId: 'loc-2', text: 'O poço selado guarda uma entidade mais antiga que a vila.' },
  ],
  locations: [
    { id: 'loc-1', title: 'Praça da vila', aspects: ['poço selado'], boxedText: 'x', description: 'x', occupants: ['npc-1', 'npc-2'] },
    { id: 'loc-2', title: 'Casa da anciã', aspects: [], boxedText: 'x', description: 'x', occupants: ['npc-5'] },
  ],
  encounters: [{ id: 'encounter-1', locationId: 'loc-2', npcIds: ['npc-7'] }],
  start: 'A caravana chega à vila ao anoitecer.',
  conclusion: 'O poço é selado de vez, ou a entidade desperta.',
  followUps: ['A entidade pode ter deixado descendentes em outras vilas.'],
}

// role ∈ MONSTER_ROLE_CR — combatente genérico, nunca entra no ledger como entidade
// durável (mesmo filtro de `seedLedgerFromGeneratedAdventure`, US-151). Reimplementado
// aqui em vez de importado: `evals/cases` só linka `@ai-dm/ai-engine` e `@ai-dm/shared`
// (ver `vitest.eval.config.ts`), apps/api fica fora do alias.
const MONSTER_NPC_IDS = new Set(['npc-7'])

// `revealedSecretIds` simula o turno EM QUE a ficção fez o personagem descobrir —
// equivalente ao Mestre chamar `recordEntity` com `revelado: true` naquele secretId.
function seedEntities(revealedSecretIds: string[] = []): WorldEntity[] {
  const locationTitleById = new Map(adventure.locations.map((l) => [l.id, l.title]))

  const secretEntities: WorldEntity[] = adventure.secrets.map((secret) => ({
    nome: secret.id,
    tipo: 'outro',
    local: locationTitleById.get(secret.locationId),
    nota: secret.text,
    sabido: 'publico',
    revelado: revealedSecretIds.includes(secret.id),
    atualizadoEm: '2026-08-18T00:00:00.000Z',
  }))

  const npcEntities: WorldEntity[] = adventure.npcs
    .filter((npc) => !MONSTER_NPC_IDS.has(npc.id))
    .map((npc) => ({
      nome: npc.name,
      tipo: 'npc',
      nota: npc.role,
      revelado: true,
      atualizadoEm: '2026-08-18T00:00:00.000Z',
    }))

  return [...secretEntities, ...npcEntities]
}

function block(revealedSecretIds: string[] = []): string {
  return buildTurnStateBlock({ sheet, activeQuests: [], inventory: [], entities: seedEntities(revealedSecretIds) })
}

function lineFor(text: string, needle: string): string | undefined {
  return text.split('\n').find((l) => l.includes(needle))
}

describe('US-154 — segredo revelado:false não vaza no bloco de entidades do turno', () => {
  it('turno ANTES da descoberta: todo segredo do artefato aparece marcado ⚠ OCULTO', () => {
    const b = block()
    for (const secret of adventure.secrets) {
      const line = lineFor(b, secret.id)
      expect(line, `secretId "${secret.id}" ausente do bloco de entidades`).toBeTruthy()
      expect(line, `secretId "${secret.id}" sem marcador OCULTO — vazaria pro jogador`).toContain('⚠ OCULTO')
    }
    expect(b).toMatch(/NEVER reveal it/)
  })

  it('turno DEPOIS da ficção merecer: marcador some só do secretId revelado, os outros continuam ocultos', () => {
    const b = block(['secret-vila-1'])
    const revealedLine = lineFor(b, 'secret-vila-1')
    expect(revealedLine, 'secretId "secret-vila-1" sumiu do bloco após revelar — o ledger deve manter o fato').toBeTruthy()
    expect(revealedLine, 'secretId "secret-vila-1" ainda marcado OCULTO mesmo com revelado:true').not.toContain('⚠ OCULTO')

    for (const secretId of ['secret-vila-2', 'secret-vila-3', 'secret-vila-4']) {
      expect(lineFor(b, secretId), `secretId "${secretId}" perdeu o marcador OCULTO sem ter sido revelado`).toContain('⚠ OCULTO')
    }
  })
})

describe('US-154 — NPC não inventado quando o artefato já trouxe os seus', () => {
  it('bloco lista os NPCs narrativos do artefato por nome; o NPC de combate fica fora', () => {
    const b = block()
    const narrativeNpcs = adventure.npcs.filter((npc) => !MONSTER_NPC_IDS.has(npc.id))
    for (const npc of narrativeNpcs) {
      expect(b, `NPC "${npc.name}" (${npc.id}) ausente do bloco de entidades — o Mestre não tem como saber que ele já existe`).toContain(npc.name)
    }
    expect(b, 'NPC de combate ("Brute") entrou como entidade durável — não deveria (US-151)').not.toContain('Brute')
    expect(b).toMatch(/TRUST this list even if the recent messages/)
  })
})

// Referência de densidade (Escopo da US-154: comparação de estrutura, NUNCA gabarito de
// conteúdo — os dois exemplares são em inglês e escritos para grupo). Contados à mão em
// scripts/lazygm/_data/LGMRD.json (gitignored, US-145 — por isso os números ficam
// documentados aqui, não lidos em runtime; CI não tem o arquivo bruto):
//   - "The Village of Whitesparrow" (hub reutilizável, não um one-shot): 3 subsections
//     (Using in Your Campaign / Notable NPCs / Notable Locations), 6 NPCs nomeados, 6
//     locais nomeados.
//   - "The Night Blade" (one-shot completo): 8 subsections (Adventure Summary / Notable
//     NPCs / Secrets and Clues / Customizing / Start / Notable Locations / Concluding /
//     Expanding) — o mesmo número de eixos que `GeneratedAdventureSchema` cobre
//     (summary, npcs, secrets, locations, start, conclusion, followUps + encounters);
//     3 NPCs nomeados no corpo (+ grupos de monstros genéricos), 11 linhas de
//     "Secrets and Clues".
// A fixture acima (6 NPCs narrativos, 4 segredos, 2 locais) fica na mesma ordem de
// grandeza da Night Blade — menor porque é nível 3 solo, não um encontro de grupo.
