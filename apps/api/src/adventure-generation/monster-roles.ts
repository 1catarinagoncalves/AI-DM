import type { AdventureNpc } from '@ai-dm/shared'
import { encounterDeadlyThreshold } from './lazy-encounter-benchmark'

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
 * US-160: monta o encontro para UM personagem (grupo = 1, nunca multiplicado) de nível
 * `level` — soma CR de papéis até `encounterDeadlyThreshold` (limiar de soma do LGMRD,
 * US-159), não `singleMonsterCrCap` (teto de monstro único): empacotar contra o teto de
 * monstro único sempre estourava o limiar de soma que a verificação 3 do gate (US-150)
 * cobra — todo encontro gerado em nível 1-4 falhava o gate (US-160, Contexto e motivação).
 * `encounterDeadlyThreshold` é sempre menor que `singleMonsterCrCap` em qualquer nível
 * (prova em US-160, Notas de implementação), então empacotar sob ele garante o teto de
 * monstro único de graça, sem checagem dupla. Em nível 1-3 o limiar é 0 e a função devolve
 * array vazio — resultado correto do LGMRD nesses níveis, não bug.
 *
 * Greedy: tenta o papel de maior impacto primeiro (Brute) a cada rodada; só entra se AINDA
 * couber estritamente abaixo do orçamento (o LGMRD trata soma igual ao limiar como letal,
 * operador `>`) — por isso nível 1 nunca recebe um Brute (CR 2) sozinho, que já estoura o
 * teto de monstro único (1), a fortiori o limiar de soma (0).
 */
export function composeEncounterRoles(level: number): MonsterRole[] {
  const budget = encounterDeadlyThreshold(level)
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
