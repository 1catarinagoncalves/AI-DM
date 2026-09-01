import { Panel, SheetHeading } from '@/components/ui/dm'

// Panel is the system's only "card" unit (design-system.md §4: no
// card-on-card) — a bare empty Panel has nothing to show, so both cells
// compose it with the kind of content it actually carries in the app: a
// character summary block (HomeHero) and a grouped/divided list
// (BackgroundPanel-style section inside a sheet).
export function CharacterSummary() {
  return (
    <Panel className="max-w-sm p-5 text-left">
      <p className="font-serif text-lg font-semibold text-parchment">Seraphine</p>
      <p className="mt-0.5 text-sm text-muted-foreground">Tiefling · Warlock · Nível 4</p>
      <p className="mt-2 text-sm text-foreground">
        Aventura atual: <span className="text-accent">A Vigília do Arboreto</span>
      </p>
    </Panel>
  )
}

export function GroupedSection() {
  return (
    <Panel className="max-w-sm overflow-hidden text-left">
      <div className="p-4">
        <SheetHeading>Ideais</SheetHeading>
        <ul className="list-inside list-disc space-y-1">
          <li className="text-[13px] text-foreground">O conhecimento tem um preço — eu pago o meu.</li>
        </ul>
      </div>
      <div className="divide-y divide-border border-t border-border">
        <div className="px-4 py-3 text-sm text-foreground">Rhogar, o Ferreiro</div>
        <div className="px-4 py-3 text-sm text-foreground">Kaelin, a Batedora</div>
      </div>
    </Panel>
  )
}
