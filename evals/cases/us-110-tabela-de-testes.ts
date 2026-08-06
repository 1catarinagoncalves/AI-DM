import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt } from '@ai-dm/ai-engine'

// Eval US-110 — a régua de QUAL teste a situação chama.
//
// Determinístico, e por decisão: julgar a ESCOLHA do modelo exigiria uma trajetória de tool
// calling, e a US-70/US-36 tiraram tools do gerador dos evals de propósito (o modelo gastava
// os passos em chamadas e devolvia narração vazia — flakiness). O que roda aqui é o contrato:
// o prompt entrega ao Mestre a tabela do SRD 2024, com o rótulo de atributo que a ficha usa,
// e diz que ela decide QUAL teste, não SE rola. Obediência é eval vivo — ver US-110 → questão 3.

const LABELS = {
  strength: 'Força',
  dexterity: 'Destreza',
  constitution: 'Constituição',
  intelligence: 'Inteligência',
  wisdom: 'Sabedoria',
  charisma: 'Carisma',
}

function prompt(overrides: Partial<Parameters<typeof buildDmSystemPrompt>[0]> = {}) {
  return buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Lyra',
    characterGender: 'feminino',
    characterClass: 'patrulheira',
    characterRace: 'humana',
    sheet: { level: 1, hp: 10, maxHp: 10, attributes: { strength: 14, wisdom: 16 }, conditions: [] },
    attributeLabels: LABELS,
    ...overrides,
  })
}

describe('US-110 — o prompt ancora a escolha do teste no SRD 2024', () => {
  // As duas situações que mais confundiam antes da tabela: empurrar/arrombar (Força, não
  // Destreza) e notar algo no ambiente (Sabedoria, não Inteligência).
  it('empurrar/arrombar cai em Força; notar o ambiente cai em Sabedoria', () => {
    const p = prompt()
    expect(p).toContain('- Força — Lift, push, pull, or break something')
    expect(p).toContain('- Sabedoria — Notice things in the environment or in creatures’ behavior')
  })

  it('as seis habilidades têm exemplo — nenhuma fica sem régua', () => {
    const p = prompt()
    for (const label of Object.values(LABELS)) expect(p).toContain(`- ${label} — `)
  })

  // A tabela responde QUAL teste. QUANDO rolar continua sendo a ordem de resolução do turno:
  // fundir as duas coisas faz o modelo rolar mais, que é o efeito colateral clássico.
  it('a tabela não vira licença para rolar mais', () => {
    expect(prompt()).toMatch(/WHICH check[^.]{0,40}never WHETHER to roll/i)
  })

  // Decisão de 06/08/2026 (US-110, questão 1): o Free é deliberadamente antimecânico.
  it('o sistema Free continua sem tabela normativa', () => {
    expect(prompt({ systemName: 'Free' })).not.toContain('Lift, push, pull, or break something')
  })
})
