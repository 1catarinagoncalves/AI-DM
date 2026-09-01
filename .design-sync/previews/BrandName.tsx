import { BrandName } from '@/components/BrandName'

// Renders inside the SceneFrame header font/color context (parchment on
// dark scrim) - on the bare card bg it'd read fine but never appear that
// way in the app, so it's wrapped in the same classes SceneFrame applies.
export function Default() {
  return (
    <div className="bg-background p-3">
      <BrandName className="font-serif text-sm font-semibold tracking-wide text-parchment" />
    </div>
  )
}
