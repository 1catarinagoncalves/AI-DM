'use client'

import { Languages } from 'lucide-react'
import { LOCALES, localeLabel } from '@ai-dm/shared'
import { useLocale } from '@/components/LocaleProvider'
import { cn } from '@/components/ui/dm'

// US-97: seletor de idioma. Segmentado (não `<select>`): com dois idiomas, mostra ao
// mesmo tempo o ativo e a alternativa, num toque só. Rótulo em TEXTO, nunca bandeira —
// bandeira é país, não idioma. Vive no fluxo do cabeçalho (SceneFrame / ficha), não
// como terceiro controlo `fixed` no canto: em 375px a barra da ficha já reserva à mão
// a largura do tema + Sair (GameView, `pr-40`), e um terceiro comeria o nome do herói.
export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <div
      role="group"
      aria-label={locale === 'pt-BR' ? 'Idioma da mesa' : 'Table language'}
      className={cn('inline-flex items-center gap-1 rounded-md border border-border bg-card/60 p-0.5 backdrop-blur', className)}
    >
      <Languages className="ml-1.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {LOCALES.map((option) => {
        const active = option === locale
        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            aria-pressed={active}
            // O rótulo visível encolhe para "PT"/"EN" no mobile; o nome acessível
            // fica sempre por extenso — o leitor de tela não deve ouvir "PT".
            aria-label={localeLabel(option)}
            // US-46: 44px de alvo de toque em cada metade, como o resto do sistema.
            className={cn(
              'min-h-[44px] rounded px-2.5 text-xs font-semibold tracking-wide transition-colors',
              active ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {/* Curto no mobile, por extenso a partir de `sm:` — em 375px o cabeçalho
                não tem largura para "Português" + "English" lado a lado. */}
            <span className="sm:hidden">{option === 'pt-BR' ? 'PT' : 'EN'}</span>
            <span className="hidden sm:inline">{localeLabel(option)}</span>
          </button>
        )
      })}
    </div>
  )
}
