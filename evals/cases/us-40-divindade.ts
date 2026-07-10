import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt } from '@ai-dm/ai-engine'

// Eval case: US-40 — divindade/patrono do personagem. Metade determinística do
// critério de regressão: um personagem COM `deity` produz a linha de divindade
// (nome + portfolio) na seção de identidade; SEM `deity` a seção não traz linha
// de divindade. A metade "a narração ancora invocações/presságios na fé" depende
// do modelo e vai no bake-off da US-17 (não roda aqui, sem API paga na suite).

const base = {
  systemName: 'D&D 5e',
  characterName: 'Lady Seraphine Valthor',
  characterGender: 'feminino',
  characterClass: 'paladina',
  characterRace: 'humana',
  activeQuests: [] as string[],
  inventory: [] as string[],
  sheet: { level: 5, hp: 44, maxHp: 44, attributes: { charisma: 16 }, conditions: [] },
}

describe('US-40 — divindade no prompt', () => {
  it('a seção de identidade traz a divindade com nome e portfolio', () => {
    const prompt = buildDmSystemPrompt({
      ...base,
      background: { deity: { name: 'Solariel', portfolio: 'justiça, cura e combate ao mal' } },
    })
    expect(prompt).toMatch(/Divindade: Solariel \(justiça, cura e combate ao mal\)/)
  })

  it('sem portfolio, renderiza só o nome (sem parênteses vazios)', () => {
    const prompt = buildDmSystemPrompt({ ...base, background: { deity: { name: 'Tymora' } } })
    expect(prompt).toMatch(/Divindade: Tymora(?!\s*\()/)
    expect(prompt).not.toMatch(/Divindade: Tymora \(/)
  })

  it('a divindade convive com os demais eixos do background na mesma seção', () => {
    const prompt = buildDmSystemPrompt({
      ...base,
      background: {
        story: 'Nobre menor que perdeu a família para um culto demoníaco',
        flaws: ['Código de honra rígido'],
        deity: { name: 'Auril', portfolio: 'goddess of winter' },
      },
    })
    expect(prompt.toLowerCase()).toMatch(/character identity \(read-only/)
    expect(prompt).toMatch(/Nobre menor que perdeu a família/)
    expect(prompt).toMatch(/Divindade: Auril \(goddess of winter\)/)
  })

  it('a instrução manda usar a fé como cor narrativa (invocações/presságios/tom)', () => {
    const prompt = buildDmSystemPrompt({
      ...base,
      background: { deity: { name: 'Solariel' } },
    })
    expect(prompt.toLowerCase()).toMatch(/faith color invocations|invocations, omens/)
  })

  it('personagem sem deity não gera linha de divindade', () => {
    const prompt = buildDmSystemPrompt({
      ...base,
      background: { story: 'Uma andarilha sem fé declarada' },
    })
    expect(prompt).not.toMatch(/Divindade:/)
  })
})
