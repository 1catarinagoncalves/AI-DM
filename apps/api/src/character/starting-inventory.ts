import type { InventoryItem } from '@ai-dm/shared'

/** Lowercase + strip diacritics for fuzzy class-name matching only. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

const KITS = {
  guerreiro: [
    { name: 'Espada longa', qty: 1 },
    { name: 'Escudo', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Mochila', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  mago: [
    { name: 'Cajado arcano', qty: 1 },
    { name: 'Grimório', qty: 1 },
    { name: 'Vestes de mago', qty: 1 },
    { name: 'Poção de mana', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  arqueiro: [
    { name: 'Arco longo', qty: 1 },
    { name: 'Aljava (20 flechas)', qty: 1 },
    { name: 'Adaga', qty: 1 },
    { name: 'Armadura de couro leve', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  ladino: [
    { name: 'Adaga', qty: 2 },
    { name: 'Ferramentas de ladrão', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Corda', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  clerigo: [
    { name: 'Martelo', qty: 1 },
    { name: 'Símbolo sagrado', qty: 1 },
    { name: 'Armadura de malha', qty: 1 },
    { name: 'Kit de primeiros socorros', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  paladino: [
    { name: 'Espada longa', qty: 1 },
    { name: 'Escudo', qty: 1 },
    { name: 'Armadura de malha', qty: 1 },
    { name: 'Símbolo sagrado', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  barbaro: [
    { name: 'Machado grande', qty: 1 },
    { name: 'Pele de urso (armadura)', qty: 1 },
    { name: 'Adaga', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  druida: [
    { name: 'Cajado de carvalho', qty: 1 },
    { name: 'Símbolo druídico', qty: 1 },
    { name: 'Túnica de couro', qty: 1 },
    { name: 'Kit de ervas', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  bardo: [
    { name: 'Espada curta', qty: 1 },
    { name: 'Instrumento musical', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  feiticeiro: [
    { name: 'Cajado', qty: 1 },
    { name: 'Foco arcano (cristal)', qty: 1 },
    { name: 'Vestes ornamentadas', qty: 1 },
    { name: 'Poção de mana', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  // Fallback: aventureiro genérico para classes fora da tabela (US: "bom senso
  // baseado no arquétipo mais próximo"). Nunca devolvemos inventário vazio.
  default: [
    { name: 'Adaga', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Mochila', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
} satisfies Record<string, InventoryItem[]>

// Cada par: [palavra-chave normalizada, kit]. Inclui variantes e arquétipos
// próximos (ex.: Patrulheiro/Caçador → arqueiro). Ordem importa: chaves mais
// específicas antes das amplas (ex.: 'paladin' antes de 'ladin').
const MATCHERS: [string, InventoryItem[]][] = [
  ['paladin', KITS.paladino],
  ['guerreir', KITS.guerreiro],
  ['lutador', KITS.guerreiro],
  ['arqueir', KITS.arqueiro],
  ['patrulhei', KITS.arqueiro],
  ['cacador', KITS.arqueiro],
  ['ranger', KITS.arqueiro],
  ['ladin', KITS.ladino],
  ['ladr', KITS.ladino],
  ['assassin', KITS.ladino],
  ['cleri', KITS.clerigo],
  ['sacerdot', KITS.clerigo],
  ['barbar', KITS.barbaro],
  ['druid', KITS.druida],
  ['bard', KITS.bardo],
  ['feiticer', KITS.feiticeiro],
  ['brux', KITS.feiticeiro],
  ['mag', KITS.mago],
]

export function getStartingInventory(charClass: string): InventoryItem[] {
  const cn = normalize(charClass)
  for (const [keyword, items] of MATCHERS) {
    if (cn.includes(keyword)) return items
  }
  return KITS.default
}
