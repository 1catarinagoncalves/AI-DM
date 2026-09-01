import { FieldLabel, fieldClass } from '@/components/ui/dm'

// FieldLabel never appears alone in the app (US-46: "placeholder never the
// only label") — always paired with fieldClass() above an <input>/<select>.
// One story shows that real pairing; a second shows the label alone so its
// own type/spacing/token grade is unambiguous.
export function WithField() {
  return (
    <div className="max-w-xs">
      <FieldLabel htmlFor="name">Nome do personagem</FieldLabel>
      <input id="name" className={fieldClass()} defaultValue="Seraphine" />
    </div>
  )
}

export function Alone() {
  return <FieldLabel>Classe</FieldLabel>
}
