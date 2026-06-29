import type { InventoryItem } from '@ai-dm/shared'

/** Lowercase + strip diacritics for fuzzy class-name matching only. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

// Each tuple: [normalized keyword to detect the class, starting items]
// Order matters: more specific keywords before broader ones (e.g. 'paladin' before 'ladin').
const CLASSES: [string, InventoryItem[]][] = [
  ['paladin', [
    { name: 'Espada longa', qty: 1 },
    { name: 'Escudo', qty: 1 },
    { name: 'Armadura de malha', qty: 1 },
    { name: 'Símbolo sagrado', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
  ['guerreir', [
    { name: 'Espada longa', qty: 1 },
    { name: 'Escudo', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Mochila', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
  ['arqueir', [
    { name: 'Arco longo', qty: 1 },
    { name: 'Aljava (20 flechas)', qty: 1 },
    { name: 'Adaga', qty: 1 },
    { name: 'Armadura de couro leve', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
  ['ladin', [
    { name: 'Adaga', qty: 2 },
    { name: 'Ferramentas de ladrão', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Corda', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
  ['cleri', [
    { name: 'Martelo', qty: 1 },
    { name: 'Símbolo sagrado', qty: 1 },
    { name: 'Armadura de malha', qty: 1 },
    { name: 'Kit de primeiros socorros', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
  ['barbar', [
    { name: 'Machado grande', qty: 1 },
    { name: 'Pele de urso (armadura)', qty: 1 },
    { name: 'Adaga', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
  ['druid', [
    { name: 'Cajado de carvalho', qty: 1 },
    { name: 'Símbolo druídico', qty: 1 },
    { name: 'Túnica de couro', qty: 1 },
    { name: 'Kit de ervas', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
  ['bard', [
    { name: 'Espada curta', qty: 1 },
    { name: 'Instrumento musical', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
  ['feiticer', [
    { name: 'Cajado', qty: 1 },
    { name: 'Foco arcano (cristal)', qty: 1 },
    { name: 'Vestes ornamentadas', qty: 1 },
    { name: 'Poção de mana', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
  // mago / maga — after feiticer to avoid false matches on "mago feiticeiro"
  ['mag', [
    { name: 'Cajado arcano', qty: 1 },
    { name: 'Grimório', qty: 1 },
    { name: 'Vestes de mago', qty: 1 },
    { name: 'Poção de mana', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ]],
]

export function getStartingInventory(charClass: string): InventoryItem[] {
  const cn = normalize(charClass)
  for (const [keyword, items] of CLASSES) {
    if (cn.includes(keyword)) return items
  }
  return []
}
