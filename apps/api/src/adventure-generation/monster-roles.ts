import type { AdventureNpc } from '@ai-dm/shared'
import { encounterDeadlyThreshold, singleMonsterCrCap } from './lazy-encounter-benchmark'

// US-152: os 3 papéis do 5e_Monster_Builder.json (seção `generalusestatblocks`, subsections
// `minion`/`soldier`/`brute`) que o motor usa como oponente jogável — sem ingerir monstro
// nominal do SRD. CR HARDCODED aqui, não lido do JSON em runtime (mesmo padrão do módulo
// irmão lazy-encounter-benchmark.ts, US-159); scripts/lazygm/extract-monster-roles.mjs só
// confirma que a seção-fonte ainda existe, nunca deriva este valor dela.
export type MonsterRole = 'Minion' | 'Soldier' | 'Brute'

// US-161: dial de risco escolhido pelo jogador — chave canônica EN (US-54). 'adventure' é o
// default (comportamento da US-160, pode zerar em nível 1-3); 'challenge' reusa
// singleMonsterCrCap (pré-US-160, sempre não vazio) pra quem topa risco maior.
export type EncounterChallenge = 'adventure' | 'challenge'

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
 * US-160/US-161: monta o encontro para UM personagem (grupo = 1, nunca multiplicado) de nível
 * `level` — soma CR de papéis até um dos dois orçamentos do LGMRD, escolhido por `challenge`.
 * Os dois orçamentos convivem como OPÇÕES do jogador, não um substituindo o outro: nenhuma
 * fórmula nova (US-159 intacta), só qual delas o loop guloso usa.
 *
 * `'adventure'` (default) usa `encounterDeadlyThreshold` (limiar de soma) — empacotar contra
 * o teto de monstro único sempre estourava o limiar de soma que a verificação 3 do gate
 * (US-150) cobra (US-160, Contexto e motivação). Em nível 1-3 o limiar é 0 e a função devolve
 * array vazio — resultado correto do LGMRD nesses níveis, não bug.
 *
 * `'challenge'` usa `singleMonsterCrCap` (teto de monstro único, sempre > 0, sempre maior que
 * `encounterDeadlyThreshold`) — pra quem topa risco maior, nível 1-3 devolve composição não
 * vazia (US-161).
 *
 * Greedy: tenta o papel de maior impacto primeiro (Brute) a cada rodada; só entra se AINDA
 * couber estritamente abaixo do orçamento (o LGMRD trata soma igual ao limiar como letal,
 * operador `>`) — por isso nível 1 em modo aventura nunca recebe um Brute (CR 2) sozinho, que
 * já estoura o teto de monstro único (1), a fortiori o limiar de soma (0).
 *
 * `reservedCr` (US-188, default 0, retrocompatível): CR já comprometido antes do loop —
 * usado só no encontro final, pra reservar o CR do antagonista (`chooseAntagonistRole`) ANTES
 * de encher o resto do orçamento com capangas. Os demais encontros `combat` chamam sem este
 * parâmetro, orçamento cheio, comportamento idêntico a antes desta story.
 */
export function composeEncounterRoles(
  level: number,
  challenge: EncounterChallenge = 'adventure',
  reservedCr = 0,
): MonsterRole[] {
  const budget = (challenge === 'challenge' ? singleMonsterCrCap(level) : encounterDeadlyThreshold(level)) - reservedCr
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

/**
 * US-188: papel do antagonista — o mais difícil (`Brute` > `Soldier` > `Minion`,
 * `ROLES_BY_IMPACT`) cujo CR SOZINHO cabe no orçamento do MESMO dial que `composeEncounterRoles`
 * usa. `undefined` quando nem `Minion` coubesse (nível 1-3, modo `'adventure'`, orçamento 0) —
 * SEM piso forçado: um `Minion` (CR 1/8) nesse caso já violaria `1/8 > 0`, o próprio limiar que
 * `checkEncounterBudget` (adventure-gate.ts) verifica. Não depende do modelo — só `level`/
 * `challenge`, calculável antes de `generateAntagonist` sequer rodar.
 */
export function chooseAntagonistRole(level: number, challenge: EncounterChallenge = 'adventure'): MonsterRole | undefined {
  const budget = challenge === 'challenge' ? singleMonsterCrCap(level) : encounterDeadlyThreshold(level)
  for (const role of ROLES_BY_IMPACT) {
    if (MONSTER_ROLE_CR[role] < budget) return role
  }
  return undefined
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
