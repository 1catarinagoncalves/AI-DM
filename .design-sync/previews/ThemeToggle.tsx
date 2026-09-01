import { ThemeToggle } from '@/components/ThemeToggle'

// `fixed` positioned (top-4 right-4) in the real app - escapes normal flow,
// so cfg.overrides.ThemeToggle pins cardMode:"single" + a small viewport
// (design-sync §4.2 "Overlay components") instead of collapsing to 0 height.
export function Default() {
  return <ThemeToggle />
}
