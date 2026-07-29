'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { DmButton, Logo, Panel, dmButtonClass } from '@/components/ui/dm'

type HubCharacter = Awaited<ReturnType<typeof api.listCharacters>>[number]

// Cabeçalho comum aos três estados do hub (vazio, erro, com personagem).
function HubHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <>
      <div className="mb-4 flex justify-center">
        <Logo className="size-14" />
      </div>
      <h1 className="text-shadow-fantasy font-serif text-3xl font-bold tracking-wide text-primary sm:text-4xl">
        {title}
      </h1>
      {children}
    </>
  )
}

const emptyState = (
  <div className="w-full max-w-md text-center">
    <HubHeading title="Olá, Aventureiro">
      <p className="mt-3 text-sm text-muted-foreground">Você ainda não tem nenhum personagem.</p>
      <p className="mt-1 text-sm text-muted-foreground">Crie seu primeiro personagem para começar a jogar.</p>
    </HubHeading>
    <Link href="/setup" className={dmButtonClass('primary', 'mt-7 w-full py-3 text-base')}>
      Criar meu personagem
    </Link>
  </div>
)

export function HomeHero() {
  // US-61: a lista vem da conta autenticada (token) — sem userId no cliente.
  const [characters, setCharacters] = useState<HubCharacter[] | null>(null)
  const [focus, setFocus] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  function fetchCharacters() {
    setError(false)
    setCharacters(null)
    api.listCharacters()
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
    fetchCharacters()
  }, [])

  if (error) {
    return (
      <div className="w-full max-w-md text-center">
        <HubHeading title="AI Dungeon Master">
          <p className="mt-3 text-sm text-muted-foreground">Não foi possível carregar seus personagens.</p>
        </HubHeading>
        <DmButton onClick={() => fetchCharacters()} className="mt-7 w-full py-3 text-base">
          Tentar de novo
        </DmButton>
      </div>
    )
  }

  if (characters === null) {
    return <p className="animate-pulse text-sm text-muted-foreground">Carregando seus personagens…</p>
  }

  if (characters.length === 0) return emptyState

  const hero = characters[focus] ?? characters[0]!
  const adventure = hero.currentAdventure

  return (
    <div className="w-full max-w-md text-center">
      <HubHeading title="AI Dungeon Master">
        <p className="mt-2 text-sm text-muted-foreground">
          Bem-vindo de volta, <span className="font-semibold text-parchment">Aventureiro</span>.
        </p>
      </HubHeading>

      <Panel className="mt-6 p-5 text-left">
        <p className="font-serif text-lg font-semibold text-parchment">{hero.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {hero.race} · {hero.class} · Nv.{hero.level}
        </p>
        {adventure && (
          <p className="mt-2 text-sm text-foreground">
            Aventura: <span className="text-accent">{adventure.title}</span>
          </p>
        )}
      </Panel>

      <div className="mt-5 flex flex-col gap-2.5">
        {adventure ? (
          <Link
            href={`/play/${adventure.id}?characterId=${hero.id}`}
            className={dmButtonClass('primary', 'w-full py-3 text-base')}
          >
            Continuar jogando
          </Link>
        ) : (
          <span className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-border bg-muted px-5 py-3 text-base font-semibold text-muted-foreground">
            Nenhuma aventura em andamento
          </span>
        )}
        <Link href="/setup" className={dmButtonClass('ghost', 'w-full')}>
          Criar novo personagem
        </Link>

        <DmButton variant="danger" onClick={() => handleDelete(hero)} className="text-xs font-medium">
          Deletar {hero.name}
        </DmButton>

        {deleteError && (
          <p className="text-sm text-destructive">Não foi possível deletar o personagem. Tente de novo.</p>
        )}

        {characters.length > 1 && (
          <div>
            <button
              onClick={() => setShowAll((v) => !v)}
              className="min-h-[44px] px-2 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              Ver todos os personagens
            </button>
            {showAll && (
              // Um painel, agrupado por `divide` — sem card-sobre-card (direção §4).
              <Panel className="mt-3 overflow-hidden text-left">
                <ul className="divide-y divide-border">
                  {characters.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-1 px-1">
                      <button
                        onClick={() => { setFocus(i); setShowAll(false) }}
                        className={`min-h-[44px] flex-1 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          i === focus ? 'text-primary' : 'text-foreground hover:text-primary'
                        }`}
                      >
                        {c.name} · {c.race} · {c.class} · Nv.{c.level}
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        aria-label={`Deletar ${c.name}`}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
