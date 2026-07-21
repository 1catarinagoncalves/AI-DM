'use client'

import { signIn } from 'next-auth/react'

// US-61: tela de login. "Entrar com Google" abre o fluxo OAuth do Auth.js e volta
// ao app autenticado. É a única porta (D3): sem sessão, o middleware traz para cá.
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-amber-50 dark:bg-stone-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div>
          <p className="text-5xl mb-4" aria-hidden="true">⚔</p>
          <h1 className="text-3xl font-bold text-amber-600 dark:text-amber-400">AI Dungeon Master</h1>
          <p className="text-stone-600 dark:text-stone-400 mt-2">
            Entra com a tua conta para os teus personagens te seguirem em qualquer dispositivo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => signIn('google', { redirectTo: '/' })}
          className="w-full inline-flex items-center justify-center gap-3 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 hover:border-amber-500 text-stone-900 dark:text-white font-semibold rounded-lg px-6 py-3 transition-colors"
        >
          <span aria-hidden="true">🇬</span>
          Entrar com Google
        </button>
      </div>
    </div>
  )
}
