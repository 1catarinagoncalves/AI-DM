import type { AdventureNpc } from '@ai-dm/shared'
import { singleMonsterCrCap } from './lazy-encounter-benchmark'

// US-152: os 3 papéis do 5e_Monster_Builder.json (seção `generalusestatblocks`, subsections
// `minion`/`soldier`/`brute`) que o motor usa como oponente jogável — sem ingerir monstro
// nominal do SRD. CR HARDCODED aqui, não lido do JSON em runtime (mesmo padrão do módulo
// irmão lazy-encounter-benchmark.ts, US-159); scripts/lazygm/extract-monster-roles.mjs só
// confirma que a seção-fonte ainda existe, nunca deriva este valor dela.
export type MonsterRole = 'Minion' | 'Soldier' | 'Brute'

export const MONSTER_ROLE_CR: Record<MonsterRole, number> = {
  Minion: 1 / 8,
  Soldier: 1 / 2,
  Brute: 2,
}

const ROLES_BY_IMPACT: MonsterRole[] = ['Brute', 'Soldier', 'Minion']

export function totalCr(roles: MonsterRole[]): number {
  return roles.reduce((sum, role) => sum + MONSTER_ROLE_CR[role], 0)
}

/**
 * US-152: monta o encontro para UM personagem (grupo = 1, nunca multiplicado) de nível
 * `level` — soma CR de papéis até o teto de monstro único do LGMRD (`singleMonsterCrCap`,
 * US-159), não o `encounterDeadlyThreshold` de soma de grupo: aquele já nasce 0 até nível 3
 * e não sobra composição alguma pra caber nele (US-159, Notas de implementação: "a
 * calibração de quantos Minions ainda são jogáveis... é decisão da US-152").
 *
 * Greedy: tenta o papel de maior impacto primeiro (Brute) a cada rodada; só entra se AINDA
 * couber estritamente abaixo do teto (o próprio LGMRD trata CR igual ao teto como letal,
 * operador `>=`) — por isso nível 1 nunca recebe um Brute (CR 2) sozinho, que já estoura o
 * teto de 1.
 */
export function composeEncounterRoles(level: number): MonsterRole[] {
  const budget = singleMonsterCrCap(level)
  const roles: MonsterRole[] = []
  let sum = 0

  for (let added = true; added; ) {
    added = false
    for (const role of ROLES_BY_IMPACT) {
      const nextSum = sum + MONSTER_ROLE_CR[role]
      if (nextSum < budget) {
        roles.push(role)
        sum = nextSum
        added = true
        break
      }
    }
  }

  return roles
}

// US-152: cada instância de papel vira um item de `npcs[]` sem schema novo — `id` continua o
// contador sequencial `npc-N` que `generateLocationsAndNpcs` (US-158, ai.service.ts:1278) já
// minta, por isso `existingNpcs` precisa ser a lista completa já mintada até aqui (sem
// namespace por encontro). `name` repete o papel; combatente genérico não tem fala
// (`interactions: []`).
export function buildEncounterNpcs(roles: MonsterRole[], existingNpcs: AdventureNpc[]): AdventureNpc[] {
  const nextId = existingNpcs.length + 1
  return roles.map((role, i) => ({
    id: `npc-${nextId + i}`,
    name: role,
    role,
    interactions: [],
  }))
}
