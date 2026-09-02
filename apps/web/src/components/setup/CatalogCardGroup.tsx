'use client'

import { optionCardClass } from '@/components/ui/dm'

// US-205: cartão de catálogo (classe, raça, subclasse) — nome, `kicker`/`blurb` opcionais
// (US-203) no layout do protótipo de referência (nome, depois kicker, depois blurb, sem
// espaço reservado de arte — o placeholder original nunca chegou a ganhar arte de verdade,
// tirado num pedido posterior de ajuste visual). `bonus` (ex.: "+2 Destreza") é o aumento de
// atributo da raça, derivado no ingest do SRD (ver `scripts/srd/race-bonus.mjs`).
// Mesmo contrato de campo que `SystemCatalogEntry` (@ai-dm/shared), sem importar o tipo
// inteiro: este componente só lê key/label/kicker/blurb/bonus, nunca grava no catálogo.
export type CatalogCardEntry = { key: string; label: string; kicker?: string; blurb?: string; bonus?: string }

// Um grupo de cartões, com cabeçalho opcional — usado pela raiz de raça que TEM subespécie
// (US-142): a raiz vira `header`, a(s) subespécie(s) são os `items` selecionáveis. Grupo sem
// `header` (classe, subclasse, raiz de raça SEM subespécie) não desenha rótulo próprio.
export type CatalogCardGroupEntry = { header?: string; items: CatalogCardEntry[] }

// US-205: grade de cartão de rádio — substitui o `<select>` de classe/raça (US-105) e serve
// a subgrade de subclasse (US-141) aninhada no cartão de classe. Mesmo padrão de acessibilidade
// do `WorldOptionGroup` (SetupWizard.tsx, US-157): um `<fieldset>`/`<legend>` por grade inteira,
// `<label>` envolve `<input type="radio" class="sr-only">` — o cartão inteiro é o alvo de
// clique/foco, nunca um `div` clicável (US-46).
//
// `groups` (em vez de `catalog` flat) é o que permite os TRÊS usos com um componente só
// (classe, subclasse: um grupo sem header; raça: N grupos, com header só onde há subespécie) —
// notas de implementação da US-205: "um componente de grade, dois usos" (na prática, três).
export function CatalogCardGroup({ name, legend, groups, value, onChange }: {
  name: string
  legend: string
  groups: CatalogCardGroupEntry[]
  value: string
  onChange: (key: string) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-parchment">{legend}</legend>
      <div className="space-y-4">
        {groups.map((group, i) => (
          <div key={group.header ?? i}>
            {group.header && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.header}</p>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {group.items.map(entry => (
                <label key={entry.key} className={optionCardClass(value === entry.key)}>
                  <input type="radio" name={name} value={entry.key} checked={value === entry.key}
                    onChange={() => onChange(entry.key)} className="sr-only" />
                  <span className="block font-serif text-base font-semibold text-parchment">{entry.label}</span>
                  {entry.kicker && (
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{entry.kicker}</span>
                  )}
                  {entry.blurb && <span className="mt-1 block text-xs text-muted-foreground">{entry.blurb}</span>}
                  {entry.bonus && <span className="mt-2 block text-[11px] font-medium text-primary">{entry.bonus}</span>}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  )
}

// US-142: agrupa o catálogo de raça por raiz — raiz COM subespécie vira `header` (não
// selecionável), raiz SEM subespécie é cartão normal. Mesma lógica de `filter(parentKey)`
// que o `<select>`/`<optgroup>` antigo já tinha (US-140), só a FORMA de saída muda: consecutivos
// sem header são mesclados num grupo só, pra empacotar 2 colunas em vez de 1 cartão por linha.
export function groupRaceCatalog(raceCatalog: Array<CatalogCardEntry & { parentKey?: string }>): CatalogCardGroupEntry[] {
  const roots = raceCatalog.filter(r => !r.parentKey)
  const groups: CatalogCardGroupEntry[] = []
  let standalone: CatalogCardEntry[] = []
  for (const root of roots) {
    const subspecies = raceCatalog.filter(r => r.parentKey === root.key)
    if (subspecies.length === 0) {
      standalone.push(root)
      continue
    }
    if (standalone.length > 0) { groups.push({ items: standalone }); standalone = [] }
    groups.push({ header: root.label, items: subspecies })
  }
  if (standalone.length > 0) groups.push({ items: standalone })
  return groups
}
