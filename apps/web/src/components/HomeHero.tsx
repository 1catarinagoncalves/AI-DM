'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { loadSession } from '@/lib/session'

type HubCharacter = Awaited<ReturnType<typeof api.listCharacters>>[number]

const emptyState = (
  <div className="text-center max-w-lg">
    <p className="text-5xl mb-4">⚔</p>
    <h1 className="text-4xl font-bold text-amber-600 dark:text-amber-400 mb-2">Olá, Aventureiro</h1>
    <p className="text-stone-500 dark:text-stone-400 text-lg mb-2">Você ainda não tem nenhum personagem.</p>
    <p className="text-stone-400 dark:text-stone-500 mb-8">Crie seu primeiro personagem para começar a jogar.</p>
    <Link
      href="/setup"
      className="inline-block bg-amber-600 hover:bg-amber-500 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors"
    >
      Criar meu personagem
    </Link>
  </div>
)

export function HomeHero() {
  // userId/userName do localStorage são só atalho — o branch vazio/preenchido vem da API.
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('Aventureiro')
  const [characters, setCharacters] = useState<HubCharacter[] | null>(null)
  const [focus, setFocus] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [ready, setReady] = useState(false)

  function fetchCharacters(uid: string) {
    setError(false)
    setCharacters(null)
    api.listCharacters(uid)
      .then((list) => { setCharacters(list); setFocus(0) })
      .catch(() => setError(true))
  }

  // ponytail: window.confirm no MVP, trocar por modal se o design pedir
  function handleDelete(c: HubCharacter) {
    if (!window.confirm(`Deletar ${c.name}? Esta ação não pode ser desfeita.`)) return
    setDeleteError(false)
    api.deleteCharacter(c.id)
      .then(() => {
        const list = characters ?? []
        const focusedId = list[focus]?.id
        const next = list.filter((x) => x.id !== c.id)
        setCharacters(next)
        // Re-foca: se o em foco foi apagado, cai no topo (último jogado); senão segue nele.
        setFocus(focusedId === c.id ? 0 : Math.max(0, next.findIndex((x) => x.id === focusedId)))
      })
      .catch(() => setDeleteError(true))
  }

  useEffect(() => {
    const session = loadSession()
    if (session?.userName) setUserName(session.userName)
    if (session?.userId) {
      setUserId(session.userId)
      fetchCharacters(session.userId)
    }
    setReady(true)
  }, [])

  if (!ready) return null

  // Sem userId (visitante novo, nunca criou usuário) → estado vazio direto.
  if (!userId) return emptyState

  if (error) {
    return (
      <div className="text-center max-w-lg">
        <p className="text-5xl mb-4">⚔</p>
        <h1 className="text-4xl font-bold text-amber-600 dark:text-amber-400 mb-2">AI Dungeon Master</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-8">Não foi possível carregar seus personagens.</p>
        <button
          onClick={() => fetchCharacters(userId)}
          className="inline-block bg-amber-600 hover:bg-amber-500 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors"
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  if (characters === null) {
    return <p className="text-stone-400 dark:text-stone-500 animate-pulse">Carregando seus personagens…</p>
  }

  if (characters.length === 0) return emptyState

  const hero = characters[focus] ?? characters[0]!
  const adventure = hero.currentAdventure

  return (
    <div className="text-center max-w-lg">
      <p className="text-5xl mb-4">⚔</p>
      <h1 className="text-4xl font-bold text-amber-600 dark:text-amber-400 mb-2">AI Dungeon Master</h1>
      <p className="text-stone-500 dark:text-stone-400 mb-6">
        Bem-vindo de volta, <span className="text-stone-900 dark:text-white font-semibold">{userName}</span>.
      </p>

      <div className="border border-stone-200 dark:border-stone-800 rounded-lg p-4 mb-8 bg-white/50 dark:bg-stone-900/50">
        <p className="text-stone-900 dark:text-white font-semibold text-lg">{hero.name}</p>
        <p className="text-stone-400 dark:text-stone-500 text-sm">
          {hero.race} · {hero.class} · Nv.{hero.level}
        </p>
        {adventure && (
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-2">
            Aventura: <span className="text-stone-700 dark:text-stone-300">{adventure.title}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {adventure ? (
          <Link
            href={`/play/${adventure.id}?characterId=${hero.id}`}
            className="inline-block bg-amber-600 hover:bg-amber-500 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors"
          >
            Continuar jogando
          </Link>
        ) : (
          <span className="inline-block bg-stone-300 dark:bg-stone-700 text-stone-500 dark:text-stone-400 font-semibold px-8 py-3 rounded-lg text-lg cursor-not-allowed">
            Nenhuma aventura em andamento
          </span>
        )}
        <Link
          href="/setup"
          className="inline-block border border-stone-400 dark:border-stone-600 hover:border-stone-600 dark:hover:border-stone-400 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white font-semibold px-8 py-2 rounded-lg transition-colors text-sm"
        >
          Criar novo personagem
        </Link>

        <button
          onClick={() => handleDelete(hero)}
          className="text-red-500/70 hover:text-red-600 dark:hover:text-red-400 text-sm transition-colors"
        >
          Deletar {hero.name}
        </button>

        {deleteError && (
          <p className="text-red-500 text-sm">Não foi possível deletar o personagem. Tente de novo.</p>
        )}

        {characters.length > 1 && (
          <div>
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-stone-400 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-400 text-xs transition-colors"
            >
              Ver todos os personagens
            </button>
            {showAll && (
              <ul className="mt-3 flex flex-col gap-1">
                {characters.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-1">
                    <button
                      onClick={() => { setFocus(i); setShowAll(false) }}
                      className={`flex-1 text-sm px-3 py-2 rounded-lg transition-colors ${
                        i === focus
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      {c.name} · {c.race} · {c.class} · Nv.{c.level}
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      aria-label={`Deletar ${c.name}`}
                      className="px-2 py-2 text-stone-400 hover:text-red-600 dark:hover:text-red-400 text-sm transition-colors"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
