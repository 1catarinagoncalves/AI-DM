'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, Dices, Languages, Pencil, Send } from 'lucide-react'
import { abilityModifier, formatModifier, stripFabricatedRolls, stripWorldStateTags, formatDiceBreakdown, spellLevelLabel } from '@ai-dm/shared'
import type { ChatTurn, Locale, RollTurn, SystemSpell } from '@ai-dm/shared'
import { api } from '@/lib/api'
import { DmButton, Logo, SheetHeading, dmButtonClass, fieldClass } from '@/components/ui/dm'
import { LocaleToggle } from '@/components/LocaleToggle'
import { useLocale, useT } from '@/components/LocaleProvider'
import { messagesFor, type MessageKey } from '@/messages'

// US-97: marcador de sessão — o aviso de troca de idioma. Vive SÓ na lista da tela:
// não é turno de jogo, não vai ao EventLog nem ao histórico que o Mestre recebe (ele
// não precisa saber que houve troca, precisa narrar no idioma-alvo). Por isso é um
// tipo local, e não um `role` novo em ChatTurn — o contrato com a API fica intacto.
interface LocaleTurn {
  role: 'locale'
  locale: Locale
}

// US-29: um turno é ação do jogador, narração do Mestre OU um bloco de rolagem.
type Message = ChatTurn | LocaleTurn

// US-98: as abreviaturas (FOR/DES/… ou STR/DEX/…) mudaram de casa para o dicionário;
// o mapa aqui só liga a chave do atributo à chave de mensagem. Atributo desconhecido
// continua caindo no fallback de 3 letras lá embaixo.
const ATTR_LABELS: Record<string, MessageKey> = {
  strength: 'game.attr.strength', dexterity: 'game.attr.dexterity', constitution: 'game.attr.constitution',
  intelligence: 'game.attr.intelligence', wisdom: 'game.attr.wisdom', charisma: 'game.attr.charisma',
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
const SHEET_TABS: { id: SheetTabId; label: MessageKey }[] = [
  { id: 'ficha', label: 'game.tab.ficha' },
  { id: 'features', label: 'game.tab.features' },
  { id: 'background', label: 'game.tab.background' },
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
  // US-97: o aviso de troca de idioma NÃO entra no cache. É marcador de sessão: se
  // fosse gravado, ressuscitaria a cada abertura da mesa, fora do momento em que
  // a troca aconteceu.
  const persistable = messages.filter((m) => m.role !== 'locale')
  localStorage.setItem(historyKey(adventureId), JSON.stringify(persistable))
}

// US-45: painel da aba Background. Read-only. Cada eixo só vira bloco se tiver
// conteúdo; se nenhum tiver, mostra o empty state (a aba nunca some — só o conteúdo).
function BackgroundPanel({ background }: { background?: CharacterBackground }) {
  const t = useT()
  const story = background?.story?.trim()
  const lists: { label: MessageKey; items: string[] }[] = [
    { label: 'game.background.ideals', items: background?.ideals ?? [] },
    { label: 'game.background.bonds', items: background?.bonds ?? [] },
    { label: 'game.background.flaws', items: background?.flaws ?? [] },
  ]
  // US-40: divindade só vira bloco se tiver nome; "Nome — portfólio" (ou só o nome).
  const deityName = background?.deity?.name?.trim()
  const deityPortfolio = background?.deity?.portfolio?.trim()
  const deityText = deityName ? (deityPortfolio ? `${deityName} — ${deityPortfolio}` : deityName) : ''
  const hasAny = Boolean(story) || Boolean(deityText) || lists.some(l => l.items.length > 0)

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('game.background.empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {story && (
        <div>
          <SheetHeading>{t('game.background.story')}</SheetHeading>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{story}</p>
        </div>
      )}
      {deityText && (
        <div>
          <SheetHeading>{t('game.background.deity')}</SheetHeading>
          <p className="text-[13px] leading-relaxed text-foreground">{deityText}</p>
        </div>
      )}
      {lists.map(({ label, items }) => items.length > 0 && (
        <div key={label}>
          <SheetHeading>{t(label)}</SheetHeading>
          <ul className="list-inside list-disc space-y-1">
            {items.map((it, i) => (
              <li key={i} className="text-[13px] text-foreground">{it}</li>
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
  const t = useT()
  // US-100: o nome da magia chega já resolvido no locale (a página resolve a chave da ficha);
  // o rótulo de nível é o único texto desta lista que se monta aqui — e acompanha.
  const { locale } = useLocale()
  const featureList = (features ?? []).filter(f => f?.name?.trim())
  // Ordem estável por nível e depois nome (os 20 truques do mago não podem sair
  // arbitrários). Cópia — a prop não é mutada.
  const spellList = [...(spells ?? [])]
    .filter(s => s?.name?.trim())
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name))

  if (featureList.length === 0 && spellList.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('game.features.empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {featureList.length > 0 && (
        <section>
          <SheetHeading>{t('game.features.title')}</SheetHeading>
          <ul className="flex flex-col gap-2">
            {featureList.map((f, i) => (
              <li key={i} className="rounded-md border border-border bg-background/40 p-3">
                <p className="text-sm font-semibold text-parchment">{f.name}</p>
                {f.description?.trim() && (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {spellList.length > 0 && (
        <section>
          <SheetHeading>{t('game.spells.title')}</SheetHeading>
          <ul className="flex flex-col gap-2">
            {spellList.map((s, i) => {
              // Rótulo vindo de @ai-dm/shared — a MESMA regra que o prompt do mestre usa
              // (US-42), para a ficha e o prompt nunca divergirem ("truque" vs "nível 0").
              const label = spellLevelLabel(s.level, locale)
              return (
                <li key={i} className="rounded-md border border-border bg-background/40 p-3">
                  <p data-testid="spell-name" className="text-sm font-semibold text-parchment">
                    {label ? `${s.name} (${label})` : s.name}
                  </p>
                  {s.description?.trim() && (
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{s.description}</p>
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
  // US-67: modo edição da última ação. Reusa o mesmo textarea e o mesmo fluxo de
  // streaming — ao confirmar, chama /api/chat com `edit: true` (regenera o turno).
  const [editing, setEditing] = useState(false)
  const [streaming, setStreaming] = useState(false)
  // Warm-up: no free tier o processo do api (Render) e a compute do Postgres (Neon)
  // suspendem por ociosidade. O primeiro fetch do mount (getTurns) acorda os dois —
  // reusamo-lo como aquecimento e travamos o input até resolver, para o cold start
  // ser pago AQUI (com tempo à mostra) e não no primeiro turno do Mestre.
  const { locale, switches } = useLocale()
  const t = useT()
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

  // US-97: trocar o idioma no meio da mesa muda a língua da PRÓXIMA cena. Sem sinal,
  // isso lê-se como o Mestre ter enlouquecido — então marcamos o ponto da conversa em
  // que a troca aconteceu, no mesmo formato do bloco de rolagem. Observa `switches`
  // (trocas do JOGADOR), não o valor do locale: a resolução inicial do provider muda o
  // valor sem ninguém ter escolhido nada e faria a pílula aparecer ao abrir a mesa.
  useEffect(() => {
    if (switches === 0) return
    setMessages((prev) => [...prev, { role: 'locale', locale }])
    // `locale` de propósito fora das deps: quem dispara é a troca, não o valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switches])

  // US-67: início da edição — devolve o texto da última ação ao textarea e entra
  // em modo edição. Bloqueado enquanto o Mestre responde/acorda (igual ao enviar).
  function startEdit() {
    if (streaming || warming) return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser || lastUser.role !== 'user') return
    setInput(lastUser.content)
    setEditing(true)
    textareaRef.current?.focus()
  }

  // US-67: cancela a edição sem tocar no histórico — esvazia o campo e sai do modo.
  function cancelEdit() {
    setEditing(false)
    setInput('')
    textareaRef.current?.focus()
  }

  // US-67: remove o último turno (ação + rolagens + narração) da lista local,
  // espelhando o que o servidor apaga antes de regenerar.
  function stripLastTurn(msgs: Message[]): Message[] {
    const lastUserIdx = msgs.map((m) => m.role).lastIndexOf('user')
    return lastUserIdx === -1 ? msgs : msgs.slice(0, lastUserIdx)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || streaming || warming) return

    const userMessage = input.trim()
    setInput('')

    // US-67: ao editar, a base é o histórico SEM o último turno (a regeneração
    // substitui-o); num turno normal, a base é o histórico completo.
    const isEdit = editing
    setEditing(false)
    const base = isEdit ? stripLastTurn(messages) : messages

    const withUser: Message[] = [...base, { role: 'user', content: userMessage }]
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
        body: JSON.stringify({ adventureId, characterId, message: userMessage, edit: isEdit }),
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
        // US-69: descarte de TURNO — o guard do servidor detetou degeneração
        // (loop "cra cra…") e vai reescrever. Apaga TUDO deste turno (rolagens +
        // prosa parcial) e volta ao estado "ação do jogador + Mestre a pensar";
        // a reescrita reemite os frames D:/0: do zero. Difere do `R` (só o step).
        if (line === 'X') {
          dmText = ''
          rollTurns.length = 0
          setMessages([...withUser, { role: 'dm', content: '' }])
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
      const finalMessages: Message[] = [...base, { role: 'user', content: userMessage }, ...rollTurns, { role: 'dm', content: cleanDm }]
      setMessages(finalMessages)
      saveHistory(adventureId, finalMessages)

      // US-67: reconcilia com a fonte de verdade (US-18). Só o servidor sabe se o
      // turno é editável (não-resumido e sem CHARACTER_UPDATE), então recarregamos
      // o histórico autoritativo — é ele que liga o botão de editar da última ação.
      // Falha aqui mantém a reconstrução local (sem editar, mas sem perder o turno).
      try {
        const authoritative = await api.getTurns(characterId, adventureId)
        setMessages(authoritative)
        saveHistory(adventureId, authoritative)
      } catch { /* mantém a reconstrução local */ }

    } catch {
      const errorMessages: Message[] = [...withUser, { role: 'dm', content: t('game.error.connect') }]
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

  // US-67: só a ÚLTIMA ação do jogador é editável — o índice ancora o botão de
  // editar (e o esmaecimento do turno em edição) a essa bolha, nunca às anteriores.
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user')

  return (
    // US-66: altura travada em `h-dvh` (acompanha a URL bar móvel) + overflow-hidden;
    // a lista de mensagens rola por dentro (flex-1 min-h-0) e a caixa de ação fica
    // sempre visível — sem o `calc(100vh - 120px)` que chutava o chrome de desktop.
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground md:flex-row">

      {/* Ficha do personagem — sidebar no desktop; painel recolhível no mobile (US-66, D1). */}
      <aside className="flex min-h-0 shrink-0 flex-col border-b border-border bg-sidebar md:w-72 md:border-b-0 md:border-r lg:w-80">
        {/* US-66: a barra hospeda os controlos fixos (Sair em right-16 + tema em
            right-4), que ocupam 16px→60px na vertical. `min-h-[76px]` fecha-os
            DENTRO dela (16px de folga em baixo, igual à de cima) em vez de os
            deixar transbordar sobre a narração; `pr-40` reserva a largura deles
            para não taparem o nome/chevron.
            US-107: a saída é IRMÃ do toggle, não filha — `<a>` dentro de `<button>`
            é inválido e o clique fica ambíguo. Por isso a barra virou wrapper e as
            duas medidas (`min-h-[76px]`, `pr-40`) mudaram de casa para cá. */}
        <div className="flex min-h-[76px] min-w-0 items-center gap-1 pl-1 pr-40 md:hidden">
          <Link
            href="/"
            aria-label={t('game.exit')}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          {/* Toggle da ficha — só no mobile; no desktop a coluna está sempre aberta. */}
          <button
            type="button"
            onClick={() => setSheetOpen(o => !o)}
            aria-expanded={sheetOpen}
            aria-controls="character-sheet"
            className="flex min-h-[44px] min-w-0 flex-1 items-center justify-between gap-2 py-4 font-serif font-semibold text-parchment"
          >
            <span className="truncate">{t('game.sheetToggle', { name: characterName })}</span>
            <ChevronDown aria-hidden className={`size-4 text-primary transition-transform ${sheetOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Cabeçalho da ficha: marca + identidade + HP. Só no desktop — no mobile
            o nome já está no toggle acima. */}
        <div className="hidden border-b border-border p-4 md:block">
          {/* US-107: linha própria acima da identidade — ao lado do Logo o nome do
              personagem truncaria nos 288px da coluna. Fora do `#character-sheet`
              (o painel recolhível) de propósito: no mobile a saída não pode exigir
              abrir a ficha, e aqui a coluna nem tem toggle. */}
          <Link href="/" className={dmButtonClass('ghost', 'mb-3 w-full justify-start px-3 text-xs')}>
            <ArrowLeft className="size-4" aria-hidden />
            {t('game.exit')}
          </Link>
          <div className="flex items-center gap-2.5">
            <Logo className="size-8 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-serif text-base font-bold text-parchment">{characterName}</p>
              <p className="truncate text-xs text-muted-foreground">{characterRace} · {characterClass}</p>
            </div>
          </div>
        </div>

        {/* Conteúdo da ficha: escondido por padrão no mobile (abre com o toggle),
            sempre visível a partir de `md:`. `max-h-[70vh]` no mobile garante que a
            narração nunca some quando a ficha abre. */}
        <div
          id="character-sheet"
          className={`${sheetOpen ? 'flex' : 'hidden'} scrollbar-thin max-h-[70vh] min-h-0 flex-col gap-4 overflow-y-auto p-4 md:flex md:max-h-none`}
        >
        {/* US-97: o seletor da mesa vive na ficha, não no topo — a barra superior já
            está cheia (tema + Sair, com a largura reservada à mão em `pr-40` acima) e
            trocar de idioma em plena mesa é raro. Um ponto só serve mobile (painel
            recolhível) e desktop (coluna sempre aberta). */}
        <LocaleToggle className="self-start" />

        <div className="md:w-full">
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>{t('game.hp')}</span>
            {/* US-46: mudança de HP anunciada de forma discreta (aria-live polite). */}
            <span aria-live="polite" className={hpPercent > 30 ? 'text-foreground' : 'text-destructive'}>{currentHp}/{maxHp}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background/70 ring-1 ring-inset ring-border">
            <div
              className={`h-full rounded-full transition-[width] ${hpPercent > 30 ? 'bg-gradient-to-r from-ember to-primary' : 'bg-destructive'}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* US-45: barra de abas da ficha — renderizada de SHEET_TABS (não hard-coded). */}
        <div
          role="tablist"
          aria-label={t('game.sheetTabs')}
          className="flex shrink-0 border-b border-border md:w-full"
          onKeyDown={e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
            e.preventDefault()
            const idx = SHEET_TABS.findIndex(item => item.id === tab)
            const delta = e.key === 'ArrowRight' ? 1 : -1
            const next = SHEET_TABS[(idx + delta + SHEET_TABS.length) % SHEET_TABS.length]
            if (!next) return
            setTab(next.id)
            document.getElementById(`sheet-tab-${next.id}`)?.focus()
          }}
        >
          {SHEET_TABS.map(tab_ => {
            const active = tab_.id === tab
            return (
              <button
                key={tab_.id}
                id={`sheet-tab-${tab_.id}`}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls={`sheet-panel-${tab_.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(tab_.id)}
                className={`relative min-h-[44px] px-3 text-sm font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(tab_.label)}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
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
            className="flex flex-col items-start gap-5 md:w-full"
          >
            {conditions && conditions.length > 0 && (
              <div className="md:w-full">
                <SheetHeading>{t('game.conditions')}</SheetHeading>
                <div className="flex flex-wrap gap-1">
                  {conditions.map((c, i) => (
                    <span key={i} className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {attributes && Object.keys(attributes).length > 0 && (
              <div className="md:w-full">
              <SheetHeading>{t('game.attributes')}</SheetHeading>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(attributes).map(([key, value]) => (
                  <div key={key} className="rounded-md border border-border bg-background/40 p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {ATTR_LABELS[key] ? t(ATTR_LABELS[key]!) : key.slice(0, 3).toUpperCase()}
                    </p>
                    <p className="font-serif text-lg font-bold leading-tight text-parchment">
                      {formatModifier(abilityModifier(value))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{value}</p>
                  </div>
                ))}
              </div>
              </div>
            )}

            {skills && skills.length > 0 && (
              <div className="md:w-full">
                <SheetHeading>{t('game.skills')}</SheetHeading>
                <ul className="scrollbar-thin max-h-56 space-y-0.5 overflow-y-auto pr-1">
                  {skills.map(sk => (
                    <li key={sk.key} className="flex items-center justify-between gap-2 px-1.5 py-1 text-[13px]">
                      <span className={`flex items-center gap-1.5 ${sk.proficient ? 'text-primary' : 'text-foreground'}`}>
                        {/* Marca de proficiência: o ponto substituiu o `●` textual, então
                            precisa de `role="img"` — `aria-label` num <span> sem papel é
                            atributo proibido (axe: aria-prohibited-attr). */}
                        {sk.proficient && <span role="img" aria-label={t('game.proficient')} title={t('game.proficient')} className="size-1.5 rounded-full bg-primary" />}
                        {sk.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{formatModifier(sk.modifier)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="md:w-full">
              <SheetHeading>{t('game.inventory', { n: inventory.length })}</SheetHeading>
              {inventory.length === 0
                ? <p className="text-[13px] text-muted-foreground">{t('game.inventoryEmpty')}</p>
                : <ul className="scrollbar-thin max-h-48 space-y-1 overflow-y-auto pr-1">
                    {inventory.map((item, i) => (
                      <li key={i} className="flex items-start justify-between gap-2 text-[13px] text-foreground">
                        <span>{item.name}</span>
                        {item.qty > 1 && <span className="shrink-0 text-muted-foreground">({item.qty})</span>}
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
      {/* `min-h-0` é obrigatório: sem ele o min-height desta coluna é `auto` (= altura
          do conteúdo), o pai `h-dvh overflow-hidden` não a consegue encolher, e no
          mobile (flex-col) a narração empurra a caixa de ação para fora do ecrã em vez
          de rolar por dentro. `min-w-0` faz o mesmo no eixo horizontal do desktop. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">

        {/* US-46: histórico é uma região viva — leitor de tela anuncia a narração que chega.
            US-66: `flex-1 min-h-0` preenche o espaço disponível e rola por dentro — sem
            o `calc(100vh - 120px)` fixo, robusto à URL bar móvel. */}
        <div
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label={t('game.log')}
          className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
        >
          {/* Coluna de leitura: a narração é o conteúdo-herói, medida de linha
              confortável em vez de esticar até à largura do ecrã. */}
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
          {messages.length === 0 && (
            <div className="pt-16 text-center text-muted-foreground">
              <Logo className="mx-auto mb-4 size-12" />
              <p className="font-serif text-lg text-parchment">{t('game.empty.title')}</p>
              <p className="mt-1 text-sm">{t('game.empty.hint')}</p>
            </div>
          )}

          {messages.map((msg, i) => {
            // US-29: bloco de rolagem REAL do sistema — mostrado antes da
            // narração. Número vindo do Game Server, nunca da prosa.
            // US-97: aviso de troca de idioma — mesma família visual do bloco de
            // rolagem (pílula centrada entre as falas), ícone próprio. Escrito no
            // idioma NOVO: é isso que confirma ao jogador que a troca pegou.
            if (msg.role === 'locale') {
              return (
                <div key={i} className="flex justify-center">
                  <p
                    role="status"
                    className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    <Languages aria-hidden className="size-3.5 text-accent" />
                    {/* US-98: resolvido pelo locale DO AVISO (`msg.locale`), não pelo ativo —
                        um aviso antigo tem de continuar na língua para a qual se trocou
                        naquele momento, senão pt→en→pt reescreve o histórico da sessão. */}
                    {messagesFor(msg.locale)('game.localeChanged')}
                  </p>
                </div>
              )
            }
            if (msg.role === 'roll') {
              return (
                <div key={i} className="flex justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs">
                    <Dices aria-hidden className="size-3.5 text-primary" />
                    {msg.skill && <span className="rounded-full bg-primary/20 px-2 py-0.5 font-semibold text-primary">{msg.skill}</span>}
                    {msg.label && <span className="font-semibold text-accent">{msg.label}</span>}
                    <span className="font-mono tabular-nums text-parchment">{formatDiceBreakdown(msg)}</span>
                  </div>
                </div>
              )
            }
            // US-67: só a última ação do jogador expõe o botão de editar — e apenas
            // quando o servidor a marcou editável (turno não-resumido e sem mutação de
            // estado). Escondido durante streaming/warming e durante a própria edição.
            const canEdit = msg.role === 'user' && i === lastUserIndex && msg.editable && !streaming && !warming && !editing
            // Turno em edição (ação + rolagens + narração dele): esmaecido para dar contexto.
            const dimmed = editing && lastUserIndex !== -1 && i >= lastUserIndex

            // O Mestre narra em PROSA, não em bolha: a narração é o texto da página,
            // e só a ação do jogador é uma bolha (é ela que precisa de se distinguir).
            if (msg.role === 'dm') {
              return (
                <div key={i} className={`whitespace-pre-wrap text-[15px] leading-relaxed text-foreground ${dimmed ? 'opacity-50' : ''}`}>
                  {msg.content}
                  {streaming && i === messages.length - 1 && (
                    <span aria-hidden="true" className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary align-text-bottom" />
                  )}
                </div>
              )
            }

            return (
              <div key={i} className={`group flex justify-end ${dimmed ? 'opacity-50' : ''}`}>
                {canEdit && (
                  // Chip de editar. No mobile (sem hover) fica SEMPRE visível; a partir
                  // de `md:` esconde-se e só aparece no hover/foco da bolha. Focável por
                  // teclado nos dois casos (US-46). Alvo de toque de 44px.
                  <button
                    type="button"
                    onClick={startEdit}
                    aria-label={t('game.editLast')}
                    className="mr-2 inline-flex min-h-[44px] items-center gap-1 self-center rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/60 hover:text-primary md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <Pencil aria-hidden className="size-3" /> {t('game.edit')}
                  </button>
                )}
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border border-primary/40 bg-primary/15 px-4 py-2.5 text-[15px] text-parchment">
                  {msg.content}
                </p>
              </div>
            )
          })}
          <div ref={bottomRef} />
          </div>
        </div>

        {/* Warm-up: cold start do free tier pago aqui (com o tempo à mostra), não no
            primeiro turno. Só aparece se demorar >1s — servidor já quente não pisca. */}
        {warming && warmSecs >= 1 && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 border-t border-border bg-card/60 px-4 py-2 text-xs text-accent backdrop-blur"
          >
            <span aria-hidden="true" className="inline-block size-2 animate-pulse rounded-full bg-primary" />
            {t('game.warming', { secs: warmSecs })}
          </div>
        )}

        {/* US-67: barra de modo edição — deixa claro no mobile que se está a reescrever
            uma ação (a bolha esmaecida pode estar fora do ecrã). */}
        {editing && (
          <div role="status" className="flex items-center gap-1.5 px-4 pt-3 text-xs font-semibold text-accent">
            <Pencil aria-hidden className="size-3" /> {t('game.editingBanner')}
          </div>
        )}

        {/* Input. Turno normal: textarea e enviar na MESMA linha (o enviar é só um
            ícone, não rouba largura ao campo). Só o modo edição empilha no mobile —
            aí são dois botões com texto ("Cancelar" + "Salvar edição") que espremiam
            a caixa. A partir de `md:` é sempre linha única. */}
        <form onSubmit={sendMessage} className="border-t border-border bg-card/40 px-4 py-3 backdrop-blur">
          <div className={`mx-auto flex max-w-3xl gap-3 md:flex-row md:items-end ${editing ? 'flex-col' : 'items-end'}`}>
            <textarea
              ref={textareaRef}
              rows={editing ? 4 : 2}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={warming ? t('game.warmingPlaceholder') : editing ? t('game.editPlaceholder') : t('game.actionPlaceholder')}
              aria-label={editing ? t('game.editLabel') : t('game.actionLabel')}
              disabled={streaming || warming}
              className={fieldClass('scrollbar-thin flex-1 resize-none disabled:opacity-50')}
            />
            {/* Botões: linha própria no mobile (alinhada à direita), inline no desktop. */}
            <div className="flex shrink-0 justify-end gap-3">
              {editing && (
                <DmButton variant="ghost" type="button" onClick={cancelEdit} disabled={streaming || warming}>
                  {t('game.cancel')}
                </DmButton>
              )}
              <DmButton
                type="submit"
                disabled={streaming || warming || !input.trim()}
                aria-label={editing ? t('game.saveEdit') : t('game.send')}
                className={editing ? undefined : 'px-4'}
              >
                {editing ? t('game.saveEdit') : <Send aria-hidden className={`size-4 ${streaming ? 'animate-pulse' : ''}`} />}
              </DmButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
