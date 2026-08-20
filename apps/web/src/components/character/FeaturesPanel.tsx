'use client'

import { spellLevelLabel, type SystemSpell } from '@ai-dm/shared'
import { SheetHeading } from '@/components/ui/dm'
import { useLocale, useT } from '@/components/LocaleProvider'

// US-41: feature de classe (awareness read-only). Mesma forma do SystemClassFeature de
// @ai-dm/shared, mas só os campos que este painel usa — `key`/`source` são dado de
// persistência (US-100), sem papel na exibição.
// US-136: `origin` é opcional — só `resolveCharacterFeatures` o preenche; qualquer outro
// chamador (nenhum conhecido hoje) continua funcionando sem badge.
// US-142: traço de raça também chega marcado `origin: 'race'`, mas esta aba é só classe/origem
// (US-41/US-136 nunca cobriram raça) — filtrado antes de renderizar, não vira badge novo.
export interface ClassFeature {
  name: string
  description: string
  origin?: 'class' | 'background' | 'race'
}

// US-41/US-50: painel da aba Features da ficha. Read-only, awareness — nome + descrição curta.
// Duas secções: features de classe e magias conhecidas (US-42). Cada secção só existe
// se a sua lista tiver itens (sem título órfão); se NENHUMA tiver, mostra o empty state
// e a aba na mesma não some (igual ao painel de Background). Não resolve mecânica:
// é só o que o personagem PODE fazer. Sem slots/preparação — não existem no modelo.
//
// US-127: extraído de GameView.tsx para cá — a etapa `review` da criação (SetupWizard)
// e a ficha em jogo (GameView) consomem o MESMO componente, com dados diferentes
// (preview local vs. persistido). Um muda, os dois mudam juntos.
export function FeaturesPanel({ features, spells }: { features?: ClassFeature[]; spells?: SystemSpell[] }) {
  const t = useT()
  // US-100: o nome da magia chega já resolvido no locale (a página resolve a chave da ficha);
  // o rótulo de nível é o único texto desta lista que se monta aqui — e acompanha.
  const { locale } = useLocale()
  const featureList = (features ?? []).filter(f => f?.name?.trim() && f.origin !== 'race')
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
                <p className="flex items-center gap-2 text-sm font-semibold text-parchment">
                  {f.name}
                  {f.origin && (
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                      {t(f.origin === 'class' ? 'game.features.tag.class' : 'game.features.tag.background')}
                    </span>
                  )}
                </p>
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
