'use client'

import { SheetHeading } from '@/components/ui/dm'
import { useT } from '@/components/LocaleProvider'
import type { MessageKey } from '@/messages'

// US-45: mesma forma do CharacterBackground de @ai-dm/ai-engine (web não depende
// desse pacote), tipada estruturalmente aqui — não redefinir a forma noutro lugar.
export interface CharacterBackground {
  story?: string
  ideals?: string[]
  bonds?: string[]
  flaws?: string[]
  // US-40: divindade/patrono opcional (nome + portfólio).
  deity?: { name: string; portfolio?: string }
}

// US-45: painel da aba Background da ficha. Read-only. Cada eixo só vira bloco se tiver
// conteúdo; se nenhum tiver, mostra o empty state (a aba nunca some — só o conteúdo).
//
// US-127: extraído de GameView.tsx para cá — a etapa `review` da criação (SetupWizard)
// e a ficha em jogo (GameView) consomem o MESMO componente, com dados diferentes
// (preview local vs. persistido). Um muda, os dois mudam juntos.
// US-124: `connection`/`memento` são campos IRMÃOS de `originName`, não parte de
// `CharacterBackground` — vêm de `Character.origin.{connection,memento}`, texto escolhido
// no `<select>` da criação (não prosa livre do jogador, ver US-124 §Modelo de dados).
// US-138: `adventures` é o gancho `adventures_and_advancement` do catálogo (prosa FIXA por
// `originKey`, já usada pelo Mestre desde a US-125) — mesmo padrão condicional de connection/memento.
export function BackgroundPanel({ background, originName, connection, memento, adventures }: { background?: CharacterBackground; originName?: string; connection?: string; memento?: string; adventures?: string }) {
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
  const hasAny = Boolean(story) || Boolean(deityText) || Boolean(originName) || Boolean(connection) || Boolean(memento) || Boolean(adventures) || lists.some(l => l.items.length > 0)

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('game.background.empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* US-122: origem do catálogo (US-121) primeiro — mesma ordem da revisão da criação
          (escolha estruturada antes da prosa livre). Campo IRMÃO de `background`. */}
      {originName && (
        <div>
          <SheetHeading>{t('game.background.origin')}</SheetHeading>
          <p className="text-[13px] leading-relaxed text-foreground">{originName}</p>
        </div>
      )}
      {/* US-124: conexão/memento escolhidos na criação — mesmo estilo de bloco de origem. */}
      {connection && (
        <div>
          <SheetHeading>{t('game.background.connection')}</SheetHeading>
          <p className="text-[13px] leading-relaxed text-foreground">{connection}</p>
        </div>
      )}
      {memento && (
        <div>
          <SheetHeading>{t('game.background.memento')}</SheetHeading>
          <p className="text-[13px] leading-relaxed text-foreground">{memento}</p>
        </div>
      )}
      {adventures && (
        <div>
          <SheetHeading>{t('game.background.adventures')}</SheetHeading>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{adventures}</p>
        </div>
      )}
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
