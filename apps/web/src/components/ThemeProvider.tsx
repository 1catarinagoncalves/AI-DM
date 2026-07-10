'use client'

import { useEffect } from 'react'

const STORAGE_KEY = 'ai-dm-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // US-46: sem escolha salva, respeita o prefers-color-scheme do sistema
    // (mesma regra do script inline do layout — não voltar a forçar 'dark').
    const saved = localStorage.getItem(STORAGE_KEY)
    const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  return <>{children}</>
}
