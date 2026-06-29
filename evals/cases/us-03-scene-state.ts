import { describe, it, expect } from 'vitest'
import { mergeSceneState, formatSceneState } from '@ai-dm/ai-engine'
import type { SceneState } from '@ai-dm/shared'

// Eval case: US-03 — estado de cena estruturado (continuidade espacial).
// Reproduz o caso real "praça → recebe mapa da estrada → olhar o mapa" e
// valida a fonte de verdade determinística que sustenta a regra:
// - merge parcial (campos omitidos preservam o valor anterior)
// - inspecionar item carregado NÃO altera local/ambiente
// - objetos e conteúdo estabelecidos não mudam sem evento explícito

const praca: SceneState = {
  local: 'praça central de Willowdale',
  ambiente: 'externo',
  periodo: 'entardecer',
  presentes: ['Thorne (prefeito)'],
  objetos_em_cena: ['mapa da estrada', 'bolsa de provisões'],
  atualizadoEm: '2026-06-27T21:40:00Z',
}

describe('US-03 — estado de cena estruturado', () => {
  it('merge parcial: período muda, demais campos preservados', () => {
    const next = mergeSceneState(praca, { periodo: 'noite' })
    expect(next.periodo).toBe('noite')
    expect(next.local).toBe(praca.local)
    expect(next.ambiente).toBe('externo')
    expect(next.presentes).toEqual(praca.presentes)
    expect(next.objetos_em_cena).toEqual(praca.objetos_em_cena)
  })

  it('"olhar o mapa" (sem patch) NÃO move o personagem nem entra em ambiente interno', () => {
    // Inspecionar item carregado não chama updateScene; se chamasse com {} nada muda.
    const next = mergeSceneState(praca, {})
    expect(next.local).toBe('praça central de Willowdale')
    expect(next.ambiente).toBe('externo') // nunca vira "interno" / mesa / sala
    expect(next.objetos_em_cena).toContain('mapa da estrada') // conteúdo do mapa intacto
  })

  it('mudança legítima de cena: entrar na taverna vira interno', () => {
    const next = mergeSceneState(praca, {
      local: 'taverna O Dragão Sonolento',
      ambiente: 'interno',
      presentes: ['taverneira'],
    })
    expect(next.local).toBe('taverna O Dragão Sonolento')
    expect(next.ambiente).toBe('interno')
    expect(next.presentes).toEqual(['taverneira']) // lista substituída por completo
    expect(next.periodo).toBe('entardecer') // omitido → preservado
  })

  it('arrays informados substituem a lista inteira', () => {
    const next = mergeSceneState(praca, { presentes: [] })
    expect(next.presentes).toEqual([])
  })

  it('parte de estado nulo sem quebrar', () => {
    const next = mergeSceneState(null, { local: 'estrada', ambiente: 'externo' })
    expect(next.local).toBe('estrada')
    expect(next.presentes).toEqual([])
    expect(next.atualizadoEm).not.toBe('')
  })

  it('formatSceneState injeta ambiente e objetos como fonte de verdade', () => {
    const text = formatSceneState(praca)
    expect(text).toContain('ambiente: externo')
    expect(text).toContain('mapa da estrada')
  })

  it('formatSceneState vazio quando não há cena estabelecida', () => {
    expect(formatSceneState(null)).toBe('')
  })
})
