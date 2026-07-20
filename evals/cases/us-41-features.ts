import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt } from '@ai-dm/ai-engine'

// Eval case: US-41 — features de classe de nível 1. Metade determinística do
// critério de regressão: um paladino traz "Sentido Divino" e "Impor as Mãos" na
// seção de features (nível 1); sem features a seção não existe. A metade "o mestre
// narra a feature coerente" depende do modelo e vai no bake-off da US-17.

const base = {
  systemName: 'D&D 5e',
  characterName: 'Lady Seraphine Valthor',
  characterGender: 'feminino',
  characterClass: 'paladina',
  characterRace: 'humana',
  sheet: { level: 1, hp: 12, maxHp: 12, attributes: { charisma: 16 }, conditions: [] },
}

const paladinoFeatures = [
  { name: 'Sentido Divino', description: 'Sente presenças de bem/mal e mortos-vivos por perto.' },
  { name: 'Impor as Mãos', description: 'Cura ferimentos tocando o alvo com energia divina.' },
]

describe('US-41 — features de classe no prompt', () => {
  it('a seção de features lista as features de nível 1 do paladino', () => {
    const prompt = buildDmSystemPrompt({ ...base, features: paladinoFeatures })
    expect(prompt.toLowerCase()).toMatch(/## class features \(read-only/)
    expect(prompt).toMatch(/- Sentido Divino: Sente presenças de bem\/mal e mortos-vivos por perto\./)
    expect(prompt).toMatch(/- Impor as Mãos: Cura ferimentos tocando o alvo com energia divina\./)
  })

  it('a seção instrui o mestre a NÃO resolver custo/efeito ali (awareness apenas)', () => {
    const prompt = buildDmSystemPrompt({ ...base, features: paladinoFeatures })
    expect(prompt.toLowerCase()).toMatch(/offer and narrate/)
    expect(prompt.toLowerCase()).toMatch(/never resolve/)
  })

  it('sem features (lista vazia) a seção de features não existe', () => {
    const prompt = buildDmSystemPrompt({ ...base, features: [] })
    expect(prompt.toLowerCase()).not.toMatch(/## class features/)
  })

  it('features ausentes (undefined) também não geram seção', () => {
    const prompt = buildDmSystemPrompt({ ...base })
    expect(prompt.toLowerCase()).not.toMatch(/## class features/)
  })

  it('feature sem descrição renderiza só o nome (sem dois-pontos vazio)', () => {
    const prompt = buildDmSystemPrompt({ ...base, features: [{ name: 'Fúria', description: '' }] })
    expect(prompt).toMatch(/- Fúria(?!:)/)
    expect(prompt).not.toMatch(/- Fúria:/)
  })
})
