import { DEFAULT_LOCALE, isLocale, type Locale } from '@ai-dm/shared'

// US-97/US-98: nome do cookie de idioma, num módulo SEM React e SEM `next/headers` —
// é o que permite às três pontas usarem a mesma string: o LocaleProvider (cliente,
// que a escreve), o auth.ts (servidor, no callback `jwt`) e o layout.tsx (servidor,
// que emite o `lang` do <html>). Antes da US-98 havia duas cópias literais.
export const LOCALE_COOKIE = 'ai-dm-locale'

/** Locale a partir do valor cru do cookie. Ausente ou inválido → default do produto. */
export function localeFromCookie(value: string | undefined): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE
}
