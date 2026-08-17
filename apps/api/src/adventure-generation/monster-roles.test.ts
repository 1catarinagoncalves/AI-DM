import { describe, it, expect } from 'vitest'
import { MONSTER_ROLE_CR, composeEncounterRoles, totalCr, buildEncounterNpcs } from './monster-roles'
import { singleMonsterCrCap } from './lazy-encounter-benchmark'
import type { AdventureNpc } from '@ai-dm/shared'

describe('MONSTER_ROLE_CR (US-152)', () => {
  it('CR por papel bate com o 5e_Monster_Builder.json (Minion 1/8, Soldier 1/2, Brute 2)', () => {
    expect(MONSTER_ROLE_CR.Minion).toBe(1 / 8)
    expect(MONSTER_ROLE_CR.Soldier).toBe(1 / 2)
    expect(MONSTER_ROLE_CR.Brute).toBe(2)
  })
})

describe('composeEncounterRoles (US-152)', () => {
  it('nível 1 nunca recebe um Brute sozinho — CR 2 já estoura o teto de monstro único (1)', () => {
    const roles = composeEncounterRoles(1)
    expect(roles).not.toEqual(['Brute'])
    expect(roles.filter((r) => r === 'Brute')).toHaveLength(0)
  })

  it('nível 1 produz encontro não vazio dentro do orçamento de um personagem solo', () => {
    const roles = composeEncounterRoles(1)
    expect(roles.length).toBeGreaterThan(0)
    expect(totalCr(roles)).toBeLessThan(singleMonsterCrCap(1))
  })

  it('nunca ultrapassa (nem alcança) o teto de monstro único do nível dado', () => {
    for (const level of [1, 2, 4, 5, 8, 12]) {
      const roles = composeEncounterRoles(level)
      expect(totalCr(roles)).toBeLessThan(singleMonsterCrCap(level))
    }
  })

  it('não multiplica por tamanho de grupo — mesmo nível produz sempre a mesma composição (determinístico)', () => {
    expect(composeEncounterRoles(1)).toEqual(composeEncounterRoles(1))
  })
})

describe('buildEncounterNpcs (US-152)', () => {
  const existingNpcs: AdventureNpc[] = Array.from({ length: 7 }, (_, i) => ({
    id: `npc-${i + 1}`,
    name: `Narrativo ${i + 1}`,
    role: 'aliado',
    interactions: [],
  }))

  it('continua o contador npc-N a partir do fim da lista existente, sem namespace por encontro', () => {
    const npcs = buildEncounterNpcs(['Minion', 'Minion'], existingNpcs)
    expect(npcs.map((n) => n.id)).toEqual(['npc-8', 'npc-9'])
  })

  it('cada instância vira um item de npcs[] com role = papel e interactions vazio', () => {
    const [minion] = buildEncounterNpcs(['Minion'], existingNpcs)
    expect(minion).toEqual({ id: 'npc-8', name: 'Minion', role: 'Minion', interactions: [] })
  })

  it('duas instâncias do mesmo papel recebem ids distintos, sem campo count — contagem é o tamanho de npcIds[] filtrado por role', () => {
    const npcs = buildEncounterNpcs(['Minion', 'Minion', 'Soldier'], existingNpcs)
    const minionIds = npcs.filter((n) => n.role === 'Minion').map((n) => n.id)
    expect(minionIds).toEqual(['npc-8', 'npc-9'])
    expect(new Set(npcs.map((n) => n.id)).size).toBe(npcs.length)
  })
})
