// Magias conhecidas (US-42, US-50): regra pura, partilhada pelo prompt do mestre
// (ai-engine) e pela ficha do jogador (web). Fonte ÚNICA do rótulo: duplicada, o
// prompt podia dizer "nível 0" e a ficha "truque" para a mesma magia.
import { DEFAULT_LOCALE, type Locale } from './locale'

// US-100: o rótulo passa a acompanhar o locale. A US-100 moveu o NOME da magia para o config do
// idioma ativo e deixou este sufixo para trás — uma mesa em inglês lia "Sacred Flame (truque)".
// `Record<Locale, …>` de propósito: locale novo não compila até ter as duas palavras, em vez de
// cair no português em silêncio (que é justamente o defeito que esta linha conserta).
const SPELL_LEVEL_WORDS: Record<Locale, { cantrip: string; level: string }> = {
  'pt-BR': { cantrip: 'truque', level: 'nível' },
  'en-US': { cantrip: 'cantrip', level: 'level' },
}

/**
 * Rótulo de nível de uma magia: 0 → "truque"/"cantrip", ≥1 → "nível N"/"level N", ausente → sem
 * rótulo. Sem `locale` cai no pt-BR (DEFAULT_LOCALE) — os dois chamadores o passam explicitamente,
 * e o default existe só para não fazer de um argumento esquecido um erro de tipo silencioso.
 */
export function spellLevelLabel(level?: number, locale: Locale = DEFAULT_LOCALE): string {
  if (level == null) return ''
  const words = SPELL_LEVEL_WORDS[locale]
  return level === 0 ? words.cantrip : `${words.level} ${level}`
}
