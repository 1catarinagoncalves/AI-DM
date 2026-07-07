import type { InitialAdventureHook, InventoryItem, SystemConfig } from '@ai-dm/shared'

/** Lowercase + strip diacritics for fuzzy class-name matching only. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

// Cada par: [palavra-chave normalizada, chave canônica em config.startingKits]. Inclui variantes e
// arquétipos próximos (ex.: Patrulheiro/Caçador → arqueiro). Ordem importa: chaves mais específicas
// antes das amplas (ex.: 'paladin' antes de 'ladin'). Vocabulário específico de classes estilo D&D;
// sistemas com outra nomenclatura simplesmente caem no `default` do próprio config.
const CLASS_SYNONYMS: [string, string][] = [
  ['paladin', 'paladino'],
  ['guerreir', 'guerreiro'],
  ['lutador', 'guerreiro'],
  ['arqueir', 'arqueiro'],
  ['patrulhei', 'arqueiro'],
  ['cacador', 'arqueiro'],
  ['ranger', 'arqueiro'],
  ['ladin', 'ladino'],
  ['ladr', 'ladino'],
  ['assassin', 'ladino'],
  ['cleri', 'clerigo'],
  ['sacerdot', 'clerigo'],
  ['barbar', 'barbaro'],
  ['druid', 'druida'],
  ['bard', 'bardo'],
  ['feiticer', 'feiticeiro'],
  ['brux', 'feiticeiro'],
  ['mag', 'mago'],
]

export function getStartingInventory(config: SystemConfig, charClass: string): InventoryItem[] {
  const kits = config.startingKits
  const cn = normalize(charClass)
  for (const [keyword, key] of CLASS_SYNONYMS) {
    const kit = kits[key]
    if (cn.includes(keyword) && kit) return kit
  }
  // SystemConfigSchema garante a chave `default`; ver types/system.ts em @ai-dm/shared.
  return kits.default as InventoryItem[]
}

/**
 * Escolhe o gancho de aventura inicial pela classe do personagem (US-28).
 * Match tolerante a acento/caixa contra `classKey`; sem match seguro cai no
 * hook `default`. Devolve null só quando o sistema não traz catálogo algum.
 */
export function resolveInitialHook(config: SystemConfig, charClass: string): InitialAdventureHook | null {
  const hooks = config.initialAdventures?.hooks
  if (!hooks || hooks.length === 0) return null
  const cn = normalize(charClass)
  const match = hooks.find((h) => h.classKey !== 'default' && normalize(h.classKey) === cn)
  return match ?? hooks.find((h) => h.classKey === 'default') ?? null
}

/** Resolve placeholders do hook antes de persistir. Suporta {characterName} e {characterClass}. */
export function resolveHookTemplate(
  text: string,
  vars: { characterName: string; characterClass: string },
): string {
  return text
    .replace(/\{characterName\}/g, vars.characterName)
    .replace(/\{characterClass\}/g, vars.characterClass)
}
