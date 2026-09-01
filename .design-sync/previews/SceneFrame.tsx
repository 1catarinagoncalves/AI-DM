import { SceneFrame, SectionTitle } from '@/components/ui/dm'
// Real scene art (design-system.md §4 "Fundo de cena por superfície") rather
// than a placeholder rectangle — `.png` compiles to an inlined data URL for
// preview compiles (STORY_LOADERS), so the card renders the actual pixel-art
// background instead of a broken <img>.
import tavern from '../../apps/web/public/scenes/tavern.png'

// Sweeps `dim` (design-system.md: heavier scrim = more text on screen) and
// `localeToggle` (off for the character wizard, on everywhere else).
export function Hub() {
  return (
    <SceneFrame scene={tavern} dim="medium">
      <div className="flex flex-1 items-center justify-center">
        <SectionTitle>Mestre da Crônica</SectionTitle>
      </div>
    </SceneFrame>
  )
}

export function WizardHeavyScrim() {
  return (
    <SceneFrame scene={tavern} dim="heavy" localeToggle={false}>
      <div className="flex flex-1 items-center justify-center">
        <SectionTitle>Criação de Personagem</SectionTitle>
      </div>
    </SceneFrame>
  )
}
