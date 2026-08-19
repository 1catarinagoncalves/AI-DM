import { describe, it, expect } from 'vitest'
import { rollAdventure } from './roll-adventure'

describe('rollAdventure (US-147)', () => {
  it('mesmo characterId+order produz mesmo registro e mesmo conteúdo — determinismo ponta a ponta', () => {
    expect(rollAdventure('char-1', 1)).toEqual(rollAdventure('char-1', 1))
  })

  it('registro escolhido manualmente não afeta o determinismo do conteúdo', () => {
    const semOverride = rollAdventure('char-1', 1)
    const comOverride = rollAdventure('char-1', 1, { tone: 'grimdark' })
    expect(comOverride.content).toEqual(semOverride.content)
    expect(comOverride.registry).toEqual({ tone: 'grimdark' })
  })

  it('devolve registro e conteúdo juntos, prontos para as chamadas de modelo seguintes', () => {
    const { registry, content } = rollAdventure('char-1', 1)
    expect(registry).toHaveProperty('tone')
    expect(content).toHaveProperty('premissa')
    expect(content).toHaveProperty('locais')
    expect(content).toHaveProperty('monumentos')
    expect(content).toHaveProperty('complicacao')
  })
})
