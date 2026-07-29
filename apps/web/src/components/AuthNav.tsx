'use client'

import { useSession, signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

// US-61: controlo de sessão global (canto superior). Só aparece autenticado; sai
// da conta e volta a /login. Fica no layout para não acoplar às telas de jogo.
export function AuthNav() {
  const { status } = useSession()
  if (status !== 'authenticated') return null
  return (
    // US-66: à esquerda do ThemeToggle (fixo em right-4, 40px de largura) para os dois
    // não se sobreporem no canto — right-16 abre a folga do botão de tema.
    <div className="fixed top-4 right-16 z-40 flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={() => signOut({ redirectTo: '/login' })}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-card/70 px-3 font-medium text-foreground backdrop-blur transition-colors hover:border-primary/60 hover:text-primary"
      >
        <LogOut className="size-3.5" aria-hidden />
        Sair
      </button>
    </div>
  )
}
