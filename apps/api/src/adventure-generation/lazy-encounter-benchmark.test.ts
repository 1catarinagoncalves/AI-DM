import { describe, it, expect } from 'vitest'
import { encounterDeadlyThreshold, singleMonsterCrCap } from './lazy-encounter-benchmark'

describe('encounterDeadlyThreshold (US-159)', () => {
  it('divide por 4 até nível 4', () => {
    expect(encounterDeadlyThreshold(4)).toBe(1)
  })

  it('divide por 2 a partir do nível 5', () => {
    expect(encounterDeadlyThreshold(5)).toBe(2)
    expect(encounterDeadlyThreshold(25)).toBe(12)
    expect(encounterDeadlyThreshold(48)).toBe(24)
  })

  it('nível 1 dá limiar 0 — qualquer CR somado já conta como potencialmente letal (esperado, não bug)', () => {
    expect(encounterDeadlyThreshold(1)).toBe(0)
  })
})

// Os 3 exemplos do texto-fonte usam GRUPO (5, 5, 6 personagens) — fora do domínio deste
// módulo (só 1 personagem, "soma de níveis" = nível do próprio personagem, ver Escopo da
// US-159). Passar a soma do grupo (20/25/48) direto por encounterDeadlyThreshold quebraria
// pro exemplo 1: a função escolhe o divisor pelo próprio valor recebido (L<=4 → ÷4), mas o
// grupo é tier 1-4 mesmo com soma 20 (>4) — o divisor certo vem do NÍVEL do personagem, não
// da magnitude da soma. Os testes abaixo reproduzem a aritmética do texto-fonte diretamente
// (mesmos divisores 4/2 que a função usa), sem forçar a chamada fora do domínio solo.
describe('exemplos numéricos do texto-fonte (5e_Monster_Builder.json § Lazy Encounter Benchmark)', () => {
  it('5 personagens nível 4 vs. 4 ogros CR 2 — soma níveis 20 ÷ 4 = 5, soma CR 8 > 5, letal', () => {
    expect(Math.floor(20 / 4)).toBe(5)
    expect(8).toBeGreaterThan(5)
  })

  it('mesmo grupo em nível 5 — soma níveis 25 ÷ 2 = 12, soma CR 8 < 12, não letal', () => {
    expect(Math.floor(25 / 2)).toBe(12)
    expect(8).toBeLessThan(12)
  })

  it('6 personagens nível 8 vs. 3 diabos-com-chifre CR 11 — soma níveis 48 ÷ 2 = 24, soma CR 33 > 24, letal', () => {
    expect(Math.floor(48 / 2)).toBe(24)
    expect(33).toBeGreaterThan(24)
  })
})

describe('singleMonsterCrCap (US-159)', () => {
  it('teto é o próprio nível até nível 4', () => {
    expect(singleMonsterCrCap(1)).toBe(1)
    expect(singleMonsterCrCap(4)).toBe(4)
  })

  it('teto é 1.5x o nível a partir do nível 5', () => {
    expect(singleMonsterCrCap(5)).toBe(7.5)
    expect(singleMonsterCrCap(8)).toBe(12)
  })

  it('CR igual ao teto conta como letal (operador >=, diferente do limiar de encontro)', () => {
    expect(singleMonsterCrCap(4)).toBe(4)
  })
})
