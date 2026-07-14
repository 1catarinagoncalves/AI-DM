import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt, resolveKnownSpell } from '@ai-dm/ai-engine'

// Eval case: US-42 — magias conhecidas pelo mestre (awareness, sem motor de spellcasting).
// Metade determinística do critério de regressão: o clérigo traz "Chama Sagrada" na
// seção de NOMES do prompt (só nomes, sem descrição), e o getSpell resolve a descrição
// sob demanda; guerreiro (não-conjurador) não tem seção e getSpell devolve known:false.
// A metade "o mestre oferece/narra a conjuração coerente" depende do modelo (bake-off US-17).

const base = {
  systemName: 'D&D 5e',
  characterName: 'Irmã Aurélia',
  characterGender: 'feminino',
  characterClass: 'clériga',
  characterRace: 'humana',
  activeQuests: [] as string[],
  inventory: [] as string[],
  sheet: { level: 1, hp: 10, maxHp: 10, attributes: { wisdom: 16 }, conditions: [] },
}

// Subconjunto dos truques do clérigo (nível 0). O prompt recebe SÓ nome+nível.
const clerigoSpells = [
  { name: 'Chama Sagrada', level: 0, description: 'luz sagrada desce sobre o alvo, ignorando cobertura.' },
  { name: 'Orientação', level: 0, description: 'um toque divino dá um impulso extra ao próximo teste do aliado.' },
]

// Exceção da US-42: paladino recebe 2 magias de NÍVEL 1 fixas (render "(nível 1)").
const paladinoSpells = [
  { name: 'Curar Ferimentos', level: 1, description: 'restaura vitalidade a uma criatura pelo toque.' },
  { name: 'Abençoar', level: 1, description: 'até três aliados ganham um impulso em ataques e salvamentos.' },
]

describe('US-42 — magias conhecidas no prompt (só nomes)', () => {
  it('a seção lista os nomes das magias do clérigo, truque como "(truque)"', () => {
    const prompt = buildDmSystemPrompt({ ...base, spells: clerigoSpells })
    expect(prompt.toLowerCase()).toMatch(/## known spells \(read-only/)
    expect(prompt).toMatch(/- Chama Sagrada \(truque\)/)
    expect(prompt).toMatch(/- Orientação \(truque\)/)
  })

  it('a seção traz SÓ os nomes — nenhuma descrição de efeito', () => {
    const prompt = buildDmSystemPrompt({ ...base, spells: clerigoSpells })
    expect(prompt).not.toMatch(/luz sagrada desce sobre o alvo/)
  })

  it('a seção instrui a chamar getSpell antes de narrar a conjuração', () => {
    const prompt = buildDmSystemPrompt({ ...base, spells: clerigoSpells })
    expect(prompt.toLowerCase()).toMatch(/call getspell/)
  })

  it('magia de nível 1 (exceção paladino) renderiza como "(nível 1)"', () => {
    const prompt = buildDmSystemPrompt({ ...base, characterClass: 'paladina', spells: paladinoSpells })
    expect(prompt).toMatch(/- Curar Ferimentos \(nível 1\)/)
  })

  it('sem magias (lista vazia) a seção não existe', () => {
    const prompt = buildDmSystemPrompt({ ...base, characterClass: 'guerreira', spells: [] })
    expect(prompt.toLowerCase()).not.toMatch(/## known spells/)
  })

  it('magias ausentes (undefined) também não geram seção', () => {
    const prompt = buildDmSystemPrompt({ ...base })
    expect(prompt.toLowerCase()).not.toMatch(/## known spells/)
  })
})

describe('US-42 — getSpell resolve a descrição sob demanda', () => {
  it('clérigo conjurando "Chama Sagrada" → known:true + nível + descrição', () => {
    const out = resolveKnownSpell(clerigoSpells, 'Chama Sagrada')
    expect(out).toEqual({ known: true, level: 0, description: 'luz sagrada desce sobre o alvo, ignorando cobertura.' })
  })

  it('match tolerante a acento/caixa ("chama sagrada" minúsculo)', () => {
    const out = resolveKnownSpell(clerigoSpells, 'chama sagrada')
    expect(out.known).toBe(true)
  })

  it('magia fora da lista do clérigo ("Bola de Fogo") → known:false', () => {
    const out = resolveKnownSpell(clerigoSpells, 'Bola de Fogo')
    expect(out).toEqual({ known: false })
  })

  it('não-conjurador (guerreiro, lista vazia) → getSpell known:false, sem crash', () => {
    const out = resolveKnownSpell([], 'Chama Sagrada')
    expect(out).toEqual({ known: false })
  })
})
