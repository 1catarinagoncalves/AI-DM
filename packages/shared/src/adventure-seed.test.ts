import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { createSeededRandom, deriveAdventureSeed } from './adventure-seed'

// US-146 — guard de drift (mesmo padrão do rubric-drift.test.ts da US-36): hash
// hardcoded em vez de toMatchSnapshot, pra não convidar `-u` sem revisão. Se o
// algoritmo do PRNG mudar sem querer, este teste falha e imprime o hash novo.
const REVIEWED_SEQUENCE_HASH = '0fe5e31b6390401f4ed3713479325a794cda2698b5b2a9712f162524d088c803'

describe('deriveAdventureSeed (US-146)', () => {
  it('é determinística: mesma entrada, mesma saída', () => {
    expect(deriveAdventureSeed('char-1', 1)).toBe(deriveAdventureSeed('char-1', 1))
  })

  it('characterId diferente produz seed diferente', () => {
    expect(deriveAdventureSeed('char-1', 1)).not.toBe(deriveAdventureSeed('char-2', 1))
  })

  it('order diferente produz seed diferente (sem colisão trivial entre vizinhos)', () => {
    expect(deriveAdventureSeed('char-1', 1)).not.toBe(deriveAdventureSeed('char-1', 2))
  })

  // US-150: attempt aditivo — default 0 preserva o hash de sempre; só attempt > 0 muda o input.
  it('attempt default (ausente) é idêntico a attempt explícito 0', () => {
    expect(deriveAdventureSeed('char-1', 1)).toBe(deriveAdventureSeed('char-1', 1, 0))
  })

  it('attempt > 0 produz seed diferente do attempt 0, determinística por tentativa', () => {
    const attempt0 = deriveAdventureSeed('char-1', 1, 0)
    const attempt1 = deriveAdventureSeed('char-1', 1, 1)
    expect(attempt1).not.toBe(attempt0)
    expect(deriveAdventureSeed('char-1', 1, 1)).toBe(attempt1)
    expect(deriveAdventureSeed('char-1', 1, 2)).not.toBe(attempt1)
  })
})

describe('createSeededRandom (US-146)', () => {
  it('mesmo seed produz sequência byte a byte idêntica', () => {
    const a = createSeededRandom(42)
    const b = createSeededRandom(42)
    const seqA = Array.from({ length: 100 }, () => a())
    const seqB = Array.from({ length: 100 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('seeds diferentes produzem sequências diferentes', () => {
    const a = createSeededRandom(42)
    const b = createSeededRandom(43)
    expect(a()).not.toBe(b())
  })

  it('seed + 1 (reseed da US-150) produz sequência distinta, também determinística', () => {
    const seed = deriveAdventureSeed('char-1', 1)
    expect(createSeededRandom(seed)()).not.toBe(createSeededRandom(seed + 1)())
    expect(createSeededRandom(seed + 1)()).toBe(createSeededRandom(seed + 1)())
  })

  it('gera floats em [0, 1)', () => {
    const rand = createSeededRandom(42)
    for (let i = 0; i < 100; i++) {
      const n = rand()
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })

  it('a sequência de createSeededRandom(42) não mudou sem revisão (US-146)', () => {
    const rand = createSeededRandom(42)
    const sequence = Array.from({ length: 100 }, () => rand())
    const cur = createHash('sha256').update(JSON.stringify(sequence)).digest('hex')
    expect(
      cur,
      `A sequência do PRNG mudou. Se foi proposital, atualize REVIEWED_SEQUENCE_HASH para: ${cur}`,
    ).toBe(REVIEWED_SEQUENCE_HASH)
  })
})

describe('sem Math.random (US-146)', () => {
  it('o módulo não chama Math.random', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/adventure-seed.ts'), 'utf8')
    expect(source).not.toMatch(/Math\.random\(/)
  })
})
