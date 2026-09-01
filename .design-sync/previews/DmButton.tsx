import { DmButton } from '@/components/ui/dm'

// Primary variant axis (design-system.md §3): primary | ghost | danger.
// Disabled folds into the Primary cell (US-46: disabled:opacity-45,
// pointer-events-none) rather than a 4th cell — the visual delta is a single
// utility class, not worth its own card.
export function Primary() {
  return (
    <div className="flex flex-col gap-3">
      <DmButton>Continuar</DmButton>
      <DmButton disabled>Continuar</DmButton>
    </div>
  )
}

export function Ghost() {
  return <DmButton variant="ghost">Novo personagem</DmButton>
}

export function Danger() {
  return <DmButton variant="danger">Apagar Seraphine</DmButton>
}
