import { DmButton } from '@/components/ui/dm'
import { useT } from '@/components/LocaleProvider'
import type { AdventureReadiness } from './useAdventureReadiness'

/**
 * US-256: faixa acima do input enquanto o RESTO da aventura ainda gera (`preparing`) ou
 * quando ele falhou (`failed`, com "Tentar de novo"). Não é modal — a abertura segue legível.
 * Só texto do dicionário: a mensagem crua da API nunca chega aqui (AGENTS.md → Frontend).
 */
export function AdventureReadinessNotice({ readiness }: { readiness: AdventureReadiness }) {
  const t = useT()
  if (readiness.phase === 'ready') return null

  if (readiness.phase === 'preparing') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 border-t border-border bg-card/60 px-4 py-2 text-xs text-accent backdrop-blur"
      >
        <span aria-hidden="true" className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-primary" />
        {t('game.rest.preparing')}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-destructive/10 px-4 py-2 text-xs text-destructive"
    >
      <span>{readiness.retryError ? t('game.rest.retryError') : t('game.rest.failed')}</span>
      <DmButton variant="ghost" type="button" onClick={readiness.retry} disabled={readiness.retrying}>
        {t('common.retry')}
      </DmButton>
    </div>
  )
}
