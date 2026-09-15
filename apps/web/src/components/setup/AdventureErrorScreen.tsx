'use client'

import { useT } from '@/components/LocaleProvider'
import { DmButton, SectionTitle } from '@/components/ui/dm'

/**
 * US-235: teto do gate de geração estourado (ou timeout do polling do cliente) — tela
 * dedicada com retry, nunca desvia pra "Aventura pronta" (decisão fechada da mantenedora,
 * 2026-09-09). O motivo técnico devolvido por `getAdventureStatus` (`error`) não aparece
 * aqui — é texto interno, não localizado.
 */
export function AdventureErrorScreen({ onRetry }: { onRetry: () => void }) {
  const t = useT()

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <SectionTitle>{t('setup.world.error.titulo')}</SectionTitle>
      <p className="mt-4 max-w-md font-serif text-lg text-parchment">{t('setup.world.error.mensagem')}</p>
      <DmButton type="button" className="mt-6" onClick={onRetry}>
        {t('setup.world.error.retry')}
      </DmButton>
    </div>
  )
}
