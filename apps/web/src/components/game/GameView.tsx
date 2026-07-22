'use client'

import { useState, useRef, useEffect } from 'react'
import { abilityModifier, formatModifier, stripFabricatedRolls, stripWorldStateTags, formatDiceBreakdown, spellLevelLabel } from '@ai-dm/shared'
import type { ChatTurn, RollTurn, SystemSpell } from '@ai-dm/shared'
import { api } from '@/lib/api'

// US-29: um turno é ação do jogador, narração do Mestre OU um bloco de rolagem.
type Message = ChatTurn

const ATTR_LABELS: Record<string, string> = {
  strength: 'FOR', dexterity: 'DES', constitution: 'CON',
  intelligence: 'INT', wisdom: 'SAB', charisma: 'CAR',
}

interface InventoryItem {
  name: string
  qty: number
}

// US-41: feature de classe (awareness read-only). Mesma forma do SystemClassFeature
// de @ai-dm/shared, tipada estruturalmente aqui (web não depende desse pacote).
interface ClassFeature {
  name: string
  description: string
}

// US-45: mesma forma do CharacterBackground de @ai-dm/ai-engine (web não depende
// desse pacote), tipada estruturalmente aqui — não redefinir a forma noutro lugar.
interface CharacterBackground {
  story?: string
  ideals?: string[]
  bonds?: string[]
  flaws?: string[]
  // US-40: divindade/patrono opcional (nome + portfólio).
  deity?: { name: string; portfolio?: string }
}

interface Props {
  adventureId: string
  characterId: string
  characterName: string
  characterClass: string
  characterRace: string
  hp: number
  maxHp: number
  attributes?: Record<string, number>
  inventory?: InventoryItem[]
  conditions?: string[]
  // US-27: todas as perícias com modificador já computado.
  skills?: { key: string; label: string; modifier: number; proficient: boolean }[]
  // US-45: background do personagem, mostrado numa aba própria da ficha.
  background?: CharacterBackground
  // US-41: features de classe (nível 1), mostradas na aba "Features".
  features?: ClassFeature[]
  // US-50: magias conhecidas (US-42), mostradas numa secção da MESMA aba "Features"
  // — mesma pergunta do jogador ("o que sei fazer de especial?"), não uma aba nova.
  spells?: SystemSpell[]
}

// US-45: abas da ficha. Lista (não botões hard-coded) para novas abas
// (divindade/features/magias — US-40/41/42) entrarem só acrescentando um item.
type SheetTabId = 'ficha' | 'background' | 'features'
const SHEET_TABS: { id: SheetTabId; label: string }[] = [
  { id: 'ficha', label: 'Ficha' },
  { id: 'features', label: 'Features' },
  { id: 'background', label: 'Background' },
]

function historyKey(adventureId: string) {
  return `ai-dm-history-${adventureId}`
}

function loadHistory(adventureId: string): Message[] {
  try {
    const raw = localStorage.getItem(historyKey(adventureId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(adventureId: string, messages: Message[]) {
  localStorage.setItem(historyKey(adventureId), JSON.stringify(messages))
}

// US-45: painel da aba Background. Read-only. Cada eixo só vira bloco se tiver
// conteúdo; se nenhum tiver, mostra o empty state (a aba nunca some — só o conteúdo).
function BackgroundPanel({ background }: { background?: CharacterBackground }) {
  const story = background?.story?.trim()
  const lists: { label: string; items: string[] }[] = [
    { label: 'Ideais', items: background?.ideals ?? [] },
    { label: 'Vínculos', items: background?.bonds ?? [] },
    { label: 'Fraquezas', items: background?.flaws ?? [] },
  ]
  // US-40: divindade só vira bloco se tiver nome; "Nome — portfólio" (ou só o nome).
  const deityName = background?.deity?.name?.trim()
  const deityPortfolio = background?.deity?.portfolio?.trim()
  const deityText = deityName ? (deityPortfolio ? `${deityName} — ${deityPortfolio}` : deityName) : ''
  const hasAny = Boolean(story) || Boolean(deityText) || lists.some(l => l.items.length > 0)

  if (!hasAny) {
    return (
      <p className="text-sm text-stone-600 dark:text-stone-400">
        Este personagem ainda não tem história.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {story && (
        <div>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-semibold uppercase tracking-wide mb-2">História</p>
          <p className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">{story}</p>
        </div>
      )}
      {deityText && (
        <div>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-semibold uppercase tracking-wide mb-2">Divindade/Patrono</p>
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{deityText}</p>
        </div>
      )}
      {lists.map(({ label, items }) => items.length > 0 && (
        <div key={label}>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-semibold uppercase tracking-wide mb-2">{label}</p>
          <ul className="space-y-1 list-disc list-inside">
            {items.map((it, i) => (
              <li key={i} className="text-sm text-stone-700 dark:text-stone-300">{it}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// US-41/US-50: painel da aba Features. Read-only, awareness — nome + descrição curta.
// Duas secções: features de classe e magias conhecidas (US-42). Cada secção só existe
// se a sua lista tiver itens (sem título órfão); se NENHUMA tiver, mostra o empty state
// e a aba na mesma não some (igual ao painel de Background). Não resolve mecânica:
// é só o que o personagem PODE fazer. Sem slots/preparação — não existem no modelo.
function FeaturesPanel({ features, spells }: { features?: ClassFeature[]; spells?: SystemSpell[] }) {
  const featureList = (features ?? []).filter(f => f?.name?.trim())
  // Ordem estável por nível e depois nome (os 20 truques do mago não podem sair
  // arbitrários). Cópia — a prop não é mutada.
  const spellList = [...(spells ?? [])]
    .filter(s => s?.name?.trim())
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name))

  if (featureList.length === 0 && spellList.length === 0) {
    return (
      <p className="text-sm text-stone-600 dark:text-stone-400">
        Esta classe ainda não tem features nem magias registadas.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {featureList.length > 0 && (
        <section>
          <h3 className="text-xs text-stone-600 dark:text-stone-400 font-semibold uppercase tracking-wide mb-2">Features</h3>
          <ul className="flex flex-col gap-3">
            {featureList.map((f, i) => (
              <li key={i}>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{f.name}</p>
                {f.description?.trim() && (
                  <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{f.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {spellList.length > 0 && (
        <section>
          <h3 className="text-xs text-stone-600 dark:text-stone-400 font-semibold uppercase tracking-wide mb-2">Magias</h3>
          <ul className="flex flex-col gap-3">
            {spellList.map((s, i) => {
              // Rótulo vindo de @ai-dm/shared — a MESMA regra que o prompt do mestre usa
              // (US-42), para a ficha e o prompt nunca divergirem ("truque" vs "nível 0").
              const label = spellLevelLabel(s.level)
              return (
                <li key={i}>
                  <p data-testid="spell-name" className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {label ? `${s.name} (${label})` : s.name}
                  </p>
                  {s.description?.trim() && (
                    <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{s.description}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

export function GameView({ adventureId, characterId, characterName, characterClass, characterRace, hp, maxHp, attributes, inventory: initialInventory, conditions, skills, background, features, spells }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  // US-45: aba ativa da ficha. Estado só de VISTA — não toca em messages/HP/inventário,
  // então trocar de aba não remonta nada nem perde estado de jogo.
  const [tab, setTab] = useState<SheetTabId>('ficha')
  // US-66: no mobile a ficha é um painel recolhível (D1), fechado por padrão — a
  // narração é o conteúdo principal. A partir de `md:` volta a ser coluna lateral
  // sempre visível (o `md:flex` ignora este estado).
  const [sheetOpen, setSheetOpen] = useState(false)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  // Warm-up: no free tier o processo do api (Render) e a compute do Postgres (Neon)
  // suspendem por ociosidade. O primeiro fetch do mount (getTurns) acorda os dois —
  // reusamo-lo como aquecimento e travamos o input até resolver, para o cold start
  // ser pago AQUI (com tempo à mostra) e não no primeiro turno do Mestre.
  const [warming, setWarming] = useState(true)
  const [warmSecs, setWarmSecs] = useState(0)
  const [currentHp, setCurrentHp] = useState(hp)
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory ?? [])
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Fonte de verdade: o servidor (US-18). O localStorage vira só um cache
    // otimista para evitar flash de tela vazia enquanto o fetch resolve.
    setMessages(loadHistory(adventureId))
    setWarming(true)
    api.getTurns(characterId, adventureId)
      .then((turns) => {
        setMessages(turns)
        saveHistory(adventureId, turns)
      })
      .catch(() => { /* mantém o cache local em caso de falha */ })
      .finally(() => setWarming(false))
  }, [adventureId, characterId])

  // Conta os segundos de espera enquanto o servidor acorda. Só corre durante o
  // warm-up; para assim que resolve.
  useEffect(() => {
    if (!warming) return
    setWarmSecs(0)
    const t = setInterval(() => setWarmSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [warming])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || streaming || warming) return

    const userMessage = input.trim()
    setInput('')

    const withUser: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(withUser)
    setStreaming(true)

    let dmText = ''
    // US-29: rolagens reais do turno, na ordem em que chegam (sempre antes da
    // narração — a rollDice resolve antes do texto).
    const rollTurns: RollTurn[] = []
    const withDmPlaceholder: Message[] = [...withUser, { role: 'dm', content: '' }]
    setMessages(withDmPlaceholder)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adventureId, characterId, message: userMessage }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const handleLine = (line: string) => {
        // Sinal de reset: um novo step do modelo vai substituir a narração
        // anterior (evita a resposta duplicada em turnos multi-step).
        if (line === 'R') {
          dmText = ''
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'dm', content: '' }
            return next
          })
          return
        }
        if (line.startsWith('I:')) {
          try { setInventory(JSON.parse(line.slice(2))) } catch { /* ignore malformed */ }
          return
        }
        if (line.startsWith('H:')) {
          try {
            const s = JSON.parse(line.slice(2))
            if (typeof s.hp === 'number') setCurrentHp(s.hp)
          } catch { /* ignore malformed */ }
          return
        }
        if (line.startsWith('D:')) {
          // US-29: bloco de rolagem real — inserido ANTES da bolha de narração
          // em construção (a rollDice resolve antes do texto).
          try {
            const r = JSON.parse(line.slice(2))
            const roll: RollTurn = { role: 'roll', label: r.label ?? '', formula: r.formula, rolls: r.rolls, modifier: r.modifier, total: r.total }
            rollTurns.push(roll)
            setMessages(prev => {
              const next = [...prev]
              next.splice(next.length - 1, 0, roll) // antes do placeholder do Mestre
              return next
            })
          } catch { /* ignore malformed */ }
          return
        }
        if (!line.startsWith('0:"')) return
        const token = line.slice(3, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
        dmText += token
        // Rede de segurança no stream ao vivo: esconde qualquer tag de estado
        // (`[WORLD_STATE_UPDATE:...]`) que o modelo cuspa na prosa apesar do prompt.
        // Trata o tag ainda ABERTO (o `]` não chegou neste chunk), então nunca
        // pisca na tela. `dmText` cru continua acumulando; só a bolha é saneada.
        const shownDm = stripWorldStateTags(dmText).clean
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'dm', content: shownDm }
          return next
        })
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Acumula no buffer e só processa linhas completas; a última linha
        // (possivelmente parcial) fica retida até chegar o resto no próximo read.
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          handleLine(line)
        }
      }

      // Processa qualquer linha completa remanescente no buffer.
      if (buffer.length > 0) handleLine(buffer)

      // US-29: sanea a narração final (remove qualquer resultado de rolagem que
      // o modelo tenha escrito na prosa apesar do prompt). O número real está
      // no bloco de rolagem acima; a prosa só o interpreta.
      const cleanDm = stripWorldStateTags(stripFabricatedRolls(dmText).clean).clean
      const finalMessages: Message[] = [...withUser, ...rollTurns, { role: 'dm', content: cleanDm }]
      setMessages(finalMessages)
      saveHistory(adventureId, finalMessages)

    } catch {
      const errorMessages: Message[] = [...withUser, { role: 'dm', content: 'Erro ao conectar com o Mestre. Tenta novamente.' }]
      setMessages(errorMessages)
      saveHistory(adventureId, errorMessages)
    } finally {
      setStreaming(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e as unknown as React.FormEvent)
    }
  }

  const hpPercent = Math.max(0, (currentHp / maxHp) * 100)
  const hpColor = hpPercent > 60 ? 'bg-green-500' : hpPercent > 30 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    // US-66: altura travada em `h-dvh` (acompanha a URL bar móvel) + overflow-hidden;
    // a lista de mensagens rola por dentro (flex-1 min-h-0) e a caixa de ação fica
    // sempre visível — sem o `calc(100vh - 120px)` que chutava o chrome de desktop.
    <div className="h-dvh bg-amber-50 dark:bg-stone-950 text-stone-900 dark:text-white flex flex-col md:flex-row overflow-hidden">

      {/* Ficha do personagem — sidebar no desktop; painel recolhível no mobile (US-66, D1). */}
      <aside className="md:w-64 shrink-0 flex flex-col min-h-0 bg-stone-100 dark:bg-stone-900 border-b md:border-b-0 md:border-r border-stone-300 dark:border-stone-800">
        {/* Toggle da ficha — só no mobile; no desktop a coluna está sempre aberta. */}
        <button
          type="button"
          onClick={() => setSheetOpen(o => !o)}
          aria-expanded={sheetOpen}
          aria-controls="character-sheet"
          className="md:hidden flex items-center justify-between gap-2 p-4 min-h-[44px] font-semibold text-amber-600 dark:text-amber-400"
        >
          <span>Ficha — {characterName}</span>
          <span aria-hidden="true" className={`transition-transform ${sheetOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {/* Conteúdo da ficha: escondido por padrão no mobile (abre com o toggle),
            sempre visível a partir de `md:`. `max-h-[70vh]` no mobile garante que a
            narração nunca some quando a ficha abre. */}
        <div
          id="character-sheet"
          className={`${sheetOpen ? 'flex' : 'hidden'} md:flex flex-col gap-4 p-4 pt-0 md:pt-4 overflow-y-auto min-h-0 max-h-[70vh] md:max-h-none`}
        >
        <div>
          <p className="text-amber-600 dark:text-amber-400 font-bold text-lg">{characterName}</p>
          <p className="text-stone-600 dark:text-stone-400 text-sm">{characterRace} · {characterClass}</p>
        </div>

        <div className="md:w-full">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-stone-600 dark:text-stone-400">HP</span>
            {/* US-46: mudança de HP anunciada de forma discreta (aria-live polite). */}
            <span aria-live="polite" className={hpPercent > 30 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{currentHp}/{maxHp}</span>
          </div>
          <div className="h-2 bg-stone-300 dark:bg-stone-700 rounded-full overflow-hidden">
            <div className={`h-full ${hpColor} rounded-full transition-all`} style={{ width: `${hpPercent}%` }} />
          </div>
        </div>

        {/* US-45: barra de abas da ficha — renderizada de SHEET_TABS (não hard-coded). */}
        <div
          role="tablist"
          aria-label="Ficha do personagem"
          className="md:w-full flex gap-1 border-b border-stone-300 dark:border-stone-700 shrink-0"
          onKeyDown={e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
            e.preventDefault()
            const idx = SHEET_TABS.findIndex(t => t.id === tab)
            const delta = e.key === 'ArrowRight' ? 1 : -1
            const next = SHEET_TABS[(idx + delta + SHEET_TABS.length) % SHEET_TABS.length]
            if (!next) return
            setTab(next.id)
            document.getElementById(`sheet-tab-${next.id}`)?.focus()
          }}
        >
          {SHEET_TABS.map(t => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                id={`sheet-tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls={`sheet-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`min-h-[44px] px-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Aba "Ficha": mecânica (condições, atributos, perícias, inventário). */}
        {tab === 'ficha' && (
          <div
            id="sheet-panel-ficha"
            role="tabpanel"
            aria-labelledby="sheet-tab-ficha"
            className="md:w-full flex flex-col gap-4 items-start"
          >
            {conditions && conditions.length > 0 && (
              <div className="md:w-full">
                <p className="text-xs text-stone-600 dark:text-stone-400 font-semibold uppercase tracking-wide mb-2">Condições</p>
                <div className="flex flex-wrap gap-1">
                  {conditions.map((c, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {attributes && Object.keys(attributes).length > 0 && (
              <div className="md:w-full">
              <p className="text-xs text-stone-600 dark:text-stone-400 font-semibold uppercase tracking-wide mb-2">Atributos</p>
              <div className="grid grid-cols-3 gap-x-2 gap-y-2">
                {Object.entries(attributes).map(([key, value]) => (
                  <div key={key} className="flex flex-col items-center bg-stone-200 dark:bg-stone-800 rounded px-1 py-1">
                    <span className="text-xs text-stone-600 dark:text-stone-400 font-medium">
                      {ATTR_LABELS[key] ?? key.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="text-lg font-bold text-stone-800 dark:text-stone-100 leading-tight">
                      {formatModifier(abilityModifier(value))}
                    </span>
                    <span className="text-xs text-stone-600 dark:text-stone-400">{value}</span>
                  </div>
                ))}
              </div>
              </div>
            )}

            {skills && skills.length > 0 && (
              <div className="md:w-full">
                <p className="text-xs text-stone-600 dark:text-stone-400 font-semibold uppercase tracking-wide mb-2">Perícias</p>
                <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {skills.map(sk => (
                    <li key={sk.key} className="text-xs flex justify-between gap-2">
                      <span className={sk.proficient ? 'text-amber-700 dark:text-amber-300 font-medium' : 'text-stone-700 dark:text-stone-300'}>
                        {sk.proficient && <span aria-label="proficiente" title="Proficiente">● </span>}{sk.label}
                      </span>
                      <span className="text-stone-600 dark:text-stone-400 shrink-0 tabular-nums">{formatModifier(sk.modifier)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="md:w-full">
              <p className="text-xs text-stone-600 dark:text-stone-400 font-semibold uppercase tracking-wide mb-2">
                Inventário ({inventory.length})
              </p>
              {inventory.length === 0
                ? <p className="text-xs text-stone-600 dark:text-stone-400">Nenhum item</p>
                : <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {inventory.map((item, i) => (
                      <li key={i} className="text-xs text-stone-700 dark:text-stone-300 flex justify-between gap-1">
                        <span>{item.name}</span>
                        {item.qty > 1 && <span className="text-stone-600 dark:text-stone-400 shrink-0">({item.qty})</span>}
                      </li>
                    ))}
                  </ul>
              }
            </div>
          </div>
        )}

        {/* US-41/US-50: aba "Features" — features de classe + magias conhecidas, read-only.
            Sempre presente; empty state só quando não há nem features nem magias. */}
        {tab === 'features' && (
          <div
            id="sheet-panel-features"
            role="tabpanel"
            aria-labelledby="sheet-tab-features"
            className="md:w-full"
          >
            <FeaturesPanel features={features} spells={spells} />
          </div>
        )}

        {/* US-45: aba "Background" — narrativa, read-only. Sempre presente; empty state quando vazia. */}
        {tab === 'background' && (
          <div
            id="sheet-panel-background"
            role="tabpanel"
            aria-labelledby="sheet-tab-background"
            className="md:w-full"
          >
            <BackgroundPanel background={background} />
          </div>
        )}
        </div>
      </aside>

      {/* Área de jogo. <div> (não <main>): o landmark <main> vive no layout — um por página. */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* US-46: histórico é uma região viva — leitor de tela anuncia a narração que chega.
            US-66: `flex-1 min-h-0` preenche o espaço disponível e rola por dentro — sem
            o `calc(100vh - 120px)` fixo, robusto à URL bar móvel. */}
        <div
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Narração do Mestre"
          className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
        >
          {messages.length === 0 && (
            <div className="text-center text-stone-600 dark:text-stone-400 pt-16">
              <p className="text-4xl mb-4" aria-hidden="true">⚔</p>
              <p className="text-lg">A tua aventura começa aqui.</p>
              <p className="text-sm mt-1">Diz ao Mestre o que queres fazer.</p>
            </div>
          )}

          {messages.map((msg, i) => {
            // US-29: bloco de rolagem REAL do sistema — mostrado antes da
            // narração. Número vindo do Game Server, nunca da prosa.
            if (msg.role === 'roll') {
              return (
                <div key={i} className="flex justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-950 px-3 py-1.5 text-xs">
                    <span aria-hidden>🎲</span>
                    {msg.skill && <span className="rounded-full bg-amber-200 dark:bg-amber-800 px-2 py-0.5 font-semibold text-amber-900 dark:text-amber-100">{msg.skill}</span>}
                    {msg.label && <span className="font-semibold text-amber-800 dark:text-amber-200">{msg.label}</span>}
                    <span className="font-mono tabular-nums text-stone-800 dark:text-stone-100">{formatDiceBreakdown(msg)}</span>
                  </div>
                </div>
              )
            }
            return (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'dm' && (
                  <div aria-hidden="true" className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900 border border-amber-500 dark:border-amber-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0 text-sm text-amber-700 dark:text-amber-300">
                    ✦
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-white rounded-br-sm'
                    : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-100 rounded-bl-sm'
                }`}>
                  {msg.content}
                  {streaming && i === messages.length - 1 && msg.role === 'dm' && (
                    <span aria-hidden="true" className="inline-block w-2 h-4 bg-amber-500 dark:bg-amber-400 ml-1 animate-pulse align-text-bottom" />
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Warm-up: cold start do free tier pago aqui (com o tempo à mostra), não no
            primeiro turno. Só aparece se demorar >1s — servidor já quente não pisca. */}
        {warming && warmSecs >= 1 && (
          <div
            role="status"
            aria-live="polite"
            className="px-4 py-2 text-xs text-amber-900 dark:text-amber-100 bg-amber-100 dark:bg-amber-950 border-t border-amber-300 dark:border-amber-800 flex items-center gap-2"
          >
            <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            O Mestre está a despertar… {warmSecs}s
          </div>
        )}

        {/* Input */}
        <form onSubmit={sendMessage} className="p-4 border-t border-stone-200 dark:border-stone-800 flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={warming ? 'O Mestre está a despertar…' : 'O que fazes? (Enter para enviar, Shift+Enter para nova linha)'}
            aria-label="A tua ação"
            disabled={streaming || warming}
            className="flex-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-stone-400 resize-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-amber-500"
          />
          <button
            type="submit"
            disabled={streaming || warming || !input.trim()}
            aria-label="Enviar ação"
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 font-semibold transition-colors"
          >
            <span aria-hidden="true">{streaming ? '...' : '➤'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
