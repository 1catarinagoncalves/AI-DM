'use client'

import { useEffect } from 'react'

const STORAGE_KEY = 'ai-dm-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? 'dark'
    document.documentElement.classList.toggle('dark', saved === 'dark')
  }, [])

  return <>{children}</>
}
