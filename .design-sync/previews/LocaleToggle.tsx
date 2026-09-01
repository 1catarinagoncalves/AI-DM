import { LocaleToggle } from '@/components/LocaleToggle'

// Both segments (active/inactive) are always visible at once - it's a
// segmented control, not a single-state toggle - so one story already shows
// the full variant axis (design-system.md §3: text label, never a flag).
export function Default() {
  return (
    <div className="bg-background p-3">
      <LocaleToggle />
    </div>
  )
}
