import { Injectable, NotFoundException } from '@nestjs/common'
import { streamText, generateText, generateObject, tool, type CoreMessage } from 'ai'
import type { InventoryItem, SceneState, SystemConfig } from '@ai-dm/shared'
import { buildSkillSheet, stripFabricatedRolls, stripReasoningLeak, resolveRollModifier, normalizeDie } from '@ai-dm/shared'
import { z } from 'zod'
import {
  narrationModels,
  NARRATION_PROVIDER_OPTIONS,
  summaryModel,
  buildDmSystemPrompt,
  buildTurnStateBlock,
  buildOpeningInstruction,
  resolveKnownSpell,
  buildSummaryInput,
  mergeSceneState,
  formatSceneState,
  SUMMARY_SYSTEM_PROMPT,
  type ScenePatch,
  type DmCharacterSheet,
  type CharacterBackground,
  type ClassFeature,
  type KnownSpell,
  type SummaryTurn,
} from '@ai-dm/ai-engine'
import { DiceService } from '../game/dice.service'
import { PrismaService } from '../prisma.service'

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
  async streamChat(input: ChatInput, attempt = 0, rollState?: RollTurnState) {
    const { adventureId, characterId, message } = input

    // Carrega contexto do banco
    const [character, adventure, characterState, quests, historyLogs] = await Promise.all([
      this.prisma.character.findUnique({ where: { id: characterId } }),
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
    const config = adventure.system.config as Partial<SystemConfig> | null
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
      characterClass: character.class,
      characterRace: character.race,
      sheet,
      attributeLabels,
      background: (character.background ?? {}) as unknown as CharacterBackground,
      // US-41: features de classe materializadas no personagem (awareness read-only).
      features: (character.features ?? []) as unknown as ClassFeature[],
      // US-42: magias conhecidas — SÓ os nomes vão ao prompt; a descrição vem via getSpell.
      spells: ((character.spells ?? []) as unknown as KnownSpell[]).map((s) => ({ name: s.name, level: s.level })),
    })

    // US-56: bloco de estado volátil do turno, prefixado à AÇÃO CRUA do jogador. A ação
    // crua (`message`) permanece separada — é ela, não o conteúdo prefixado, que o
    // `onFinish` persiste no EventLog (fronteira de persistência: mantém o history e o
    // resumo limpos e o próprio prefixo do history estável turno a turno).
    const turnState = buildTurnStateBlock({
      sheet,
      sceneState: (characterState?.sceneState ?? null) as SceneState | null,
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
          presentes: z.array(z.string()).optional().describe('FULL list of NPCs/characters present in the scene now'),
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

      // US-42: descrição da magia sob demanda. Awareness apenas — NÃO resolve slot,
      // dano, cura ou preparação. Fonte de verdade = Character.spells (materializado
      // do kit da classe na criação). Match tolerante a acento/caixa. Magia fora da
      // lista → { known: false } e o mestre NÃO inventa o efeito.
      getSpell: tool({
        description:
          'Look up a spell the character knows to get its effect BEFORE narrating a casting. Pass the spell NAME exactly as shown in the "Known spells" list. Returns { known, level, description }. If it returns known:false, the character does NOT know that spell — do NOT invent its effect. This is awareness only: it does NOT spend slots, roll damage/healing, or track preparation.',
        parameters: z.object({
          name: z.string().describe('Spell name as shown in the "Known spells" list, e.g. "Chama Sagrada".'),
        }),
        execute: async ({ name }: { name: string }) => {
          return resolveKnownSpell((character.spells ?? []) as unknown as KnownSpell[], name)
        },
      }),
    }

    const model = narrationModels[Math.min(attempt, narrationModels.length - 1)]!
    const hasFallback = attempt < narrationModels.length - 1
    console.log(`[AiService] turno attempt=${attempt} modelo=${model.modelId ?? 'unknown'}`)

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
      // Persiste a narração do mestre ao final, mantendo a continuidade da cena,
      // e condensa turnos antigos no resumo quando a janela cresce demais.
      onFinish: async ({ text, steps, finishReason, usage, providerMetadata, response }) => {
        // DIAGNÓSTICO corte de narração: 'length' = estourou maxTokens (raciocínio
        // oculto do deepseek conta no orçamento); 'stop' com prosa incompleta =
        // provider dropou upstream; 'error' = ver logs acima.
        console.log(`[AiService] onFinish finishReason=${finishReason} tokens=${JSON.stringify(usage)} steps=${steps.length}`)
        // US-55 spike de cache: o pin @ai-sdk/openai-compatible@0.2.16 não
        // normaliza cached tokens no `usage` (só promptTokens/completionTokens); o
        // OpenRouter/DeepSeek reporta em prompt_tokens_details.cached_tokens +
        // cache_discount no corpo bruto, que sai em providerMetadata/response.body.
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
        const { clean: finalText, removed } = stripFabricatedRolls(withoutReasoning)
        if (removed.length > 0) {
          console.warn(`[AiService] saneador removeu ${removed.length} rolagem(ns) fictícia(s) da narração:`, removed)
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
        }
        await this.summarizeOldTurns(adventureId, characterId)
      },
    })

    return { result, hasFallback }
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
      const prompt = `${turnState}\n\n${buildOpeningInstruction({ characterName: params.characterName, hookSeed: params.hookSeed })}`
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
          console.error(`[AiService] Abertura falhou no modelo ${model.modelId ?? 'unknown'}, tentando próximo:`, err)
        }
      }
      return null
    } catch (err) {
      console.error('[AiService] Falha ao gerar abertura por IA, usando fallback estático:', err)
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
      const { object } = await generateObject({
        model: summaryModel,
        schema: OPENING_SCENE_SCHEMA,
        system:
          'Extraia o estado de cena atual desta narração de abertura de RPG. Use APENAS o que está no texto — não invente local, NPC nem objeto. `ambiente`: interno = coberto/abrigado, externo = aberto. `presentes`: só NPCs/personagens na cena (NUNCA a própria personagem-jogadora). `objetos_em_cena`: objetos e elementos notáveis do ambiente, incluindo atmosféricos (névoa, cheiro), NUNCA itens que a personagem carrega. Deixe um campo vazio só se o texto realmente não o revelar.',
        prompt: `Narração de abertura:\n"""\n${text}\n"""${exclusion}`,
        providerOptions: NARRATION_PROVIDER_OPTIONS,
      })
      // Snapshot vazio (prosa sem cena discernível) = tratamos como nulo: nada a ancorar.
      const empty = !object.local.trim() && object.presentes.length === 0 && object.objetos_em_cena.length === 0
      return empty ? null : object
    } catch (err) {
      console.error('[AiService] Falha ao extrair cena da abertura, sceneState fica nulo:', err)
      return null
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
      console.error('[AiService] Falha ao sumarizar memória da sessão:', err)
    }
  }
}
