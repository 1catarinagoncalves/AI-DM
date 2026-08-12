import type { InventoryItem } from './types/character'
import type { SystemConfig } from './types/system'
import type { Locale } from './locale'

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
//
// US-127: mora em packages/shared (não mais só apps/api) porque a etapa `review` do wizard
// (apps/web) precisa do MESMO kit que a criação vai persistir depois — reusar a função em vez
// de reimplementar o lookup é o que garante que o preview nunca diverge do que a API salva.

export function getStartingInventory(config: SystemConfig, classKey: string): InventoryItem[] {
  // SystemConfigSchema garante a chave `default`; ver types/system.ts.
  return config.startingKits[classKey] ?? (config.startingKits.default as InventoryItem[])
}

/**
 * Equipamento inicial da ORIGEM escolhida (US-128), pela chave do background (US-122
 * `origin.key`). Sem fallback `default`: origem é opcional na criação e a chave pode não
 * existir no catálogo (sistema sem backgrounds) — as duas situações devolvem lista vazia,
 * nunca lançam. Item marcado `origin: 'equipment'` pelo CHAMADOR (US-128 §Notas de
 * implementação); esta função só resolve o kit cru do config, igual a `getStartingInventory`.
 */
export function getBackgroundEquipment(config: SystemConfig, originKey: string): InventoryItem[] {
  return config.backgroundEquipment?.[originKey] ?? []
}

/**
 * Rótulo fixo do item de memento no inventário (US-128) — mesma palavra usada no heading
 * `game.background.memento` (`apps/web/src/messages`), duplicada aqui porque `apps/api` não
 * tem catálogo de mensagens (sem ConfigModule/i18n, ver AGENTS.md). O nome do item nunca é o
 * texto completo escolhido (`Character.origin.memento`) — esse continua só na aba Background.
 */
export const MEMENTO_ITEM_LABEL: Record<Locale, string> = {
  'pt-BR': 'Memento',
  'en-US': 'Memento',
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
