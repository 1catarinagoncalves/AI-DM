import { describe, it, expect } from 'vitest'
import { chooseNominalCreature, BESTIARY, type BestiaryCreature } from './bestiary'
import { MONSTER_ROLE_CR } from './monster-roles'

// US-252: bestiário reduzido — só os 3 CRs de MONSTER_ROLE_CR (Minion 1/8, Soldier 1/2, Brute
// 2), com tipos misturados por CR pra exercitar filtro de tema/fallback sem depender do
// bestiary-5e.json real (325 criaturas, US-251).
const fixture: BestiaryCreature[] = [
  { cr: 1 / 8, name: 'Goblin Minion', size: 'small', type: 'humanoid' },
  { cr: 1 / 8, name: 'Rot Grub Swarm', size: 'tiny', type: 'ooze' },
  { cr: 1 / 2, name: 'Orc Warrior', size: 'medium', type: 'humanoid' },
  { cr: 2, name: 'Ogre Brute', size: 'large', type: 'giant' },
]

describe('chooseNominalCreature (US-252)', () => {
  it('devolve criatura com cr === MONSTER_ROLE_CR[combatRole]', () => {
    expect(fixture.find((c) => c.name === chooseNominalCreature('Minion', undefined, fixture, 0))!.cr).toBe(MONSTER_ROLE_CR.Minion)
    expect(fixture.find((c) => c.name === chooseNominalCreature('Soldier', undefined, fixture, 0))!.cr).toBe(MONSTER_ROLE_CR.Soldier)
    expect(fixture.find((c) => c.name === chooseNominalCreature('Brute', undefined, fixture, 0))!.cr).toBe(MONSTER_ROLE_CR.Brute)
  })

  it('tema preferido restringe corretamente — humanoid nunca devolve ooze', () => {
    for (let i = 0; i < 10; i++) {
      expect(chooseNominalCreature('Minion', 'humanoid', fixture, i)).toBe('Goblin Minion')
    }
  })

  it('sem candidato do tema pedido no CR exato, cai pra qualquer type do mesmo CR (fallback, não erro)', () => {
    expect(() => chooseNominalCreature('Brute', 'ooze', fixture, 0)).not.toThrow()
    expect(chooseNominalCreature('Brute', 'ooze', fixture, 0)).toBe('Ogre Brute')
  })

  it('CR sem candidato exato cai pro CR mais próximo do bestiário', () => {
    const semMinion = fixture.filter((c) => c.name !== 'Goblin Minion' && c.name !== 'Rot Grub Swarm')
    // sem nenhuma criatura em cr 1/8, o mais próximo é cr 1/2 (Orc Warrior)
    expect(chooseNominalCreature('Minion', undefined, semMinion, 0)).toBe('Orc Warrior')
  })

  it('mesma entrada (combatRole, tema, index) produz sempre o mesmo nome — sem RNG', () => {
    expect(chooseNominalCreature('Soldier', undefined, fixture, 3)).toBe(chooseNominalCreature('Soldier', undefined, fixture, 3))
  })

  it('index cicla entre candidatos empatados no mesmo CR/tema — determinístico por posição', () => {
    const doisMinions: BestiaryCreature[] = [
      { cr: 1 / 8, name: 'A', size: 'small', type: 'humanoid' },
      { cr: 1 / 8, name: 'B', size: 'small', type: 'humanoid' },
    ]
    expect(chooseNominalCreature('Minion', undefined, doisMinions, 0)).toBe('A')
    expect(chooseNominalCreature('Minion', undefined, doisMinions, 1)).toBe('B')
    expect(chooseNominalCreature('Minion', undefined, doisMinions, 2)).toBe('A')
  })
})

describe('BESTIARY (US-251, dado real)', () => {
  it('tem candidato exato pros 3 CRs de MONSTER_ROLE_CR — fallback de CR próximo não é o caminho comum em produção', () => {
    for (const cr of Object.values(MONSTER_ROLE_CR)) {
      expect(BESTIARY.some((c) => c.cr === cr)).toBe(true)
    }
  })
})
