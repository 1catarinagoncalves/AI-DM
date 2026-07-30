// US-97: locale como preferência do jogador (ADR 005). Duas chaves de primeira
// classe, ambas na forma `idioma-REGIÃO` — `en-US` é a base nativa dos dados
// (dataset SRD em inglês) e `pt-BR` é a localização por overlay.
export const LOCALES = ['pt-BR', 'en-US'] as const

export type Locale = (typeof LOCALES)[number]

/** Fallback quando não há preferência nenhuma — e o default da coluna `User.locale`. */
export const DEFAULT_LOCALE: Locale = 'pt-BR'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Normaliza qualquer origem de idioma (coluna do banco, localStorage,
 * `navigator.language`) para uma das chaves suportadas.
 *
 * Casa pela SUBTAG de idioma, nunca pela string inteira: o browser devolve
 * `en-GB`, `pt-PT`, `en` — comparar por igualdade erraria em quase todos e
 * mandaria um jogador português para o inglês. Sem valor → `pt-BR`; qualquer
 * idioma que não seja português → `en-US`.
 */
export function resolveLocale(input?: string | null): Locale {
  const tag = (input ?? '').trim().toLowerCase()
  if (!tag) return DEFAULT_LOCALE
  return tag.split('-')[0] === 'pt' ? 'pt-BR' : 'en-US'
}

/** Nome do idioma NA PRÓPRIA língua: quem não lê a interface reconhece o seu. */
export function localeLabel(locale: Locale): string {
  return locale === 'pt-BR' ? 'Português' : 'English'
}

/** Nome do idioma em inglês, para instruir o modelo (o prompt é escrito em EN). */
export function localeNameForPrompt(locale: Locale): string {
  return locale === 'pt-BR' ? 'Brazilian Portuguese (pt-BR)' : 'English'
}
