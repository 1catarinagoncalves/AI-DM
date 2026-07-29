import Image from 'next/image'
import { Swords } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Primitivas do design system "grimório vivo".
// Documento canónico: docs/sdlc/02-design/design-system.md
// Regra: as telas compõem estas primitivas; nenhuma escreve cor literal.

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/** Superfície emoldurada — a única unidade de "card" do sistema (sem card-sobre-card). */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('dm-panel rounded-lg', className)}>{children}</div>
}

/** Título de tela. Serif + acento; o único sítio onde `text-shadow-fantasy` entra. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cn('text-shadow-fantasy font-serif text-2xl font-bold tracking-wide text-primary sm:text-3xl', className)}>
      {children}
    </h1>
  )
}

export type DmVariant = 'primary' | 'ghost' | 'danger'

const VARIANT_CLASS: Record<DmVariant, string> = {
  primary:
    'border border-primary/60 bg-gradient-to-b from-primary to-ember text-primary-foreground shadow-[0_6px_20px_-6px_var(--ember)] hover:brightness-110',
  ghost:
    'border border-border bg-card/60 text-foreground backdrop-blur hover:border-primary/60 hover:text-primary',
  danger:
    'text-destructive hover:underline underline-offset-4',
}

// US-46: `min-h-[44px]` no base — todo alvo de toque do sistema já nasce com 44px.
const BUTTON_BASE =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold tracking-wide transition-all disabled:pointer-events-none disabled:opacity-45 active:translate-y-px'

/** Classe do botão, para quando o elemento tem de ser um `<Link>` e não um `<button>`. */
export function dmButtonClass(variant: DmVariant = 'primary', extra?: string) {
  return cn(BUTTON_BASE, VARIANT_CLASS[variant], extra)
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: DmVariant }

export function DmButton({ variant = 'primary', className, children, ...props }: BtnProps) {
  return (
    <button className={dmButtonClass(variant, className)} {...props}>
      {children}
    </button>
  )
}

/** US-46: rótulo visível e persistente acima do campo — placeholder nunca é o único rótulo. */
export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  )
}

/** Classe única de input/select/textarea. Função (não componente) para servir os três. */
export function fieldClass(extra?: string) {
  return cn(
    'w-full rounded-md border border-input bg-background/60 px-3 py-2 text-base sm:text-sm text-foreground shadow-inner backdrop-blur placeholder:text-muted-foreground/70 focus:border-primary/60',
    extra,
  )
}

/** Rótulo de secção dentro de um painel (ficha, revisão). Caixa alta, acento, tracking largo. */
export function SheetHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">{children}</h3>
  )
}

/** Marca. Substitui o emoji `⚔` que era o tell nº 2 da auditoria visual. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-primary/40 bg-gradient-to-b from-primary/25 to-transparent p-2 text-primary shadow-[inset_0_1px_0_var(--panel-sheen)]',
        className,
      )}
    >
      <Swords className="size-full" strokeWidth={2} aria-hidden />
    </span>
  )
}

// Scrim sobre a arte de cena. Quanto mais texto a tela tem, mais escuro — a
// legibilidade ganha sempre da atmosfera.
const DIM_CLASS = {
  light: 'bg-background/55',
  medium: 'bg-background/75',
  heavy: 'bg-background/88',
} as const

/**
 * Moldura de cena: arte de fundo + scrim + vinheta + cabeçalho da marca.
 * `<div>` e não `<main>` — o landmark `<main>` vive no layout, um por página (US-46).
 */
export function SceneFrame({
  scene,
  dim = 'medium',
  children,
  className,
}: {
  scene: string
  dim?: keyof typeof DIM_CLASS
  children: ReactNode
  className?: string
}) {
  return (
    <div className="dm-vignette relative flex min-h-dvh w-full flex-col overflow-hidden">
      {/* next/image (e não background-image) para o Next servir WebP/AVIF redimensionado:
          os PNG de origem têm ~2 MB cada e o plano é custo zero (ADR 006). */}
      <Image
        src={scene}
        alt=""
        aria-hidden
        fill
        priority
        quality={60}
        sizes="100vw"
        className="object-cover"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className={cn('absolute inset-0', DIM_CLASS[dim])} aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-transparent to-background/90" aria-hidden />

      <header className="relative z-10 flex items-center gap-2 px-4 py-3 sm:px-6">
        <Logo className="size-8" />
        <span className="hidden font-serif text-sm font-semibold tracking-wide text-parchment sm:inline">
          AI Dungeon Master
        </span>
      </header>

      <div className={cn('relative z-10 flex flex-1 flex-col', className)}>{children}</div>
    </div>
  )
}
