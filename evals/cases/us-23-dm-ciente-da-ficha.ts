import { describe, it, expect } from 'vitest'
import { buildDmSystemPrompt, buildTurnStateBlock } from '@ai-dm/ai-engine'

// Eval case: US-23 — DM ciente da ficha completa (injeção dirigida por dados).
// Metade determinística do critério de regressão: um personagem com HP baixo e
// condição "envenenado" produz o bloco de ficha correto. US-56 dividiu a ficha por
// volatilidade: nível + atributos (constante) ficam no system; HP + condições
// (voláteis) migraram para o bloco de estado do turno (`buildTurnStateBlock`),
// prefixado à mensagem. Cada metade é asserida na sua fonte. A metade "narração
// coerente" depende do modelo e não roda aqui (sem API paga na suite).

const sheet = {
  level: 3,
  hp: 4,
  maxHp: 24,
  attributes: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 8 },
  conditions: ['envenenado'],
}

describe('US-23 — DM ciente da ficha', () => {
  const prompt = buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Aria',
    characterGender: 'feminino',
    characterClass: 'guerreiro',
    characterRace: 'humana',
    sheet,
    attributeLabels: {
      strength: 'FOR', dexterity: 'DES', constitution: 'CON',
      intelligence: 'INT', wisdom: 'SAB', charisma: 'CAR',
    },
  })

  const turnState = buildTurnStateBlock({ sheet, activeQuests: [], inventory: [] })

  it('o system traz nível (constante); o bloco do turno traz HP baixo e a condição (volátil)', () => {
    expect(prompt).toMatch(/Level:\s*3/)
    expect(turnState).toMatch(/HP:\s*4\/24/)
    expect(turnState).toMatch(/Conditions:.*envenenado/)
    // e o inverso: o volátil NÃO vaza para o system (US-56).
    expect(prompt).not.toMatch(/HP:\s*4\/24/)
    expect(prompt).not.toMatch(/envenenado/)
  })

  it('o system traz TODOS os atributos com os rótulos do config', () => {
    for (const label of ['FOR 16', 'DES 12', 'CON 14', 'INT 10', 'SAB 13', 'CAR 8']) {
      expect(prompt).toContain(label)
    }
  })

  it('a ficha (system) é marcada como read-only / fonte de verdade', () => {
    expect(prompt.toLowerCase()).toMatch(/character sheet \(read-only/)
  })

  it('o bloco de estado do turno declara-se fonte de verdade (não fala do jogador)', () => {
    // US-77 — o contrato é PRECEDÊNCIA sobre a prosa + "isto não é fala do jogador";
    // as duas ancoravam em frases do preâmbulo (ver evals/PROMPT-ANCHORS.md).
    // `source of truth` sozinho seria falso verde: a seção "## Estado atual" também o diz.
    // Mesmo contrato, mesmas âncoras, em packages/ai-engine/src/prompts/dm-system.test.ts.
    expect(turnState.toLowerCase()).toMatch(/(precedence|precedência)[^.]{0,80}(infer|prose|prosa)/)
    expect(turnState.toLowerCase()).toMatch(/\b(not|não)\s+(the\s+)?(player|jogador)[^.]{0,30}(speak|talk|fala|input|voice)/)
  })
})
