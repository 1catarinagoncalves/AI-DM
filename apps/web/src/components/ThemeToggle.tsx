'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ai-dm-theme'

export function ThemeToggle() {
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

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Mudar para modo claro' : 'Mudar para modo noturno'}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo noturno'}
      className="fixed top-4 right-4 z-50 w-10 h-10 rounded-lg border transition-colors
        bg-stone-200 border-stone-300 text-stone-600 hover:bg-stone-300
        dark:bg-stone-800 dark:border-stone-700 dark:text-amber-400 dark:hover:bg-stone-700
        flex items-center justify-center shadow-md"
    >
      <span aria-hidden="true">{isDark ? '☀' : '🌙'}</span>
    </button>
  )
}
