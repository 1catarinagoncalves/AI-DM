import { describe, it, expect } from 'vitest'
import { stripFabricatedRolls } from '@ai-dm/shared'
import { buildDmSystemPrompt } from '@ai-dm/ai-engine'

// Eval US-29 — Saneamento de rolagens fictícias. Metade determinística: o
// saneador remove qualquer resultado numérico de teste/rolagem da prosa,
// preservando a narração legítima. A "obediência do modelo" (não rolar para
// trivialidade) depende do LLM e não roda aqui; cobrimos o contrato de saída.

describe('US-29 — saneador de rolagens', () => {
  const casos: { nome: string; entrada: string; naoContem?: RegExp[]; contem?: string[]; igual?: string }[] = [
    {
      nome: 'PT-BR: total inventado',
      entrada: 'Com um total de 20 no teste de Percepção, você nota a sombra. Ela se move.',
      naoContem: [/20/, /total/i, /teste de Percep/i],
      contem: ['Ela se move.'],
    },
    {
      nome: 'EN: roll na prosa',
      entrada: 'You roll a 17 on your Stealth check and slip past.',
      igual: '',
    },
    {
      nome: 'breakdown vazado',
      entrada: 'A lâmina desce. 1d20+5: [14] +5 = 19. Ela acerta.',
      naoContem: [/1d20/, /19/],
      contem: ['A lâmina desce.', 'Ela acerta.'],
    },
    {
      nome: 'falso-positivo: HP e contagem sobrevivem',
      entrada: 'Três goblins bloqueiam a ponte; você tem 8 de HP.',
      igual: 'Três goblins bloqueiam a ponte; você tem 8 de HP.',
    },
  ]

  for (const c of casos) {
    it(c.nome, () => {
      const { clean } = stripFabricatedRolls(c.entrada)
      if (c.igual !== undefined) expect(clean).toBe(c.igual)
      for (const re of c.naoContem ?? []) expect(clean).not.toMatch(re)
      for (const s of c.contem ?? []) expect(clean).toContain(s)
    })
  }
})

describe('US-29 — prompt endurece o gate de rolagem', () => {
  const prompt = buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Aria',
    characterGender: 'feminino',
    characterClass: 'guerreiro',
    characterRace: 'humana',
    activeQuests: [],
    inventory: [],
    sheet: { level: 1, hp: 10, maxHp: 10, attributes: { strength: 12 }, conditions: [] },
  })

  it('proíbe número de teste na prosa e pede narração qualitativa', () => {
    expect(prompt).toMatch(/QUALITATIVELY/i)
    expect(prompt).toMatch(/sanitizer will DELETE/i)
  })

  it('trivialidade não rola; pedido do jogador passa por rollDice', () => {
    expect(prompt).toMatch(/TRIVIAL actions NEVER roll/i)
    expect(prompt).toMatch(/quero rolar/i)
  })
})
