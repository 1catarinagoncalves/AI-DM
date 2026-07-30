'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { DEFAULT_LOCALE, resolveLocale, type Locale } from '@ai-dm/shared'
import { api } from '@/lib/api'

// US-97: idioma ativo da mesa. Escada de resolução em UM lugar só (duas cópias
// divergem no primeiro default que mudar):
//   conta (User.locale, via sessão) → localStorage → navigator.language → pt-BR
// Antes do login não há conta: a escolha vive no localStorage e sobe para a conta no
// primeiro /auth/sync. Ela é espelhada num COOKIE porque o `localStorage` não existe
// no servidor, e o sync corre no callback `jwt` do Auth.js (auth.ts) — sem o cookie,
// o visitante que escolheu English antes de entrar veria a conta nascer em pt-BR.
export const LOCALE_STORAGE_KEY = 'ai-dm-locale'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

function rememberLocale(locale: Locale) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
}

interface LocaleContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
  /**
   * Quantas vezes o JOGADOR trocou de idioma nesta sessão. É o gatilho do aviso no
   * chat (US-97): a resolução inicial (SSR → localStorage/browser) muda o `locale`
   * sem ninguém ter escolhido nada, e observar só o valor faria a pílula aparecer
   * sozinha ao abrir a mesa.
   */
  switches: number
}

const LocaleContext = createContext<LocaleContextValue>({ locale: DEFAULT_LOCALE, setLocale: () => {}, switches: 0 })

export function useLocale() {
  return useContext(LocaleContext)
}

function storedLocale(): Locale | null {
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
  return saved ? resolveLocale(saved) : null
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // SSR renderiza sempre no default (não há localStorage no servidor); o efeito
  // abaixo corrige no primeiro paint do cliente, como o ThemeProvider já faz.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [switches, setSwitches] = useState(0)
  const { data: session } = useSession()
  const accountLocale = session?.locale

  useEffect(() => {
    // A conta manda: é ela que faz a preferência seguir o jogador para outro
    // aparelho. Sem conta, o palpite local (localStorage → browser).
    const next = accountLocale ? resolveLocale(accountLocale) : storedLocale() ?? resolveLocale(navigator.language)
    setLocaleState(next)
    rememberLocale(next)
  }, [accountLocale])

  // US-46: o leitor de tela escolhe a voz pelo `lang` do <html>. Sem isto, inglês
  // seria lido com voz portuguesa.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState((current) => {
        if (current !== next) setSwitches((n) => n + 1)
        return next
      })
      rememberLocale(next)
      // Autenticado → a conta é a fonte de verdade e precisa acompanhar. Falha de
      // rede não desfaz a escolha local: o jogador já está a jogar no idioma novo.
      if (session?.userId) api.setLocale(next).catch(() => {})
    },
    [session?.userId],
  )

  return <LocaleContext.Provider value={{ locale, setLocale, switches }}>{children}</LocaleContext.Provider>
}
