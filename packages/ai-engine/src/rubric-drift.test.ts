import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { NARRATIVE_CRAFT_SECTION } from './prompts/dm-system'
import { DIMENSIONS } from './rubric'

// Guard de drift (US-36): a barra de ofício (dm-system.ts) e a rubrica
// (DIMENSIONS em rubric.ts) são DUAS fontes de verdade da mesma "barra de
// qualidade". Se a barra ganha uma exigência e a rubrica não acompanha, o eval
// passa a medir uma barra velha — regressão silenciosa da própria rede de
// segurança. Este teste falha quando a barra muda sem a rubrica ser revista.
//
// Const hardcoded (não toMatchSnapshot): snapshot convida ao reflexo `-u`, que
// regrava sem pensar — justamente o que se quer impedir. Atualizar o hash À MÃO
// É o "eu revisei a rubrica contra a barra nova".
//
// Ao MUDAR a barra de propósito:
//   1. revise DIMENSIONS em rubric.ts (a rubrica precisa cobrir a exigência nova);
//   2. cole o novo hash (a mensagem de erro imprime o valor atual) em REVIEWED_CRAFT_HASH.
const REVIEWED_CRAFT_HASH = '18c7c9670586346f11a4434fb466ebdb8aa67f2af5ad1b494dadf93b612892c8'

describe('drift da barra de ofício vs rubrica (US-36)', () => {
  it('a barra de ofício não mudou sem revisão da rubrica', () => {
    const cur = createHash('sha256').update(NARRATIVE_CRAFT_SECTION).digest('hex')
    expect(
      cur,
      `A barra de ofício (NARRATIVE_CRAFT_SECTION) mudou. Revise DIMENSIONS em rubric.ts e atualize REVIEWED_CRAFT_HASH para: ${cur}`,
    ).toBe(REVIEWED_CRAFT_HASH)
  })

  it('a rubrica cobre os eixos da barra atual da US-34', () => {
    // Barreira mínima de cobertura: os eixos que a barra exige explicitamente.
    const keys = DIMENSIONS.map((d) => d.key)
    for (const k of ['sensorial', 'concretude', 'onomastica', 'identidade', 'tensao', 'vozNpc', 'ritmo', 'agencia', 'linguaPt'] as const) {
      expect(keys, `rubrica sem a dimensão "${k}" da barra de ofício`).toContain(k)
    }
  })
})
