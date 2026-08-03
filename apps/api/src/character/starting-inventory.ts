import type { InitialAdventureHook, InventoryItem, SystemConfig } from '@ai-dm/shared'

// US-105: `classKey` é a CHAVE canônica gravada no Character (`wizard`, `paladin`), validada
// contra `config.classes` na criação — não é mais o texto livre que o jogador digitava. Por isso
// o lookup aqui é DIRETO, e não mais por substring.
//
// O que saiu daqui: o `CLASS_SYNONYMS`, matcher que casava trecho normalizado do texto PT contra
// a chave ('mag' → wizard). Ele sobrevive só como camada de migração das fichas antigas, em
// prisma/migrate-race-class-keys.ts — no caminho de leitura era dívida esperando o primeiro
// sistema com uma classe chamada "Magistrado".
//
// O fallback `default` FICA: sistema custom (ou classe fora do catálogo do próprio config, como
// o Free antes de ter kit por classe) continua caindo nele em vez de quebrar.

export function getStartingInventory(config: SystemConfig, classKey: string): InventoryItem[] {
  // SystemConfigSchema garante a chave `default`; ver types/system.ts em @ai-dm/shared.
  return config.startingKits[classKey] ?? (config.startingKits.default as InventoryItem[])
}

/**
 * Features de classe de nível 1 do kit (US-41), pela chave canônica da classe. Classe sem
 * entrada cai no `default` do config; sem `classFeatures` no config → []. Nunca inventa
 * feature: personagem sem kit fica com lista vazia (sem crash, sem seção).
 *
 * US-100: devolve as CHAVES, não os objetos. A ficha guarda a pergunta ("qual feature?"), não a
 * resposta no idioma de quem criou — quem devolve nome e descrição é o `resolveSheetEntries`, na
 * LEITURA, com o config do locale ativo. Lê só `classFeatures`: conteúdo aposentado
 * (`retiredFeatures`) resolve ficha antiga e nunca entra em personagem novo.
 */
export function getClassFeatures(config: SystemConfig, classKey: string): string[] {
  const map = config.classFeatures
  if (!map) return []
  return (map[classKey] ?? map.default ?? []).map((f) => f.key)
}

/**
 * Magias conhecidas do kit da classe (US-42). Espelha `getClassFeatures`: lookup pela chave
 * canônica; classe sem entrada cai no `default`; sem `classSpells` no config → [].
 * Não-conjurador (ou classe sem truques) → lista vazia, sem crash e sem seção no prompt.
 * US-100: também devolve chaves (aqui o slug nu do dataset, não prefixado por classe).
 */
export function getClassSpells(config: SystemConfig, classKey: string): string[] {
  const map = config.classSpells
  if (!map) return []
  return (map[classKey] ?? map.default ?? []).map((s) => s.key)
}

/**
 * Escolhe o gancho de aventura inicial pela classe do personagem (US-28). `classKey` do hook
 * é a chave canônica EN desde a US-54, e desde a US-105 `Character.class` também é — logo a
 * comparação é direta. Classe sem gancho próprio cai no hook `default`. Devolve null só
 * quando o sistema não traz catálogo algum.
 */
export function resolveInitialHook(config: SystemConfig, classKey: string): InitialAdventureHook | null {
  const hooks = config.initialAdventures?.hooks
  if (!hooks || hooks.length === 0) return null
  return hooks.find((h) => h.classKey === classKey) ?? hooks.find((h) => h.classKey === 'default') ?? null
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
