'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useT } from '@/components/LocaleProvider'

const STORAGE_KEY = 'ai-dm-theme'

export function ThemeToggle() {
  const t = useT()
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    // US-46: reflete o tema realmente aplicado (script/ThemeProvider já resolveram
    // localStorage → prefers-color-scheme), para o ícone bater com a tela.
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  const label = isDark ? t('common.theme.toLight') : t('common.theme.toDark')
  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className="fixed top-4 right-4 z-50 flex size-11 items-center justify-center rounded-md border border-border bg-card/70 text-foreground backdrop-blur transition-colors hover:border-primary/60 hover:text-primary"
    >
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  )
}
