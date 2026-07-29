import { describe, it, expect } from 'vitest'
import { mergeSceneState, formatSceneState, overlapRatio, REPLAY_OVERLAP_THRESHOLD } from '@ai-dm/ai-engine'
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

// US-71 — regressão determinística do bug de REPLAY DE TRANSIÇÃO (descrito em
// docs/sdlc/01-requisitos/US-71-simplificar-localizacao-do-personagem.md).
// Turno 1: a personagem chega à forja e Hélio a saúda. Turno 2 só CONTINUA a conversa.
// O comportamento ANTIGO re-narra a chegada inteira (mesma saudação) → sobreposição de
// trigramas alta contra a narração do turno 1. O NOVO responde ali mesmo, sem replay →
// sobreposição baixa. `overlapRatio` + `REPLAY_OVERLAP_THRESHOLD` separam os dois. Custo
// zero, sem LLM (o A/B com modelo real vive em `packages/ai-engine/location-ab-bakeoff.mjs`).
describe('US-71 — replay de transição (detector determinístico)', () => {
  const narrTurno1 =
    'Você se despede de Elara na capela e atravessa a rua de terra batida até a forja de Hélio. ' +
    'O calor da fornalha bate no rosto assim que você cruza a porta. Hélio ergue os olhos da bigorna, ' +
    'martelo suspenso no ar. — Anetra! Achei que a menina ia passar o dia na capela. Vai sair?'

  // ANTIGO: re-narra a viagem e a chegada do turno 1 quase idêntica antes de continuar.
  const narrTurno2_ANTIGO =
    'Você se despede de Elara na capela e atravessa a rua de terra batida até a forja de Hélio. ' +
    'O calor da fornalha bate no rosto assim que você cruza a porta. Hélio ergue os olhos da bigorna, ' +
    'martelo suspenso no ar. — Anetra! Achei que a menina ia passar o dia na capela. Vai sair? ' +
    '— Vou ao Pântano de Ossos — você diz. Ele baixa o martelo devagar.'

  // NOVO: começa DENTRO da cena, sem rebobinar a chegada.
  const narrTurno2_NOVO =
    '— Vou ao Pântano de Ossos — você diz, e a palavra parece esfriar a fornalha. ' +
    'Hélio pousa o martelo na bigorna e limpa as mãos no avental de couro, o rosto de repente sério. ' +
    '— Aquele lugar engoliu gente melhor que você, menina. O que foi procurar lá?'

  it('ANTIGO (replay) dispara acima do limiar; NOVO (continuação) fica abaixo', () => {
    const antigo = overlapRatio(narrTurno2_ANTIGO, narrTurno1)
    const novo = overlapRatio(narrTurno2_NOVO, narrTurno1)
    expect(antigo).toBeGreaterThan(REPLAY_OVERLAP_THRESHOLD)
    expect(novo).toBeLessThan(REPLAY_OVERLAP_THRESHOLD)
    expect(antigo).toBeGreaterThan(novo)
  })

  it('overlapRatio é 0 quando a nova narração tem menos de um trigrama', () => {
    expect(overlapRatio('Vai', narrTurno1)).toBe(0)
    expect(overlapRatio('', narrTurno1)).toBe(0)
  })
})
