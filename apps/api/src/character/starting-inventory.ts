import type { InitialAdventureHook, InventoryItem, SystemClassFeature, SystemConfig, SystemSpell } from '@ai-dm/shared'

/** Lowercase + strip diacritics for fuzzy class-name matching only. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

// Cada par: [palavra-chave normalizada, chave canônica em config.startingKits/classFeatures/classSpells].
// Inclui variantes e arquétipos próximos (ex.: Arqueiro/Caçador/Ranger → patrulheiro). Ordem importa:
// chaves mais específicas antes das amplas (ex.: 'paladin' antes de 'ladin'). Vocabulário específico de
// classes estilo D&D; sistemas com outra nomenclatura simplesmente caem no `default` do próprio config.
// US-42: `brux`→bruxo e `patrulhei`/`ranger`/`cacador`→patrulheiro são chaves PRÓPRIAS (listas de magias
// distintas); antes colapsavam em feiticeiro/arqueiro. O seed renomeou os kits/features junto (ver seed.ts).
const CLASS_SYNONYMS: [string, string][] = [
  ['paladin', 'paladino'],
  ['guerreir', 'guerreiro'],
  ['lutador', 'guerreiro'],
  ['arqueir', 'patrulheiro'],
  ['patrulhei', 'patrulheiro'],
  ['cacador', 'patrulheiro'],
  ['ranger', 'patrulheiro'],
  ['ladin', 'ladino'],
  ['ladr', 'ladino'],
  ['assassin', 'ladino'],
  ['cleri', 'clerigo'],
  ['sacerdot', 'clerigo'],
  ['barbar', 'barbaro'],
  ['druid', 'druida'],
  ['bard', 'bardo'],
  // 'feitic' (não 'feiticer'): "feiticeiro" = f-e-i-t-i-c-e-i-r-o NÃO contém "feiticer"
  // (o 'i' de -eiro quebra o match). Bug latente pré-US-42: Feiticeiro caía no default.
  ['feitic', 'feiticeiro'],
  ['brux', 'bruxo'],
  ['monge', 'monge'],
  ['mong', 'monge'],
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
 * Features de classe de nível 1 do kit (US-41). Mesmo match tolerante do
 * inventário (`CLASS_SYNONYMS`), keyed pela chave canônica da classe. Classe sem
 * entrada cai no `default` do config; sem `classFeatures` no config → []. Nunca
 * inventa feature: personagem sem kit fica com lista vazia (sem crash, sem seção).
 */
export function getClassFeatures(config: SystemConfig, charClass: string): SystemClassFeature[] {
  const map = config.classFeatures
  if (!map) return []
  const cn = normalize(charClass)
  for (const [keyword, key] of CLASS_SYNONYMS) {
    const feats = map[key]
    if (cn.includes(keyword) && feats) return feats
  }
  return map.default ?? []
}

/**
 * Magias conhecidas do kit da classe (US-42). Espelha `getClassFeatures`: mesmo
 * match tolerante (`CLASS_SYNONYMS`), keyed pela chave canônica; classe sem entrada
 * cai no `default`; sem `classSpells` no config → []. Não-conjurador (ou classe sem
 * truques) → lista vazia, sem crash e sem seção de magias no prompt.
 */
export function getClassSpells(config: SystemConfig, charClass: string): SystemSpell[] {
  const map = config.classSpells
  if (!map) return []
  const cn = normalize(charClass)
  for (const [keyword, key] of CLASS_SYNONYMS) {
    const spells = map[key]
    if (cn.includes(keyword) && spells) return spells
  }
  return map.default ?? []
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
