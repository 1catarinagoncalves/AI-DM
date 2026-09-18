import { describe, it, expect } from 'vitest'
import type { SceneState } from '@ai-dm/shared'
import { sceneMoveHint } from './scene'

const fenda: SceneState = {
  local: 'fenda na planície, junto ao basilisco',
  ambiente: 'externo',
  periodo: 'tarde',
  presentes: [],
  objetos_em_cena: [],
  atualizadoEm: '',
}

// 2026-09-18: o Mestre abria o turno JÁ no destino («Ariel Moon está na borda do círculo…»)
// e o trajeto nunca era narrado. `sceneMoveHint` é o que o `updateScene` devolve ao modelo
// logo antes de ele escrever a prosa — só quando o `local` de fato mudou.
describe('sceneMoveHint — instrução de trânsito no resultado do updateScene', () => {
  it('local mudou → devolve origem, destino e a ordem trânsito → chegada', () => {
    const depois = { ...fenda, local: 'Círculo de Cinzas' }
    const hint = sceneMoveHint(fenda, depois)
    expect(hint).not.toBeNull()
    expect(hint?.de).toBe('fenda na planície, junto ao basilisco')
    expect(hint?.para).toBe('Círculo de Cinzas')
    expect(hint?.instrucao).toMatch(/way there/i)
    expect(hint?.instrucao).toMatch(/(never|not)[^.]{0,30}open[^.]{0,30}destination/i)
  })

  it('local igual (só período mudou) → null', () => {
    expect(sceneMoveHint(fenda, { ...fenda, periodo: 'noite' })).toBeNull()
  })

  it('1ª colocação (cena anterior nula ou sem local) não é deslocamento → null', () => {
    expect(sceneMoveHint(null, fenda)).toBeNull()
    expect(sceneMoveHint({ ...fenda, local: '' }, fenda)).toBeNull()
  })

  it('diferença só de espaço nas pontas não conta como mover', () => {
    expect(sceneMoveHint(fenda, { ...fenda, local: `  ${fenda.local} ` })).toBeNull()
  })
})
