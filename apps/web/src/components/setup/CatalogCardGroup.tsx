'use client'

import { optionCardClass } from '@/components/ui/dm'

// US-205: cartão de catálogo (classe, raça, subclasse) — nome, `kicker`/`blurb` opcionais
// (US-203) no layout do protótipo de referência (nome, depois kicker, depois blurb, sem
// espaço reservado de arte — o placeholder original nunca chegou a ganhar arte de verdade,
// tirado num pedido posterior de ajuste visual). `bonus` (ex.: "+2 Destreza") é o aumento de
// atributo — da raça (ou só o delta da variante, ver SetupWizard.tsx), derivado no ingest do
// SRD (ver `scripts/srd/race-bonus.mjs`).
// Mesmo contrato de campo que `SystemCatalogEntry` (@ai-dm/shared), sem importar o tipo
// inteiro: este componente só lê key/label/kicker/blurb/bonus, nunca grava no catálogo.
export type CatalogCardEntry = { key: string; label: string; kicker?: string; blurb?: string; bonus?: string }

// US-205: grade de cartão de rádio — substitui o `<select>` de classe/raça (US-105) e serve
// a subgrade de subclasse (US-141) aninhada no cartão de classe, e a grade de variante de
// espécie (US-142, correção de 2026-09-02) abaixo do cartão de raiz escolhido. Mesmo padrão de
// acessibilidade do `WorldOptionGroup` (SetupWizard.tsx, US-157): um `<fieldset>`/`<legend>`
// por grade inteira, `<label>` envolve `<input type="radio" class="sr-only">` — o cartão
// inteiro é o alvo de clique/foco, nunca um `div` clicável (US-46).
export function CatalogCardGroup({ name, legend, items, value, onChange }: {
  name: string
  legend: string
  items: CatalogCardEntry[]
  value: string
  onChange: (key: string) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-parchment">{legend}</legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {items.map(entry => (
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
    </fieldset>
  )
}
