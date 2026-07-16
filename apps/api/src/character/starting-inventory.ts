import type { InitialAdventureHook, InventoryItem, SystemClassFeature, SystemConfig, SystemSpell } from '@ai-dm/shared'

/** Lowercase + strip diacritics for fuzzy class-name matching only. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

// Cada par: [palavra-chave normalizada, chave canônica em config.startingKits/classFeatures/
// classSpells/initialAdventures.hooks[].classKey].
//
// AS DUAS COLUNAS SÃO COISAS DIFERENTES — não unifique, não "limpe":
//   • ESQUERDA = matcher da entrada LIVRE do jogador (Character.class é texto que ele digita).
//     É deliberadamente multilíngue e inclui variantes/arquétipos próximos: 'ranger', 'cacador'
//     e 'arqueir' casam o mesmo Ranger que 'patrulhei'. Continua aceitando PT: quem digita
//     "Bruxo" TEM de achar a chave `warlock`. Tirar as palavras PT quebra a criação em PT-BR.
//   • DIREITA = chave canônica do config, em inglês desde a US-54 (a base nativa dos dados é EN,
//     ver ADR 005). Não é exibida ao jogador; a UI segue em PT (SetupWizard).
// Logo, pares como ['ranger', 'ranger'] e ['bard', 'bard'] são COINCIDÊNCIA entre uma palavra que
// o jogador pode digitar e um identificador — não duplicação a remover.
//
// Ordem importa: chaves mais específicas antes das amplas (ex.: 'paladin' antes de 'ladin').
// Vocabulário específico de classes estilo D&D; sistemas com outra nomenclatura simplesmente caem
// no `default` do próprio config.
// US-42: `brux`→warlock e `patrulhei`/`ranger`/`cacador`→ranger são chaves PRÓPRIAS (listas de magias
// distintas); antes colapsavam em feiticeiro/arqueiro. O seed renomeou os kits/features junto (ver seed.ts).
const CLASS_SYNONYMS: [string, string][] = [
  ['paladin', 'paladin'],
  ['guerreir', 'fighter'],
  ['lutador', 'fighter'],
  ['arqueir', 'ranger'],
  ['patrulhei', 'ranger'],
  ['cacador', 'ranger'],
  ['ranger', 'ranger'],
  ['ladin', 'rogue'],
  ['ladr', 'rogue'],
  ['assassin', 'rogue'],
  ['cleri', 'cleric'],
  ['sacerdot', 'cleric'],
  ['barbar', 'barbarian'],
  ['druid', 'druid'],
  ['bard', 'bard'],
  // 'feitic' (não 'feiticer'): "feiticeiro" = f-e-i-t-i-c-e-i-r-o NÃO contém "feiticer"
  // (o 'i' de -eiro quebra o match). Bug latente pré-US-42: Feiticeiro caía no default.
  ['feitic', 'sorcerer'],
  ['brux', 'warlock'],
  ['monge', 'monk'],
  ['mong', 'monk'],
  ['mag', 'wizard'],
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
 * Escolhe o gancho de aventura inicial pela classe do personagem (US-28). Mesmo match
 * tolerante do inventário/features (`CLASS_SYNONYMS`), agora que `classKey` é a chave
 * canônica EN e não mais o nome PT exibido (US-54): comparar `classKey` direto com o
 * texto do jogador mandaria todo personagem PT para o `default`. Classe sem gancho
 * próprio cai no hook `default`. Devolve null só quando o sistema não traz catálogo algum.
 */
export function resolveInitialHook(config: SystemConfig, charClass: string): InitialAdventureHook | null {
  const hooks = config.initialAdventures?.hooks
  if (!hooks || hooks.length === 0) return null
  const cn = normalize(charClass)
  for (const [keyword, key] of CLASS_SYNONYMS) {
    if (!cn.includes(keyword)) continue
    const hook = hooks.find((h) => h.classKey === key)
    if (hook) return hook
  }
  return hooks.find((h) => h.classKey === 'default') ?? null
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
