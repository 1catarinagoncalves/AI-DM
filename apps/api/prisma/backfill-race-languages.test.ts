// US-214 — regressão do backfill. Só o cálculo puro entra aqui (mesmo corte de
// migrate-race-class-keys.test.ts): a escrita no banco é I/O, o erro mora no cálculo.
import { describe, it, expect } from 'vitest'
import { computeBackfill } from './backfill-race-languages'

describe('computeBackfill (US-214)', () => {
  it('soma o idioma fixo da raça a `languages`, sem tocar em `features` sem chave obsoleta', () => {
    const result = computeBackfill({ race: 'hill-dwarf', languages: [], features: ['darkvision'] })
    expect(result).toEqual({ languages: ['common', 'dwarvish'], features: ['darkvision'] })
  })

  it('não duplica idioma já persistido (ex.: high-elf com a escolha extra já gravada)', () => {
    const result = computeBackfill({ race: 'high-elf', languages: ['draconic'], features: [] })
    expect(result).toEqual({ languages: ['draconic', 'common', 'elvish'], features: [] })
  })

  it('remove só "languages"/"extra-language" de `features`, preserva as demais chaves e a ordem', () => {
    const result = computeBackfill({
      race: 'high-elf',
      languages: ['common', 'elvish'],
      features: ['ability-score-increase', 'languages', 'darkvision', 'extra-language', 'cantrip'],
    })
    expect(result!.features).toEqual(['ability-score-increase', 'darkvision', 'cantrip'])
  })

  it('raça sem entrada em RACE_LANGUAGES (fora do catálogo jogável) não quebra, fixedLanguages vazio', () => {
    const result = computeBackfill({ race: 'goliath', languages: [], features: ['x'] })
    expect(result).toBeNull()
  })

  it('ficha já migrada (idioma fixo presente, sem chave obsoleta em features) devolve null — idempotente', () => {
    const result = computeBackfill({ race: 'human', languages: ['common'], features: ['darkvision'] })
    expect(result).toBeNull()
  })

  it('rodar duas vezes seguidas: o resultado da 1ª chamada não muda mais na 2ª', () => {
    const first = computeBackfill({ race: 'tiefling', languages: [], features: ['languages', 'darkvision'] })
    expect(first).toEqual({ languages: ['common', 'infernal'], features: ['darkvision'] })
    const second = computeBackfill({ race: 'tiefling', languages: first!.languages, features: first!.features })
    expect(second).toBeNull()
  })

  it('`languages`/`features` ausentes (null, ficha bem antiga) tratados como array vazio', () => {
    const result = computeBackfill({ race: 'dragonborn', languages: null, features: null })
    expect(result).toEqual({ languages: ['common', 'draconic'], features: [] })
  })
})
