'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadSession, clearSession, type GameSession } from '@/lib/session'

export function HomeHero() {
  const [session, setSession] = useState<GameSession | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSession(loadSession())
    setReady(true)
  }, [])

  if (!ready) return null

  if (session?.adventureId) {
    return (
      <div className="text-center max-w-lg">
        <p className="text-5xl mb-4">⚔</p>
        <h1 className="text-4xl font-bold text-amber-400 mb-2">AI Dungeon Master</h1>
        <p className="text-stone-400 mb-2">Bem-vindo de volta, <span className="text-white font-semibold">{session.userName}</span>.</p>
        <p className="text-stone-500 text-sm mb-8">
          Personagem: <span className="text-stone-300">{session.characterName}</span>
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href={`/play/${session.adventureId}?characterId=${session.characterId}`}
            className="inline-block bg-amber-600 hover:bg-amber-500 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors"
          >
            Continuar aventura
          </Link>
          <Link
            href="/setup"
            className="inline-block border border-stone-600 hover:border-stone-400 text-stone-400 hover:text-white font-semibold px-8 py-2 rounded-lg transition-colors text-sm"
          >
            Nova aventura com {session.characterName}
          </Link>
          <button
            onClick={() => { clearSession(); setSession(null) }}
            className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
          >
            Trocar de personagem
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center max-w-lg">
      <p className="text-5xl mb-4">⚔</p>
      <h1 className="text-4xl font-bold text-amber-400 mb-2">AI Dungeon Master</h1>
      <p className="text-stone-400 text-lg mb-8">
        Um mestre de RPG movido por inteligência artificial. Cada aventura é única.
      </p>
      <Link
        href="/setup"
        className="inline-block bg-amber-600 hover:bg-amber-500 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors"
      >
        Começar aventura
      </Link>
    </div>
  )
}
