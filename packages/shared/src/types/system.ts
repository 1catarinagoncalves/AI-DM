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

// Idioma do sistema (US-133), derivado de `Language.json` (mesmo doc `core` que Skill.json).
// Mesmo contrato de `SystemSkillSchema` (key/label + âncora extra), estendido com `secret`
// pelo mesmo motivo: um consumidor (US-129) precisa do campo pra não oferecer Druidic/
// Thieves' Cant como "idioma à escolha" genérico de background — concedidos só por
// classe/feature própria, nunca pela escolha livre.
export const SystemLanguageSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  secret: z.boolean(),
})

// Entrada de catálogo do sistema (US-105): chave canônica EN + rótulo no locale do config.
// Serve `races` e `classes`, e é o mesmo contrato de `skills` sem a âncora de atributo:
// o Character guarda a CHAVE, a tela e o prompt resolvem o rótulo na leitura.
//
// US-203: `kicker`/`blurb` opcionais — prosa curta de catálogo (chamada de 3-6 palavras +
// resumo de 1-2 frases). Servem `races`, `classes` E `subclasses` de graça: os três reusam
// este mesmo schema (subclasse via `config.subclasses`, US-141), então os campos chegam aos
// três sem schema novo. `blurb` tem teto de 200 caracteres no schema (não no CSS) — sem teto
// a curadoria escreve parágrafo e o cartão da US-205 quebra o alinhamento da grade.
// `primary` (chaves de `config.attributes`) só é POVOADO em `classes` pelo ingest — o schema
// não restringe por domínio (mesmo raciocínio dos outros campos deste contrato), mas
// races/subclasses nunca ganham valor aqui: o atributo principal é da classe-mãe.
export const SystemCatalogEntrySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kicker: z.string().min(1).optional(),
  blurb: z.string().min(1).max(200).optional(),
  primary: z.array(z.string().min(1)).optional(),
})

// US-212: bônus de atributo de RAÇA (traço `ability-score-increase`, US-142), derivado pelo
// ingest (`buildRaceBonuses`, race-bonus.mjs). Ao contrário do grant de background (US-123,
// SystemBackgroundGrantSchema, sempre 1 fixo + 1 livre), a raça tem 3 formas medidas no
// dataset: só fixo — 1 ou 2 atributos, quantidade própria cada (a maioria) —, "+1 em todos"
// (`fixed` com as 6 chaves, Humano) e fixo + N livres à escolha (Meio-Elfo, `choice.count = 2`).
// `fixed` cobre as duas primeiras; `choice` é ausente nelas e presente só na terceira.
export const SystemRaceGrantSchema = z.object({
  fixed: z.array(z.object({ attr: z.string().min(1), amount: z.number().int().positive() })),
  choice: z.object({
    count: z.number().int().positive(),
    amount: z.number().int().positive(),
  }).optional(),
})
export type SystemRaceGrant = z.infer<typeof SystemRaceGrantSchema>

// Entrada de catálogo de RAÇA (US-140): estende SystemCatalogEntrySchema com `parentKey`,
// só para `config.races` — `classes` fica no schema genérico acima, sem o campo (subclasse
// é catálogo `Record<classKey, …>` separado, US-141, desenho de dado diferente).
// Ausente = raiz; presente = subespécie, valor é a `key` da raiz (não o `pk` cru do dataset).
// `bonus`: texto curto de aumento de atributo ("+2 Destreza"), derivado no ingest a
// partir do traço "Ability Score Increase" (SpeciesTrait.2014.json) — não é autoral como
// kicker/blurb, é regra do SRD formatada. Na raiz é só o ASI PRÓPRIO dela; na subespécie é o
// ASI JÁ SOMADO com o da raiz (mecânica real do personagem — quem consome fora do wizard, ex.
// prompt do Mestre, precisa do total). Correção de 2026-09-02: raiz-com-subespécie passou a ter
// `bonus` próprio (era ausente — decisão original da US-142/US-205, revertida porque o wizard
// agora exibe a raiz como cartão selecionável, ver CatalogCardGroup.tsx no web).
export const RaceCatalogEntrySchema = SystemCatalogEntrySchema.extend({
  parentKey: z.string().min(1).optional(),
  bonus: z.string().min(1).optional(),
  // `variantBonus`: só em subespécie — o ASI QUE ELA SOZINHA ADICIONA além da raiz (ex.: raiz
  // Gnomo "+2 Inteligência", subespécie Gnomo das Rochas `bonus` "+1 Constituição, +2
  // Inteligência" mas `variantBonus` só "+1 Constituição"). Existe só pro cartão de variante do
  // wizard não repetir o bônus da raiz que já está visível no cartão de cima.
  variantBonus: z.string().min(1).optional(),
  // US-212: estrutura numérica do mesmo bônus que `bonus` já formata em texto — presente só
  // quando o parser reconhece o traço `ability-score-increase` (hoje 100% das 13 raças
  // jogáveis, mesma cobertura de `bonus`). Ausente na raiz-com-subespécie (não-jogável).
  grant: SystemRaceGrantSchema.optional(),
})

// Entrada de catálogo de CLASSE (US-209): estende SystemCatalogEntrySchema com `hitDice`
// (notação "NdM" minúscula, ex. "1d12") e `savingThrows` (2 chaves canônicas de atributo, na
// ordem do dataset — não ordenadas, ver ingest.mjs `normalizeSavingThrows`). Derivados do SRD
// pelo `buildClasses`. Só `config.classes` — subclasse não tem os dois campos próprios (regra
// 5e: são da classe-mãe), por isso `subclasses` continua no SystemCatalogEntrySchema genérico.
export const ClassCatalogEntrySchema = SystemCatalogEntrySchema.extend({
  hitDice: z.string().min(1).optional(),
  savingThrows: z.array(z.string().min(1)).optional(),
})

// Ferramenta/veículo do sistema (US-134), derivado de `Item.json` (categorias `tools`,
// `land-vehicle`, `waterborne-vehicle`). Mesmo contrato de `SystemCatalogEntrySchema`
// (key/label) mais `category`: a categoria de PROFICIÊNCIA do 5e (`artisan`,
// `musical-instrument`, `gaming-set`, `kit`, `vehicle`, ou a própria `key` para os 2 itens
// nomeados sozinhos sem categoria — ver `buildTools`). String livre, não enum: mesmo
// raciocínio de `SystemBackgroundBenefitSchema.type` — 5 valores observados hoje, taxonomia
// fechada cedo demais quebra no primeiro valor novo de um bump.
export const SystemToolSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1),
})

// Arma do sistema (US-215), derivado de `Item.json` (categoria `weapon`, 44 itens). Mesmo
// contrato mínimo de SystemToolSchema menos `category`: arma não tem subcategoria de
// proficiência do 5e como ferramenta (artisan/musical-instrument/gaming-set/kit/vehicle).
export const SystemWeaponSchema = z.object({
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

// US-123: bônus de atributo do background, derivado pelo ingest de `type === 'ability_score'`
// (padrão único medido nas 21 entradas: "+1 to <fixo> and one other ability score."). União
// discriminada: a US-131 adiciona o segundo membro (`kind: 'skills'`, para `skill_proficiency`)
// sem reabrir este — mesma infraestrutura, dois benefícios diferentes.
export const SystemBackgroundGrantSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ability'), fixed: z.string().min(1), freeCount: z.number().int().min(0) }),
  // US-131: `fixed`/`chooseFrom` já são CHAVES de config.skills, resolvidas pelo ingest —
  // perícia sem entrada no catálogo é omitida (relatada como órfã), nunca entra aqui.
  z.object({
    kind: z.literal('skills'),
    fixed: z.array(z.string()),
    chooseFrom: z.array(z.string()),
    chooseCount: z.number().int().min(0),
  }),
  // US-132: `fixed`/`chooseFrom` já são CHAVES de config.tools, resolvidas pelo ingest — mesmo
  // contrato de `kind: 'skills'`, mas `chooseCount` pode ser 2 (Folk Hero: um slot de artisan +
  // um de vehicle, união dos dois catálogos num `chooseFrom` só — ver `parseToolGrant`).
  z.object({
    kind: z.literal('tools'),
    fixed: z.array(z.string()),
    chooseFrom: z.array(z.string()),
    chooseCount: z.number().int().min(0),
  }),
])
export type SystemBackgroundGrant = z.infer<typeof SystemBackgroundGrantSchema>

// Background do A5E Adventurer's Guide (US-121). Catálogo MECÂNICO (texto), não efeito —
// aplicar `benefits[].type` (ex. `ability_score`) num personagem de fato é fora do escopo.
// `type` é string livre (não enum): 8 valores observados no dataset, mesmo raciocínio do
// `source` acima — taxonomia fechada cedo demais quebra no primeiro valor novo de um bump.
export const SystemBackgroundBenefitSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  // US-123: presente só quando o ingest reconheceu o padrão estruturado do `type` (hoje só
  // `ability_score` → `grant.kind === 'ability'`). Ausente → benefício continua awareness-only.
  grant: SystemBackgroundGrantSchema.optional(),
})

// `key` é o pk cru do dataset (`a5e-ag_acolyte`), sem mapa explícito tipo CLASS_MAP: background
// não tem consumidor cruzado ainda (US-121). Sem `description` própria — o `Background.desc` do
// dataset vem vazio nas 21 entradas; toda a prosa está em `benefits`.
export const SystemBackgroundSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  benefits: z.array(SystemBackgroundBenefitSchema),
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
  // primaryQuestTitle/primaryQuestDescription: removidos na US-155 (quest passou a vir só
  // do artefato gerado, US-153) e REINTRODUZIDOS na US-217 — o ramo "Aventura pronta" do
  // passo `world` (US-216) pula o motor de geração inteiro, então precisa de volta de uma
  // quest fixa por classe (mesmo par de campos que existia antes da US-155, mesmo formato
  // de placeholder). O ramo "Criar minha história" continua 100% no motor, sem usá-los.
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
  // Catálogo de idiomas (US-133), derivado do SRD pelo ingest. Opcional como skills/races:
  // config legado sem ele não fica inválido. Fecha a lacuna que bloqueava a US-129 (escolha
  // do benefício `language` do background) — catálogo cru, aplicar a um personagem é a US-129.
  languages: z.array(SystemLanguageSchema).optional(),
  // Catálogos de raça e de classe (US-105), derivados do SRD pelo ingest. Opcionais como
  // `skills`: config legado sem eles não fica inválido — e é o que decide se o service
  // valida a chave da ficha contra catálogo ou aceita o que vier (ver character.service).
  races: z.array(RaceCatalogEntrySchema).optional(),
  // Traço mecânico de raça (US-142), por chave JOGÁVEL de `races` — raiz sem subespécie, ou
  // subespécie (a raiz que TEM subespécie não ganha entrada própria, ver validateCatalogKey em
  // character.service.ts). Reusa SystemClassFeatureSchema, mesma forma de `backgroundFeatures`
  // logo abaixo — sem tipo novo. Subespécie concatena os traços da raiz + os próprios, sem
  // dedupe por `key` (Ability Score Increase da raiz e da subespécie somam como dois traços).
  raceFeatures: z.record(z.string(), z.array(SystemClassFeatureSchema)).optional(),
  classes: z.array(ClassCatalogEntrySchema).optional(),
  // Catálogo de subclasses (US-141), agrupado por classe-mãe — reusa SystemCatalogEntrySchema
  // (mesma forma {key,label} de races/classes) dentro de um Record por chave de classe. Uma
  // subclasse pressupõe a classe já escolhida (Character.class), não é entidade jogável sozinha
  // — por isso separado de `classes`, nunca achatado nele (ver US-141 §Contexto).
  subclasses: z.record(z.string(), z.array(SystemCatalogEntrySchema)).optional(),
  // Catálogo de backgrounds do a5e-ag (US-121), derivado pelo ingest. Opcional como races/classes:
  // config legado sem ele não fica inválido. Mecânico apenas — escolha na criação é story separada.
  backgrounds: z.array(SystemBackgroundSchema).optional(),
  // Equipamento inicial por ORIGEM (US-128), paralelo a `startingKits` (por classe) mas sem
  // chave `default` — origem é opcional na criação, sem origem escolhida não há o que resolver.
  // Chave = `SystemBackground.key`. Derivado pelo ingest do benefício `type === 'equipment'`.
  backgroundEquipment: z.record(z.string(), z.array(StartingKitItemSchema)).optional(),
  // Feature nomeada da origem (US-135), paralela a `classFeatures` mas keyed por
  // `SystemBackground.key` (sem `default`: origem é opcional). Reusa SystemClassFeatureSchema —
  // mesma forma `{key,name,description,source}`, sem tipo novo.
  backgroundFeatures: z.record(z.string(), z.array(SystemClassFeatureSchema)).optional(),
  // Catálogo de ferramentas e veículos (US-134), derivado do `Item.json` pelo ingest. Opcional
  // como races/classes/backgrounds: config legado sem ele não fica inválido. Fecha a lacuna que
  // bloqueava a US-132 (escolha do benefício `tool_proficiency` do background).
  tools: z.array(SystemToolSchema).optional(),
  // Catálogo de arma (US-215), derivado do `Item.json` pelo ingest. Opcional como tools: config
  // legado sem ele não fica inválido. Fecha a lacuna que bloqueava o traço de arma fixa de
  // raça (RACE_WEAPON_PROFICIENCIES) — catálogo cru, aplicar a um personagem é a US-215.
  weapons: z.array(SystemWeaponSchema).optional(),
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
  // Catálogo de registro da aventura (US-156; `settings`/`areaTypes` cortados em US-173 e
  // devolvidos em US-184 junto do registro completo). Mesmo contrato de races/classes.
  // "Aleatório" nunca é entrada de catálogo: campo omitido no DTO é quem sinaliza sorteio
  // (US-147), nunca uma chave `random` aqui dentro.
  tones: z.array(SystemCatalogEntrySchema).optional(),
  settings: z.array(SystemCatalogEntrySchema).optional(),
  areaTypes: z.array(SystemCatalogEntrySchema).optional(),
  // US-210: alinhamento (9 combinações LG/NG/CG/LN/N/CN/LE/NE/CE), derivado pelo ingest de
  // `Rule.json` (srd-2024_create-your-character_alignment, US-108). Mesmo contrato de
  // races/classes (chave canônica EN + rótulo por locale) — opcional como eles, para não
  // invalidar config legado (banco ainda não re-semeado). `.length(9)` só quando presente:
  // as 9 combinações do 5e são fixas, catálogo com contagem diferente é sinal de bug de parser.
  alignments: z.array(SystemCatalogEntrySchema).length(9).optional(),
})

export type SystemAttribute = z.infer<typeof SystemAttributeSchema>
export type SystemCatalogEntry = z.infer<typeof SystemCatalogEntrySchema>
export type SystemTool = z.infer<typeof SystemToolSchema>
export type SystemClassFeature = z.infer<typeof SystemClassFeatureSchema>
export type SystemSpell = z.infer<typeof SystemSpellSchema>
export type SystemBackground = z.infer<typeof SystemBackgroundSchema>
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
