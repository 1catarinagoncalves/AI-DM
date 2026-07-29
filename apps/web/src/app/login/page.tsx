'use client'

import { signIn } from 'next-auth/react'
import { Logo, Panel, SceneFrame } from '@/components/ui/dm'

// US-61: tela de login. "Entrar com Google" abre o fluxo OAuth do Auth.js e volta
// ao app autenticado. É a única porta (D3): sem sessão, o middleware traz para cá.
export default function LoginPage() {
  return (
    <SceneFrame scene="/scenes/gate-entrance.png" dim="medium">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Panel className="w-full max-w-md p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Logo className="size-14" />
          </div>
          <h1 className="text-shadow-fantasy font-serif text-3xl font-bold tracking-wide text-primary">
            AI Dungeon Master
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
            Entra com a tua conta para os teus personagens te seguirem em qualquer dispositivo.
          </p>
          <button
            type="button"
            onClick={() => signIn('google', { redirectTo: '/' })}
            className="mt-7 inline-flex min-h-[44px] w-full items-center justify-center gap-3 rounded-md border border-border bg-card/80 px-5 py-3 text-sm font-semibold text-foreground shadow-lg backdrop-blur transition-all hover:border-primary/60 hover:bg-card active:translate-y-px"
          >
            <GoogleIcon className="size-5" />
            Entrar com Google
          </button>
        </Panel>
      </div>
    </SceneFrame>
  )
}

// Marca do Google — as cores são as oficiais e por isso ficam fora dos tokens
// (é logotipo de terceiro, não superfície do produto).
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  )
}
