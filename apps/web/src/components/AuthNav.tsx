'use client'

import { useSession, signOut } from 'next-auth/react'

// US-61: controlo de sessão global (canto superior). Só aparece autenticado; sai
// da conta e volta a /login. Fica no layout para não acoplar às telas de jogo.
export function AuthNav() {
  const { data, status } = useSession()
  if (status !== 'authenticated') return null
  return (
    // US-66: à esquerda do ThemeToggle (fixo em right-4, 40px de largura) para os dois
    // não se sobreporem no canto — right-16 abre a folga do botão de tema.
    <div className="fixed top-4 right-16 z-40 flex items-center gap-2 text-xs">
      {data?.user?.email && (
        <span className="hidden sm:inline text-stone-600 dark:text-stone-400">{data.user.email}</span>
      )}
      <button
        type="button"
        onClick={() => signOut({ redirectTo: '/login' })}
        className="min-h-[36px] px-3 rounded-lg border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:border-amber-500 transition-colors"
      >
        Sair
      </button>
    </div>
  )
}
