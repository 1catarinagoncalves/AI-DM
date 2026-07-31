import type { Locale } from '@ai-dm/shared'
import { ptBR, type MessageKey } from './pt-BR'
import { enUS } from './en-US'

// US-98: resolução de mensagem. Módulo PURO, sem React de propósito — é o que
// permite ao `metadata` e ao `lang` do <html> (componentes de SERVIDOR) indexarem
// o mesmo dicionário que as telas do cliente. O hook `useT` vive no LocaleProvider,
// que já é 'use client' e já é dono do locale ativo.
//
// Sem lib de i18n: são 2 idiomas, sem plural complexo nem formatação de data/moeda.
// `next-intl` e afins cobram roteamento por locale (`/en/...`), e aqui o idioma vem
// do `User.locale`, não da URL (D1 do ADR 005).
const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = {
  'pt-BR': ptBR,
  'en-US': enUS,
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

/** Substitui `{nome}` pelos valores; placeholder sem valor fica visível (não vira "undefined"). */
function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = DICTIONARIES[locale][key]
  return vars ? fill(text, vars) : text
}

/** Tradutor preso a um locale — para o servidor, onde não há contexto de React. */
export function messagesFor(locale: Locale): Translate {
  return (key, vars) => translate(locale, key, vars)
}

export type { MessageKey }
