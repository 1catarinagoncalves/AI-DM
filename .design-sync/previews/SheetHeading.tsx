import { Panel, SheetHeading } from '@/components/ui/dm'

// SheetHeading only ever appears inside a Panel (BackgroundPanel/FeaturesPanel
// both use it that way) - composing it bare would show none of its actual
// context (uppercase + accent color reads very differently on card bg).
export function Default() {
  return (
    <Panel className="max-w-xs p-4">
      <SheetHeading>Traços de Classe</SheetHeading>
    </Panel>
  )
}
