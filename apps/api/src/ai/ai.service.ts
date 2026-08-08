import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { EventLog } from '../generated/prisma/client'
import { streamText, generateText, generateObject, tool, type CoreMessage } from 'ai'
import { logLlmFailure } from './llm-error'
import type { InventoryItem, SceneState, SystemConfig, WorldEntity } from '@ai-dm/shared'
import { buildSkillSheet, catalogLabel, resolveSheetEntries, stripFabricatedRolls, stripReasoningLeak, stripWorldStateTags, resolveRollModifier, normalizeDie, hasOptionsList, resolveLocale, type Locale } from '@ai-dm/shared'
import { z } from 'zod'
import {
  narrationModels,
  NARRATION_PROVIDER_OPTIONS,
  EXTRACTION_PROVIDER_OPTIONS,
  formatProvenance,
  summaryModel,
  buildDmSystemPrompt,
  buildTurnStateBlock,
  buildOpeningInstruction,
  resolveKnownSpell,
  buildSummaryInput,
  mergeSceneState,
  formatSceneState,
  mergeEntities,
  judgeModel,
  judgeTurn,
  meanOfScore,
  formatScoreLines,
  detectSlopName,
  SUMMARY_SYSTEM_PROMPT,
  ENTITIES_BLOCK,
  type ScenePatch,
  type DmCharacterSheet,
  type CharacterBackground,
  type ClassFeature,
  type KnownSpell,
  type SummaryTurn,
} from '@ai-dm/ai-engine'
import { DiceService } from '../game/dice.service'
import { PrismaService } from '../prisma.service'
import { configForLocale } from '../system/system-locale'

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
const OPENING_SCENE_SCHEMA = z.object({
  local: z.string().describe('Lugar em linguagem natural, específico, e.g. "sacristia da igreja de Pedra do Norte"'),
  ambiente: z.enum(['externo', 'interno']).describe('externo = aberto/ao relento, interno = coberto/fechado. Deduzir de abrigo, não do clima'),
  periodo: z.string().describe('Período do dia em linguagem natural, e.g. manhã/tarde/entardecer/anoitecer/noite'),
  presentes: z.array(z.string()).describe('Só NPCs/personagens na cena, e.g. ["padre Mateus"]. NUNCA a própria personagem-jogadora'),
  objetos_em_cena: z.array(z.string()).describe('Objetos e elementos notáveis do ambiente, incl. atmosféricos. NUNCA itens carregados no inventário'),
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

// Raciocínio baixo de propósito: o fecho é uma tarefa curta e o que importa aqui é
// LATÊNCIA (estamos dentro do orçamento de 60s do turno). `exclude` mantém o raciocínio
// fora da prosa (mesma razão do NARRATION_PROVIDER_OPTIONS).
const SALVAGE_PROVIDER_OPTIONS = { openrouter: { reasoning: { effort: 'low', exclude: true } } } as const

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
 * US-103: proveniência das três extrações estruturadas, no mesmo formato da linha do
 * turno. As três usam `summaryModel` e o MESMO pin de rota da narração — a ADR 008 §3
 * afirma que caem no mesmo endpoint dela, e esta linha é o que permite conferir por
 * observação. Endpoint diferente do turno = a §3 está errada.
 */
function logExtractionEndpoint(label: string, providerMetadata: unknown): void {
  console.log(`[AiService][${label}] model=${summaryModel.modelId ?? 'unknown'} ${formatProvenance(providerMetadata)}`)
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
    const primary = quests.find((q) => q.isPrimary)
    const mainQuest = primary ? `${primary.title}\n${primary.description}` : null
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
    // US-100: a ficha guarda CHAVES de feature/magia; o catálogo do locale devolve o texto.
    // Resolvido UMA vez por turno e compartilhado com a tool `getSpell` abaixo — é o que
    // mantém a busca por nome na MESMA língua da lista que o prompt mostrou.
    const features = resolveSheetEntries(config?.classFeatures, config?.retiredFeatures, character.class, (character.features ?? []) as string[])
    const knownSpells = resolveSheetEntries(config?.classSpells, config?.retiredSpells, character.class, (character.spells ?? []) as string[])
    const sheet = {
      level: character.level,
      hp: characterState?.hp ?? 0,
      maxHp: characterState?.maxHp ?? 0,
      attributes,
      conditions: (characterState?.conditions ?? []) as string[],
      skills,
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
      // US-97: camada 1 do prompt (estável por usuário) — trocar de idioma invalida o
      // cache do prefixo uma vez, e é evento raro (ADR 007).
      locale,
    })

    // US-56: bloco de estado volátil do turno, prefixado à AÇÃO CRUA do jogador. A ação
    // crua (`message`) permanece separada — é ela, não o conteúdo prefixado, que o
    // `onFinish` persiste no EventLog (fronteira de persistência: mantém o history e o
    // resumo limpos e o próprio prefixo do history estável turno a turno).
    const turnState = buildTurnStateBlock({
      sheet,
      sceneState: (characterState?.sceneState ?? null) as SceneState | null,
      entities: (adventure.entities ?? null) as WorldEntity[] | null,
      mainQuest,
      activeQuests: activeQuests.map((q) => q.title),
      inventory: inventory.map((i) => (i.qty > 1 ? `${i.name} (${i.qty})` : i.name)),
      memorySummary: adventure.memorySummary,
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
            console.warn(`[AiService] rollDice: teste repetido no mesmo turno (skill=${skill} ability=${ability}) — reusando o 1º (um teste por ação)`)
            return rolls.first
          }

          // US-38: o modificador vem SEMPRE da ficha, nunca do modelo. Casa por
          // key OU rótulo (o modelo vê perícias por rótulo no prompt). `label` =
          // rótulo canônico da perícia/atributo, exibido no bloco.
          const { modifier, unresolved, label: skillLabel } = resolveRollModifier({ skill, ability, skills: resolvedSkills, attributes, attributeLabels })
          if (unresolved) {
            console.warn(`[AiService] rollDice sem perícia/atributo resolvível (skill=${skill} ability=${ability}) → +0. reason="${reason}"`)
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
          const inv = new Map<string, number>(current.map(i => [i.name, i.qty]))

          for (const { name, delta } of changes) {
            const next = (inv.get(name) ?? 0) + delta
            if (next <= 0) inv.delete(name)
            else inv.set(name, next)
          }

          const total = Array.from(inv.values()).reduce((a, b) => a + b, 0)
          if (total > 9999) {
            return { error: 'Inventário cheio: limite de 9999 itens atingido. O item não foi adicionado.' }
          }

          const inventory: InventoryItem[] = Array.from(inv.entries()).map(([name, qty]) => ({ name, qty }))

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
          `Record or update a DURABLE campaign entity (a named NPC, a place, a notable object, a faction) so it is never forgotten. Call this the moment you INTRODUCE such an entity, and again (with only the changed fields) whenever it moves or its state changes (an NPC wakes/dies/becomes an ally, a place is discovered/destroyed). Pass \`nome\` plus whatever is known: \`tipo\` (npc/local/objeto/faccao/outro), \`local\` (where it is now), \`estado\` (its current condition/relationship), \`nota\` (a short durable fact). Matching is by \`nome\` (accent/case tolerant); omitted fields keep their previous value. This ledger is re-shown to you in full every turn under "${ENTITIES_BLOCK}" — it is your permanent memory, unlike the scene (only the present) and the summary (lossy prose). Two independent knowledge axes (US-75): \`sabido\` = who in the WORLD may know this; \`revelado\` = whether the PLAYER has discovered it. Promote by re-recording: set \`revelado: true\` the moment the fiction reveals a hidden truth to the player, set \`sabido: "publico"\` when a private fact spreads through the world.`,
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
              }),
            )
            .describe('One or more entities to insert or update this turn.'),
        }),
        execute: async ({ entidades }: { entidades: Omit<WorldEntity, 'atualizadoEm'>[] }) => {
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
          `[AiService] onFinish finishReason=${finishReason} model=${model.modelId ?? 'unknown'}` +
            ` ${formatProvenance(providerMetadata)} tokens=${JSON.stringify(usage)} steps=${steps.length}`,
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
          console.warn(
            `[AiService] saneador removeu raciocínio vazado da narração (${leaked.length} trecho(s)):`,
            leaked.map((l) => l.slice(0, 120)),
          )
        }
        // US-29: rede de segurança — remove da narração qualquer resultado de
        // rolagem inventado pelo modelo ANTES de persistir. O número real vive
        // só no bloco de rolagem (evento DICE_ROLL), nunca na prosa. Assim o
        // histórico e o resumo (US-18) nunca realimentam a alucinação.
        const { clean: withoutRolls, removed } = stripFabricatedRolls(withoutReasoning)
        if (removed.length > 0) {
          console.warn(`[AiService] saneador removeu ${removed.length} rolagem(ns) fictícia(s) da narração:`, removed)
        }
        // Rede de segurança — remove tags de control-plane (`[WORLD_STATE_UPDATE:...]`)
        // que o modelo tenha cravado na prosa apesar do prompt. É sink legado que
        // nada lê; mudança de estado é só via tool. Sem isto o tag entra no
        // histórico/resumo e realimenta o vazamento nos próximos turnos.
        const { clean: finalText, removed: stateTags } = stripWorldStateTags(withoutRolls)
        if (stateTags.length > 0) {
          console.warn(`[AiService] saneador removeu ${stateTags.length} tag(s) de estado vazada(s) da narração:`, stateTags)
        }
        // US-69: turno cortado pelo guard anti-degeneração (loop de repetição
        // detectado mid-stream). O jogador já teve o parcial descartado no cliente e
        // o turno vai ser reescrito — NÃO persistir o lixo nem sumarizar em cima dele.
        // (Sai depois dos saneadores/log só para o diagnóstico continuar visível.)
        if (turnGuard.degenerated) {
          console.warn('[AiService] turno degenerado descartado pelo guard (US-69) — não persistido')
          return
        }
        // US-74: turno truncado — narração sem a lista de opções obrigatória (o modelo
        // parou num cliffhanger, `finishReason=stop`). Autoridade de PERSISTÊNCIA: não
        // grava o beco-sem-saída nem sumariza em cima dele. O controller detecta o mesmo
        // (predicado puro idêntico) e re-amostra. Só quando HÁ prosa — um turno vazio já
        // cai no guard `finalText.length > 0` abaixo (fallback/erro antes de emitir texto).
        if (turnGuard.incomplete || (finalText.length > 0 && !hasOptionsList(finalText))) {
          console.warn('[AiService] turno truncado sem lista de opções (US-74) — não persistido; controller re-amostra')
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
          if (slop.slop) console.warn(`[AiService][slop] nome clichê na narração: "${slop.match}" (observabilidade; não regenera)`)
          // US-36: avaliação de qualidade AO VIVO em dev (async, fire-and-forget).
          // NÃO dar await — o jogador já recebeu o stream; a nota chega ao log
          // depois. Só roda atrás de DM_LIVE_EVAL (nunca em produção).
          void this.liveEvalTurn(message, finalText)
          // US-73: rede de segurança contra o sceneState apodrecer. Se o modelo NÃO
          // manteve a cena via `updateScene` neste turno (comum em turnos de
          // viagem→chegada), reconcilia o sceneState com a narração em background —
          // sem isso o `local` congela e o sinal de continuidade da US-71 passa a
          // apontar para trás, alimentando o replay (bug de `erro narração 2`). Roda
          // SÓ quando o modelo negligenciou a cena → custo zero nos turnos disciplinados.
          const cenaTocada = steps.some((s) => (s.toolCalls ?? []).some((tc) => tc.toolName === 'updateScene'))
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
        // narrationModels[0] = deepseek-v4-flash (mesmo primário da narração).
        model: narrationModels[0]!,
        system: SALVAGE_SYSTEM_PROMPT,
        prompt: `[AÇÃO DO JOGADOR]:\n${message}\n\n[NARRAÇÃO ATÉ AGORA — continue EXATAMENTE de onde parou, sem repetir]:\n${base}`,
        maxTokens: 700,
        providerOptions: SALVAGE_PROVIDER_OPTIONS,
      })
      // Mesma cadeia de saneadores do onFinish: o fecho volta ao histórico como contexto.
      closure = stripWorldStateTags(stripFabricatedRolls(stripReasoningLeak(text).clean).clean).clean.trim()
    } catch (err) {
      logLlmFailure('completeTruncatedTurn: geração do fecho', 'usa o fecho estático', err)
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
    inventory: string[]
    sheet: DmCharacterSheet
    hookSeed: string
    attributeLabels?: Record<string, string>
    background?: CharacterBackground
    features?: ClassFeature[]
    spells?: KnownSpell[]
    /** US-97: idioma-alvo. A semente (gancho) é PT autoral — a cena sai no idioma do jogador. */
    locale?: Locale
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
      })
      // US-56: o estado volátil saiu do system. Na abertura não há cena/histórico/HP
      // dinâmico, mas a main quest e o equipamento inicial ainda são contexto útil —
      // então prefixamos o bloco de estado ao prompt de abertura (mesma convenção dos
      // turnos: estado na mensagem, não no system).
      const turnState = buildTurnStateBlock({
        sheet: params.sheet,
        sceneState: null,
        mainQuest: params.mainQuest ?? null,
        activeQuests: [],
        inventory: params.inventory,
        memorySummary: null,
      })
      const prompt = `${turnState}\n\n${buildOpeningInstruction({ characterName: params.characterName, hookSeed: params.hookSeed, locale: params.locale })}`
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
        model: summaryModel,
        schema: OPENING_SCENE_SCHEMA,
        system:
          'Extraia o estado de cena atual desta narração de abertura de RPG. Use APENAS o que está no texto — não invente local, NPC nem objeto. `ambiente`: interno = coberto/abrigado, externo = aberto. `presentes`: só NPCs/personagens na cena (NUNCA a própria personagem-jogadora). `objetos_em_cena`: objetos e elementos notáveis do ambiente, incluindo atmosféricos (névoa, cheiro), NUNCA itens que a personagem carrega. Deixe um campo vazio só se o texto realmente não o revelar.',
        prompt: `Narração de abertura:\n"""\n${text}\n"""${exclusion}`,
        // Thinking desligado: com ele, o `tool_choice` do modo tool leva 400 e a cena
        // nasce nula sempre (medido 04/08/2026 — ver EXTRACTION_PROVIDER_OPTIONS).
        providerOptions: EXTRACTION_PROVIDER_OPTIONS,
      })
      logExtractionEndpoint('extractOpeningScene', providerMetadata)
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
        model: summaryModel,
        schema: OPENING_ENTITIES_SCHEMA,
        system:
          'Extraia as entidades DURÁVEIS que esta abertura de RPG estabelece — NPCs nomeados, locais, objetos notáveis, facções — e ONDE cada um está, usando APENAS o texto. Não invente e NÃO INFIRA vínculos que o texto não afirma explicitamente (dono, identidade secreta, parentesco): se a prosa mostra um arboreto sem dizer de quem é, extraia só "arboreto" (local), sem dono. Tudo aqui é conhecimento comum que o jogador já viu. Não inclua a própria personagem-jogadora. Se a abertura não estabelece nenhuma entidade durável, devolva a lista vazia.',
        prompt: `Abertura:\n"""\n${text}\n"""${questContext ? `\n\nGancho da aventura (contexto):\n"""\n${questContext}\n"""` : ''}`,
        providerOptions: EXTRACTION_PROVIDER_OPTIONS,
      })
      logExtractionEndpoint('extractOpeningEntities', providerMetadata)
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
   * US-73: reconciliador de cena em background. Chamado no `onFinish` SÓ quando o
   * modelo NÃO chamou `updateScene` no turno — a rede de segurança contra o
   * `sceneState` apodrecer em turnos de viagem→chegada (o modelo narra o deslocamento
   * mas esquece de registrar; o snapshot congela e o sinal de continuidade da US-71
   * passa a apontar para trás, alimentando o replay — `erro narração 2`).
   *
   * Reusa a extração estruturada da US-35 (`OPENING_SCENE_SCHEMA` + `summaryModel`),
   * mas FUNDE com a cena corrente: dá a cena atual como base e pede o estado no FIM da
   * narração; campos escalares vazios NÃO sobrescrevem (turno só-diálogo não zera o
   * `local`). Persiste só a coluna `sceneState` — NÃO loga `CHARACTER_UPDATE` (mesmo
   * motivo do `recordEntity`: um evento marcaria o turno como mutação e o guard da
   * US-67 desativaria a edição de turnos de conversa). Fire-and-forget: nunca lança —
   * o turno já foi entregue ao jogador.
   */
  // `turnId` (US-117/ADR 011): recebido e ainda não consumido aqui — fica pronto
  // para o `arc_signal` (US-116) e para quando este log migrar para JSON (US-118).
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
        model: summaryModel,
        schema: OPENING_SCENE_SCHEMA,
        system:
          'Você reconcilia o estado ESTRUTURADO da cena de um RPG com a narração mais recente. Dada a CENA ATUAL e a NARRAÇÃO, produza o estado da cena como está no FIM da narração. Use APENAS o que a narração e a cena atual revelam — não invente. Se a personagem SE MOVEU para um lugar novo na narração, `local` é o lugar NOVO (fim do trajeto), não o de partida. `presentes`: só NPCs/personagens presentes no FIM (inclua quem apareceu, remova quem saiu; NUNCA a própria personagem-jogadora). `objetos_em_cena`: elementos notáveis do ambiente no fim (incl. atmosféricos), NUNCA itens carregados. Se a narração NÃO muda um campo, repita o valor da cena atual. Deixe um campo vazio só se nem a cena atual nem a narração o revelarem.',
        prompt: `CENA ATUAL:\n"""\n${baseText}\n"""\n\nNARRAÇÃO MAIS RECENTE:\n"""\n${text}\n"""`,
        providerOptions: EXTRACTION_PROVIDER_OPTIONS,
      })
      logExtractionEndpoint('reconcileScene', providerMetadata)
      const next = mergeSceneState(current, scenePatchFromExtraction(object, playerName))

      await this.prisma.characterState.update({
        where: { characterId_adventureId: { characterId, adventureId } },
        data: { sceneState: next as unknown as object },
      })
      console.log(`[AiService][reconcile] cena sincronizada: local="${next.local}" presentes=[${next.presentes.join(', ')}]`)
    } catch (err) {
      logLlmFailure('reconcileScene', 'a cena não sincroniza com a narração deste turno', err)
    }
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
  private async liveEvalTurn(playerAction: string, narration: string): Promise<void> {
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
      console.warn('[AiService][live-eval] juiz falhou (ignorado):', (err as Error).message)
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
