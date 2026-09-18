import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { SystemConfigSchema, catalogLabel, resolveLocale, type GeneratedAdventure, type InventoryItem, type Locale, type SystemBackground, type SystemConfig, type WorldEntity } from '@ai-dm/shared'
import { mergeSceneState, type CharacterBackground, type ClassFeature, type KnownSpell, type OriginNarrative } from '@ai-dm/ai-engine'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma.service'
import { AiService } from '../ai/ai.service'
import type { CombatBudget, CombatCast } from '../ai/adventure-authoring'
import { configForLocale, getSystemCached } from '../system/system-locale'
import { assignBudgetedCombatRoles, composeEncounterRoles, MONSTER_ROLE_CR, type EncounterChallenge, type MonsterRole } from '../adventure-generation/monster-roles'
import { BESTIARY, chooseNominalCreature } from '../adventure-generation/bestiary'
import { rollRegistry, rollFactionCount, rollNamingRegister, type AdventureRegistryOverrides } from '../adventure-generation/roll-registry'
import { rollQuestSeed } from '../adventure-generation/roll-quest-seed'
import { generateWithGate, sanitizeSlice, type GateResult } from '../adventure-generation/adventure-gate'
import { enrichLedgerWithRest, seedLedgerFromSlice } from '../adventure-generation/seed-ledger'
import { mintRestOntoSlice, mintSlice } from '../adventure-generation/mint-adventure'
import { AuthoredSliceRecordSchema, type AdventureSlice, type AuthoredSliceRecord } from '../adventure-generation/adventure-slice'
import { writeAuthoringDump } from './adventure-authoring-dump'

/**
 * US-148: entrada do motor de geração de aventuras (US-149 em diante). `hookSeed` é
 * sempre a rede de segurança — presente mesmo com `background`/`origin` vazios.
 */
export interface AdventureProfile {
  level: number
  classKey: string
  background: CharacterBackground
  origin: OriginNarrative
  hookSeed: string
  challenge: EncounterChallenge // US-167: default 'adventure', resolvido em createForCharacter
}

/**
 * US-235: tudo que a abertura (US-34) e o `CharacterState`/inventário precisam, calculado ANTES do
 * gatilho assíncrono em `createForCharacter` — o job em background não refaz nenhuma dessas consultas.
 */
export interface AdventureOpeningContext {
  systemName: string
  characterName: string
  characterGender: string
  className: string
  raceName: string
  level: number
  maxHp: number
  attrs: Record<string, number>
  skills?: { label: string; modifier: number; proficient: boolean }[]
  attributeLabels: Record<string, string>
  background: CharacterBackground
  features: ClassFeature[]
  knownSpells: KnownSpell[]
  fullInventory: InventoryItem[]
  hookSeed: string
  locale: Locale
  /** US-257: origem escolhida — repassada a `generateIntroNarration` (`releaseOpening`). */
  origin: { key?: string; connection?: string; memento?: string }
  backgrounds?: SystemBackground[]
}

// Locais/NPCs/desafios/encontros FIXOS nos defaults (têm dial, US-162/163 — vira a alavanca de
// variação depois, nunca dado).
const AUTHORING_COUNTS = { locations: 6, npcs: 7, challenges: 3, encounters: 3 }
const MAX_ATTEMPTS = 3

interface RestContext {
  challenge: EncounterChallenge
  namingRegister: string
  locale: Locale
  className: string
}

type Tx = Prisma.TransactionClient

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * US-256: motor de geração em duas chamadas. A fatia inicial (1A) é gerada, saneada e narrada; a
 * jogadora entra no chat (`OPENING_READY`) enquanto o resto (1B, com a fatia como contexto FIXO)
 * gera em segundo plano; só depois da junção dos dois ramos é gravado o estado terminal
 * (`ACTIVE`/`FAILED`) — ver `run`. Saiu de `AdventureService` (que já passava de 1000 linhas).
 */
@Injectable()
export class AdventureGenerationService {
  /**
   * Aventuras com a 1B em andamento NESTA instância. Sem fila (mesma premissa da US-235: instância
   * única no Render Free), então o Set é a única fonte de "está rodando": impede que o "tentar de
   * novo" dispare uma 1B duplicada (dois `Quest` primários) e, depois de um restart do dyno, é
   * exatamente o que distingue "estourou o teto porque morreu" de "ainda está gerando".
   */
  private readonly restRunning = new Set<string>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /**
   * US-253: elenco nominal POR SLOT de encontro (0..`encounterCount`-1), calculado ANTES da
   * autoria — mesma régua de papel de `assignBudgetedCombatRoles` que o PASSO 2 já usa (não só
   * `assignCombatRoles`/`ROLES_BY_IMPACT` cru): a composição greedy de `composeEncounterRoles`
   * (que decide `maxHostileCount`) NÃO é a mesma sequência que um ciclo reto Brute→Soldier→Minion
   * dá pro MESMO total — em nível 4+ isso já faz `assignBudgetedCombatRoles` descartar 1-2
   * posições por estourar o nível (checado com tsx antes de fechar esta story). Usar aqui a
   * função de ORÇAMENTO (não a crua) garante que TODO nome prometido no prompt é um nome que o
   * PASSO 2 vai CONFIRMAR depois — nunca promete mais do que a mecânica sustenta. Índice de
   * `chooseNominalCreature` usa a posição BRUTA `i` (antes de descartar `undefined`) somada a
   * `slotIndex * maxHostileCount` — mesma fórmula, mesmo array-base, que o PASSO 2 usa.
   */
  private buildCombatCast(combatBudget: CombatBudget, encounterCount: number, level: number, challenge: EncounterChallenge): CombatCast | undefined {
    if (!combatBudget.viable) return undefined
    const roles = assignBudgetedCombatRoles(combatBudget.maxHostileCount, level, challenge)
    const affordableCrs = roles.filter((role): role is MonsterRole => role !== undefined).map((role) => MONSTER_ROLE_CR[role])
    const strongestCr = Math.max(...affordableCrs)
    return Array.from({ length: encounterCount }, (_, slotIndex) =>
      roles.flatMap((role, i) =>
        role === undefined
          ? []
          : [
              {
                nominalCreature: chooseNominalCreature(role, undefined, BESTIARY, slotIndex * combatBudget.maxHostileCount + i),
                strongerThanRest: MONSTER_ROLE_CR[role] === strongestCr,
              },
            ],
      ),
    )
  }

  /**
   * US-256: chamada 1A + minting + saneamento da fatia. Contagem de FACÇÕES sorteada [2,4] no Game
   * Server (`rollFactionCount`) e passada como restrição do prompt; `registry` vem de `rollRegistry`
   * inteiro (dimensão de filtro/eval), só os eixos com override viram RÓTULO pt-BR no prompt
   * ("Aleatório" = omitido). `attempt` (US-150) re-rola registro/contagem/registro de nomenclatura/
   * semente do gancho — é a variação do reseed, e pertence só à 1A (nada foi mostrado ainda).
   * Saneia ANTES de devolver: a abertura só pode ver texto saneado (o gate final só roda depois).
   */
  async generateSlice(
    profile: AdventureProfile,
    characterId: string,
    order: number,
    locale: Locale,
    config: SystemConfig,
    registryOverrides: AdventureRegistryOverrides = {},
    attempt = 0,
  ): Promise<AuthoredSliceRecord> {
    const registry = rollRegistry(characterId, order, registryOverrides, attempt)
    const namingRegister = rollNamingRegister(characterId, order, attempt)
    const world = {
      setting: registryOverrides.setting ? catalogLabel(config.settings, registryOverrides.setting) : undefined,
      tone: registryOverrides.tone ? catalogLabel(config.tones, registryOverrides.tone) : undefined,
      areaType: registryOverrides.areaType ? catalogLabel(config.areaTypes, registryOverrides.areaType) : undefined,
    }
    const { slice, modelId } = await this.ai.generateAdventureSlice({
      world,
      factionCount: rollFactionCount(characterId, order, attempt),
      counts: { locations: AUTHORING_COUNTS.locations, npcs: AUTHORING_COUNTS.npcs },
      // US-232: background como TOM — só `character.story`; bonds/deity/flaws ficam de fora.
      characterStory: profile.background.story,
      namingRegister,
      questSeed: rollQuestSeed(characterId, order, attempt),
      level: profile.level,
      className: catalogLabel(config.classes, profile.classKey),
      locale,
    })
    const minted = mintSlice(slice, { id: `${characterId}:${order}`, level: profile.level, registry, modelId })
    return { slice: sanitizeSlice(minted), challenge: profile.challenge, namingRegister }
  }

  /**
   * Reseed da 1A ANTES da liberação (`attempt + 1`, como o gate fazia com a chamada única): a
   * escada esgotada ou um minting que lança re-semeia até `MAX_ATTEMPTS`. Esgotou → lança com o
   * motivo da última falha (vira `FAILED` em `run`, ainda com a jogadora no wizard).
   */
  private async generateSliceWithReseed(
    profile: AdventureProfile,
    characterId: string,
    order: number,
    locale: Locale,
    config: SystemConfig,
    registryOverrides: AdventureRegistryOverrides,
  ): Promise<AuthoredSliceRecord> {
    let lastReason = 'nenhuma tentativa executada'
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await this.generateSlice(profile, characterId, order, locale, config, registryOverrides, attempt)
      } catch (err) {
        lastReason = messageOf(err)
        console.error(JSON.stringify({ event: 'adventure_slice_failed', timestamp: new Date().toISOString(), attempt, reason: lastReason }))
      }
    }
    throw new Error(`teto de ${MAX_ATTEMPTS} tentativas da fatia esgotado — última falha: ${lastReason}`)
  }

  /**
   * US-256: chamada 1B + minting sobre a fatia congelada → artefato COMPLETO. Sem `attempt`: a 1B
   * não re-rola nada (registry/factionCount/namingRegister/questSeed são da 1A), só re-amostra.
   * `combatBudget`/`combatCast` saem só de `level`/`challenge` (US-250/US-253), então o prompt da
   * 1B não muda entre tentativas — o retry dela é cego (ver US-256, Notas: `attempt`).
   */
  async generateRestArtifact(slice: AdventureSlice, ctx: RestContext): Promise<GeneratedAdventure> {
    const level = slice.levelRange.min
    // US-250: mesmo orçamento do PASSO 2 (composeEncounterRoles), calculado ANTES da autoria —
    // vira restrição de prompt em vez de checagem tardia que descarta posição em silêncio.
    const combatRoles = composeEncounterRoles(level, ctx.challenge)
    const combatBudget = { maxHostileCount: combatRoles.length, viable: combatRoles.length > 0 }
    // US-253: elenco nominal por slot de encontro — soma ao combatBudget como restrição de
    // prompt, pra ficção já ser escrita sobre a criatura real (ver buildCombatCast acima).
    const combatCast = this.buildCombatCast(combatBudget, AUTHORING_COUNTS.encounters, level, ctx.challenge)
    const { rest, modelId } = await this.ai.generateAdventureRest({
      slice,
      counts: { challenges: AUTHORING_COUNTS.challenges, encounters: AUTHORING_COUNTS.encounters },
      namingRegister: ctx.namingRegister,
      level,
      className: ctx.className,
      combatBudget,
      combatCast,
      locale: ctx.locale,
    })
    return mintRestOntoSlice(slice, rest, { level, challenge: ctx.challenge, maxHostileCount: combatBudget.maxHostileCount, modelId })
  }

  /**
   * US-150/US-234: gate sobre o artefato MESCLADO (fatia + resto). Reprovar regenera SÓ a 1B —
   * `generateWithGate` re-executa o callback, que nunca toca na fatia (mundo/NPCs/locais/gancho que
   * a jogadora já leu são os do artefato final). Nunca lança (o gate converte exceção em falha
   * de estágio 'parse'); o `.catch` é só rede contra um `generate` que rejeite fora dele.
   */
  generateGatedRest(slice: AdventureSlice, ctx: RestContext, config: SystemConfig, maxAttempts = MAX_ATTEMPTS): Promise<GateResult> {
    return generateWithGate(() => this.generateRestArtifact(slice, ctx), maxAttempts, ctx.challenge, config)
      .catch((err): GateResult => ({ ok: false, reason: messageOf(err), attempt: 0 }))
  }

  /**
   * US-235: promise solta do controller/`createForCharacter` — sem fila no repo (sem BullMQ/Redis) e
   * Render Free é instância única, aceito para fase 1. Nunca lança: qualquer falha termina a linha
   * em FAILED, nunca deixa a Adventure presa em GENERATING por um erro não tratado.
   *
   * US-256: 1A → [ramo N: narração + liberação (`OPENING_READY`)] ∥ [ramo R: 1B + gate] → junção →
   * estado terminal. Os DOIS ramos concorrem por `Adventure.status`, então NENHUM grava estado
   * terminal: o ramo R só devolve o resultado e quem grava `ACTIVE`/`FAILED` é este método,
   * DEPOIS de a liberação terminar (senão a liberação, mais lenta, sobrescreveria um `ACTIVE`/
   * `FAILED` já gravado com `OPENING_READY`). Se a narração/liberação lança, ainda não há nada
   * liberado: `FAILED` na hora, sem esperar a 1B (que segue e é descartada) — a jogadora ainda está
   * no wizard e a tela de erro+retry da US-235 a alcança.
   */
  async run(
    adventureId: string,
    characterId: string,
    profile: AdventureProfile,
    order: number,
    locale: Locale,
    config: SystemConfig,
    registryOverrides: AdventureRegistryOverrides,
    opening: AdventureOpeningContext,
  ): Promise<void> {
    this.restRunning.add(adventureId)
    try {
      const record = await this.generateSliceWithReseed(profile, characterId, order, locale, config, registryOverrides)
      const restResult = this.startRest(record, config, locale, opening.className)
      await this.releaseOpening(adventureId, characterId, record, opening)
      await this.finishWithRest(adventureId, characterId, await restResult)
    } catch (err) {
      await this.failGeneration(adventureId, err)
    } finally {
      this.restRunning.delete(adventureId)
    }
  }

  private startRest(record: AuthoredSliceRecord, config: SystemConfig, locale: Locale, className: string): Promise<GateResult> {
    return this.generateGatedRest(record.slice, { challenge: record.challenge, namingRegister: record.namingRegister, locale, className }, config)
  }

  private async finishWithRest(adventureId: string, characterId: string, result: GateResult): Promise<void> {
    if (!result.ok) {
      await this.prisma.adventure.update({ where: { id: adventureId }, data: { status: 'FAILED', generationError: result.reason } })
      return
    }
    await this.completeGeneration(adventureId, characterId, result.adventure)
  }

  private async failGeneration(adventureId: string, err: unknown): Promise<void> {
    const message = messageOf(err)
    console.error(JSON.stringify({ event: 'adventure_generation_crashed', adventureId, timestamp: new Date().toISOString(), errorMessage: message }))
    await this.prisma.adventure.update({ where: { id: adventureId }, data: { status: 'FAILED', generationError: message } }).catch(() => {})
  }

  /**
   * US-256: liberação — narra a abertura sobre a fatia (só texto saneado), extrai a cena e grava, numa
   * transação, o estado `OPENING_READY` + `authoredSlice` + ledger da fatia + EventLogs. É o que
   * faz a jogadora entrar no chat. Lança se qualquer passo falhar (a transação faz rollback:
   * nada foi liberado).
   */
  private async releaseOpening(adventureId: string, characterId: string, record: AuthoredSliceRecord, opening: AdventureOpeningContext): Promise<void> {
    const { slice } = record
    // US-151: ledger semeado do artefato JÁ VALIDADO — substitui `extractOpeningEntities` (extração
    // por LLM da prosa) como fonte, agora que a aventura sempre vem do motor (US-153). US-256: só
    // a fatia existe aqui; `enrichLedgerWithRest` completa na conclusão.
    const ledger = seedLedgerFromSlice(slice)
    const { openingText, introText } = await this.narrateOpening(slice, ledger, opening)
    // US-35: extrai a cena estruturada da abertura ANTES da transação (é LLM). Sem isto o
    // `sceneState` nasce nulo e o turno 1 fica sem âncora de continuidade (a abertura roda sem
    // tools, nunca chama `updateScene`). Falha/vazio → nulo; nunca derruba a criação.
    const scenePatch = await this.ai.extractOpeningScene(openingText, opening.fullInventory.map((i) => i.name))
    const sceneState = scenePatch ? mergeSceneState(null, scenePatch) : null

    await this.prisma.$transaction(async (tx) => {
      await tx.adventure.update({
        where: { id: adventureId },
        data: {
          status: 'OPENING_READY',
          title: slice.summary,
          authoredSlice: record as unknown as object,
          ...(ledger.length > 0 ? { entities: ledger as unknown as object } : {}),
        },
      })
      // US-35: cena extraída da abertura, aplicada ao CharacterState já criado (sync).
      if (sceneState) {
        await tx.characterState.update({
          where: { characterId_adventureId: { characterId, adventureId } },
          data: { sceneState: sceneState as unknown as object },
        })
      }
      await this.writeOpeningEvents(tx, adventureId, characterId, introText, openingText)
    })
  }

  // US-257: introdução em PARALELO à abertura (não soma latência entre si) — as duas só dependem de
  // `summary`, `start`, `registry` e do ledger, todos disponíveis na fatia, então rodam ANTES da
  // liberação, juntas (adiar a introdução exigiria inserir o `INTRODUCTION` com `createdAt`
  // anterior ao da `NARRATION` já exibida).
  private async narrateOpening(slice: AdventureSlice, ledger: WorldEntity[], opening: AdventureOpeningContext): Promise<{ openingText: string; introText: string | null }> {
    const [generatedOpening, generatedIntro] = await Promise.all([
      this.ai.generateOpeningNarration(this.openingParams(slice, ledger, opening)),
      this.ai.generateIntroNarration(this.introParams(slice, opening)),
    ])
    // US-101: o fallback estático já sai no idioma certo — `opening.hookSeed` veio do `config` do
    // locale do dono, e o gancho tem versão por idioma.
    return { openingText: generatedOpening ?? opening.hookSeed, introText: generatedIntro }
  }

  private openingParams(slice: AdventureSlice, ledger: WorldEntity[], opening: AdventureOpeningContext): Parameters<AiService['generateOpeningNarration']>[0] {
    return {
      systemName: opening.systemName,
      characterName: opening.characterName,
      characterGender: opening.characterGender,
      characterClass: opening.className,
      characterRace: opening.raceName,
      mainQuest: `${slice.summary}\n${slice.start}`,
      // US-168: mesmo ledger que a transação persiste — a abertura vê o elenco que o motor já
      // gerou, em vez de inventar um à parte (violando Onomástica).
      entities: ledger,
      inventory: opening.fullInventory.map((i) => (i.qty > 1 ? `${i.name} (${i.qty})` : i.name)),
      sheet: { level: opening.level, hp: opening.maxHp, maxHp: opening.maxHp, attributes: opening.attrs, conditions: [], skills: opening.skills },
      hookSeed: opening.hookSeed,
      attributeLabels: opening.attributeLabels,
      background: opening.background,
      // US-41: features de classe do kit (o DM já as conhece na 1ª cena).
      features: opening.features,
      // US-42: magias conhecidas — só os nomes vão ao prompt (descrição via getSpell nos turnos).
      spells: opening.knownSpells.map((s) => ({ name: s.name, level: s.level })),
      locale: opening.locale,
      // US-168/US-185: direto de `registry` — a abertura já nasce coerente, sem esperar o round-trip
      // pelo banco.
      tone: slice.registry.tone,
      setting: slice.registry.setting,
      areaType: slice.registry.areaType,
    }
  }

  private introParams(slice: AdventureSlice, opening: AdventureOpeningContext): Parameters<AiService['generateIntroNarration']>[0] {
    return {
      systemName: opening.systemName,
      characterName: opening.characterName,
      characterGender: opening.characterGender,
      characterClass: opening.className,
      characterRace: opening.raceName,
      mainQuest: `${slice.summary}\n${slice.start}`,
      sheet: { level: opening.level, hp: opening.maxHp, maxHp: opening.maxHp, attributes: opening.attrs, conditions: [], skills: opening.skills },
      hookSeed: opening.hookSeed,
      attributeLabels: opening.attributeLabels,
      background: opening.background,
      features: opening.features,
      spells: opening.knownSpells.map((s) => ({ name: s.name, level: s.level })),
      origin: opening.origin,
      backgrounds: opening.backgrounds,
      locale: opening.locale,
      tone: slice.registry.tone,
      setting: slice.registry.setting,
      areaType: slice.registry.areaType,
    }
  }

  // Primeira narração persistida: aparece como mensagem do Mestre (getTurns) e entra na janela de
  // contexto do DM (historyLogs, summarized: false).
  // US-257: introdução ANTES da cena, `createdAt` explícito nas duas — `now()` do Postgres é fixo
  // por TRANSAÇÃO (não por statement), então duas `create` na mesma `$transaction` empatariam sem
  // isto, quebrando a ordem (`orderBy: createdAt`) entre intro e cena.
  private async writeOpeningEvents(tx: Tx, adventureId: string, characterId: string, introText: string | null, openingText: string): Promise<void> {
    if (!introText) {
      await tx.eventLog.create({ data: { adventureId, characterId, type: 'NARRATION', payload: { text: openingText } } })
      return
    }
    const introAt = new Date()
    await tx.eventLog.create({ data: { adventureId, characterId, type: 'INTRODUCTION', payload: { text: introText }, createdAt: introAt } })
    await tx.eventLog.create({ data: { adventureId, characterId, type: 'NARRATION', payload: { text: openingText }, createdAt: new Date(introAt.getTime() + 1) } })
  }

  /**
   * US-256: transação final — o artefato completo, o ledger enriquecido (segmentos de encontro/
   * desafio nos locais, `occupants` finais nos NPCs) e a Quest primária. Só aqui `ACTIVE` passa a
   * significar "aventura pronta por inteiro". Não corre com um turno (`assertAdventurePlayable`
   * recusa turno em `OPENING_READY`), então o ledger lido do banco é o que a liberação gravou.
   */
  private async completeGeneration(adventureId: string, characterId: string, generated: GeneratedAdventure): Promise<void> {
    const row = await this.prisma.adventure.findUnique({ where: { id: adventureId }, select: { entities: true } })
    const entities = enrichLedgerWithRest((row?.entities ?? []) as unknown as WorldEntity[], generated)
    await this.prisma.$transaction(async (tx) => {
      // US-168: `generatedAdventure` (ADR 012 §D2/US-144) — disponível de graça a todo turno via
      // `streamChat` (SELECT * implícito, sem query nova).
      await tx.adventure.update({
        where: { id: adventureId },
        data: {
          status: 'ACTIVE',
          generationError: null,
          generatedAdventure: generated as unknown as object,
          ...(entities.length > 0 ? { entities: entities as unknown as object } : {}),
        },
      })
      // US-153: quest principal derivada do artefato gerado (não mais do gancho fixo por classe) —
      // dá objetivo ao DM (ver AiService). US-169: `objective` (alvo concreto) é exposto ao Mestre
      // todo turno (buildTurnStateBlock). US-232: `objective` do artefato virou objeto — grava só
      // `.description` (a coluna Quest é texto). `Quest.conclusionHint` SAIU da tabela: a autoria
      // mundo-primeiro tem fecho RAMIFICADO (`branchedResolution`, sem herói), não uma conclusão
      // única pré-escrita. US-194: `description` = `generated.summary` (a premissa), não a cena.
      await tx.quest.create({
        data: { adventureId, title: generated.summary, description: generated.summary, objective: generated.objective.description, isPrimary: true },
      })
    })
    this.dumpAuthoring(adventureId, characterId, generated)
  }

  // US-243: dump best-effort do artefato aprovado, só depois da transação confirmar (senão o JSON em
  // disco não bateria com o que foi persistido). Dev-only, mesmo gate de `adventure.module.ts`
  // (US-202); nunca bloqueia a criação — falha de disco é só logada.
  private dumpAuthoring(adventureId: string, characterId: string, generated: GeneratedAdventure): void {
    if (process.env.NODE_ENV === 'production') return
    try {
      writeAuthoringDump(characterId, generated)
    } catch (err) {
      console.error(JSON.stringify({ event: 'authoring_dump_failed', adventureId, characterId, timestamp: new Date().toISOString(), errorMessage: messageOf(err) }))
    }
  }

  /**
   * US-256 (Questão #4): "tentar de novo" da 1B depois da liberação — re-executa SÓ a 1B contra a
   * fatia persistida em `authoredSlice` (barato porque a fatia é imutável). Aceita `FAILED` e
   * `OPENING_READY` (este último cobre o dyno que reiniciou no meio da 1B: o status ficou preso
   * mas nada roda — `restRunning` é o que distingue "morreu" de "ainda gerando"; se ainda roda,
   * devolve o estado atual sem duplicar). Falha ANTES da liberação não tem fatia: o cliente
   * recomeça a criação, como na US-235.
   */
  async retryRest(characterId: string, adventureId: string): Promise<{ status: string }> {
    const row = await this.prisma.adventure.findFirst({
      where: { id: adventureId, participants: { some: { characterId } } },
      select: { status: true, authoredSlice: true },
    })
    if (!row) throw new NotFoundException(`Aventura ${adventureId} não encontrada para este personagem`)
    if (this.restRunning.has(adventureId)) return { status: row.status }
    const record = this.parseRetryableSlice(adventureId, row)
    this.restRunning.add(adventureId)
    try {
      const { config, locale, className } = await this.loadRestContext(characterId)
      await this.prisma.adventure.update({ where: { id: adventureId }, data: { status: 'OPENING_READY', generationError: null } })
      void this.runRestOnly(adventureId, characterId, record, config, locale, className)
    } catch (err) {
      this.restRunning.delete(adventureId)
      throw err
    }
    return { status: 'OPENING_READY' }
  }

  private parseRetryableSlice(adventureId: string, row: { status: string; authoredSlice: unknown }): AuthoredSliceRecord {
    if (row.status !== 'FAILED' && row.status !== 'OPENING_READY') {
      throw new ConflictException(`Aventura ${adventureId} está em ${row.status}: só FAILED ou OPENING_READY reexecutam a geração do resto`)
    }
    const parsed = AuthoredSliceRecordSchema.safeParse(row.authoredSlice)
    if (!parsed.success) {
      throw new ConflictException(`Aventura ${adventureId} não tem fatia persistida (authoredSlice ${row.authoredSlice == null ? 'ausente' : 'inválido'}): a falha foi antes da liberação — recomece a criação`)
    }
    return parsed.data
  }

  private async runRestOnly(adventureId: string, characterId: string, record: AuthoredSliceRecord, config: SystemConfig, locale: Locale, className: string): Promise<void> {
    try {
      await this.finishWithRest(adventureId, characterId, await this.startRest(record, config, locale, className))
    } catch (err) {
      await this.failGeneration(adventureId, err)
    } finally {
      this.restRunning.delete(adventureId)
    }
  }

  // Mesmo trio de `createForCharacter` (locale do dono → config do locale → rótulo da classe): a 1B
  // precisa do config pro catálogo de perícia do gate (US-234) e pro `className` do prompt.
  private async loadRestContext(characterId: string): Promise<{ config: SystemConfig; locale: Locale; className: string }> {
    const character = await this.prisma.character.findUnique({ where: { id: characterId }, include: { user: { select: { locale: true } } } })
    if (!character) throw new NotFoundException(`Personagem ${characterId} não encontrado`)
    const system = await getSystemCached(this.prisma, character.systemId)
    const locale = resolveLocale(character.user?.locale)
    const config = SystemConfigSchema.parse(configForLocale(system, locale))
    return { config, locale, className: catalogLabel(config.classes, character.class) }
  }
}
