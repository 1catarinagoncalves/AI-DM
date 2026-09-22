'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/components/LocaleProvider'
import { SectionTitle } from '@/components/ui/dm'
import type { MessageKey } from '@/messages'

const LOADING_KEYS: MessageKey[] = [
  'setup.world.loading.1',
  'setup.world.loading.2',
  'setup.world.loading.3',
  'setup.world.loading.4',
  'setup.world.loading.5',
  'setup.world.loading.6',
]

// US-197: 3s — dentro da janela 2,5-4s da story, sem exigir mais uma constante configurável.
const CAROUSEL_INTERVAL_MS = 3000

// Embaralha uma vez (não precisa ser determinística nem seguir a ordem real do motor —
// ver "Copy das mensagens" da US-197: acoplar à ordem desalinharia se o motor mudar de
// passos, como a US-190 já fez com o antagonista).
function shuffled(keys: MessageKey[]): MessageKey[] {
  const copy = [...keys]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy
}

interface AdventureLoadingScreenProps {
  /**
   * US-265: acima do limiar, o carrossel ganha o aviso de demora embaixo. Constante mora em
   * SetupWizard.tsx, ao lado de STATUS_POLL_TIMEOUT_MS — mesma janela de espera, uma fonte só.
   */
  delayThresholdMs: number
}

/**
 * Tela de espera do passo `world` enquanto `createWorldAdventure` aguarda a API (US-197).
 * Substitui o formulário quando `starting === true` — sem ação possível durante a espera.
 */
export function AdventureLoadingScreen({ delayThresholdMs }: AdventureLoadingScreenProps) {
  const t = useT()
  const [keys] = useState(() => shuffled(LOADING_KEYS))
  const [index, setIndex] = useState(0)
  const [delayed, setDelayed] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % keys.length), CAROUSEL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [keys.length])

  useEffect(() => {
    const id = setTimeout(() => setDelayed(true), delayThresholdMs)
    return () => clearTimeout(id)
  }, [delayThresholdMs])

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <SectionTitle>{t('setup.world.titulo')}</SectionTitle>
      {/* font-serif: mesma família das mensagens ambiente sobre arte de cena (GameView
          game.empty.title, HomeHero); text-lg + text-parchment sem font-serif destoava
          da identidade tipográfica do resto do wizard. */}
      <p className="mt-6 max-w-md font-serif text-lg text-parchment" aria-live="polite">
        {t(keys[index]!)}
      </p>
      {/* US-265: personagem salvo e o que sair significa — fixas, não entram no carrossel
          (não são atmosféricas, são fato). */}
      <p className="mt-4 max-w-md text-sm text-parchment">{t('setup.world.loading.saved')}</p>
      <p className="mt-1 max-w-md text-sm text-parchment">{t('setup.world.loading.exit')}</p>
      {delayed && (
        <p className="mt-4 max-w-md font-serif text-lg text-parchment" aria-live="polite">
          {t('setup.world.loading.delay')}
        </p>
      )}
    </div>
  )
}
