import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { EventLog } from '../generated/prisma/client'
import { streamText, generateText, generateObject, tool, type CoreMessage } from 'ai'
import { logLlmFailure } from './llm-error'
import type { AdventureAntagonist, AdventureEncounter, AdventureLocation, AdventureNpc, AdventureSecret, GeneratedAdventure, InventoryItem, SceneState, SystemConfig, WorldEntity } from '@ai-dm/shared'
import { buildSkillSheet, catalogLabel, resolveSheetEntries, resolveCharacterFeatures, stripFabricatedRolls, stripReasoningLeak, stripWorldStateTags, resolveRollModifier, normalizeDie, hasOptionsList, resolveLocale, DEFAULT_LOCALE, localeNameForPrompt, type Locale } from '@ai-dm/shared'
import { z } from 'zod'
import {
  narrationModels,
  NARRATION_PROVIDER_OPTIONS,
  EXTRACTION_PROVIDER_OPTIONS,
  ENGINE_PROVIDER_OPTIONS,
  formatProvenance,
  summaryModel,
  extractionModel,
  primaryModel,
  buildDmSystemPrompt,
  buildTurnStateBlock,
  buildOpeningInstruction,
  ONOMASTICS_SECTION,
  CRAFT_CORE_SECTION,
  NPC_VOICE_BULLET,
  resolveKnownSpell,
  resolveAdventuresAndAdvancement,
  buildSummaryInput,
  mergeSceneState,
  formatSceneState,
  mergeEntities,
  norm,
  judgeModel,
  judgeTurn,
  meanOfScore,
  formatScoreLines,
  detectSlopName,
  detectUnledgeredName,
  SUMMARY_SYSTEM_PROMPT,
  ENTITIES_BLOCK,
  type ScenePatch,
  type EntityPatch,
  type DmCharacterSheet,
  type CharacterBackground,
  type ClassFeature,
  type KnownSpell,
  type SummaryTurn,
} from '@ai-dm/ai-engine'
import { DiceService } from '../game/dice.service'
import { PrismaService } from '../prisma.service'
import { configForLocale } from '../system/system-locale'
import type { RolledAdventureContent } from '../adventure-generation/roll-content'
import type { AdventureRegistry } from '../adventure-generation/roll-registry'
import type { SecretPrompts } from '../adventure-generation/lgmrd-tables'
import { MONSTER_ROLE_CR } from '../adventure-generation/monster-roles'
import { nextUnrevealedEncounterLocation } from '../adventure-generation/next-encounter-hint'

export interface ChatInput {
  adventureId: string
  characterId: string
  message: string
}

/** US-38: o teste ancorado do turno, guardado FORA de `streamChat` para
 * sobreviver às tentativas de fallback (cada attempt reexecuta `streamChat`). */
interface AnchoredRoll { formula: string; rolls: number[]; modifier: number; total: number; reason: string }
export interface RollTurnState { first: AnchoredRoll | null }

// Acima de SUMMARIZE_THRESHOLD turnos não-resumidos, fundimos os mais antigos
// no resumo, mantendo apenas KEEP_RECENT turnos verbatim na janela. Cada turno
// = 1 ACTION + 1 NARRATION = 2 eventos. ~15 turnos = ~30 eventos.
const SUMMARIZE_THRESHOLD = 30
const KEEP_RECENT = 12

// US-35: schema da extração de cena da abertura. Espelha o `ScenePatch`
// (`packages/ai-engine/src/scene.ts`) com o MESMO vocabulário do `updateScene`.
// Objetivo é um snapshot COMPLETO — os 5 campos vêm sempre que a prosa permitir;
// `ambiente`/`periodo` são os vetores de teletransporte/salto temporal que a US ataca.
// Modelos de extração mais fracos (e.g. qwen3.7-flash) às vezes devolvem uma string
// solta ("a, b, c") em vez de array pra campos de lista — o preprocess absorve isso em
// vez de derrubar o turno inteiro com AI_TypeValidationError (visto em prod, US-192).
const coercedStringArray = z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value),
  z.array(z.string()),
)

export const OPENING_SCENE_SCHEMA = z.object({
  local: z.string().describe('Lugar em linguagem natural, específico, e.g. "sacristia da igreja de Pedra do Norte"'),
  ambiente: z.enum(['externo', 'interno']).describe('externo = aberto/ao relento, interno = coberto/fechado. Deduzir de abrigo, não do clima'),
  periodo: z.string().describe('Período do dia em linguagem natural, e.g. manhã/tarde/entardecer/anoitecer/noite'),
  presentes: z.array(z.string()).describe('Só NPCs/personagens na cena, e.g. ["padre Mateus"]. NUNCA a própria personagem-jogadora'),
  objetos_em_cena: coercedStringArray.describe('Objetos e elementos notáveis do ambiente, incl. atmosféricos. NUNCA itens carregados no inventário'),
})

type ExtractedScene = z.infer<typeof OPENING_SCENE_SCHEMA>

// US-75: schema da SEMEADURA do ledger na abertura. Espelha `WorldEntity` (sem
// `atualizadoEm`), mas SEM os eixos de conhecimento — toda entidade da abertura é
// pública e já vivida pelo jogador, então `sabido`/`revelado` são forçados no código,
// não deixados ao extrator (que só decide O QUE a prosa estabelece, não segredos).
const OPENING_ENTITIES_SCHEMA = z.object({
  entidades: z
    .array(
      z.object({
        nome: z.string().describe('Nome da entidade exatamente como a prosa a nomeia, e.g. "Marta", "moinho ao norte", "arboreto".'),
        tipo: z.enum(['npc', 'local', 'objeto', 'faccao', 'outro']).optional(),
        local: z.string().optional().describe('Onde a entidade está/mora, SÓ se a prosa afirmar. NÃO invente.'),
        nota: z.string().optional().describe('Fato durável curto que a prosa afirma sobre ela.'),
      }),
    )
    .describe('Entidades DURÁVEIS que esta abertura estabelece explicitamente.'),
})

const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()

// US-158: schema da prosa de locais+NPCs. SEM `id` — quem minta é o código
// (`generateLocationsAndNpcs`), nunca o modelo.
//
// 2026-08-19: `occupants` referenciava NPC pelo NOME (string livre, casado contra
// `npcs[].name` via `normName` — só normaliza caixa/acento). Com deepseek-v4-flash
// (trocado nesta data por precisar de mais raciocínio, ver ENGINE_PROVIDER_OPTIONS em
// model.ts) o nome escrito em `occupants` divergia do `npcs[].name` com frequência
// maior que o qwen anterior — ex.: "Vesper Thornwood" em occupants vs. um `npcs[].name`
// que não bate exatamente — e a US-150 trata isso como falha DURA (`checkOccupantReferences`),
// não órfão: esgotava as 3 tentativas do gate direto. `occupants` agora é ÍNDICE
// (0-based) em `npcs[]`: sem correspondência de string nenhuma, o modelo só aponta pra
// uma posição de um array que ele mesmo escreveu — `npcs` vem ANTES de `locations` no
// schema de propósito, pra já estar "escrito" quando o modelo gera os índices.
const LOCATIONS_AND_NPCS_SCHEMA = z.object({
  npcs: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1).describe('Arquétipo de ficção popular + conexão com a aventura, 1 frase curta'),
      }),
    )
    .min(1),
  locations: z
    .array(
      z.object({
        title: z.string().min(1),
        aspects: z.array(z.string()).describe('2-3 aspectos/traços curtos do local, estilo Fate — não frases completas'),
        boxedText: z.string().min(1).describe('Texto de leitura em voz alta ao chegar no local, 2-3 frases'),
        description: z.string().min(1).describe('Notas do mestre sobre o local — NÃO lidas em voz alta'),
        occupants: z.array(z.number().int().min(0)).describe('Índices (0-based) de npcs[] presentes aqui — NÚMERO, nunca o nome — [] se nenhum'),
        // US-187: rótulo de que tipo de cena este local puxa melhor — consumido pela
        // distribuição de locationId dos encontros (US-166), nunca pelo ledger.
        vibe: z.enum(['combat', 'skill', 'social']).describe('Que tipo de cena este local puxa melhor, dado o que você já escreveu acima'),
      }),
    )
    .min(1),
})

// US-158: `patronsandnpcs` só dá behavior+ancestry (método do LGMRD) — o prompt lista
// as linhas roladas para o modelo INVENTAR nome+arquétipo em cima delas, nunca copiar.
function buildLocationsAndNpcsPrompt(rolled: RolledAdventureContent): string {
  const npcRows = rolled.patronsandnpcs
    .map((row, i) => `${i + 1}. comportamento: ${row.behavior}; ancestralidade: ${row.ancestry}`)
    .join('\n')
  return [
    `Premissa da aventura: ${rolled.premissa}`,
    `Local/monumento centrais rolados: ${rolled.locais} — ${rolled.monumentos}`,
    `Complicação: ${rolled.complicacao.condition} (${rolled.complicacao.description}), origem: ${rolled.complicacao.origin}`,
    '',
    `Linhas roladas para os NPCs (uma por NPC, gere exatamente ${rolled.patronsandnpcs.length}):`,
    npcRows,
  ].join('\n')
}

// US-149: schema dos SEGREDOS. SEM `id` — mesma disciplina de LOCATIONS_AND_NPCS_SCHEMA
// (`generateSecrets` minta `secret-N` no código). `locationId` é texto livre no schema
// (Zod não valida contra a lista de locais em runtime), mas o system prompt instrui a
// só escolher entre os ids dados — verificação formal é o gate da US-150.
const SECRETS_SCHEMA = z.object({
  secrets: z
    .array(
      z.object({
        locationId: z.string().min(1).describe('Um dos ids de locations recebidos — NUNCA invente um id novo'),
        text: z.string().min(1),
      }),
    )
    .min(1),
})

const SECRET_CATEGORY_LABEL: Record<keyof SecretPrompts, string> = {
  charactersecrets: 'Segredos de personagem (ligam a background/origin da personagem)',
  historicalsecrets: 'Segredos históricos (ligam a um local)',
  npcandvillainsecrets: 'Segredos de NPC/vilão (ligam a um NPC já gerado)',
  plotandstorysecrets: 'Segredos de trama (ligam ao gancho/arco geral)',
}

// US-149, Questão em aberto #2: split fixado 3+3+3+2=11 — vai no PROMPT como instrução
// fixa de quantidade, não como validação de código (heurística de seleção é implementação,
// fora do escopo formal da story).
const SECRET_CATEGORY_COUNT: Record<keyof SecretPrompts, number> = {
  charactersecrets: 3,
  historicalsecrets: 3,
  npcandvillainsecrets: 3,
  plotandstorysecrets: 2,
}

function buildSecretsPrompt(locations: AdventureLocation[], npcs: AdventureNpc[], secretPrompts: SecretPrompts): string {
  const locationLines = locations.map((loc) => `${loc.id}: ${loc.title}`).join('\n')
  // Reverse-lookup do local do NPC (mesmo padrão de seed-ledger.ts:43) — sem isso, segredos de
  // NPC/vilão não têm locationId óbvio e o modelo chuta o id do NPC no campo (visto em prod
  // 2026-08-19: "segredo referencia locationId inexistente npc-1").
  const npcLines = npcs
    .map((npc) => {
      const location = locations.find((loc) => loc.occupants.includes(npc.id))
      const locationHint = location ? ` (local: ${location.id})` : ''
      return `${npc.id}: ${npc.name} — ${npc.role}${locationHint}`
    })
    .join('\n')
  const categoryBlock = (category: keyof SecretPrompts) =>
    `${SECRET_CATEGORY_LABEL[category]} — escreva exatamente ${SECRET_CATEGORY_COUNT[category]}, escolhendo entre estes moldes:\n` +
    secretPrompts[category].map((p, i) => `${i + 1}. ${p}`).join('\n')
  return [
    `Locais disponíveis (use o id em locationId):\n${locationLines}`,
    '',
    `NPCs disponíveis:\n${npcLines}`,
    '',
    categoryBlock('charactersecrets'),
    '',
    categoryBlock('historicalsecrets'),
    '',
    categoryBlock('npcandvillainsecrets'),
    '',
    categoryBlock('plotandstorysecrets'),
  ].join('\n')
}

// US-180: lista de âncoras pessoais da personagem (`story`/`origin.adventuresAndAdvancement`)
// — usada por `generateSecrets` (US-149) e `generateOpeningBeat` (US-180) pra montar a
// própria frase de instrução. Extraída pra função pura porque as duas listas eram
// quase-idênticas e arriscavam divergir com o tempo (mesma disciplina de reuso da seção
// compartilhada de `dm-system.ts`, US-177/US-179).
// `bonds`/`flaws`/`deity` NÃO entram aqui — motor de geração só consome `story` do
// background (o resto continua servindo só a narração de turno ao vivo). `connection`/
// `memento` do origin também ficam de fora, mesma razão.
function characterAnchors(params: {
  background?: CharacterBackground
  origin?: { adventuresAndAdvancement?: string }
}): string[] {
  return [
    params.background?.story?.trim() && `História: ${params.background.story}`,
    params.origin?.adventuresAndAdvancement?.trim() && `Aventura e avanço da origem: ${params.origin.adventuresAndAdvancement}`,
  ].filter((line): line is string => Boolean(line))
}

// US-181/US-190: schema do ANTAGONISTA estruturado — `want`/`method`/`trait`/`weakness`
// sempre presentes (mesmo quando `premissa` não sugere vilão óbvio, o modelo infere uma
// oposição plausível — campo opcional é pior consumidor a jusante que campo sempre presente).
// `connection` (US-183): como o antagonista se relaciona com o vínculo pessoal da
// personagem (`characterAnchors`) — sem âncora registrada, cai pra conexão genérica
// ancorada em locations/npcs/secrets, nunca vazio (mesma disciplina dos outros 4 campos).
const ANTAGONIST_SCHEMA = z.object({
  name: z.string().min(1),
  want: z.string().min(1),
  method: z.string().min(1),
  trait: z.string().min(1),
  weakness: z.string().min(1),
  connection: z.string().min(1),
})

// US-164, passo 6 / US-166: schema do FECHO RAMIFICADO. SEM `id` — `followUps[]` não
// referencia nada, é semente pra PRÓXIMA aventura (US-151 consome como texto, não por id).
// `encounterSituations` fecha as 3 perguntas restantes de cada uma das 8 SITUAÇÕES (Sly
// Flourish) — posicional, o item `i` corresponde ao `encounterSkeleton[i]` do prompt.
const CLOSING_SCHEMA = z.object({
  // US-169: alvo concreto e verificável da aventura, citando NOMES reais (NPC/vilão/facção)
  // e o `want`/`method` do antagonista — nunca uma paráfrase do `summary` nem só o nome dele.
  objective: z.string().min(1),
  conclusion: z.string().min(1),
  followUps: z.array(z.string()).min(1),
  encounterSituations: z.array(z.object({
    behaviors: z.string().min(1),
    goal: z.string().min(1),
    complications: z.string().min(1),
  })).length(8),
})

// US-172: schema da ABERTURA (`start`). SEM `id` (não referencia nada, é prosa livre).
// `hookSeed` NÃO é insumo desta chamada — nem no schema, nem no `system`/`prompt` de
// `buildOpeningBeatPrompt`/`generateOpeningBeat` abaixo (zero influência, ver US-172).
const OPENING_BEAT_SCHEMA = z.object({
  start: z.string().min(1),
})

// US-191, Parte 2: schema da PROSA REESCRITA do local do confronto final — mesmos dois
// campos de AdventureLocationSchema (`boxedText`/`description`), agora citando o antagonista
// pelo nome. `title`/`aspects`/`occupants` do local NÃO mudam por esta chamada.
const ANTAGONIST_LOCATION_PROSE_SCHEMA = z.object({
  boxedText: z.string().min(1),
  description: z.string().min(1),
})

function buildOpeningBeatPrompt(params: {
  locations: AdventureLocation[]
  npcs: AdventureNpc[]
  secrets: AdventureSecret[]
  registry: AdventureRegistry
  complicacao: { condition: string; description: string; origin: string }
  premissa: string
  antagonist: AdventureAntagonist
}): string {
  const locationLines = params.locations.map((loc) => `${loc.id}: ${loc.title}`).join('\n')
  const npcLines = params.npcs.map((npc) => `${npc.id}: ${npc.name} — ${npc.role}`).join('\n')
  const secretLines = params.secrets.map((s) => `${s.id} (${s.locationId}): ${s.text}`).join('\n')
  // US-191: reverte a proibição da US-190 — nome ENTRA aqui agora (Questão em aberto #2
  // daquela story, decidida ao contrário nesta). weakness continua fora: só o nome deixou
  // de ser segredo, o mesmo "não vaza antes de merecer" ainda protege a fraqueza dele.
  const antagonistLine =
    `Antagonista já decidido — nome: ${params.antagonist.name} (pode nomeá-lo na cena; NUNCA revele a weakness): ` +
    `método: ${params.antagonist.method}; traço: ${params.antagonist.trait}.`
  return [
    `Premissa: ${params.premissa}`,
    // US-180: sem esta linha, `complicacao` chega só como TIPO em `params` — o modelo
    // nunca lê condition/description/origin e não tem como escolher entre Enraizada e
    // Confronto. Mesmo formato que `buildClosingPrompt` já usa para o mesmo campo.
    `Complicação: ${params.complicacao.condition} (${params.complicacao.description}), origem: ${params.complicacao.origin}`,
    '',
    antagonistLine,
    '',
    `Locais disponíveis:\n${locationLines}`,
    '',
    `NPCs disponíveis:\n${npcLines}`,
    '',
    `Segredos já escritos (pode insinuar, NUNCA revelar):\n${secretLines}`,
  ].join('\n')
}

// US-166: encontro já resolvido (locationId/npcIds → location/npcs reais) — o que
// `generateClosing` precisa pra escrever behaviors/goal/complications por posição.
interface EncounterSkeletonEntry {
  id: string
  type: 'combat' | 'skill' | 'social'
  location: AdventureLocation
  npcs: AdventureNpc[]
}

// US-181/US-190: `antagonist` é opcional aqui — `generateAntagonist` reusa este builder
// ANTES de o antagonista existir (é ele quem o decide); `generateClosing` roda DEPOIS,
// sempre passa o antagonista já pronto pra ancorar a conclusão nele.
// US-166: `encounterSkeleton` é opcional pela mesma razão — só `generateClosing` precisa da
// seção dos 8 encontros; `generateAntagonist` não escreve `encounterSituations`.
function buildClosingPrompt(params: {
  locations: AdventureLocation[]
  npcs: AdventureNpc[]
  secrets: AdventureSecret[]
  complicacao: { condition: string; description: string; origin: string }
  premissa: string
  antagonist?: AdventureAntagonist
  encounterSkeleton?: EncounterSkeletonEntry[]
}): string {
  const locationLines = params.locations.map((loc) => `${loc.id}: ${loc.title}`).join('\n')
  const npcLines = params.npcs.map((npc) => `${npc.id}: ${npc.name} — ${npc.role}`).join('\n')
  const secretLines = params.secrets.map((s) => `${s.id} (${s.locationId}): ${s.text}`).join('\n')
  const antagonistLine = params.antagonist
    ? `Antagonista já decidido: ${params.antagonist.name} — quer ${params.antagonist.want}; método: ${params.antagonist.method}.`
    : null
  const encounterLines = params.encounterSkeleton
    ?.map((e, i) => {
      const npcLabel = e.npcs.length > 0 ? e.npcs.map((n) => `${n.name} (${n.role})`).join(', ') : 'nenhum'
      return `${i + 1}. ${e.id} (${e.type}) — local: ${e.location.title}; moradores: ${npcLabel}`
    })
    .join('\n')
  return [
    `Premissa: ${params.premissa}`,
    `Complicação: ${params.complicacao.condition} (${params.complicacao.description}), origem: ${params.complicacao.origin}`,
    ...(antagonistLine ? ['', antagonistLine] : []),
    '',
    `Locais disponíveis:\n${locationLines}`,
    '',
    `NPCs disponíveis:\n${npcLines}`,
    '',
    `Segredos já escritos:\n${secretLines}`,
    ...(encounterLines ? ['', `Encontros da aventura, na ORDEM em que encounterSituations deve respondê-los:\n${encounterLines}`] : []),
  ].join('\n')
}

// US-74 (salvage): instrução da chamada que COMPLETA uma narração truncada. Foco
// estreito — continuar + fechar nas opções, SEM tools, SEM dados. As opções são
// ancoradas no próprio texto da narração (que já descreveu a cena), então não precisa
// recarregar ficha/cena do banco: barato e rápido, cabe no teto de 60s do proxy.
const SALVAGE_SYSTEM_PROMPT = `Você é o Mestre de um RPG. A narração de um turno foi TRUNCADA: parou antes do desfecho e/ou sem a lista de opções obrigatória. Escreva APENAS a CONTINUAÇÃO, para completar o turno:
- Continue EXATAMENTE de onde a narração parou; NÃO repita nada do que já foi escrito.
- Se algo estava prestes a ser revelado (uma carta aberta, uma porta, um rosto), revele agora, em 1–2 parágrafos curtos.
- A AÇÃO DO JOGADOR já aconteceu na narração acima — NUNCA a re-ofereça como opção. As opções são o que vem DEPOIS dela.
- Termine SEMPRE com uma lista de 3–4 opções de ação, uma por linha, no formato \`- emoji texto\` (hífen + emoji).
- NÃO role dados, NÃO chame ferramentas, NÃO escreva números de teste nem blocos de estado. Só a prosa de continuação e as opções.
- Escreva em pt-BR natural, no mesmo tom da narração.`

// US-114: `{enabled:false}`, NÃO `{effort:'low', exclude:true}`. A config antiga foi
// medida contra o `extractionModel` (`qwen/qwen3.7-flash`) em 2026-08-17 e dá 200 com
// corpo VAZIO — sem erro, sem log — o `hasOptionsList` abaixo dá falso, o
// `SALVAGE_FALLBACK` assume, e o turno degrada pro "- 💬 Continuar." SEMPRE. Mesma
// chave de `EXTRACTION_PROVIDER_OPTIONS`, mesmo motivo.
const SALVAGE_PROVIDER_OPTIONS = { openrouter: { reasoning: { enabled: false } } } as const

// Fecho estático de último recurso — se a geração do salvamento falhar ou ainda vier
// sem opções, o jogador NUNCA fica sem saída.
const SALVAGE_FALLBACK = '\n\n- 💬 Continuar.'

/**
 * US-73: monta o patch de cena a partir da extração estruturada, protegendo contra
 * ZERAR campos escalares. Um turno só-diálogo devolve `local`/`periodo` vazios — nesse
 * caso NÃO entram no patch, então `mergeSceneState` preserva o valor corrente (não
 * teletransporta a personagem para "lugar nenhum"). `presentes`/`objetos_em_cena`
 * substituem a lista inteira (mesma semântica do `updateScene`: quem apareceu entra,
 * quem saiu sai). Puro e testável — fora do `reconcileScene`, que é LLM + DB.
 *
 * `presentes` NUNCA contém a própria personagem-jogadora: o prompt já pede isso, mas o
 * modelo às vezes a carrega da cena atual (foi o que poluiu o `sceneState` do bug real),
 * então filtramos `playerName` de forma determinística (match por primeiro nome,
 * tolerante a acento/caixa) — auto-cura mesmo uma cena já poluída.
 */
export function scenePatchFromExtraction(object: ExtractedScene, playerName?: string): ScenePatch {
  const first = playerName ? normName(playerName).split(/\s+/)[0] ?? '' : ''
  const presentes = first
    ? object.presentes.filter((p) => !normName(p).includes(first))
    : object.presentes
  const patch: ScenePatch = {
    presentes,
    objetos_em_cena: object.objetos_em_cena,
  }
  if (object.local.trim()) patch.local = object.local.trim()
  if (object.ambiente) patch.ambiente = object.ambiente
  if (object.periodo.trim()) patch.periodo = object.periodo.trim()
  return patch
}

/**
 * US-128: aplica deltas de quantidade (tool `updateInventory`) PRESERVANDO campos além de
 * `name`/`qty` — antes reduzia o inventário a `Map<string, number>` e reconstruía cada item
 * como `{name, qty}`, apagando `origin` (memento/equipamento da origem) no primeiro turno em
 * que o Mestre mexesse em QUALQUER item, não só o marcado. Item novo (sem entrada prévia)
 * nasce sem `origin`, igual a hoje. `qty <= 0` remove o item.
 */
export function applyInventoryDeltas(current: InventoryItem[], changes: { name: string; delta: number }[]): InventoryItem[] {
  const items = new Map(current.map((item) => [item.name, item]))
  for (const { name, delta } of changes) {
    const qty = (items.get(name)?.qty ?? 0) + delta
    if (qty <= 0) items.delete(name)
    else items.set(name, { ...items.get(name), name, qty })
  }
  return [...items.values()]
}

/**
 * US-103: proveniência das extrações/chamadas do motor, no mesmo formato da linha do
 * turno. `model` é passado pelo chamador (2026-08-19: deixou de ser sempre
 * `extractionModel` — o motor de aventura roda em `primaryModel`, ver
 * ENGINE_PROVIDER_OPTIONS em model.ts) — sem isso o log mentiria qual dos dois serviu.
 */
function logExtractionEndpoint(label: string, model: { modelId: string }, providerMetadata: unknown): void {
  console.log(`[AiService][${label}] model=${model.modelId ?? 'unknown'} ${formatProvenance(providerMetadata)}`)
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dice: DiceService,
  ) {}

  /**
   * Cria o stream de narração para um turno. `attempt` seleciona o modelo na
   * lista de prioridade (0 = deepseek-v4-flash, 1 = deepseek-v4-pro via OpenRouter,
   * 2 = llama-3.3-70b via Groq). O controller tenta a próxima quando o modelo falha antes de emitir texto.
   *
   * A ação do jogador NÃO é persistida aqui — é gravada no `onFinish`, junto
   * com a narração, apenas quando o turno produz texto. Assim uma tentativa de
   * fallback não duplica a ação no histórico nem reconstrói a janela errada.
   */
  /**
   * US-61: confirma que o personagem pertence ao utilizador autenticado antes de
   * o Mestre agir sobre a ficha. Inexistente → 404; dono diferente → 403.
   */
  async assertCharacterOwner(characterId: string, userId: string): Promise<void> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { userId: true },
    })
    if (!character) throw new NotFoundException(`Character ${characterId} not found`)
    if (character.userId !== userId) {
      throw new ForbiddenException('Este personagem não pertence ao utilizador autenticado')
    }
  }

  /**
   * US-67: apaga o rastro do último turno para a re-execução de uma edição e
   * devolve os eventos apagados (para o controller os restaurar se a regeneração
   * não produzir narração nenhuma — a aventura nunca fica com a ação sem resposta).
   *
   * Editável SÓ o último turno, não-resumido e SEM mutação de estado
   * (`CHARACTER_UPDATE`). A UI já esconde o botão nesses casos, mas o endpoint
   * rejeita por segurança. Deve rodar ANTES de `streamChat`: assim a narração
   * antiga não volta como contexto (o history é reconstruído do EventLog).
   */
  async clearLastTurnForEdit(adventureId: string, characterId: string): Promise<EventLog[]> {
    const lastAction = await this.prisma.eventLog.findFirst({
      where: { adventureId, characterId, type: 'ACTION' },
      orderBy: { createdAt: 'desc' },
    })
    if (!lastAction) throw new BadRequestException('Não há ação para editar')
    if (lastAction.summarized) throw new BadRequestException('O último turno já foi resumido e não pode ser editado')

    // Âncora = a narração imediatamente anterior à última ação (sempre existe: a
    // abertura da aventura é uma NARRATION). O rastro do turno são os eventos
    // criados DEPOIS dela — inclui as DICE_ROLL/CHARACTER_UPDATE gravadas durante o
    // stream (createdAt < ACTION, que é gravada no onFinish) e a NARRATION final.
    const prevNarration = await this.prisma.eventLog.findFirst({
      where: { adventureId, characterId, type: 'NARRATION', createdAt: { lt: lastAction.createdAt } },
      orderBy: { createdAt: 'desc' },
    })
    const trail = await this.prisma.eventLog.findMany({
      where: {
        adventureId,
        characterId,
        type: { in: ['ACTION', 'NARRATION', 'DICE_ROLL', 'CHARACTER_UPDATE'] },
        // ponytail: sem narração anterior (impossível com a abertura) limitamos ao
        // próprio evento — nunca à história toda, que apagaria a aventura inteira.
        createdAt: prevNarration ? { gt: prevNarration.createdAt } : { gte: lastAction.createdAt },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (trail.some((e) => e.type === 'CHARACTER_UPDATE')) {
      throw new ForbiddenException('Este turno alterou o estado da personagem e não pode ser editado')
    }

    await this.prisma.eventLog.deleteMany({ where: { id: { in: trail.map((e) => e.id) } } })
    return trail
  }

  /**
   * US-67: restaura o turno apagado por `clearLastTurnForEdit` quando a
   * regeneração da edição falha por completo (nenhuma narração nova). Reinsere os
   * eventos originais tal como estavam (id/createdAt preservados) — o histórico
   * volta ao que era, sem a ação órfã.
   */
  async restoreClearedTurn(events: EventLog[]): Promise<void> {
    if (events.length === 0) return
    await this.prisma.eventLog.createMany({
      data: events.map((e) => ({
        id: e.id,
        adventureId: e.adventureId,
        characterId: e.characterId,
        type: e.type,
        payload: e.payload as object,
        summarized: e.summarized,
        createdAt: e.createdAt,
      })),
    })
  }

  async streamChat(input: ChatInput, attempt = 0, rollState?: RollTurnState, turnId?: string) {
    const { adventureId, characterId, message } = input

    // Carrega contexto do banco
    const [character, adventure, characterState, quests, historyLogs] = await Promise.all([
      // US-97: o idioma-alvo do turno é a preferência do DONO da ficha (`User.locale`),
      // derivada aqui no servidor — o cliente nunca manda locale (US-61).
      this.prisma.character.findUnique({ where: { id: characterId }, include: { user: { select: { locale: true } } } }),
      this.prisma.adventure.findUnique({
        where: { id: adventureId },
        include: { system: true },
      }),
      this.prisma.characterState.findUnique({
        where: { characterId_adventureId: { characterId, adventureId } },
      }),
      this.prisma.quest.findMany({
        where: { adventureId, status: 'OPEN' },
      }),
      // Janela recente verbatim: só os turnos ainda NÃO resumidos. O que é
      // antigo demais já foi condensado em adventure.memorySummary e entra no
      // system prompt, não aqui. Sem isso o agente perde a memória da cena.
      this.prisma.eventLog.findMany({
        where: { adventureId, characterId, type: { in: ['ACTION', 'NARRATION'] }, summarized: false },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    if (!character) throw new NotFoundException(`Character ${characterId} not found`)
    if (!adventure) throw new NotFoundException(`Adventure ${adventureId} not found`)

    // Reconstrói o fio recente da conversa em ordem cronológica.
    const history: CoreMessage[] = historyLogs
      .map((log) => {
        const text = (log.payload as { text?: string }).text ?? ''
        return {
          role: log.type === 'NARRATION' ? ('assistant' as const) : ('user' as const),
          content: text,
        }
      })
      .filter((m) => m.content.trim().length > 0)

    const systemName = adventure.system.name
    const inventory = (characterState?.inventory ?? []) as unknown as InventoryItem[]
    // Título + descrição da quest primária para o DM saber o objetivo (US-28).
    // US-169: `objective` soma quando presente — guard obrigatório: `primary.objective` é
    // `String?` (quests legadas, pré-US-169, ficam `null`), sem o guard o texto "null" vaza
    // literal no bloco `## Main quest` do turno.
    const primary = quests.find((q) => q.isPrimary)
    const mainQuest = primary ? `${primary.title}\n${primary.description}${primary.objective ? `\n${primary.objective}` : ''}` : null
    const activeQuests = quests.filter((q) => !q.isPrimary)

    // Rótulos e perícias vêm de System.config (US-21/US-27, já validado na criação);
    // ausente → o builder usa a chave crua / sem perícias. ponytail: leitura defensiva sem re-validar.
    // US-99: resolvido pelo locale do dono — `system.config` cru é a base EN e mandaria
    // "Strength" ao prompt de um Mestre que narra em português.
    const locale = resolveLocale(character.user?.locale)
    const config = configForLocale(adventure.system, locale) as Partial<SystemConfig> | null
    const attributeLabels = Object.fromEntries((config?.attributes ?? []).map((a) => [a.key, a.label]))

    // Ficha que o mestre precisa conhecer (US-23). Prefere o estado (evolui com
    // level-up) e cai em baseAttributes quando o estado ainda não existe.
    const attributes = (characterState?.attributes ?? character.baseAttributes ?? {}) as Record<string, number>
    // Todas as perícias com modificador (US-27): o mestre decide qualquer teste, não só as proficientes.
    // Guarda a versão COM `key` (US-38: a rolagem resolve o modificador por key);
    // a versão sem `key` alimenta o prompt/ficha.
    const resolvedSkills = config?.skills
      ? buildSkillSheet(config.skills, attributes, (character.skills ?? []) as string[], config.proficiency?.bonus ?? 2)
      : undefined
    const skills = resolvedSkills?.map(({ label, modifier, proficient }) => ({ label, modifier, proficient }))
    // US-132: ferramentas/veículos proficientes da origem — traço FIXO de nível 1 (mesmo
    // perfil de `skills`), resolvidos pro rótulo do locale ativo. Vai à camada 2 (sheetSection,
    // `sheet.tools`), nunca ao INVENTORY_BLOCK do turno — ver dm-system.ts §SKILLS_LINE.
    // `characterTools` (não `tools`, colidiria com o registro de tools da AI SDK mais abaixo).
    const characterTools = ((character.tools ?? []) as string[]).map((key) => catalogLabel(config?.tools, key))
    // US-100: a ficha guarda CHAVES de feature/magia; o catálogo do locale devolve o texto.
    // Resolvido UMA vez por turno e compartilhado com a tool `getSpell` abaixo — é o que
    // mantém a busca por nome na MESMA língua da lista que o prompt mostrou.
    // US-135: Character.features mistura chaves de classe (US-41) e de origem (benefício
    // `feature` do background) — resolveCharacterFeatures resolve as duas contra a união
    // dos dois catálogos, sem mudar a assinatura de resolveSheetEntries (ver US-135 §Notas).
    const origin = character.origin as { key?: string; connection?: string; memento?: string } | null
    const originKey = origin?.key
    const features = config
      ? resolveCharacterFeatures(config as SystemConfig, character.class, originKey, (character.features ?? []) as string[])
      : []
    const knownSpells = resolveSheetEntries(config?.classSpells, config?.retiredSpells, character.class, (character.spells ?? []) as string[])
    // US-125: gancho de origem (catálogo) + conexão/memento ESCOLHIDOS (US-124) — os dois
    // últimos já chegam resolvidos em `origin`, sem função de resolução (ver dm-system.ts).
    const originNarrative = {
      adventuresAndAdvancement: resolveAdventuresAndAdvancement(config?.backgrounds, originKey),
      connection: origin?.connection,
      memento: origin?.memento,
    }
    const sheet = {
      level: character.level,
      hp: characterState?.hp ?? 0,
      maxHp: characterState?.maxHp ?? 0,
      attributes,
      conditions: (characterState?.conditions ?? []) as string[],
      skills,
      tools: characterTools,
    }

    // US-56: o system carrega SÓ as camadas 1+2 (estático + constante por personagem).
    // O estado volátil (HP/condições, cena, quests, inventário, resumo) sai daqui e vai
    // para o bloco de estado do turno, prefixado à mensagem — assim `system + history`
    // vira prefixo estável e cacheável.
    const systemPrompt = buildDmSystemPrompt({
      systemName,
      characterName: character.name,
      characterGender: character.gender,
      // US-105: a ficha guarda a CHAVE (`wizard`); o Mestre recebe o rótulo do locale ativo
      // ("Mago"/"Wizard"). Sistema sem catálogo no config → a própria chave, nunca vazio.
      characterClass: catalogLabel(config?.classes, character.class),
      characterRace: catalogLabel(config?.races, character.race),
      sheet,
      attributeLabels,
      background: (character.background ?? {}) as unknown as CharacterBackground,
      // US-41: features de classe do kit (awareness read-only), no locale ativo (US-100).
      features,
      // US-42: magias conhecidas — SÓ os nomes vão ao prompt; a descrição vem via getSpell.
      spells: knownSpells.map((s) => ({ name: s.name, level: s.level })),
      // US-125: gancho de origem + conexão/memento escolhidos, awareness apenas.
      originNarrative,
      // US-97: camada 1 do prompt (estável por usuário) — trocar de idioma invalida o
      // cache do prefixo uma vez, e é evento raro (ADR 007).
      locale,
      // US-168: já disponível de graça no SELECT * implícito do findUnique acima —
      // nenhuma query nova. Ausente/sistema sem motor de geração → sem linha extra.
      tone: (adventure.generatedAdventure as GeneratedAdventure | null)?.registry.tone,
      // US-185: mesmo registry do tone acima, mesma condição de ausência.
      setting: (adventure.generatedAdventure as GeneratedAdventure | null)?.registry.setting,
      areaType: (adventure.generatedAdventure as GeneratedAdventure | null)?.registry.areaType,
    })

    // US-166: sinal de orientação — o encontro de menor id cujo local ainda não é `revelado`
    // no ledger. Puro/sem IA (nextUnrevealedEncounterLocation); `null` quando não há aventura
    // gerada ou todos os locais de encontro já foram revelados — bloco fica ausente.
    const generatedAdventure = adventure.generatedAdventure as GeneratedAdventure | null
    const entities = (adventure.entities ?? null) as WorldEntity[] | null
    const nextEncounter = generatedAdventure
      ? nextUnrevealedEncounterLocation(generatedAdventure.encounters, generatedAdventure.locations, entities ?? [])
      : null
    const nextEncounterLocationTitle = nextEncounter
      ? generatedAdventure!.locations.find((l) => l.id === nextEncounter.locationId)?.title ?? null
      : null

    // US-56: bloco de estado volátil do turno, prefixado à AÇÃO CRUA do jogador. A ação
    // crua (`message`) permanece separada — é ela, não o conteúdo prefixado, que o
    // `onFinish` persiste no EventLog (fronteira de persistência: mantém o history e o
    // resumo limpos e o próprio prefixo do history estável turno a turno).
    const turnState = buildTurnStateBlock({
      sheet,
      sceneState: (characterState?.sceneState ?? null) as SceneState | null,
      entities,
      mainQuest,
      activeQuests: activeQuests.map((q) => q.title),
      inventory: inventory.map((i) => (i.qty > 1 ? `${i.name} (${i.qty})` : i.name)),
      memorySummary: adventure.memorySummary,
      nextEncounterLocationTitle,
    })
    const messages: CoreMessage[] = [...history, { role: 'user', content: `${turnState}\n\n${message}` }]

    // US-38: um teste ancorado por turno. "Uma ação → um teste": o modelo às
    // vezes rola duas perícias diferentes para a mesma coisa (ex.: Sobrevivência
    // + Percepção para rastrear). Guardamos o 1º teste ancorado do turno; um 2º
    // (qualquer perícia/atributo) reusa o 1º. Rolagens SEM anchor (dano, cura)
    // não são testes e não entram nessa trava.
    // COMPARTILHADO entre tentativas: no fallback o controller reexecuta
    // streamChat; sem o estado compartilhado o mesmo teste rolava de novo (duas
    // rolagens iguais). O caller passa `rollState`; sem ele, escopo local.
    // ponytail: trava por turno inteiro; se um dia um turno precisar de dois
    // testes distintos legítimos, trocar por regra mais fina.
    const rolls: RollTurnState = rollState ?? { first: null }

    // Monta as tools — cada tool chama o Game Server (this.dice, this.prisma)
    const tools = {
      rollDice: tool({
        description:
          'Roll a d20 check. Say WHAT is being tested via `skill` (or `ability`) key — the system supplies the modifier from the character sheet. NEVER pass a modifier of your own. Roll ONE check per action. ALWAYS call this BEFORE narrating a chance-based outcome and WAIT for the result.',
        parameters: z.object({
          reason: z.string().describe('Short label for the roll block, e.g. "Percepção para seguir as pegadas"'),
          skill: z.string().optional().describe('Name of the tested skill exactly as shown in the character sheet (e.g. "Percepção"). System supplies the modifier — do NOT add one.'),
          ability: z.string().optional().describe('Name of the tested attribute when no skill applies (e.g. "Destreza"). System supplies the modifier.'),
          dice: z.string().optional().describe('Base die only, default "1d20". Any +N here is IGNORED — the modifier comes from the sheet.'),
        }),
        execute: async ({ reason, skill, ability, dice }: { reason: string; skill?: string; ability?: string; dice?: string }) => {
          const isAnchored = !!(skill || ability)
          // US-38: um teste por ação — 2º teste ancorado no turno (inclusive numa
          // tentativa de fallback) reusa o 1º.
          if (isAnchored && rolls.first) {
            console.log(JSON.stringify({ event: 'roll_dedup', turnId, timestamp: new Date().toISOString(), skill, ability }))
            return rolls.first
          }

          // US-38: o modificador vem SEMPRE da ficha, nunca do modelo. Casa por
          // key OU rótulo (o modelo vê perícias por rótulo no prompt). `label` =
          // rótulo canônico da perícia/atributo, exibido no bloco.
          const { modifier, unresolved, label: skillLabel } = resolveRollModifier({ skill, ability, skills: resolvedSkills, attributes, attributeLabels })
          if (unresolved) {
            console.log(JSON.stringify({ event: 'roll_unresolved_skill', turnId, timestamp: new Date().toISOString(), skill, ability, reason }))
          }
          const base = normalizeDie(dice)
          const formula = `${base}${modifier >= 0 ? '+' : ''}${modifier}`
          const result = this.dice.roll(formula)
          await this.prisma.eventLog.create({
            data: {
              adventureId,
              characterId,
              type: 'DICE_ROLL',
              payload: { formula, reason, skill, ability, skillLabel, rolls: result.rolls, modifier: result.modifier, total: result.total },
            },
          })
          // Devolve `reason` (rótulo do bloco) e `skillLabel` (perícia usada) para
          // o controller montar o frame `D:` (US-29/US-38).
          const out = { ...result, reason, skill: skillLabel }
          if (isAnchored) rolls.first = out
          return out
        },
      }),

      updateCharacterHp: tool({
        description: 'Update character HP after taking damage or healing.',
        parameters: z.object({
          newHp: z.number().describe('New HP value (cannot exceed maxHp)'),
          reason: z.string().describe('Why HP changed'),
        }),
        execute: async ({ newHp, reason }: { newHp: number; reason: string }) => {
          const maxHp = characterState?.maxHp ?? 0
          const clampedHp = Math.max(0, Math.min(newHp, maxHp))
          await this.prisma.characterState.upsert({
            where: { characterId_adventureId: { characterId, adventureId } },
            update: { hp: clampedHp },
            create: {
              characterId,
              adventureId,
              hp: clampedHp,
              maxHp,
              attributes: (character.baseAttributes as object) ?? {},
            },
          })
          await this.prisma.eventLog.create({
            data: {
              adventureId,
              characterId,
              type: 'CHARACTER_UPDATE',
              payload: { field: 'hp', newHp: clampedHp, reason },
            },
          })
          return { hp: clampedHp, maxHp }
        },
      }),

      updateInventory: tool({
        description:
          'Add or remove items from the character inventory. Call when the character acquires, uses, gives away, or loses items. Positive delta = add, negative = remove.',
        parameters: z.object({
          changes: z.array(z.object({
            name: z.string().describe('Item name, exactly as it should appear in the inventory'),
            delta: z.number().int().describe('Quantity change: positive to add, negative to remove'),
          })).describe('List of item changes to apply'),
        }),
        execute: async ({ changes }: { changes: { name: string; delta: number }[] }) => {
          const state = await this.prisma.characterState.findUnique({
            where: { characterId_adventureId: { characterId, adventureId } },
          })

          const current = (state?.inventory ?? []) as unknown as InventoryItem[]
          const inventory = applyInventoryDeltas(current, changes)

          const total = inventory.reduce((a, item) => a + item.qty, 0)
          if (total > 9999) {
            return { error: 'Inventário cheio: limite de 9999 itens atingido. O item não foi adicionado.' }
          }

          const inventoryJson = inventory as unknown as object

          await this.prisma.characterState.upsert({
            where: { characterId_adventureId: { characterId, adventureId } },
            update: { inventory: inventoryJson },
            create: {
              characterId,
              adventureId,
              hp: characterState?.hp ?? 10,
              maxHp: characterState?.maxHp ?? 10,
              attributes: (character.baseAttributes as object) ?? {},
              inventory: inventoryJson,
            },
          })

          await this.prisma.eventLog.create({
            data: {
              adventureId,
              characterId,
              type: 'CHARACTER_UPDATE',
              payload: { field: 'inventory', changes: changes as unknown as object, result: inventoryJson },
            },
          })

          return { inventory }
        },
      }),

      updateScene: tool({
        description:
          'Update the structured scene state (source of truth for spatial continuity). Call BEFORE narrating whenever the scene CHANGES: the character moves to a new location, the environment switches indoor/outdoor, the time of day advances, an NPC arrives or leaves, or a notable object appears/disappears. Pass ONLY the fields that changed this turn — omitted fields keep their previous value. For `presentes` and `objetos_em_cena`, send the FULL current list (it replaces the previous one). Do NOT call this when the player merely inspects an item they are carrying — that does not move the character.',
        parameters: z.object({
          local: z.string().optional().describe('Current location in natural language, e.g. "praça central de Willowdale"'),
          ambiente: z.enum(['externo', 'interno']).optional().describe('externo = open/outdoors, interno = enclosed/indoors'),
          periodo: z.string().optional().describe('Time of day, e.g. manhã/tarde/entardecer/noite'),
          presentes: z.array(z.string()).optional().describe('FULL list of NPCs/characters present in the scene now (names only — an NPC\'s durable condition/status belongs in the entity ledger via recordEntity, not here).'),
          objetos_em_cena: z.array(z.string()).optional().describe('FULL list of notable objects visible/available in the scene now (distinct from carried inventory)'),
        }),
        execute: async (patch: {
          local?: string
          ambiente?: 'externo' | 'interno'
          periodo?: string
          presentes?: string[]
          objetos_em_cena?: string[]
        }) => {
          const current = (characterState?.sceneState ?? null) as SceneState | null
          const next = mergeSceneState(current, patch)
          const sceneJson = next as unknown as object

          await this.prisma.characterState.upsert({
            where: { characterId_adventureId: { characterId, adventureId } },
            update: { sceneState: sceneJson },
            create: {
              characterId,
              adventureId,
              hp: characterState?.hp ?? 10,
              maxHp: characterState?.maxHp ?? 10,
              attributes: (character.baseAttributes as object) ?? {},
              sceneState: sceneJson,
            },
          })

          await this.prisma.eventLog.create({
            data: {
              adventureId,
              characterId,
              type: 'CHARACTER_UPDATE',
              payload: { field: 'scene', patch: patch as unknown as object, result: sceneJson },
            },
          })

          return next
        },
      }),

      // Registro durável de entidades da campanha (NPCs, locais, objetos). Vive no
      // Adventure, FORA do EventLog/resumo — nunca é comprimido nem apagado pela
      // sumarização, então um callback a uma entidade de muitos turnos atrás
      // sobrevive (correção da amnésia que apagou "a Vigia" do resumo).
      recordEntity: tool({
        // US-84: a description É prompt (vai inteira ao modelo todo turno) e promete ao
        // modelo SOB QUE NOME o ledger reaparece — o mesmo literal que
        // `buildTurnStateBlock` emite. Vem da constante do ai-engine, não escrito à mão:
        // renomear o bloco lá renomearia esta promessa aqui também.
        description:
          `Record or update a DURABLE campaign entity (a named NPC, a place, a notable object, a faction) so it is never forgotten. Call this the moment you INTRODUCE such an entity, and again (with only the changed fields) whenever it moves or its state changes (an NPC wakes/dies/becomes an ally, a place is discovered/destroyed). Pass \`nome\` plus whatever is known: \`tipo\` (npc/local/objeto/faccao/outro), \`local\` (where it is now), \`estado\` (its current condition/relationship), \`nota\` (a short durable fact). Matching is by \`nome\` (accent/case tolerant); omitted fields keep their previous value. This ledger is re-shown to you in full every turn under "${ENTITIES_BLOCK}" — it is your permanent memory, unlike the scene (only the present) and the summary (lossy prose). Two independent knowledge axes (US-75): \`sabido\` = who in the WORLD may know this; \`revelado\` = whether the PLAYER has discovered it. Promote by re-recording: set \`revelado: true\` the moment the fiction reveals a hidden truth to the player, set \`sabido: "publico"\` when a private fact spreads through the world.

Links between two ledger entities (US-113) go in \`relacoes\`, NOT in \`nota\` — "Marta is Morvath's sister" is a fact about the EDGE between them, not about Marta alone. Call this with \`relacoes\` the moment the fiction ESTABLISHES a link between two entities you have already recorded (never invent one the fiction doesn't state). Each edge needs \`fonte\`: where this link came from — always fill it in, it is what lets you tell established canon from something you improvised. Edges merge by \`(relacao, para)\`, so re-recording the same edge updates it (e.g. to flip its \`revelado\`) instead of duplicating it.`,
        parameters: z.object({
          entidades: z
            .array(
              z.object({
                nome: z.string().describe('Entity name, e.g. "Vigia", "sala secreta sob a capela", "Barnabé".'),
                tipo: z.enum(['npc', 'local', 'objeto', 'faccao', 'outro']).optional(),
                local: z.string().optional().describe('Where it is now (for a mobile NPC/object). A place itself needs no `local`.'),
                estado: z.string().optional().describe('Current condition/relationship, e.g. "inconsciente", "acordado", "aliada", "hostil".'),
                nota: z.string().optional().describe('A short durable fact the DM must not forget about this entity.'),
                sabido: z
                  .enum(['publico', 'privado'])
                  .optional()
                  .describe('World-provenance. "publico" (default) = common knowledge any local NPC may reference. "privado" = only the player and whoever witnessed it discovered it alone/off-scene (e.g. thugs the player met while alone) — an NPC must NOT mention it unless the player told them in scene.'),
                revelado: z
                  .boolean()
                  .optional()
                  .describe('Player-discovery. true (default) = the player character already knows this, narrate freely. false = a world-truth you PIN so you stay consistent but the player has NOT connected yet — keep it hidden from narration and options until the fiction reveals it, then re-record with revelado:true.'),
                relacoes: z
                  .array(
                    z.object({
                      relacao: z.string().describe('The link\'s verb, readable in prose: "irmã de", "deve dinheiro a", "serve", "fica dentro de".'),
                      para: z.string().describe('`nome` of the target entity (accent/case tolerant match).'),
                      fonte: z
                        .string()
                        .describe('REQUIRED. Where this edge was established: "abertura" if from the opening, or a short note of the scene/turn it came from. This is what separates canon from improvisation — never leave it out.'),
                      sabido: z
                        .enum(['publico', 'privado'])
                        .optional()
                        .describe('World-provenance of THIS EDGE — independent of the two entities\' own `sabido`. Ausente ⇒ publico.'),
                      revelado: z
                        .boolean()
                        .optional()
                        .describe('Player-discovery of THIS EDGE — independent of the two entities\' own `revelado`. Two revealed entities can still have a hidden link between them. Ausente ⇒ true.'),
                    }),
                  )
                  .optional()
                  .describe('Directed links FROM this entity to other ledger entities, established by the fiction this turn.'),
              }),
            )
            .describe('One or more entities to insert or update this turn.'),
        }),
        execute: async ({ entidades }: { entidades: EntityPatch[] }) => {
          // Re-lê do banco (não do closure) para acumular corretamente quando o
          // modelo chama recordEntity mais de uma vez no mesmo turno.
          const fresh = await this.prisma.adventure.findUnique({
            where: { id: adventureId },
            select: { entities: true },
          })
          const current = (fresh?.entities ?? null) as WorldEntity[] | null
          const next = mergeEntities(current, entidades)

          await this.prisma.adventure.update({
            where: { id: adventureId },
            data: { entities: next as unknown as object },
          })

          // ponytail: SEM eventLog CHARACTER_UPDATE aqui de propósito. A persistência
          // é a coluna Adventure.entities. Logar CHARACTER_UPDATE marcaria o turno como
          // mutação de estado e o guard da US-67 bloquearia a edição — e como quase todo
          // turno apresenta um NPC, isso desativaria a edição de turnos de conversa.
          return { entities: next }
        },
      }),

      // US-169: fecha a quest PRIMÁRIA da aventura corrente — sucesso ou fracasso/desistência
      // (`outcome: 'failure'` cobre os dois, ver US-169 Questões em aberto #2). Devolve
      // `conclusionHint` (texto que o motor já escreveu pro desfecho) pro Mestre expandir na
      // narração do MESMO turno, sem citar verbatim (mesma disciplina do `hookSeed`).
      completeQuest: tool({
        description:
          'Call this the moment the fiction resolves the adventure\'s main objective — the character achieves it, or clearly fails/gives up on it (flees, refuses to continue, an irreversible change of course). Pass `outcome`: "success" or "failure" (failure also covers abandoning/fleeing the objective). Returns `conclusion`: prose written for this exact ending — use it as the BASIS for your closing narration this turn, never quote it verbatim. Call this only ONCE per adventure; a second call after the quest is already closed does not overwrite it.',
        parameters: z.object({
          outcome: z.enum(['success', 'failure']),
          reason: z.string().optional().describe('Short note of HOW it ended, for the campaign record — e.g. "derrotou Malvora em combate", "fugiu da vila sem enfrentar o culto".'),
        }),
        execute: async ({ outcome, reason }: { outcome: 'success' | 'failure'; reason?: string }) => {
          const quest = await this.prisma.quest.findFirst({ where: { adventureId, isPrimary: true } })
          if (!quest) {
            throw new Error(`completeQuest: nenhuma quest isPrimary:true para adventureId="${adventureId}" — esperado exatamente uma quest primária por aventura`)
          }

          const status = outcome === 'success' ? 'COMPLETED' : 'FAILED'
          const isTerminal = quest.status === 'COMPLETED' || quest.status === 'FAILED'
          // US-169 (Questão em aberto #4): outcome DIFERENTE do já gravado, com a quest já
          // terminal, REJEITA — não sobrescreve (evita duas conclusões narrativas contraditórias
          // vindas de o modelo "se corrigir" por engano). Mesmo outcome repetido é idempotente.
          if (isTerminal && quest.status !== status) {
            return { alreadyCompleted: true, status: quest.status, conclusion: quest.conclusionHint }
          }

          await this.prisma.quest.update({
            where: { id: quest.id },
            data: { status, completedAt: new Date() },
          })
          await this.prisma.eventLog.create({
            data: {
              adventureId,
              characterId,
              type: 'CHARACTER_UPDATE',
              payload: { field: 'quest', outcome, ...(reason ? { reason } : {}) },
            },
          })

          return { conclusion: quest.conclusionHint }
        },
      }),

      // US-42: descrição da magia sob demanda. Awareness apenas — NÃO resolve slot,
      // dano, cura ou preparação. Fonte de verdade = Character.spells (as chaves do kit
      // da classe), resolvida no locale ativo. Match tolerante a acento/caixa. Magia fora
      // da lista → { known: false } e o mestre NÃO inventa o efeito.
      //
      // US-100: casa contra `knownSpells` (o MESMO array que virou a lista do prompt), não
      // contra a coluna crua — que hoje é chave. Fosse a coluna, o mestre pediria "Fúria" e
      // receberia known:false, porque lá está `barbarian_rage`.
      getSpell: tool({
        description:
          'Look up a spell the character knows to get its effect BEFORE narrating a casting. Pass the spell NAME exactly as shown in the "Known spells" list. Returns { known, level, description }. If it returns known:false, the character does NOT know that spell — do NOT invent its effect. This is awareness only: it does NOT spend slots, roll damage/healing, or track preparation.',
        parameters: z.object({
          name: z.string().describe('Spell name as shown in the "Known spells" list, e.g. "Chama Sagrada".'),
        }),
        execute: async ({ name }: { name: string }) => {
          return resolveKnownSpell(knownSpells, name)
        },
      }),
    }

    const model = narrationModels[Math.min(attempt, narrationModels.length - 1)]!
    const hasFallback = attempt < narrationModels.length - 1
    console.log(`[AiService] turno attempt=${attempt} modelo=${model.modelId ?? 'unknown'}`)

    // US-69: sinal do guard anti-degeneração. O controller, ao detectar repetição
    // patológica mid-stream, marca `degenerated = true` ANTES de descartar o stream —
    // o `onFinish` (que ainda pode disparar quando o provider termina a geração
    // cancelada) NÃO persiste nem sumariza o turno-lixo. Um objeto novo por tentativa:
    // o retry cria o seu, então o `onFinish` desta tentativa vê o SEU flag (sem corrida
    // com a tentativa boa que persiste). Mesmo padrão do `rollState`.
    // US-74: `incomplete` marca o turno truncado (o modelo parou num cliffhanger sem
    // emitir a lista de opções). Como o degenerado, gate de persistência: o onFinish NÃO
    // grava o turno-sem-saída e o controller re-amostra. Objeto novo por tentativa.
    const turnGuard = { degenerated: false, incomplete: false }

    // Retorna o stream — o controller vai encaminhar para o cliente
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      providerOptions: NARRATION_PROVIDER_OPTIONS,
      maxSteps: 5, // permite até 5 tool calls por turno
      // Teto explícito de saída. Sem isto vale o default do provider — e como o
      // raciocínio oculto do deepseek (reasoning.exclude) CONTA no orçamento mas
      // não volta, a narração era cortada no meio da frase (finishReason=length).
      // 4000 comporta o raciocínio cheio (sem effort cap, pra manter aderência ao
      // prompt) + narração + opções com folga.
      maxTokens: 4000,
      // Anti-loop degenerado (US-69). Penalidade de repetição — 1ª linha probabilística
      // contra "cra cra cra…" em região OOD; a rede determinística do guard (controller)
      // é a 2ª. openai-compatible@0.2.16 envia como `presence_penalty`; OpenRouter/DeepSeek
      // honram, o Groq ignora se não suportar.
      //
      // presencePenalty, NÃO frequencyPenalty (troca 2026-07-24). Diagnóstico da
      // reincidência do embaralhamento de whitespace (US-69, 2º modo): finishReason=stop,
      // reasoningTokens=782 > prosa visível, providerMetadata SEM nome de backend (não
      // dá pra confirmar "backend ruim"). `frequency_penalty` escala ∝ contagem do token,
      // e o espaço é o mais contado — os 782 tokens de raciocínio oculto inflam essa
      // contagem ANTES da prosa, então a penalidade suprime espaços na narração (palavras
      // fundidas). `presence_penalty` é FIXA (não escala com o comprimento do raciocínio)
      // → desencoraja o loop sem esmagar o whitespace. Se o embaralhamento reincidir
      // MESMO sem frequency, a causa é upstream (backend) e aí sim entra o detector de
      // whitespace no guard.
      presencePenalty: 0.3,
      // Persiste a narração do mestre ao final, mantendo a continuidade da cena,
      // e condensa turnos antigos no resumo quando a janela cresce demais.
      onFinish: async ({ text, steps, finishReason, usage, providerMetadata, response }) => {
        // DIAGNÓSTICO corte de narração: 'length' = estourou maxTokens (raciocínio
        // oculto do deepseek conta no orçamento); 'stop' com prosa incompleta =
        // provider dropou upstream; 'error' = ver logs acima.
        // US-69 PASSO 0: a intenção era logar SEMPRE o provider upstream que o OpenRouter
        // roteou, para a próxima ocorrência do embaralhamento de whitespace (2º modo)
        // desambiguar backend ruim (hipótese principal) de frequencyPenalty×raciocínio.
        // O dump cru de `providerMetadata` que morava aqui NÃO entregava isso — o nome do
        // endpoint não sobrevive à normalização do SDK. US-103 põe o nome na linha abaixo
        // (via metadataExtractor, em model.ts) e o dump saiu: uma linha a menos por turno.
        // `model=` nomeia o nível da escada que serviu (flash / pro / Groq).
        console.log(
          JSON.stringify({
            event: 'turn_summary',
            turnId,
            timestamp: new Date().toISOString(),
            finishReason,
            model: model.modelId ?? 'unknown',
            provenance: formatProvenance(providerMetadata),
            tokens: usage,
            steps: steps.length,
          }),
        )
        // US-55 spike de cache: o pin @ai-sdk/openai-compatible@0.2.16 não
        // normaliza cached tokens no `usage` (só promptTokens/completionTokens); o
        // OpenRouter/DeepSeek reporta em prompt_tokens_details.cached_tokens +
        // cache_discount no corpo bruto, que sai em providerMetadata/response.body.
        // US-103, medido no dist do SDK: no STREAMING `response.body` é `undefined`
        // (doStream devolve só headers) — aqui o número útil é
        // `providerMetadata.openrouter.cachedPromptTokens`, que o SDK preenche a partir
        // de prompt_tokens_details. O dump do corpo só tem conteúdo nas extrações.
        // Gate por env pra logar SÓ quando estamos medindo — sem ruído em prod.
        // ponytail: dump completo atrás de flag; remover a flag quando a Q1 fechar.
        if (process.env.DM_CACHE_SPIKE) {
          console.log(
            '[AiService][cache-spike] providerMetadata=',
            JSON.stringify(providerMetadata),
            'response.body=',
            JSON.stringify((response as { body?: unknown }).body),
          )
        }
        // Em turnos multi-step, `text` concatena a narração de TODOS os steps.
        // Reconstruímos exatamente o que foi mostrado ao jogador (mesma lógica
        // do controller): descartamos um step anterior só quando ele já era uma
        // narração completa (terminava com opções) — duplicação real — mas
        // mantemos preparação + desfecho juntos. Sem isso o histórico grava a
        // duplicação e realimenta o problema nos próximos turnos.
        const COMPLETE_NARRATION = /(^|\n)\s*-\s/
        let shown = ''
        for (const step of steps) {
          const t = step.text ?? ''
          if (t.trim().length === 0) continue
          if (COMPLETE_NARRATION.test(shown)) shown = ''
          shown += t
        }
        // Rede de segurança — remove o raciocínio que o provider tenha deixado
        // vazar para a prosa (canais Harmony do gpt-oss, bloco <think>) ANTES de
        // persistir. O jogador já viu o texto do stream: o que se protege aqui é
        // o HISTÓRICO, que volta como contexto nos próximos turnos e é fundido no
        // resumo (US-18) — sem isto o vazamento se realimenta. A prevenção real é
        // o NARRATION_PROVIDER_OPTIONS; isto é a segunda linha de defesa, para o
        // dia em que um provider novo (ou um bump do SDK) volte a entregar os
        // canais no content.
        const { clean: withoutReasoning, removed: leaked } = stripReasoningLeak((shown || text).trim())
        if (leaked.length > 0) {
          console.log(
            JSON.stringify({
              event: 'leak_reasoning_stripped',
              turnId,
              timestamp: new Date().toISOString(),
              leaked: leaked.map((l) => l.slice(0, 120)),
            }),
          )
        }
        // US-29: rede de segurança — remove da narração qualquer resultado de
        // rolagem inventado pelo modelo ANTES de persistir. O número real vive
        // só no bloco de rolagem (evento DICE_ROLL), nunca na prosa. Assim o
        // histórico e o resumo (US-18) nunca realimentam a alucinação.
        const { clean: withoutRolls, removed } = stripFabricatedRolls(withoutReasoning)
        if (removed.length > 0) {
          console.log(JSON.stringify({ event: 'leak_fake_roll_stripped', turnId, timestamp: new Date().toISOString(), removed }))
        }
        // Rede de segurança — remove tags de control-plane (`[WORLD_STATE_UPDATE:...]`)
        // que o modelo tenha cravado na prosa apesar do prompt. É sink legado que
        // nada lê; mudança de estado é só via tool. Sem isto o tag entra no
        // histórico/resumo e realimenta o vazamento nos próximos turnos.
        const { clean: finalText, removed: stateTags } = stripWorldStateTags(withoutRolls)
        if (stateTags.length > 0) {
          console.log(JSON.stringify({ event: 'leak_state_tag_stripped', turnId, timestamp: new Date().toISOString(), stateTags }))
        }
        // US-69: turno cortado pelo guard anti-degeneração (loop de repetição
        // detectado mid-stream). O jogador já teve o parcial descartado no cliente e
        // o turno vai ser reescrito — NÃO persistir o lixo nem sumarizar em cima dele.
        // (Sai depois dos saneadores/log só para o diagnóstico continuar visível.)
        if (turnGuard.degenerated) {
          console.log(
            JSON.stringify({
              event: 'turn_discarded_degenerate',
              turnId,
              timestamp: new Date().toISOString(),
              reason: 'guard anti-degeneração (US-69)',
            }),
          )
          return
        }
        // US-74: turno truncado — narração sem a lista de opções obrigatória (o modelo
        // parou num cliffhanger, `finishReason=stop`). Autoridade de PERSISTÊNCIA: não
        // grava o beco-sem-saída nem sumariza em cima dele. O controller detecta o mesmo
        // (predicado puro idêntico) e re-amostra. Só quando HÁ prosa — um turno vazio já
        // cai no guard `finalText.length > 0` abaixo (fallback/erro antes de emitir texto).
        if (turnGuard.incomplete || (finalText.length > 0 && !hasOptionsList(finalText))) {
          console.log(
            JSON.stringify({
              event: 'turn_discarded_truncated',
              turnId,
              timestamp: new Date().toISOString(),
              reason: 'sem lista de opções (US-74); controller re-amostra',
            }),
          )
          turnGuard.incomplete = true
          return
        }
        // Só registra o turno (ação + narração) quando ele de fato produziu
        // narração. Uma tentativa que falhou antes de emitir texto não grava
        // nada, evitando duplicar a ação quando o fallback assume.
        if (finalText.length > 0) {
          await this.prisma.eventLog.create({
            data: { adventureId, characterId, type: 'ACTION', payload: { text: message } },
          })
          await this.prisma.eventLog.create({
            data: { adventureId, characterId, type: 'NARRATION', payload: { text: finalText } },
          })
          // US-36: observabilidade de slop names (onomástica). Detector determinístico,
          // custo zero, NÃO regenera — só loga quando um nome clichê passa. Dá a
          // métrica de prod pra decidir enforcement (regeneração) com dado depois.
          const slop = detectSlopName(finalText)
          if (slop.slop) console.log(JSON.stringify({ event: 'slop_name', turnId, timestamp: new Date().toISOString(), match: slop.match }))
          // US-115 fase A: observabilidade PURA da omissão de `recordEntity` — detecta,
          // loga, NÃO age (a fase B, condicionada ao resultado desta medição, é quem
          // insere no ledger). `calledRecordEntity` vai no payload para o log já trazer
          // a taxa real de omissão (detector acusou E o modelo não registrou), sem
          // precisar casar linhas de log por turnId depois.
          const calledRecordEntity = steps.some((s) => (s.toolCalls ?? []).some((tc) => tc.toolName === 'recordEntity'))
          const unledgered = detectUnledgeredName(finalText, adventure.entities as WorldEntity[] | null, character.name)
          if (unledgered.unledgered) {
            console.log(
              JSON.stringify({
                event: 'unledgered_name',
                turnId,
                timestamp: new Date().toISOString(),
                match: unledgered.match,
                calledRecordEntity,
              }),
            )
          }
          // US-36: avaliação de qualidade AO VIVO em dev (async, fire-and-forget).
          // NÃO dar await — o jogador já recebeu o stream; a nota chega ao log
          // depois. Só roda atrás de DM_LIVE_EVAL (nunca em produção).
          void this.liveEvalTurn(message, finalText, turnId)
          // US-73: rede de segurança contra o sceneState apodrecer. Se o modelo NÃO
          // manteve a cena via `updateScene` neste turno (comum em turnos de
          // viagem→chegada), reconcilia o sceneState com a narração em background —
          // sem isso o `local` congela e o sinal de continuidade da US-71 passa a
          // apontar para trás, alimentando o replay (bug de `erro narração 2`). Roda
          // SÓ quando o modelo negligenciou a cena → custo zero nos turnos disciplinados.
          const cenaTocada = steps.some((s) => (s.toolCalls ?? []).some((tc) => tc.toolName === 'updateScene'))
          // US-116 (ADR 011, Camada 0): taxa observável de cenaTocada — o único sinal do
          // inventário do ADR 011 que ainda faltava logar. Emite em TODO turno com
          // narração (não só quando reconcileScene dispara), pra virar taxa, não só falha.
          console.log(JSON.stringify({ event: 'arc_signal', turnId, timestamp: new Date().toISOString(), adventureId, characterId, cenaTocada }))
          if (!cenaTocada) void this.reconcileScene(adventureId, characterId, finalText, character.name, turnId)
        }
        await this.summarizeOldTurns(adventureId, characterId)
      },
    })

    return { result, hasFallback, turnGuard }
  }

  /**
   * US-74 (salvage): completa uma narração TRUNCADA — o modelo parou num cliffhanger,
   * sem a lista de opções. NÃO re-roda o turno: as tools já commitaram no banco
   * (cena/entidades/inventário), então re-amostrar dessincronizaria o mundo (inventário
   * em dobro, cena avançada 2×) e serializaria outra geração cheia, estourando o teto de
   * 60s do proxy SSE (a causa real do "a narração sumiu" em prod). Em vez disso, UMA
   * chamada curta, SEM tools, continua a prosa de onde parou e fecha com as opções.
   *
   * Persiste ACTION + NARRATION(narração + fecho) — é a autoridade de persistência do
   * turno salvo (o `onFinish` da tentativa truncada foi gateado por `turnGuard.incomplete`
   * e NÃO gravou). Devolve SÓ o fecho, para o controller anexar à narração que o cliente
   * já mostrou. Nunca lança: falha/vazio devolve um fecho estático — o jogador nunca fica
   * sem saída.
   */
  async completeTruncatedTurn(input: ChatInput, narration: string, turnId?: string): Promise<string> {
    const { adventureId, characterId, message } = input
    const base = narration.trimEnd()

    let closure = ''
    try {
      const { text } = await generateText({
        // US-114: extractionModel (qwen/qwen3.7-flash), não mais narrationModels[0].
        // Fecho é continuação curta sem tools, mesma classe de tarefa das extrações —
        // e é o item de maior valor da US-114 (latência dentro do teto de 60s do proxy).
        model: extractionModel,
        system: SALVAGE_SYSTEM_PROMPT,
        prompt: `[AÇÃO DO JOGADOR]:\n${message}\n\n[NARRAÇÃO ATÉ AGORA — continue EXATAMENTE de onde parou, sem repetir]:\n${base}`,
        maxTokens: 700,
        providerOptions: SALVAGE_PROVIDER_OPTIONS,
      })
      // Mesma cadeia de saneadores do onFinish: o fecho volta ao histórico como contexto.
      closure = stripWorldStateTags(stripFabricatedRolls(stripReasoningLeak(text).clean).clean).clean.trim()
    } catch (err) {
      logLlmFailure('completeTruncatedTurn: geração do fecho', 'usa o fecho estático', err, turnId)
    }

    // Garante o contrato de fecho: sem opções (falha, vazio, ou o modelo ignorou) → anexa
    // o fallback estático. Nunca devolve um turno ainda truncado.
    if (!hasOptionsList(closure)) {
      closure = closure ? `${closure}${SALVAGE_FALLBACK}` : SALVAGE_FALLBACK.trimStart()
    }

    const separator = base.endsWith('\n') ? '' : '\n\n'
    const streamed = `${separator}${closure}`
    const finalText = `${base}${streamed}`

    await this.prisma.eventLog.create({
      data: { adventureId, characterId, type: 'ACTION', payload: { text: message } },
    })
    await this.prisma.eventLog.create({
      data: { adventureId, characterId, type: 'NARRATION', payload: { text: finalText } },
    })

    // US-73 + US-74: este caminho NÃO passa pelo `onFinish` (gateado por
    // `turnGuard.incomplete`), então o `reconcileScene` de lá nunca corria — o
    // `sceneState` congelava no lugar ANTERIOR enquanto a narração já tinha mudado de
    // cena (prod 29/07/2026: narração no beco do Foles Quebrado, cena ainda na cozinha
    // da Sibil), e o sinal de continuidade da US-71 passava a apontar para trás no turno
    // seguinte. Mesmo fire-and-forget do onFinish: o jogador já recebeu o fecho.
    // ponytail: sem o gate `cenaTocada` do onFinish — os steps não chegam aqui, e um
    // turno truncado é justamente o desleixado. Uma extração a mais num caminho raro.
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { name: true },
    })
    void this.reconcileScene(adventureId, characterId, finalText, character?.name ?? '', turnId)

    await this.summarizeOldTurns(adventureId, characterId)

    return streamed
  }

  /**
   * Primeira narração da aventura gerada pelo MESMO DM (US-34): reusa
   * `buildDmSystemPrompt` (com a seção de ofício) e a fagulha do gancho da classe
   * como semente. Roda fora da transação de criação, SEM tools (não há ação, dados
   * nem CharacterState estruturado ainda). Nunca lança: qualquer falha devolve
   * `null` para o chamador cair no `openingNarration` estático (fallback).
   */
  async generateOpeningNarration(params: {
    systemName: string
    characterName: string
    characterGender: string
    characterClass: string
    characterRace: string
    mainQuest?: string | null
    /** US-168: ledger semeado do artefato gerado (`seedLedgerFromGeneratedAdventure`) — a
     * abertura passa a ver o mesmo elenco que o turno 1 vai persistir, em vez de escrever
     * cego (ramo "nenhuma entidade registrada ainda" do turn-state). */
    entities?: WorldEntity[] | null
    inventory: string[]
    sheet: DmCharacterSheet
    hookSeed: string
    attributeLabels?: Record<string, string>
    background?: CharacterBackground
    features?: ClassFeature[]
    spells?: KnownSpell[]
    /** US-97: idioma-alvo. A semente (gancho) é PT autoral — a cena sai no idioma do jogador. */
    locale?: Locale
    /** US-168: registo/mood da aventura gerada (`generated.tone`) — a abertura já nasce
     * coerente, sem esperar o round-trip pelo banco (ver `streamChat`). */
    tone?: string
    /** US-185: mesmo registry do `tone` acima — cenário/tipo de área da aventura gerada. */
    setting?: string
    areaType?: string
  }): Promise<string | null> {
    try {
      const system = buildDmSystemPrompt({
        systemName: params.systemName,
        characterName: params.characterName,
        characterGender: params.characterGender,
        characterClass: params.characterClass,
        characterRace: params.characterRace,
        sheet: params.sheet,
        attributeLabels: params.attributeLabels,
        background: params.background,
        features: params.features,
        spells: params.spells,
        locale: params.locale,
        tone: params.tone,
        setting: params.setting,
        areaType: params.areaType,
      })
      // US-56: o estado volátil saiu do system. Na abertura não há cena/histórico/HP
      // dinâmico, mas a main quest, o elenco semeado e o equipamento inicial ainda são
      // contexto útil — então prefixamos o bloco de estado ao prompt de abertura (mesma
      // convenção dos turnos: estado na mensagem, não no system).
      const turnState = buildTurnStateBlock({
        sheet: params.sheet,
        sceneState: null,
        entities: params.entities ?? null,
        mainQuest: params.mainQuest ?? null,
        activeQuests: [],
        inventory: params.inventory,
        memorySummary: null,
      })
      const prompt = `${turnState}\n\n${buildOpeningInstruction({ characterName: params.characterName, hookSeed: params.hookSeed, mainQuest: params.mainQuest, locale: params.locale })}`
      // Percorre a MESMA escada de modelos dos turnos (narrationModels): o primário
      // pode estar indisponível para a conta (ex.: gpt-oss-120b sem acesso no OpenRouter)
      // e é justamente esse fallback que mantém a narração dos turnos viva. Sem a
      // escada aqui, a abertura caía direto no template estático.
      for (const model of narrationModels) {
        try {
          const { text } = await generateText({ model, system, prompt, providerOptions: NARRATION_PROVIDER_OPTIONS })
          const trimmed = text.trim()
          if (trimmed.length > 0) return trimmed
        } catch (err) {
          logLlmFailure(`abertura no modelo ${model.modelId ?? 'unknown'}`, 'desce para o próximo modelo da escada', err)
        }
      }
      return null
    } catch (err) {
      logLlmFailure('geração da abertura por IA', 'usa o openingNarration estático do gancho', err)
      return null
    }
  }

  /**
   * US-35: extrai o estado de cena ESTRUTURADO da narração de abertura (US-34),
   * para que o `sceneState` inicial bata com a prosa já no turno 1 (a abertura roda
   * sem tools, então nunca chama `updateScene`). Saída estruturada e validada via
   * `generateObject` — nada de parsing de texto livre. Mesmo vocabulário do
   * `updateScene` (`ambiente` ∈ {externo,interno}; arrays para presentes/objetos).
   *
   * Roda FORA da transação de criação (é LLM). Nunca lança: qualquer falha, saída
   * vazia ou erro devolve `null` e a aventura nasce com `sceneState` nulo (fallback
   * idêntico à US-34, sem bloquear a criação). `carriedInventory` entra como lista
   * de exclusão — objetos de cena são distintos do que a personagem carrega (Q2).
   */
  async extractOpeningScene(openingText: string, carriedInventory: string[] = []): Promise<ScenePatch | null> {
    const text = openingText.trim()
    if (text.length === 0) return null
    try {
      const exclusion = carriedInventory.length > 0
        ? `\n\nNÃO liste como objeto de cena o que a personagem CARREGA no inventário: ${carriedInventory.join(', ')}.`
        : ''
      const { object, providerMetadata } = await generateObject({
        model: extractionModel,
        schema: OPENING_SCENE_SCHEMA,
        system:
          'Extraia o estado de cena atual desta narração de abertura de RPG. Use APENAS o que está no texto — não invente local, NPC nem objeto. `ambiente`: interno = coberto/abrigado, externo = aberto. `presentes`: só NPCs/personagens na cena (NUNCA a própria personagem-jogadora). `objetos_em_cena`: objetos e elementos notáveis do ambiente, incluindo atmosféricos (névoa, cheiro), NUNCA itens que a personagem carrega. Deixe um campo vazio só se o texto realmente não o revelar.',
        prompt: `Narração de abertura:\n"""\n${text}\n"""${exclusion}`,
        // Thinking desligado: com ele, o `tool_choice` do modo tool leva 400 e a cena
        // nasce nula sempre (medido 04/08/2026 — ver EXTRACTION_PROVIDER_OPTIONS).
        providerOptions: EXTRACTION_PROVIDER_OPTIONS,
      })
      logExtractionEndpoint('extractOpeningScene', extractionModel, providerMetadata)
      // Snapshot vazio (prosa sem cena discernível) = tratamos como nulo: nada a ancorar.
      const empty = !object.local.trim() && object.presentes.length === 0 && object.objetos_em_cena.length === 0
      return empty ? null : object
    } catch (err) {
      logLlmFailure('extração da cena da abertura', 'sceneState fica nulo e o turno 1 nasce sem âncora (US-35)', err)
      return null
    }
  }

  /**
   * US-75: SEMEIA o ledger `Adventure.entities` na criação da aventura, espelhando
   * `extractOpeningScene`. A abertura (US-34) roda tool-free e estabelece NPCs/locais
   * só em prosa — sem uma âncora estruturada, o Mestre fica livre para contradizê-los
   * depois (Erro 1: a estalajadeira dá ao herborista um lar diferente do estabelecido).
   *
   * Extrai APENAS o que o texto AFIRMA, e nunca INFERE um vínculo (dono, identidade
   * secreta, parentesco) que a prosa não diga — um arboreto anônimo entra como lugar,
   * sem dono. Toda entidade semeada é conhecimento comum já vivido pelo jogador, então
   * nasce `sabido: 'publico'` + `revelado: true` (forçado no código, não no extrator).
   *
   * Roda FORA da transação (é LLM). Nunca lança: falha/vazio devolve `null` e a aventura
   * nasce com ledger vazio (comportamento pré-US-75) — jamais derruba a criação.
   */
  async extractOpeningEntities(openingText: string, questContext = ''): Promise<WorldEntity[] | null> {
    const text = openingText.trim()
    if (text.length === 0) return null
    try {
      const { object, providerMetadata } = await generateObject({
        model: extractionModel,
        schema: OPENING_ENTITIES_SCHEMA,
        system:
          'Extraia as entidades DURÁVEIS que esta abertura de RPG estabelece — NPCs nomeados, locais, objetos notáveis, facções — e ONDE cada um está, usando APENAS o texto. Não invente e NÃO INFIRA vínculos que o texto não afirma explicitamente (dono, identidade secreta, parentesco): se a prosa mostra um arboreto sem dizer de quem é, extraia só "arboreto" (local), sem dono. Tudo aqui é conhecimento comum que o jogador já viu. Não inclua a própria personagem-jogadora. Se a abertura não estabelece nenhuma entidade durável, devolva a lista vazia.',
        prompt: `Abertura:\n"""\n${text}\n"""${questContext ? `\n\nGancho da aventura (contexto):\n"""\n${questContext}\n"""` : ''}`,
        providerOptions: EXTRACTION_PROVIDER_OPTIONS,
      })
      logExtractionEndpoint('extractOpeningEntities', extractionModel, providerMetadata)
      const seeded = object.entidades
        .filter((e) => e.nome?.trim())
        // A abertura É pública e já vivida: força os dois eixos, não deixa ao extrator.
        .map((e): WorldEntity => ({ ...e, sabido: 'publico', revelado: true, atualizadoEm: new Date().toISOString() }))
      return seeded.length > 0 ? seeded : null
    } catch (err) {
      logLlmFailure('semeadura de entidades da abertura', 'o ledger nasce vazio e o Mestre pode contradizer a abertura (US-75)', err)
      return null
    }
  }

  /**
   * US-158: veste de prosa os ~6 locais e gera os ~7 NPCs a partir do conteúdo bruto
   * já rolado (US-147), mintando `id` real no CÓDIGO (`loc-N`/`npc-N`) — nunca deixado
   * ao modelo (a US-149 só CONSOME esses `id`s, esta story é quem os cria). Uma
   * chamada combinada (não duas): deixa o modelo amarrar `occupants` de local a NPC no
   * mesmo contexto (Notas de implementação da US-158).
   *
   * Ao contrário de `extractOpeningEntities`/`extractOpeningScene` (que engolem falha
   * e devolvem `null`), esta chamada NUNCA captura erro: sem `locations`/`npcs` a
   * US-149 (segredos) e o gate da US-150 não têm entrada — a falha aqui é motivo de
   * reseed, não de degradar em silêncio (US-158, critério de aceite).
   */
  async generateLocationsAndNpcs(params: {
    rolled: RolledAdventureContent
    registry: AdventureRegistry
    background?: CharacterBackground
    origin?: { adventuresAndAdvancement?: string }
    locale?: Locale
  }): Promise<{ locations: AdventureLocation[]; npcs: AdventureNpc[] }> {
    // 2026-08-23: elenco original nascia surdo a `origin.adventuresAndAdvancement` — só as 3
    // chamadas seguintes do motor (generateSecrets/generateAntagonist/generateOpeningBeat,
    // US-180/US-183) recebiam esse vínculo. `characterAnchors` já combina story+adventures
    // (bonds/flaws seguem de fora, mesma disciplina de antes — ver `characterAnchors`).
    const anchors = characterAnchors(params)
    // US-174: rede de segurança quando `background`/`origin` vêm vazios deixou de citar o
    // gancho fixo por classe (`hookSeed`) — vira instrução genérica ancorada no que já foi
    // rolado para ESTA aventura, não no catálogo por classe (US-153).
    const storyInstruction = anchors.length > 0
      ? `Contexto da personagem — amarre AO MENOS UM NPC (por nome ou papel) a um destes: ${anchors.join('; ')}.`
      : 'Sem história registrada — amarre ao menos um NPC ao que já foi rolado para esta aventura (local ou NPC).'
    // US-178: `system` continua em português (instrução PARA o modelo) — só a SAÍDA segue
    // o locale do jogador, mesmo padrão de `buildDmSystemPrompt` (dm-system.ts:260).
    const targetLanguage = localeNameForPrompt(params.locale ?? DEFAULT_LOCALE)

    const { object, providerMetadata } = await generateObject({
      model: primaryModel,
      schema: LOCATIONS_AND_NPCS_SCHEMA,
      system:
        'Você é o Mestre de um RPG vestindo de prosa o conteúdo bruto rolado de uma aventura one-shot (método Lazy GM Resource Document). ' +
        'Para cada NPC, invente NOME e um ARQUÉTIPO DE FICÇÃO POPULAR a partir do comportamento/ancestralidade dados — nunca invente comportamento ou ancestralidade além do que foi rolado. ' +
        // US-187: setting/areaType entram ao lado do tone já citado — mesmo padrão dos
        // outros 4 consumidores de prosa (US-186).
        // 2026-08-23: sem isto o modelo às vezes não marca NENHUM local como vibe:'combat'
        // — o confronto final (sempre combat, US-166) cai no fallback de round-robin cego
        // em vez de um local pensado pra ele (buildEncounterDraft, adventure.service.ts).
        `Tom: ${params.registry.tone}. Cenário: ${params.registry.setting}. Tipo de área: ${params.registry.areaType}. ${storyInstruction} ` +
        `Ao menos UM local precisa ter vibe:'combat' — o confronto final desta aventura é sempre um combate e precisa de um local que sirva a ele. ` +
        `Responda SEMPRE em ${targetLanguage} — idioma da mesa, escolhido pelo jogador; nomes próprios seguem a regra de Onomástica abaixo, não o idioma-alvo.\n\n` +
        // US-179: boxedText é lido em voz alta (método LGMRD) — vale a MESMA barra
        // abaixo, não uma versão mais fraca por ser um trecho curto.
        `A prosa de local (boxedText/description) e o role do NPC seguem esta barra de qualidade:\n${CRAFT_CORE_SECTION}\n${NPC_VOICE_BULLET}\n\n${ONOMASTICS_SECTION}`,
      prompt: buildLocationsAndNpcsPrompt(params.rolled),
      providerOptions: ENGINE_PROVIDER_OPTIONS,
    })
    logExtractionEndpoint('generateLocationsAndNpcs', primaryModel, providerMetadata)

    const npcs: AdventureNpc[] = object.npcs.map((npc, i) => ({
      id: `npc-${i + 1}`,
      name: npc.name,
      role: npc.role,
      interactions: [],
    }))

    // 2026-08-19: índice fora de faixa (o modelo inventa uma posição que `npcs[]` não
    // tem) é descartado em silêncio, não vira `occupants` cru — ao contrário do antigo
    // match por nome, um índice inválido não tem "melhor esforço" possível: não há
    // string nenhuma pra preservar. Gate (US-150) segue sendo quem pega o local que
    // ficar sem NENHUM occupant válido.
    const locations: AdventureLocation[] = object.locations.map((loc, i) => ({
      id: `loc-${i + 1}`,
      title: loc.title,
      aspects: loc.aspects,
      boxedText: loc.boxedText,
      description: loc.description,
      occupants: loc.occupants.filter((idx) => idx < npcs.length).map((idx) => npcs[idx]!.id),
      vibe: loc.vibe,
    }))

    return { locations, npcs }
  }

  /**
   * US-149: escreve os ~11 segredos da aventura a partir dos 40 prompts-molde do LGMRD,
   * usando `locations`/`npcs` já decididos (US-158) como âncora referencial e
   * `background`/`origin` como âncora narrativa. Mesma disciplina de
   * `generateLocationsAndNpcs`: minta `id` (`secret-N`) no CÓDIGO, nunca no modelo, e
   * NUNCA captura erro — falha aqui é motivo de reseed da US-150, não degradação silenciosa.
   * `locations`/`npcs` obrigatórios (não opcionais) força a ordem: esta chamada não roda
   * sem eles. `hookSeed` (gancho fixo por classe) NÃO é insumo — nem no schema, nem no
   * `system`/`prompt` (US-174; depois de US-175, nenhuma chamada do motor recebe `hookSeed`).
   */
  async generateSecrets(params: {
    locations: AdventureLocation[]
    npcs: AdventureNpc[]
    secretPrompts: SecretPrompts
    registry: AdventureRegistry
    background?: CharacterBackground
    origin?: { adventuresAndAdvancement?: string }
    locale?: Locale
  }): Promise<AdventureSecret[]> {
    const anchors = characterAnchors(params)
    // US-174: rede de segurança quando `background`/`origin` vêm vazios deixou de citar
    // o gancho fixo por classe (`hookSeed`) — vira instrução genérica ancorada no que já
    // foi rolado para ESTA aventura, mesmo padrão de `generateLocationsAndNpcs`.
    const anchorInstruction = anchors.length > 0
      ? `Contexto da personagem — ancore ao menos um segredo a um destes: ${anchors.join('; ')}.`
      : 'Sem background/origin registrados — ancore os segredos ao que já foi rolado para esta aventura (registry/local/NPC).'
    // US-178: mesmo padrão de `generateLocationsAndNpcs` — só a SAÍDA segue o locale.
    const targetLanguage = localeNameForPrompt(params.locale ?? DEFAULT_LOCALE)

    const { object, providerMetadata } = await generateObject({
      model: primaryModel,
      schema: SECRETS_SCHEMA,
      system:
        'Você é o Mestre de um RPG escrevendo os SEGREDOS de uma aventura one-shot (método Lazy GM Resource Document), a partir de moldes de pergunta. ' +
        'Para cada segredo, responda a UMA das perguntas-molde dadas, ancorando o fato em um local ou NPC REAL da lista recebida — nunca invente local, NPC ou fato fora do que foi dado. ' +
        '`locationId` DEVE ser um dos ids de LOCAIS recebidos (nunca um id de NPC), o mais relevante ao segredo. ' +
        'Para segredo de NPC/vilão, use o "(local: ...)" indicado ao lado do NPC se houver; senão, escolha o local mais relevante da lista. ' +
        `Tom: ${params.registry.tone}. Cenário: ${params.registry.setting}. Tipo de área: ${params.registry.areaType}. ${anchorInstruction} ` +
        `Responda SEMPRE em ${targetLanguage} — idioma da mesa, escolhido pelo jogador; nomes próprios já estabelecidos (locais/NPCs recebidos) ficam como estão.\n\n${CRAFT_CORE_SECTION}`,
      prompt: buildSecretsPrompt(params.locations, params.npcs, params.secretPrompts),
      providerOptions: ENGINE_PROVIDER_OPTIONS,
    })
    logExtractionEndpoint('generateSecrets', primaryModel, providerMetadata)

    return object.secrets.map((secret, i) => ({
      id: `secret-${i + 1}`,
      locationId: secret.locationId,
      text: secret.text,
    }))
  }

  /**
   * US-181/US-190: sintetiza o ANTAGONISTA estruturado (`name`/`want`/`method`/`trait`/
   * `weakness`) a partir de `locations`/`npcs`/`secrets` já decididos (US-158/US-149) e a
   * `complicacao`/`premissa` roladas — chamada PRÓPRIA, sequencial, rodando depois de
   * `generateSecrets` e antes de `generateClosing`/`generateOpeningBeat` (US-190: não fica
   * mais implícito dentro do fecho, pra que outras chamadas também possam vê-lo cedo).
   * Reusa `buildClosingPrompt` — mesmo bloco de contexto (locais/NPCs/segredos/premissa/
   * complicação) que `generateClosing` já monta, nenhuma duplicação de prompt builder.
   *
   * US-183: ganha `background`/`origin` (mesma forma de `generateOpeningBeat`/`generateSecrets`)
   * e sintetiza `connection` — reusa `characterAnchors(params)`, mesmo padrão condicional do
   * `anchorInstruction` de `generateOpeningBeat`: com âncora, prefere ligar o antagonista a
   * ela; sem âncora, cai pra conexão genérica ancorada em locations/npcs/secrets.
   *
   * NUNCA captura erro — mesma disciplina de `generateSecrets`/`generateClosing`: falha
   * aqui é motivo de reseed na US-150, não degradação silenciosa.
   */
  async generateAntagonist(params: {
    locations: AdventureLocation[]
    npcs: AdventureNpc[]
    secrets: AdventureSecret[]
    registry: AdventureRegistry
    complicacao: { condition: string; description: string; origin: string }
    premissa: string
    background?: CharacterBackground
    origin?: { adventuresAndAdvancement?: string }
    locale?: Locale
    // US-188: `npcId` NÃO sai daqui — o modelo não decide `id` de NPC, quem mintou o
    // AdventureNpc (adventure.service.ts) fecha essa referência depois desta chamada.
  }): Promise<Omit<AdventureAntagonist, 'npcId'>> {
    const anchors = characterAnchors(params)
    const anchorInstruction = anchors.length > 0
      ? `Vínculo pessoal da personagem — prefira ligar a conexão do antagonista a um destes, quando fizer sentido com a premissa/complicação: ${anchors.join('; ')}.`
      : 'Sem vínculo pessoal registrado — descreva uma conexão mais genérica, ancorada no que já foi rolado para esta aventura (locations/npcs/secrets recebidos).'
    const targetLanguage = localeNameForPrompt(params.locale ?? DEFAULT_LOCALE)

    const { object, providerMetadata } = await generateObject({
      model: primaryModel,
      schema: ANTAGONIST_SCHEMA,
      system:
        'Você é o Mestre de um RPG decidindo o ANTAGONISTA de uma aventura one-shot (método Lazy GM Resource Document), ancorado nos locais/NPCs/segredos REAIS recebidos — nunca invente entidade nova fora da lista dada. ' +
        'Nomeie o antagonista e declare: `want` (o que busca — poder, vingança, recurso, ritual), `method` (o que faz pra conseguir — reunir exército, ritual em curso, espalhar boato), `trait` (maneirismo/marca reconhecível numa frase curta) e `weakness` (ponto cego ou vício explorável numa frase curta, não a derrota dele). ' +
        'Mesmo que a premissa não aponte vilão óbvio, infira uma oposição plausível — os quatro campos são sempre preenchidos. ' +
        `Declare também \`connection\` (1 frase curta): como o antagonista se relaciona com o personagem — nunca vazio. ${anchorInstruction} ` +
        `Tom: ${params.registry.tone}. Cenário: ${params.registry.setting}. Tipo de área: ${params.registry.areaType}. ` +
        `Responda SEMPRE em ${targetLanguage} — idioma da mesa, escolhido pelo jogador; nomes próprios já estabelecidos (locais/NPCs recebidos) ficam como estão.\n\n${CRAFT_CORE_SECTION}`,
      prompt: buildClosingPrompt(params),
      providerOptions: ENGINE_PROVIDER_OPTIONS,
    })
    logExtractionEndpoint('generateAntagonist', primaryModel, providerMetadata)

    return object
  }

  /**
   * US-164, passo 6: escreve o FECHO RAMIFICADO — `conclusion` (prosa) e `followUps[]`
   * (sementes pra próxima aventura, US-151) — a partir de `locations`/`npcs`/`secrets` já
   * decididos (US-158/US-149) e a `complicacao`/`premissa` roladas (US-147). `registry`
   * entra no system prompt, mesma disciplina de `generateSecrets`/`generateLocationsAndNpcs`
   * — sem ele o fecho pode destoar do tom fixado. `hookSeed` (gancho fixo por classe) NÃO é
   * insumo — nem no schema, nem no `system`/`prompt` de `buildClosingPrompt` (US-175: era o
   * último insumo do motor ainda ancorado no catálogo fixo por classe, `premissa` já
   * cumpria a mesma função de cor narrativa). US-181/US-190: antagonista deixou de ser
   * cor narrativa emergente da premissa — chega aqui já decidido (`generateAntagonist`),
   * a CONCLUSÃO ancora nele em vez de inventar prosa solta. Ainda não é entidade rastreável
   * (US-164, Questão em aberto #2 — isso é US-188). NUNCA captura erro — mesma disciplina
   * de `generateSecrets`: falha aqui é motivo de reseed na US-150, não degradação silenciosa.
   *
   * US-166: ganha `encounterSkeleton` (8 encontros já resolvidos: locationId/npcIds →
   * location/npcs reais) e devolve `encounterSituations` — as 3 perguntas restantes de cada
   * SITUAÇÃO (Sly Flourish: behaviors/goal/complications), posicional. Roda na MESMA chamada
   * que já escreve `conclusion`/`followUps` — nenhum round-trip a mais.
   */
  async generateClosing(params: {
    locations: AdventureLocation[]
    npcs: AdventureNpc[]
    secrets: AdventureSecret[]
    registry: AdventureRegistry
    complicacao: { condition: string; description: string; origin: string }
    premissa: string
    antagonist: AdventureAntagonist
    encounterSkeleton: EncounterSkeletonEntry[]
    background?: CharacterBackground
    origin?: { adventuresAndAdvancement?: string }
    locale?: Locale
  }): Promise<{ objective: string; conclusion: string; followUps: string[]; encounterSituations: Array<{ behaviors: string; goal: string; complications: string }> }> {
    // 2026-08-23: única das 5 chamadas do motor que nunca ancorava em background/origin —
    // locations/npcs/secrets/antagonist/openingBeat já usam `characterAnchors` (US-149/US-180/
    // US-183); o fecho escrevia objective/conclusion cego ao vínculo pessoal da personagem.
    const anchors = characterAnchors(params)
    const anchorInstruction = anchors.length > 0
      ? `Vínculo pessoal da personagem — ancore objective/conclusion nisto quando fizer sentido com a premissa/complicação: ${anchors.join('; ')}.`
      : 'Sem vínculo pessoal registrado — resolva a premissa/complicação genericamente, ancorada no que já foi rolado para esta aventura (locations/npcs/secrets recebidos).'
    // US-178: mesmo padrão de `generateLocationsAndNpcs` — só a SAÍDA segue o locale.
    const targetLanguage = localeNameForPrompt(params.locale ?? DEFAULT_LOCALE)

    const { object, providerMetadata } = await generateObject({
      model: primaryModel,
      schema: CLOSING_SCHEMA,
      system:
        'Você é o Mestre de um RPG escrevendo o FECHO RAMIFICADO de uma aventura one-shot (método Lazy GM Resource Document). ' +
        // US-169: `objective` nasce ANTES da conclusão no raciocínio do modelo — é o alvo que
        // o Mestre reconhece cumprido turno a turno; a conclusão é só o texto de fecho. Exige
        // nome concreto (NPC/vilão/facção) e want/method do antagonista — nunca reduz o
        // antagonista só ao nome (ex.: "Impedir Malvora" sozinho é ruim; "Impedir que Malvora
        // drene a vila pra alimentar seu ritual" é o padrão esperado).
        'Antes disso, escreva `objective`: o alvo concreto e verificável desta aventura, citando NOMES reais dos locais/NPCs/segredos recebidos e SEMPRE o `want`/`method` do antagonista abaixo — nunca reduza o antagonista só ao nome, e nunca escreva uma paráfrase vaga do resumo da aventura. ' +
        'Escreva a CONCLUSÃO (2-3 parágrafos) resolvendo a premissa e a complicação, ancorada nos locais/NPCs/segredos REAIS recebidos — nunca invente entidade nova. ' +
        'O antagonista já está decidido (nome/want/method abaixo) — a conclusão resolve o confronto com ELE, sem inventar outro nem contradizer o que já foi definido. ' +
        `${anchorInstruction} ` +
        `Tom: ${params.registry.tone}. Cenário: ${params.registry.setting}. Tipo de área: ${params.registry.areaType}. ` +
        'Depois escreva 2-3 followUps: ganchos com história suficiente para virar a PRÓXIMA aventura. ' +
        'Depois, para CADA um dos 8 encontros listados abaixo (na MESMA ordem), escreva `behaviors`/`goal`/`complications` — as 3 perguntas restantes de uma SITUAÇÃO (framework Sly Flourish): `behaviors` é o que os moradores estão fazendo agora; `goal` é por que o personagem foi até lá; `complications` é o que pode virar o jogo de cabeça pra baixo. ' +
        'Use o `type` de cada encontro pra guiar o tom: `skill` → obstáculo físico/ambiental; `social` → negociação ou tensão social; `combat` → ameaça e cerco — sem travar qual perícia é testada, isso continua emergente no turno. ' +
        'O ÚLTIMO encontro da lista é o confronto final — `behaviors`/`goal`/`complications` DEVEM ecoar diretamente o `want`/`method` do antagonista, sem ambiguidade; os outros 7 só PODEM tocar nele, nunca são obrigados. ' +
        `Responda SEMPRE em ${targetLanguage} — idioma da mesa, escolhido pelo jogador; nomes próprios já estabelecidos ficam como estão.\n\n${CRAFT_CORE_SECTION}`,
      prompt: buildClosingPrompt(params),
      providerOptions: ENGINE_PROVIDER_OPTIONS,
    })
    logExtractionEndpoint('generateClosing', primaryModel, providerMetadata)

    return { objective: object.objective, conclusion: object.conclusion, followUps: object.followUps, encounterSituations: object.encounterSituations }
  }

  /**
   * US-172: escreve a ABERTURA (`start`) da aventura a partir de `registry`/`premissa`/
   * `locations`/`npcs`/`secrets` já decididos — `hookSeed` NÃO é parâmetro desta chamada
   * (mesma disciplina que US-175 estendeu a `generateClosing`): copiar `hookSeed` verbatim
   * (US-164) deixava `start` sem ver o `tone` sorteado desta aventura. Instrui abertura
   * *in medias res* (LGMRD "strong start") ancorada numa das `locations` recebidas,
   * podendo insinuar (não revelar) um
   * `secret` — sem isso `start` fica coerente em tom mas solto do resto do artefato.
   * NUNCA captura erro — mesma disciplina de `generateClosing`: falha aqui é motivo de
   * reseed na US-150, não degradação silenciosa.
   *
   * US-180: ganha `background`/`origin` (mesmos tipos de `generateSecrets`) pra ancorar a
   * cena num vínculo pessoal da personagem quando existir (`characterAnchors`, molde de
   * `generateSecrets`) — sem isso a abertura podia ancorar em local/NPC sem relação
   * nenhuma com quem joga. Ganha também `complicacao` (mesmo tipo de `generateClosing`):
   * o fallback único "sem conflito óbvio, abra com confronto" (herdado literal do LGMRD)
   * vira dois estilos nomeados, Enraizada e Confronto — o artigo que motivou esta story
   * argumenta contra empurrar todo grupo pra um confronto fixo quando nada se destaca.
   *
   * US-182: *in medias res* garante urgência, não apelo — soma instrução exigindo mirar
   * pelo menos 2 dos 3 apelos clássicos (recompensa/heroísmo/descoberta), sempre ancorados
   * no que já foi gerado, nunca elemento novo — eixo ortogonal a tom/ancoragem/vínculo/estilo.
   *
   * US-190: ganha `antagonist` (já decidido por `generateAntagonist`, que roda antes desta
   * chamada) — primeira vez que a abertura pode ecoar o vilão real, não só no fecho.
   *
   * US-191: reverte a proibição de nomear que a US-190 registrou aqui (Questão em aberto #2
   * daquela story) — o produto passou a querer o vilão reconhecível por nome desde a
   * abertura. `weakness` continua fora do prompt, mesma disciplina "não vaza antes de
   * merecer" que já protege `conclusion`/segredos (US-153 #4).
   */
  async generateOpeningBeat(params: {
    locations: AdventureLocation[]
    npcs: AdventureNpc[]
    secrets: AdventureSecret[]
    registry: AdventureRegistry
    background?: CharacterBackground
    origin?: { adventuresAndAdvancement?: string }
    complicacao: { condition: string; description: string; origin: string }
    premissa: string
    antagonist: AdventureAntagonist
    locale?: Locale
  }): Promise<{ start: string }> {
    const anchors = characterAnchors(params)
    const anchorInstruction = anchors.length > 0
      ? `Vínculo pessoal da personagem — prefira ancorar a cena no local/NPC mais alinhado a um destes: ${anchors.join('; ')}.`
      : 'Sem vínculo pessoal registrado — ancore a cena ao que já foi rolado para esta aventura (locations/npcs/secrets recebidos).'
    // US-178: mesmo padrão de `generateLocationsAndNpcs` — só a SAÍDA segue o locale.
    const targetLanguage = localeNameForPrompt(params.locale ?? DEFAULT_LOCALE)

    const { object, providerMetadata } = await generateObject({
      model: primaryModel,
      schema: OPENING_BEAT_SCHEMA,
      system:
        'Você é o Mestre de um RPG escrevendo a ABERTURA (start) de uma aventura one-shot (método Lazy GM Resource Document). ' +
        'Escreva 1-2 parágrafos que joguem a cena já EM AÇÃO (in medias res) — nunca descrição estática de cenário parado. ' +
        'Ancore a cena numa das locations recebidas (cite ou situe o local) e, se fizer sentido, insinue (sem revelar) um dos secrets. ' +
        `${anchorInstruction} ` +
        'Escolha o ESTILO da abertura pelo que premissa/complicação sugerir, sem viés padrão para violência: ' +
        'ENRAIZADA (preferida quando nada aponta violência) — chegada a um local vivo ou encontro com um NPC, de preferência o ligado ao vínculo pessoal acima, com a complicação já pairando como tensão perceptível, sem exigir luta. ' +
        'CONFRONTO (quando premissa/complicação/secrets tornarem a violência a leitura mais natural — perseguição, ataque em curso, monstro solto) — ameaça ou luta já em ação. ' +
        'A cena também precisa mirar pelo menos 2 dos 3 apelos a seguir, usando só o que já foi gerado (locations/npcs/secrets recebidos), nunca elemento novo: ' +
        'RECOMPENSA — algo a ganhar (riqueza, poder, um item, um favor). ' +
        'HEROÍSMO — a chance de agir bem (proteger alguém, corrigir um erro, impedir um dano). ' +
        'DESCOBERTA — um segredo ou mistério que a cena já insinua, sem revelar. ' +
        'O antagonista já está decidido (nome/method/trait abaixo) — pode nomeá-lo e deixar sinal de sua presença/método na cena, mas NUNCA revele sua weakness, mesma disciplina que protege os segredos. ' +
        `Tom: ${params.registry.tone}. Cenário: ${params.registry.setting}. Tipo de área: ${params.registry.areaType}. ` +
        `Responda SEMPRE em ${targetLanguage} — idioma da mesa, escolhido pelo jogador; nomes próprios já estabelecidos ficam como estão.\n\n${CRAFT_CORE_SECTION}`,
      prompt: buildOpeningBeatPrompt(params),
      providerOptions: ENGINE_PROVIDER_OPTIONS,
    })
    logExtractionEndpoint('generateOpeningBeat', primaryModel, providerMetadata)

    return { start: object.start }
  }

  /**
   * US-191, Parte 2: reescreve `boxedText`/`description` do local do CONFRONTO FINAL
   * citando o antagonista pelo nome. `generateLocationsAndNpcs` (passo 2) roda ANTES do
   * antagonista existir e não pode nomeá-lo — esta chamada roda depois, em paralelo a
   * `generateClosing`/`generateOpeningBeat` (mesmo `Promise.all`), e só troca esses dois
   * campos desse local; `title`/`aspects`/`occupants` ficam como `generateLocationsAndNpcs`
   * já decidiu.
   *
   * `antagonist` é `Pick<'name' | 'method' | 'trait'>`, não `AdventureAntagonist` inteiro —
   * `weakness`/`connection` nem existem no parâmetro, o compilador recusa se este prompt
   * tentar lê-los. Função NOVA, não herda a proteção de `buildOpeningBeatPrompt` automaticamente.
   *
   * NUNCA captura erro — mesma disciplina de `generateClosing`/`generateOpeningBeat`: falha
   * aqui é motivo de reseed na US-150, não degradação silenciosa.
   */
  async generateAntagonistLocationProse(params: {
    location: AdventureLocation
    antagonist: Pick<AdventureAntagonist, 'name' | 'method' | 'trait'>
    registry: AdventureRegistry
    locale?: Locale
  }): Promise<{ boxedText: string; description: string }> {
    const targetLanguage = localeNameForPrompt(params.locale ?? DEFAULT_LOCALE)

    const { object, providerMetadata } = await generateObject({
      model: primaryModel,
      schema: ANTAGONIST_LOCATION_PROSE_SCHEMA,
      system:
        'Você é o Mestre de um RPG reescrevendo boxedText/description do local do CONFRONTO FINAL de uma aventura one-shot (método Lazy GM Resource Document), agora que o antagonista já está decidido. ' +
        'Reescreva os dois campos citando o antagonista PELO NOME em pelo menos um deles — nunca revele a weakness dele. ' +
        'Mantenha o mesmo local e tema (o título e os aspectos do local não mudam, só a prosa). ' +
        `Tom: ${params.registry.tone}. Cenário: ${params.registry.setting}. Tipo de área: ${params.registry.areaType}. ` +
        `Responda SEMPRE em ${targetLanguage} — idioma da mesa, escolhido pelo jogador; nomes próprios já estabelecidos ficam como estão.\n\n${CRAFT_CORE_SECTION}`,
      prompt: [
        `Local: ${params.location.title} (aspectos: ${params.location.aspects.join(', ')})`,
        `boxedText atual: ${params.location.boxedText}`,
        `description atual: ${params.location.description}`,
        '',
        `Antagonista já decidido — nome: ${params.antagonist.name}; método: ${params.antagonist.method}; traço: ${params.antagonist.trait}.`,
      ].join('\n'),
      providerOptions: ENGINE_PROVIDER_OPTIONS,
    })
    logExtractionEndpoint('generateAntagonistLocationProse', primaryModel, providerMetadata)

    return { boxedText: object.boxedText, description: object.description }
  }

  /**
   * US-73: reconciliador de cena em background. Chamado no `onFinish` SÓ quando o
   * modelo NÃO chamou `updateScene` no turno — a rede de segurança contra o
   * `sceneState` apodrecer em turnos de viagem→chegada (o modelo narra o deslocamento
   * mas esquece de registrar; o snapshot congela e o sinal de continuidade da US-71
   * passa a apontar para trás, alimentando o replay — `erro narração 2`).
   *
   * Reusa a extração estruturada da US-35 (`OPENING_SCENE_SCHEMA` + `extractionModel`, US-114),
   * mas FUNDE com a cena corrente: dá a cena atual como base e pede o estado no FIM da
   * narração; campos escalares vazios NÃO sobrescrevem (turno só-diálogo não zera o
   * `local`). Persiste só a coluna `sceneState` — NÃO loga `CHARACTER_UPDATE` (mesmo
   * motivo do `recordEntity`: um evento marcaria o turno como mutação e o guard da
   * US-67 desativaria a edição de turnos de conversa). Fire-and-forget: nunca lança —
   * o turno já foi entregue ao jogador.
   */
  // `turnId` (US-117/ADR 011) consumido no `scene_reconciled` abaixo (US-119).
  private async reconcileScene(adventureId: string, characterId: string, narration: string, playerName: string, turnId?: string): Promise<void> {
    const text = narration.trim()
    if (text.length === 0) return
    try {
      const state = await this.prisma.characterState.findUnique({
        where: { characterId_adventureId: { characterId, adventureId } },
        select: { sceneState: true },
      })
      const current = (state?.sceneState ?? null) as SceneState | null
      const baseText = (current && formatSceneState(current)) || '(nenhuma cena registrada ainda)'
      const { object, providerMetadata } = await generateObject({
        model: extractionModel,
        schema: OPENING_SCENE_SCHEMA,
        system:
          'Você reconcilia o estado ESTRUTURADO da cena de um RPG com a narração mais recente. Dada a CENA ATUAL e a NARRAÇÃO, produza o estado da cena como está no FIM da narração. Use APENAS o que a narração e a cena atual revelam — não invente. Se a personagem SE MOVEU para um lugar novo na narração, `local` é o lugar NOVO (fim do trajeto), não o de partida. `presentes`: só NPCs/personagens presentes no FIM (inclua quem apareceu, remova quem saiu; NUNCA a própria personagem-jogadora). `objetos_em_cena`: elementos notáveis do ambiente no fim (incl. atmosféricos), NUNCA itens carregados. Se a narração NÃO muda um campo, repita o valor da cena atual. Deixe um campo vazio só se nem a cena atual nem a narração o revelarem.',
        prompt: `CENA ATUAL:\n"""\n${baseText}\n"""\n\nNARRAÇÃO MAIS RECENTE:\n"""\n${text}\n"""`,
        providerOptions: EXTRACTION_PROVIDER_OPTIONS,
      })
      logExtractionEndpoint('reconcileScene', extractionModel, providerMetadata)
      const next = mergeSceneState(current, scenePatchFromExtraction(object, playerName))

      await this.prisma.characterState.update({
        where: { characterId_adventureId: { characterId, adventureId } },
        data: { sceneState: next as unknown as object },
      })
      await this.reconcileEncounterLedger(adventureId, current?.presentes, next.presentes)
      console.log(
        JSON.stringify({ event: 'scene_reconciled', turnId, timestamp: new Date().toISOString(), local: next.local, presentes: next.presentes }),
      )
    } catch (err) {
      logLlmFailure('reconcileScene', 'a cena não sincroniza com a narração deste turno', err, turnId)
    }
  }

  /**
   * US-171 (segunda metade): reconcilia o ledger de combatentes de encontro junto do
   * `sceneState` — resolve o risco de "ressurreição" (combatente derrotado
   * narrativamente continuava listado como ameaça ativa pra sempre). Compara
   * `presentes` ANTES/DEPOIS desta passagem e, pra todo `WorldEntity` de combatente
   * (`nota` ∈ papel de `MONSTER_ROLE_CR`) que SAIU de `presentes` NESTA transição,
   * marca `estado: 'fora de cena'` — neutro de propósito (não afirma derrota, fuga
   * nem negociação, só que não está mais na cena; sem statblock/HP pra saber o
   * desfecho, ver US-171 Fora do escopo).
   *
   * Só toca na TRANSIÇÃO: um combatente que já saiu num turno anterior não está mais
   * em `presentesBefore` (o `sceneState` daquele turno já não o listava), então não é
   * tocado de novo — não sobrescreve um `estado` mais específico que o Mestre tenha
   * registrado depois via `recordEntity`. Combatente nunca engajado (nunca esteve em
   * `presentes`) também fica intocado, pelo mesmo motivo.
   */
  private async reconcileEncounterLedger(
    adventureId: string,
    presentesBefore: string[] | null | undefined,
    presentesAfter: string[] | null | undefined,
  ): Promise<void> {
    const before = presentesBefore ?? []
    if (before.length === 0) return
    const afterNorm = new Set((presentesAfter ?? []).map(norm))
    const departedNorm = new Set(before.filter((name) => !afterNorm.has(norm(name))).map(norm))
    if (departedNorm.size === 0) return

    const fresh = await this.prisma.adventure.findUnique({
      where: { id: adventureId },
      select: { entities: true },
    })
    const current = (fresh?.entities ?? null) as WorldEntity[] | null
    if (!current) return

    const roles = new Set(Object.keys(MONSTER_ROLE_CR))
    const patches: EntityPatch[] = current
      .filter((e) => e.nota !== undefined && roles.has(e.nota) && departedNorm.has(norm(e.nome)))
      .map((e) => ({ nome: e.nome, tipo: 'npc', estado: 'fora de cena' }))
    if (patches.length === 0) return

    const next = mergeEntities(current, patches)
    await this.prisma.adventure.update({
      where: { id: adventureId },
      data: { entities: next as unknown as object },
    })
  }

  /**
   * US-36 — avaliação de qualidade AO VIVO em dev (async, por turno). Pontua a
   * narração REAL do turno com o MESMO juiz + rubrica dos eval cases, para ver a
   * qualidade cair na hora, sem esperar o CI nem montar um caso.
   *
   * - Só roda atrás de `DM_LIVE_EVAL` (a API não auto-carrega `.env`; a flag vem
   *   do `.env` da raiz / env do Windows). Em produção NÃO roda — nem carrega o juiz.
   * - Observabilidade, não portão: nota baixa AVISA, não altera nem re-gera nada.
   * - Falha isolada: erro/timeout/quota do juiz NUNCA derruba o turno — engole a
   *   exceção e loga um aviso. O turno já foi entregue; o juiz é opcional.
   * - Reuso total: `judgeModel()` + `judgeTurn` sem exemplar (turno real não tem
   *   âncora) — zero lógica de pontuação nova.
   */
  private async liveEvalTurn(playerAction: string, narration: string, turnId?: string): Promise<void> {
    if (!process.env.DM_LIVE_EVAL) return
    try {
      const { score } = await judgeTurn({
        judge: judgeModel(),
        scenarioContext: 'Avaliação ao vivo de um turno real de jogo (dev).',
        playerAction,
        narration,
      })
      console.log(
        `[AiService][live-eval] MÉDIA ${meanOfScore(score).toFixed(2)}/5\n${formatScoreLines(score)}`,
      )
    } catch (err) {
      // Fire-and-forget: o turno já foi entregue. O juiz é opcional.
      console.log(
        JSON.stringify({ event: 'live_eval_judge_failed', turnId, timestamp: new Date().toISOString(), error: (err as Error).message }),
      )
    }
  }

  /**
   * Memória de longo prazo: quando os turnos não-resumidos ultrapassam o limite,
   * funde os mais antigos no resumo acumulado da aventura (Adventure.memorySummary)
   * e os marca como `summarized`, mantendo apenas a janela recente verbatim.
   *
   * Roda no onFinish, de forma assíncrona, e nunca deve derrubar o turno — uma
   * falha aqui apenas adia a sumarização para o próximo turno.
   */
  private async summarizeOldTurns(adventureId: string, characterId: string): Promise<void> {
    try {
      const unsummarized = await this.prisma.eventLog.findMany({
        where: { adventureId, characterId, type: { in: ['ACTION', 'NARRATION'] }, summarized: false },
        orderBy: { createdAt: 'asc' },
      })

      if (unsummarized.length <= SUMMARIZE_THRESHOLD) return

      // Mantém os KEEP_RECENT eventos mais recentes verbatim; o excedente vira resumo.
      const overflow = unsummarized.slice(0, unsummarized.length - KEEP_RECENT)

      const turns: SummaryTurn[] = overflow
        .map((log) => ({
          role: log.type === 'NARRATION' ? ('assistant' as const) : ('user' as const),
          content: (log.payload as { text?: string }).text ?? '',
        }))
        .filter((t) => t.content.trim().length > 0)

      if (turns.length === 0) return

      const [adventure, state] = await Promise.all([
        this.prisma.adventure.findUnique({
          where: { id: adventureId },
          select: { memorySummary: true },
        }),
        this.prisma.characterState.findUnique({
          where: { characterId_adventureId: { characterId, adventureId } },
          select: { sceneState: true },
        }),
      ])

      const sceneLine = formatSceneState((state?.sceneState ?? null) as SceneState | null)

      const { text: updatedSummary } = await generateText({
        model: summaryModel,
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: buildSummaryInput(adventure?.memorySummary, turns, sceneLine),
        providerOptions: NARRATION_PROVIDER_OPTIONS,
      })

      if (updatedSummary.trim().length === 0) return

      // Atualiza o resumo e marca os turnos incorporados, atomicamente.
      await this.prisma.$transaction([
        this.prisma.adventure.update({
          where: { id: adventureId },
          data: { memorySummary: updatedSummary.trim() },
        }),
        this.prisma.eventLog.updateMany({
          where: { id: { in: overflow.map((e) => e.id) } },
          data: { summarized: true },
        }),
      ])
    } catch (err) {
      // Não propaga: a narração já foi entregue ao jogador.
      logLlmFailure('sumarização da memória da sessão', 'o resumo não avança e os turnos seguem por incorporar', err)
    }
  }
}
