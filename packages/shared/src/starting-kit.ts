import type { InventoryItem } from './types/character'
import { resolveSheetEntries, type SystemClassFeature, type SystemConfig, type SystemWeapon } from './types/system'
import type { Locale } from './locale'
import { DWARF_TOOL_PROFICIENCY_CHOICES } from './dwarf-tool-proficiency'

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

/**
 * US-226: `equipmentChoices` é `Character.equipmentChoices` — um índice por slot de
 * `config.classes[classKey].startingEquipmentChoices.choices`, na mesma ordem. Classe sem
 * `startingEquipmentChoices` no config (artefato pré-ingest desta story, ou a5e-ag/marshal) OU
 * `equipmentChoices` ausente → cai no `startingKits[classKey]` de sempre, byte a byte (nenhuma
 * regressão do comportamento anterior a esta story). Índice ausente ou fora do intervalo de um
 * slot → opção 0 (a mesma que `startingKits` já grava para esse slot), nunca lança — mesma
 * disciplina "nunca quebra" de `getRaceToolEquipment`/`getBackgroundEquipment`.
 */
export function getStartingInventory(config: SystemConfig, classKey: string, equipmentChoices?: number[]): InventoryItem[] {
  const resolved = resolveEquipmentSlots(config, classKey)
  if (!resolved) {
    // SystemConfigSchema garante a chave `default`; ver types/system.ts.
    return config.startingKits[classKey] ?? (config.startingKits.default as InventoryItem[])
  }
  return [
    ...resolved.fixed,
    ...resolved.slots.map((slot, i) => slot.options[equipmentChoices?.[i] ?? 0] ?? slot.options[0]!).flat(),
  ]
}

// US-229: as 3 formas de texto que a `startingEquipmentChoices` do ingest produz pra uma
// alternativa de arma GENÉRICA ("escolha qualquer arma desta categoria"), nos dois locales —
// varredura ad-hoc confirmou que são só estas 3, nunca "ranged" sozinho, nunca "martial" sem
// qualificador de tipo (US-229 §Contexto). Mapa em vez de regex: só 6 strings concretas existem
// hoje, e um lookup exaustivo não corre risco de casar acento errado (ex. "À Distância").
type GenericWeaponItem = { category: 'simple' | 'martial'; weaponType?: 'melee' | 'ranged' }
const GENERIC_WEAPON_ITEMS: Record<string, GenericWeaponItem> = {
  'Any Simple Weapon': { category: 'simple' },
  'Qualquer Arma Simples': { category: 'simple' },
  'Any Simple Melee Weapon': { category: 'simple', weaponType: 'melee' },
  'Qualquer Arma Simples Corpo a Corpo': { category: 'simple', weaponType: 'melee' },
  'Any Martial Melee Weapon': { category: 'martial', weaponType: 'melee' },
  'Qualquer Arma Marcial Corpo a Corpo': { category: 'martial', weaponType: 'melee' },
}

function parseGenericWeaponItem(name: string): GenericWeaponItem | undefined {
  return GENERIC_WEAPON_ITEMS[name]
}

/**
 * US-229 §Contexto "achado crítico": `category`/`weaponType` sozinhos não garantem que a
 * classe seja PROFICIENTE na arma — druida e feiticeiro têm `weaponProficiencies.categories`
 * vazio, proficiência 100% em lista NOMEADA (`.weapons`). Nesse caso o pool vem só da lista
 * nomeada (filtrada por `weaponType` quando o item genérico pede um), NUNCA cruzado com
 * `category` — uma arma pode estar na lista nomeada com categoria de catálogo diferente da do
 * item genérico (ex.: Cimitarra é `martial` no catálogo, mas está na lista nomeada do druida
 * dentro do balde "Qualquer Arma Simples", porque a SRD concede aquela exceção nomeada). Classe
 * com `categories` não-vazio (os outros 6 das 8 com item genérico) já resolve por categoria —
 * a lista nomeada nem entra na conta.
 */
function matchingWeapons(
  generic: GenericWeaponItem,
  weapons: SystemWeapon[],
  weaponProficiencies?: { categories: string[]; weapons: string[] },
): SystemWeapon[] {
  const matchesType = (w: SystemWeapon) => !generic.weaponType || w.weaponType === generic.weaponType
  if (weaponProficiencies && weaponProficiencies.categories.length === 0) {
    return weaponProficiencies.weapons
      .map((key) => weapons.find((w) => w.key === key))
      .filter((w): w is SystemWeapon => !!w && matchesType(w))
  }
  return weapons.filter((w) => w.category === generic.category && matchesType(w))
}

/**
 * Substitui, DENTRO do slot, a alternativa genérica por uma alternativa por arma casada
 * (US-229 §Decisão de UI — nenhum controle novo, só mais `<option>` no mesmo `<select>`). Só
 * uma alternativa de item ÚNICO pode ser genérica (é o formato que o ingest sempre produz para
 * ela, ver GENERIC_WEAPON_ITEMS); alternativas nomeadas (ex. "Machado Grande") passam intactas.
 */
function flattenWeaponOptions(
  options: InventoryItem[][],
  weapons: SystemWeapon[],
  weaponProficiencies?: { categories: string[]; weapons: string[] },
): InventoryItem[][] {
  return options.flatMap((option) => {
    const generic = option.length === 1 ? parseGenericWeaponItem(option[0]!.name) : undefined
    if (!generic) return [option]
    return matchingWeapons(generic, weapons, weaponProficiencies).map((w) => [{ name: w.label, qty: option[0]!.qty }])
  })
}

export type EquipmentChoiceSlot = { options: InventoryItem[][] }

/**
 * US-229: junta os slots de `choices` (US-226) com um slot SINTÉTICO por item genérico solto
 * dentro de `fixed` — o caso do bruxo, "Qualquer Arma Simples" GARANTIDO, sem alternativa
 * nomeada nenhuma (US-229 §Contexto "achado que muda o escopo") — e ACHATA cada slot resultante
 * com `flattenWeaponOptions`. `equipmentChoices[i]` (US-226) passa a indexar esta lista JÁ
 * ACHATADA: o componente (SetupWizard) e `getStartingInventory` chamam esta MESMA função pra
 * nunca divergir, mesma disciplina do preview nunca divergir da criação (US-127).
 */
export function resolveEquipmentSlots(config: SystemConfig, classKey: string): { fixed: InventoryItem[]; slots: EquipmentChoiceSlot[] } | undefined {
  const classEntry = config.classes?.find((c) => c.key === classKey)
  const equipment = classEntry?.startingEquipmentChoices
  if (!equipment) return undefined
  const weapons = config.weapons ?? []
  const weaponProficiencies = classEntry?.weaponProficiencies
  const fixed = equipment.fixed.filter((item) => !parseGenericWeaponItem(item.name))
  const syntheticSlots = equipment.fixed
    .filter((item) => parseGenericWeaponItem(item.name))
    .map((item) => ({ options: [[item]] }))
  const slots = [...equipment.choices, ...syntheticSlots].map((slot) => ({
    options: flattenWeaponOptions(slot.options, weapons, weaponProficiencies),
  }))
  return { fixed, slots }
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
 * Feature nomeada da origem (US-135), pela chave do background (US-122 `origin.key`) — espelha
 * `getBackgroundEquipment`: sem fallback `default` (origem é opcional), chave sem entrada no
 * catálogo devolve [], nunca lança.
 */
export function getBackgroundFeatures(config: SystemConfig, originKey?: string): string[] {
  if (!originKey) return []
  const map = config.backgroundFeatures
  if (!map) return []
  return (map[originKey] ?? []).map((f) => f.key)
}

/**
 * Ferramenta de artesão do traço racial do anão (`Character.raceToolChoice`), como item físico
 * do kit inicial — pedido explícito além da proficiência em si (que já entra em `Character.tools`
 * pelo mesmo caminho de `applyToolGrant`, US-132): a jogadora que escolhe "Ferramentas de
 * Ferreiro" espera achar o item no inventário, não só a proficiência na ficha. `raceKey` diferente
 * de `hill-dwarf` (único anão jogável) ou `toolChoice` ausente/fora das 3 chaves do traço →
 * lista vazia, nunca lança (mesmo tratamento sem-crash de `getBackgroundEquipment`).
 */
export function getRaceToolEquipment(config: SystemConfig, raceKey: string, toolChoice?: string): InventoryItem[] {
  if (raceKey !== 'hill-dwarf') return []
  if (!toolChoice || !(DWARF_TOOL_PROFICIENCY_CHOICES as readonly string[]).includes(toolChoice)) return []
  const label = config.tools?.find((t) => t.key === toolChoice)?.label
  return label ? [{ name: label, qty: 1 }] : []
}

/**
 * Traço mecânico da RAÇA escolhida (US-142), pela chave jogável de `config.races` (raiz sem
 * subespécie, ou subespécie — a raiz que TEM subespécie nunca chega aqui, `validateCatalogKey`
 * barra antes). Espelha `getClassFeatures`: sem fallback `default` (não existe "raça default"),
 * chave sem entrada devolve [], nunca lança.
 */
export function getRaceFeatures(config: SystemConfig, raceKey: string): string[] {
  const map = config.raceFeatures
  if (!map) return []
  return (map[raceKey] ?? []).map((f) => f.key)
}

/** US-136/US-142: `SystemClassFeature` + de qual catálogo a chave veio, calculado ANTES do merge. */
export type CharacterFeature = SystemClassFeature & { origin: 'class' | 'background' | 'race' }

/**
 * Resolve `Character.features` (chaves de classe, de origem e de raça misturadas, US-135/US-142)
 * contra a UNIÃO dos três catálogos — `resolveSheetEntries` sozinho só enxerga um mapa por vez, e
 * uma chave de origem/raça passada contra `classFeatures` cairia no fallback `{key, name: key}`.
 * Mapa sintético de uma entrada por trás, mesmo `retiredFeatures` servindo as três fontes (US-100).
 *
 * US-136: `origin` marca cada item como `'class'`, `'background'` ou `'race'` por pertencimento
 * aos `Set`s de chave de `classList`/`originList`/`raceList` — NUNCA por parsing de prefixo
 * (`a5e-ag_*` vs `<classe>_*`), que é detalhe de formato do dataset, não contrato. Calculado sobre
 * as chaves de entrada (que cobrem também `retiredFeatures` indiretamente, US-100), não sobre o
 * resultado já resolvido. `raceKey` é opcional (US-142 chegou depois): sem ele, traço de raça cai
 * no fallback `'background'` de antes — chamador que não passa raça continua como estava.
 */
export function resolveCharacterFeatures(
  config: SystemConfig,
  classKey: string,
  originKey: string | undefined,
  featureKeys: string[],
  raceKey?: string,
): CharacterFeature[] {
  const classList = config.classFeatures?.[classKey] ?? config.classFeatures?.default ?? []
  const originList = originKey ? (config.backgroundFeatures?.[originKey] ?? []) : []
  const raceList = raceKey ? (config.raceFeatures?.[raceKey] ?? []) : []
  const classKeys = new Set(classList.map((f) => f.key))
  const raceKeys = new Set(raceList.map((f) => f.key))
  const resolved = resolveSheetEntries({ combined: [...classList, ...originList, ...raceList] }, config.retiredFeatures, 'combined', featureKeys)
  return resolved.map((f) => ({
    ...f,
    origin: classKeys.has(f.key) ? 'class' : raceKeys.has(f.key) ? 'race' : 'background',
  }))
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
