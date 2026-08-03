import { z } from 'zod'

export const SystemAttributeSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  min: z.number().int(),
  max: z.number().int(),
  default: z.number().int(),
})

const StartingKitItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().min(1),
})

// Perícia do sistema (US-27). `ability` referencia a `key` de um atributo do
// próprio config; o modificador da perícia deriva desse atributo + proficiência.
export const SystemSkillSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  ability: z.string().min(1),
})

// Entrada de catálogo do sistema (US-105): chave canônica EN + rótulo no locale do config.
// Serve `races` e `classes`, e é o mesmo contrato de `skills` sem a âncora de atributo:
// o Character guarda a CHAVE, a tela e o prompt resolvem o rótulo na leitura.
export const SystemCatalogEntrySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
})

// Feature de classe (US-41): o que o personagem SABE FAZER de especial (Sentido
// Divino, Fúria, Ataque Furtivo…). Awareness apenas — sem usos/custo/mecânica.
// NÃO é atributo (`ability`) nem perícia (`skill`): é uma terceira coisa.
//
// US-106: `key` é a chave canônica EN do catálogo (`<classe>_<slug>`, ex. `paladin_lay-on-hands`),
// calculada pelo ingest e agora PRESERVADA — é onde a resolução por locale se pendura (US-100).
// `source` diz de onde veio ESTE texto (ADR 004, 6f): 'srd' = derivado do artefato, 'authored' =
// escrito por nós. É por entrada, não por sistema: o Free mistura as duas (7 truques + 2 features
// não existem em SRD nenhum). `z.string()` e não enum de propósito — dois valores bastam hoje, e
// o dia em que houver UPLOAD o valor novo é uma linha, não uma taxonomia inventada antes da hora.
export const SystemClassFeatureSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  source: z.string().min(1),
})

// Magia conhecida (US-42): truque/magia que o personagem SABE conjurar — awareness
// apenas. `name` (+ `level`) vai ao prompt para o mestre OFERECER; `description` volta
// sob demanda via tool getSpell. `level: 0` = truque. Sem slots/preparação/componentes
// (motor de spellcasting fica fora). Sistema irmão do SystemClassFeature.
// US-106: `key` e `source` pelo mesmo motivo do SystemClassFeature acima. A chave de magia
// NÃO é prefixada por classe (`light` é a mesma no mago e no clérigo) — quem repete é a lista
// da classe, não a chave.
export const SystemSpellSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().min(0).optional(),
  description: z.string().min(1).optional(),
  source: z.string().min(1),
})

// Gancho de aventura inicial por classe (US-28). Textos podem conter placeholders
// {characterName} e {characterClass}, resolvidos no backend antes de persistir.
export const InitialAdventureHookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  // Classe base à qual se aplica, ou 'default' (fallback para classes desconhecidas/custom).
  classKey: z.string().min(1),
  pitch: z.string().min(1),
  primaryQuestTitle: z.string().min(1),
  primaryQuestDescription: z.string().min(1),
  openingNarration: z.string().min(1),
  tags: z.array(z.string()).default([]),
})

export const SystemConfigSchema = z.object({
  attributes: z.array(SystemAttributeSchema).min(1),
  startingKits: z.record(z.string(), z.array(StartingKitItemSchema))
    .refine(kits => 'default' in kits, { message: 'startingKits precisa de uma chave "default"' }),
  // Orçamento de point-buy da etapa de Atributos (US-26). Ausente → inputs livres min/max.
  pointBuy: z.object({ budget: z.number().int().positive() }).optional(),
  // Perícias do sistema (US-27). Ausente → etapa de Perícias inativa. Quando presente,
  // `proficiency.choices` proficiências são escolhidas na criação, cada uma somando
  // `proficiency.bonus` ao modificador do atributo-âncora.
  skills: z.array(SystemSkillSchema).optional(),
  // Catálogos de raça e de classe (US-105), derivados do SRD pelo ingest. Opcionais como
  // `skills`: config legado sem eles não fica inválido — e é o que decide se o service
  // valida a chave da ficha contra catálogo ou aceita o que vier (ver character.service).
  races: z.array(SystemCatalogEntrySchema).optional(),
  classes: z.array(SystemCatalogEntrySchema).optional(),
  proficiency: z.object({
    choices: z.number().int().min(0),
    bonus: z.number().int(),
  }).optional(),
  // Features de classe de nível 1 (US-41), por chave de classe (mesmo esquema de
  // `startingKits`: chave canônica normalizada + fallback opcional). Materializadas
  // no Character.features na criação. Ausente → personagem sem features (sem crash).
  classFeatures: z.record(z.string(), z.array(SystemClassFeatureSchema)).optional(),
  // Magias conhecidas por classe (US-42), mesmo esquema de `classFeatures`: chave
  // canônica de classe + fallback opcional. Materializadas em Character.spells na
  // criação. Ausente → personagem sem magias (sem seção, sem crash).
  classSpells: z.record(z.string(), z.array(SystemSpellSchema)).optional(),
  // US-100: conteúdo APOSENTADO — chave que existia no bump anterior e saiu do catálogo vivo,
  // transportada pelo ingest com o texto do locale que ela já tinha. Serve só a RESOLUÇÃO de
  // ficha antiga (`resolveSheetEntries`): sem esta rede, um bump que retire conteúdo apaga a
  // linha da ficha de quem o tinha, em silêncio. Personagem NOVO nunca nasce com ela — quem lê
  // isto é o resolvedor, nunca o `getClassFeatures`/`getClassSpells` da criação.
  retiredFeatures: z.record(z.string(), SystemClassFeatureSchema).optional(),
  retiredSpells: z.record(z.string(), SystemSpellSchema).optional(),
  // Catálogo de aventuras iniciais (US-28). Opcional para não invalidar configs legados;
  // quando presente, precisa de um hook classKey 'default' obrigatório.
  initialAdventures: z.object({
    hooks: z.array(InitialAdventureHookSchema).min(1)
      .refine(hooks => hooks.some(h => h.classKey === 'default'), {
        message: 'initialAdventures.hooks precisa de um hook com classKey "default"',
      }),
  }).optional(),
})

export type SystemAttribute = z.infer<typeof SystemAttributeSchema>
export type SystemCatalogEntry = z.infer<typeof SystemCatalogEntrySchema>
export type SystemClassFeature = z.infer<typeof SystemClassFeatureSchema>
export type SystemSpell = z.infer<typeof SystemSpellSchema>
export type InitialAdventureHook = z.infer<typeof InitialAdventureHookSchema>
export type SystemConfig = z.infer<typeof SystemConfigSchema>

/**
 * Rótulo de uma chave de catálogo no locale do config (US-105). Chave sem entrada devolve
 * a própria chave: ficha legada (texto cru pré-migração) e sistema sem catálogo continuam
 * exibindo alguma coisa em vez de vazio. É o ÚNICO caminho de leitura de `race`/`class` —
 * ficha, hub, prompt e criação de aventura passam todos por aqui.
 */
export function catalogLabel(catalog: SystemCatalogEntry[] | undefined, key: string): string {
  return catalog?.find(e => e.key === key)?.label ?? key
}

/**
 * Resolve as CHAVES que a ficha guarda (US-100) contra o catálogo do locale ativo — irmão do
 * `catalogLabel` acima e do `buildSkillSheet`, e a razão de a ficha acompanhar o idioma: a mesma
 * `barbarian_rage` devolve "Fúria" ou "Rage" conforme o config que chega aqui, sem tocar no banco.
 *
 * Serve features e magias (mesma forma `{key, name, …}`); a lista da classe cai no `default` como
 * na criação, e chave fora dela procura no catálogo aposentado (`retired*`) antes de desistir.
 *
 * Fonte ÚNICA de resolução: a usam a ficha da web, o prompt do Mestre e a tool `getSpell` — duas
 * cópias divergiriam, e a `getSpell` casa por NOME contra a lista que o prompt mostrou.
 */
export function resolveSheetEntries<T extends { key: string }>(
  byClass: Record<string, T[]> | undefined,
  retired: Record<string, T> | undefined,
  classKey: string,
  keys: string[],
): T[] {
  const live = byClass?.[classKey] ?? byClass?.['default'] ?? []
  return keys.map((key) =>
    live.find((e) => e.key === key)
      ?? retired?.[key]
      // Chave sem dono em lugar nenhum vira entrada mínima com o nome = a própria chave, mesma
      // escolha do `catalogLabel`: a linha continua na ficha em vez de sumir sem erro. O cast é
      // porque a entrada mínima não tem `description`/`source` — é fallback de EXIBIÇÃO, não
      // dado de catálogo (e o config de onde ela viria é justamente o que não a tem).
      ?? ({ key, name: key } as unknown as T),
  )
}

/** Zod dinâmico: um campo por atributo do sistema, min/max do próprio config. Rejeita chaves fora do config. */
export function buildCharacterAttributesSchema(attributes: SystemAttribute[]) {
  const shape = Object.fromEntries(
    attributes.map(a => [a.key, z.number().int().min(a.min).max(a.max)]),
  )
  return z.object(shape).strict()
}
