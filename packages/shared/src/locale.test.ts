import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, LOCALES, isLocale, localeLabel, resolveLocale } from './locale'

describe('resolveLocale (US-97)', () => {
  it('devolve o locale exato quando já é um dos suportados', () => {
    expect(resolveLocale('pt-BR')).toBe('pt-BR')
    expect(resolveLocale('en-US')).toBe('en-US')
  })

  it('casa pela SUBTAG de idioma, não pela string inteira', () => {
    // O browser devolve en-GB/pt-PT/en — comparar por igualdade mandaria pt-PT para o inglês.
    expect(resolveLocale('pt')).toBe('pt-BR')
    expect(resolveLocale('pt-PT')).toBe('pt-BR')
    expect(resolveLocale('en')).toBe('en-US')
    expect(resolveLocale('en-GB')).toBe('en-US')
  })

  it('manda qualquer idioma não-português para o inglês (base nativa dos dados)', () => {
    expect(resolveLocale('fr-FR')).toBe('en-US')
    expect(resolveLocale('es')).toBe('en-US')
  })

  it('cai no default pt-BR sem valor nenhum', () => {
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE)
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE)
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE)
    expect(DEFAULT_LOCALE).toBe('pt-BR')
  })

  it('ignora caixa e espaços — o browser não promete formato', () => {
    expect(resolveLocale(' PT-br ')).toBe('pt-BR')
    expect(resolveLocale('EN')).toBe('en-US')
  })
})

describe('isLocale', () => {
  it('aceita só as chaves canônicas, não a subtag solta', () => {
    expect(isLocale('pt-BR')).toBe(true)
    expect(isLocale('en-US')).toBe(true)
    expect(isLocale('en')).toBe(false)
    expect(isLocale('pt-PT')).toBe(false)
  })
})

describe('localeLabel', () => {
  it('nomeia cada idioma NA PRÓPRIA língua — quem não lê a interface reconhece o seu', () => {
    expect(localeLabel('pt-BR')).toBe('Português')
    expect(localeLabel('en-US')).toBe('English')
  })

  it('LOCALES lista os dois na ordem em que o seletor os mostra', () => {
    expect(LOCALES).toEqual(['pt-BR', 'en-US'])
  })
})
