import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { SystemConfigSchema, buildSkillSheet, catalogLabel, resolveLocale, resolveSheetEntries, stripFabricatedRolls, getStartingInventory, getBackgroundEquipment, getRaceToolEquipment, MEMENTO_ITEM_LABEL, maxHpForLevel, proficiencyBonusForLevel, type InitialAdventureHook, type ChatTurn, type InventoryItem, type SystemConfig, type Locale } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'
import { configForLocale, getSystemCached } from '../system/system-locale'
import { AiService } from '../ai/ai.service'
import { mergeSceneState, resolveAdventuresAndAdvancement, type CharacterBackground } from '@ai-dm/ai-engine'
import { resolveInitialHook, resolveHookTemplate } from '../character/starting-inventory'
import type { EncounterChallenge } from '../adventure-generation/monster-roles'
import type { AdventureRegistryOverrides } from '../adventure-generation/roll-registry'
import { IN_PROGRESS_ADVENTURE_STATUSES } from '../adventure-generation/adventure-status'
import { AdventureGenerationService, type AdventureOpeningContext, type AdventureProfile } from './adventure-generation.service'
import type { AdventureExportData } from './adventure-export'

export interface CreateAdventureDto {
  // initialHookId REMOVIDO (US-153): a aventura passou a ser sempre gerada. US-217 reabre
  // essa decisão só para o ramo "Aventura pronta" (US-216) — ver `preset` abaixo.
  // setting/areaType voltaram na US-184 (revert do corte da US-173).
  tone?: string // US-156: chave do catálogo, ou ausente = sorteado pelo seed
  setting?: string
  areaType?: string
  challenge?: 'adventure' | 'challenge' // US-165: risco de combate (US-161); ausente = 'adventure'
  // US-217: `true` pula o motor de geração inteiro — usa o gancho fixo da classe
  // (title/primaryQuestTitle/primaryQuestDescription/openingNarration) sem nenhuma chamada
  // de IA, como a criação funcionava antes da US-153. Ausente/false = comportamento de hoje
  // (motor sempre gera). `tone`/`setting`/`areaType`/`challenge` são ignorados quando `true`
  // — o ramo "pronta" não passa por Cenário/Tom/Área/Desafio (US-216).
  preset?: boolean
}

// US-256: `AdventureProfile` mora em adventure-generation.service.ts (o motor saiu daqui); re-exportado
// porque testes e scripts/run-authoring.ts importam de './adventure.service'.
export type { AdventureProfile } from './adventure-generation.service'

// US-235: título placeholder da linha `GENERATING` — trocado por `generated.summary` no
// sucesso (`completeGeneration`/`releaseOpening`, adventure-generation.service.ts). Locale-aware como MEMENTO_ITEM_LABEL (starting-kit.ts).
const GENERATING_ADVENTURE_TITLE: Record<Locale, string> = {
  'pt-BR': 'Aventura de {characterName}',
  'en-US': "{characterName}'s Adventure",
}

@Injectable()
export class AdventureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    // US-256: default pros ~40 testes que constroem `new AdventureService(prisma, ai)` à mão; o Nest
    // injeta o provider registrado em adventure.module.ts.
    private readonly generation: AdventureGenerationService = new AdventureGenerationService(prisma, ai),
  ) {}

  /**
   * Cria a aventura do personagem, liga-o como participante e gera o
   * CharacterState inicial — tudo numa transação (cobre o caso single-player
   * numa única chamada, ver US-22). `systemId`/`creatorId` vêm do próprio
   * personagem, então a invariante "mesmo sistema" vale por construção.
   */
  /**
   * US-61: confirma que o personagem pertence ao utilizador autenticado antes de
   * qualquer operação por `characterId`. Inexistente → 404; dono diferente → 403.
   */
  async assertCharacterOwner(characterId: string, userId: string): Promise<void> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { userId: true },
    })
    if (!character) throw new NotFoundException(`Personagem ${characterId} não encontrado`)
    if (character.userId !== userId) {
      throw new ForbiddenException('Este personagem não pertence ao utilizador autenticado')
    }
  }

  /**
   * Valida a chave de `tone`/`setting`/`areaType` contra o catálogo do config (US-156),
   * cópia do `validateCatalogKey` de `character.service.ts` (mesmo molde de mensagem,
   * catálogo FECHADO, sem chave `custom`). Config sem o catálogo (campos opcionais, para
   * não invalidar config legado) aceita o que vier — mesma rede que impede um banco não
   * re-semeado de bloquear a criação de aventura.
   */
  private validateCatalogKey(catalog: Array<{ key: string }> | undefined, key: string, field: string): string {
    if (!catalog || catalog.length === 0) return key
    if (!catalog.some((e) => e.key === key)) {
      throw new BadRequestException(
        `${field} inválido: "${key}". Esperado uma chave do catálogo do sistema: ${catalog.map((e) => e.key).join(', ')}`,
      )
    }
    return key
  }

  private resolveHook(hook: InitialAdventureHook, name: string, charClass: string): InitialAdventureHook {
    const vars = { characterName: name, characterClass: charClass }
    return {
      ...hook,
      title: resolveHookTemplate(hook.title, vars),
      pitch: resolveHookTemplate(hook.pitch, vars),
      openingNarration: resolveHookTemplate(hook.openingNarration, vars),
    }
  }

  /**
   * US-148: monta o perfil que o motor de geração recebe — nível, classe, background/origin
   * brutos e o hookSeed RESOLVIDO (placeholders já substituídos, via `this.resolveHook`,
   * mesmo padrão de `createForCharacter`). `background`/`origin` vazios não lançam: o
   * `hookSeed` da classe é a rede de segurança. Método privado (não função livre) porque
   * precisa de `this.resolveHook` — só ele resolve os placeholders sem duplicar a lógica.
   */
  private buildAdventureProfile(
    character: { name: string; level: number; class: string; background: unknown; origin: unknown },
    config: SystemConfig,
    challenge: EncounterChallenge,
  ): AdventureProfile {
    const origin = (character.origin ?? {}) as { key?: string; connection?: string; memento?: string }
    const rawHook = resolveInitialHook(config, character.class)
    const className = catalogLabel(config.classes, character.class)
    const hookSeed = rawHook ? this.resolveHook(rawHook, character.name, className).openingNarration : ''

    return {
      level: character.level,
      classKey: character.class,
      background: (character.background ?? {}) as CharacterBackground,
      // `connection`/`memento` ficam de fora do perfil de propósito: só `adventuresAndAdvancement`
      // alimenta o motor de geração — os outros dois continuam servindo só a narração de
      // turno ao vivo (ai.service.ts:344-356, lê `Character.origin` direto, não este perfil).
      origin: {
        adventuresAndAdvancement: resolveAdventuresAndAdvancement(config.backgrounds, origin.key),
      },
      hookSeed,
      challenge,
    }
  }

  async createForCharacter(characterId: string, dto: CreateAdventureDto) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      // US-97: `user.locale` decide o idioma da primeira cena — é o único texto que
      // nasce antes de o jogador escrever qualquer coisa (não há o que espelhar).
      include: { user: { select: { locale: true } } },
    })
    if (!character) throw new NotFoundException(`Personagem ${characterId} não encontrado`)
    const system = await getSystemCached(this.prisma, character.systemId)

    // US-128: um só resolveLocale — reusado no config, na abertura gerada e no rótulo do
    // item de memento (`MEMENTO_ITEM_LABEL`), em vez de recalcular a mesma coisa 3 vezes.
    const locale = resolveLocale(character.user?.locale)
    const config = SystemConfigSchema.parse(configForLocale(system, locale))

    // US-153: no ramo gerado (abaixo), a classe não escolhe mais a aventura inteira — o
    // gancho vive só como hookSeed do motor (buildAdventureProfile), via US-148. US-217:
    // no ramo `dto.preset`, é o gancho INTEIRO que vira a aventura, de novo (ver abaixo).
    // US-105: a chave vai para o lookup (kit); o rótulo, para todo texto que uma
    // pessoa lê — mensagem de erro e prompt do Mestre.
    const className = catalogLabel(config.classes, character.class)
    const raceName = catalogLabel(config.races, character.race)

    const rawHook = resolveInitialHook(config, character.class)
    if (!rawHook) throw new BadRequestException('O sistema deste personagem não tem aventuras iniciais configuradas')

    const attrs = character.baseAttributes as Record<string, number>
    const conMod = Math.floor(((attrs['constitution'] ?? 10) - 10) / 2)
    // US-227: PV e bônus de proficiência derivam de classe+nível — antes fórmula fixa (10 +
    // conMod, +2) idêntica pra qualquer classe/nível. `hitDice` vem do mesmo lookup que
    // savingThrows/skillProficiencies já usam (US-222/US-224); `character.level` ausente
    // (artefato pré-migração, hipótese: nenhum existe já que a coluna sempre teve
    // `@default(1)`) cai no nível 1, mesmo fallback de sempre.
    const hitDice = config.classes?.find((c) => c.key === character.class)?.hitDice
    const maxHp = maxHpForLevel(hitDice, character.level ?? 1, conMod)
    const proficiencyBonus = proficiencyBonusForLevel(character.level ?? 1)

    // Inventário inicial calculado uma vez: alimenta o CharacterState e o system
    // prompt da geração de abertura (o DM precisa saber o que a personagem carrega).
    // US-226: `equipmentChoices` é a escolha gravada na criação (índice por slot de
    // `startingEquipmentChoices.choices`) — mesmo momento de materialização de sempre, agora
    // resolvendo a alternativa ESCOLHIDA em vez de sempre a opção A.
    const startingInventory = getStartingInventory(config, character.class, (character.equipmentChoices ?? []) as number[])

    // US-128: equipamento da origem escolhida + memento, somados ao kit da classe — mesmo
    // momento de materialização, mesma lista que vai para `CharacterState.inventory`. Nome do
    // memento é o RÓTULO FIXO (`MEMENTO_ITEM_LABEL`), nunca o texto completo escolhido no
    // wizard — esse continua só em `Character.origin.memento`, lido pela aba Background.
    const origin = (character.origin ?? {}) as { key?: string; connection?: string; memento?: string }
    const originItems: InventoryItem[] = [
      ...getBackgroundEquipment(config, origin.key ?? '').map((item) => ({ ...item, origin: 'equipment' as const })),
      ...(origin.memento ? [{ name: MEMENTO_ITEM_LABEL[locale], qty: 1, origin: 'memento' as const }] : []),
    ]
    // Traço "Tool Proficiency" do anão: a ferramenta escolhida (Character.raceToolChoice) vira
    // item físico do kit também, não só proficiência — mesma materialização de originItems acima.
    const raceItems = getRaceToolEquipment(config, character.race, character.raceToolChoice ?? undefined)
      .map((item) => ({ ...item, origin: 'equipment' as const }))
    const fullInventory = [...startingInventory, ...originItems, ...raceItems]

    // US-153: order calculado ANTES da transação — a geração (`generateSlice`/`generateGatedRest`) roda fora do
    // lock (LLM é lento, mesma disciplina de generateOpeningNarration abaixo) e precisa
    // do valor pronto; a transação recebe este MESMO `order`, não recalcula.
    const order = (await this.prisma.adventureParticipant.count({ where: { characterId } })) + 1

    // Abertura gerada pelo MESMO DM (US-34), FORA da transação (LLM é lento e não deve
    // segurar locks) — usado pelos DOIS ramos (US-217): a abertura continua escrita na
    // hora pela IA mesmo no ramo "pronta", só o motor de MUNDO (premissa/locais/NPCs/
    // segredos/antagonista/fecho) some. Falha/vazio → cai no texto estático do gancho.
    const labelPairs = (config.attributes ?? []).map((a) => [a.key, a.label] as const)
    // Perícias com modificador para a abertura (US-27): o DM já conhece as competências desde a 1ª cena.
    // US-227: bônus de proficiência por nível (antes config.proficiency?.bonus ?? 2, fixo).
    const skills = config.skills
      ? buildSkillSheet(config.skills, attrs, (character.skills ?? []) as string[], proficiencyBonus)
        .map(({ label, modifier, proficient }) => ({ label, modifier, proficient }))
      : undefined
    const features = resolveSheetEntries(config.classFeatures, config.retiredFeatures, character.class, (character.features ?? []) as string[])
    const knownSpells = resolveSheetEntries(config.classSpells, config.retiredSpells, character.class, (character.spells ?? []) as string[])

    // US-217: ramo "Aventura pronta" (US-216) — pula o motor de MUNDO inteiro, de volta ao
    // gancho fixo por classe que a US-28 usava antes de a US-153 existir. A ABERTURA
    // continua gerada pelo mesmo DM (US-34) logo abaixo — só premissa/locais/NPCs/
    // segredos/antagonista/fecho somem. `generatedAdventure`/`entities`/`Quest.objective`/
    // `conclusionHint` ficam ausentes — o mesmo caminho "Free/legado" que `ai.service.ts`
    // já trata de graça (US-199, ver `ai.service.ts` §isAntagonistRevealed/tone-setting-areaType),
    // não um caso novo. `tone`/`setting`/`areaType`/`challenge` do dto são ignorados aqui —
    // o ramo "pronta" nunca passou por Cenário/Tom/Área/Desafio (US-216).
    if (dto.preset) {
      const vars = { characterName: character.name, characterClass: className }
      const title = resolveHookTemplate(rawHook.title, vars)
      const questTitle = resolveHookTemplate(rawHook.primaryQuestTitle, vars)
      const questDescription = resolveHookTemplate(rawHook.primaryQuestDescription, vars)
      const hookOpening = resolveHookTemplate(rawHook.openingNarration, vars)

      // US-257: introdução roda em PARALELO à abertura (mesmo padrão de Promise.all da
      // US-168) — `generateOpeningNarration` recebe EXATAMENTE os mesmos parâmetros de antes.
      const [generatedOpening, generatedIntro] = await Promise.all([
        this.ai.generateOpeningNarration({
          systemName: system.name,
          characterName: character.name,
          characterGender: character.gender,
          characterClass: className,
          characterRace: raceName,
          mainQuest: `${questTitle}\n${questDescription}`,
          inventory: fullInventory.map((i) => (i.qty > 1 ? `${i.name} (${i.qty})` : i.name)),
          sheet: { level: character.level, hp: maxHp, maxHp, attributes: attrs, conditions: [], skills },
          hookSeed: hookOpening,
          attributeLabels: Object.fromEntries(labelPairs),
          background: (character.background ?? {}) as unknown as CharacterBackground,
          features,
          spells: knownSpells.map((s) => ({ name: s.name, level: s.level })),
          locale,
          // Sem `tone`/`setting`/`areaType`/`entities`: não há registry nem ledger semeado
          // nesse ramo (não há motor gerado) — mesmas 4 ausências do caminho "Free/legado".
        }),
        this.ai.generateIntroNarration({
          systemName: system.name,
          characterName: character.name,
          characterGender: character.gender,
          characterClass: className,
          characterRace: raceName,
          mainQuest: `${questTitle}\n${questDescription}`,
          sheet: { level: character.level, hp: maxHp, maxHp, attributes: attrs, conditions: [], skills },
          hookSeed: hookOpening,
          attributeLabels: Object.fromEntries(labelPairs),
          background: (character.background ?? {}) as unknown as CharacterBackground,
          features,
          spells: knownSpells.map((s) => ({ name: s.name, level: s.level })),
          origin,
          backgrounds: config.backgrounds,
          locale,
        }),
      ])
      const openingText = generatedOpening ?? hookOpening

      // US-35: mesma extração de cena do ramo gerado — o turno 1 do ramo "pronta" merece
      // a mesma âncora de continuidade. Falha/vazio → nulo, nunca derruba a criação.
      const scenePatch = await this.ai.extractOpeningScene(
        openingText,
        fullInventory.map((i) => i.name),
      )
      const sceneState = scenePatch ? mergeSceneState(null, scenePatch) : null

      return this.prisma.$transaction(async (tx) => {
        // Fecha a aventura ativa anterior do personagem (continuidade sequencial, ver ADR 002)
        await tx.adventure.updateMany({
          where: { status: { in: IN_PROGRESS_ADVENTURE_STATUSES }, participants: { some: { characterId } } },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })

        const adventure = await tx.adventure.create({
          data: { systemId: character.systemId, creatorId: character.userId, title, order },
        })

        await tx.adventureParticipant.create({ data: { adventureId: adventure.id, characterId } })

        await tx.characterState.create({
          data: {
            characterId,
            adventureId: adventure.id,
            hp: maxHp,
            maxHp,
            attributes: character.baseAttributes as object,
            inventory: fullInventory as unknown as object,
            ...(sceneState ? { sceneState: sceneState as unknown as object } : {}),
          },
        })

        await tx.quest.create({
          data: { adventureId: adventure.id, title: questTitle, description: questDescription, isPrimary: true },
        })

        // US-257: `createdAt` explícito quando a introdução existe — `now()` do Postgres é
        // fixo por TRANSAÇÃO (não por statement), então duas `create` na mesma `$transaction`
        // empatariam sem isto, quebrando a ordem (`orderBy: createdAt`) entre intro e cena.
        if (generatedIntro) {
          const introAt = new Date()
          await tx.eventLog.create({
            data: { adventureId: adventure.id, characterId, type: 'INTRODUCTION', payload: { text: generatedIntro }, createdAt: introAt },
          })
          await tx.eventLog.create({
            data: { adventureId: adventure.id, characterId, type: 'NARRATION', payload: { text: openingText }, createdAt: new Date(introAt.getTime() + 1) },
          })
        } else {
          await tx.eventLog.create({
            data: { adventureId: adventure.id, characterId, type: 'NARRATION', payload: { text: openingText } },
          })
        }

        return adventure
      })
    }

    const profile = this.buildAdventureProfile(character, config, dto.challenge ?? 'adventure')
    const registryOverrides: AdventureRegistryOverrides = {
      tone: dto.tone ? this.validateCatalogKey(config.tones, dto.tone, 'Tom') : undefined,
      setting: dto.setting ? this.validateCatalogKey(config.settings, dto.setting, 'Cenário') : undefined,
      areaType: dto.areaType ? this.validateCatalogKey(config.areaTypes, dto.areaType, 'Tipo de Área') : undefined,
    }

    // US-235: Adventure/AdventureParticipant/CharacterState nascem AQUI, síncronos — tudo
    // que os alimenta já estava calculado ANTES da chamada de IA (só moveu pra cima). O
    // `id` criado agora é o identificador que a tela de espera consulta; o motor (gate +
    // abertura) roda em background (`runAdventureGeneration`, sem `await`) e termina a
    // linha depois, em ACTIVE (sucesso) ou FAILED (teto do gate estourado, US-234).
    const placeholderTitle = resolveHookTemplate(GENERATING_ADVENTURE_TITLE[locale], { characterName: character.name, characterClass: className })
    const adventure = await this.prisma.$transaction(async (tx) => {
      // Fecha a aventura ativa anterior do personagem (continuidade sequencial, ver ADR 002)
      await tx.adventure.updateMany({
        where: { status: { in: IN_PROGRESS_ADVENTURE_STATUSES }, participants: { some: { characterId } } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })

      const created = await tx.adventure.create({
        data: { systemId: character.systemId, creatorId: character.userId, title: placeholderTitle, order, status: 'GENERATING' },
      })

      await tx.adventureParticipant.create({ data: { adventureId: created.id, characterId } })

      await tx.characterState.create({
        data: {
          characterId,
          adventureId: created.id,
          hp: maxHp,
          maxHp,
          attributes: character.baseAttributes as object,
          inventory: fullInventory as unknown as object,
        },
      })

      return created
    })

    const opening: AdventureOpeningContext = {
      systemName: system.name,
      characterName: character.name,
      characterGender: character.gender,
      className,
      raceName,
      level: character.level,
      maxHp,
      attrs,
      skills,
      attributeLabels: Object.fromEntries(labelPairs),
      background: (character.background ?? {}) as unknown as CharacterBackground,
      features,
      knownSpells,
      fullInventory,
      hookSeed: profile.hookSeed,
      locale,
      origin,
      backgrounds: config.backgrounds,
    }

    void this.runAdventureGeneration(adventure.id, characterId, profile, order, locale, config, registryOverrides, opening)

    return adventure
  }

  /**
   * US-235: promise solta do controller/`createForCharacter`. US-256: o motor (1A → narração ∥ 1B →
   * junção) vive em `AdventureGenerationService.run`; este método fino existe porque os testes (e
   * `createForCharacter`) disparam o job por aqui e o espionam pelo nome.
   */
  runAdventureGeneration(...args: Parameters<AdventureGenerationService['run']>): Promise<void> {
    return this.generation.run(...args)
  }

  /**
   * US-256 (Questão #4): "tentar de novo" da 1B depois da liberação — ver
   * `AdventureGenerationService.retryRest`. `assertOwner` (controller) já garantiu a posse do personagem.
   */
  retryAdventureRest(characterId: string, adventureId: string): Promise<{ status: string }> {
    return this.generation.retryRest(characterId, adventureId)
  }

  /**
   * US-235: consultado pela tela de espera — `adventureId` tem de pertencer a ESTE
   * `characterId` (mesma disciplina de `getExportData`), senão vazaria o estado de
   * geração de outro personagem. `error` só viaja quando FAILED; nunca mostrado ao
   * jogador (texto interno/não localizado) — o cliente decide só com base em `status`.
   */
  async getGenerationStatus(characterId: string, adventureId: string): Promise<{ status: string; error?: string }> {
    const adventure = await this.prisma.adventure.findFirst({
      where: { id: adventureId, participants: { some: { characterId } } },
      select: { status: true, generationError: true },
    })
    if (!adventure) throw new NotFoundException(`Aventura ${adventureId} não encontrada para este personagem`)
    return { status: adventure.status, ...(adventure.generationError ? { error: adventure.generationError } : {}) }
  }

  /**
   * Histórico visível ao jogador (US-18): turnos ACTION/NARRATION/DICE_ROLL em
   * ordem cronológica, mapeados para o formato do chat. Inclui os já
   * `summarized` — a condensação da memória não deve apagar a conversa da tela.
   */
  async getTurns(characterId: string, adventureId: string): Promise<ChatTurn[]> {
    // US-67: inclui CHARACTER_UPDATE (não renderizado) só para decidir a
    // editabilidade do último turno — ele não é editável se mutou o estado.
    // US-257: INTRODUCTION vira uma bolha do Mestre a mais, antes da cena de abertura.
    const logs = await this.prisma.eventLog.findMany({
      where: { adventureId, characterId, type: { in: ['ACTION', 'NARRATION', 'DICE_ROLL', 'CHARACTER_UPDATE', 'INTRODUCTION'] } },
      orderBy: { createdAt: 'asc' },
    })

    const turns = logs
      .filter((log) => log.type !== 'CHARACTER_UPDATE')
      .map((log): ChatTurn => {
        if (log.type === 'DICE_ROLL') {
          // US-29: bloco de rolagem. O número vem do payload do Game Server, nunca da prosa.
          const p = log.payload as { formula: string; reason: string; skillLabel?: string; rolls: number[]; modifier: number; total: number }
          return { role: 'roll', label: p.reason, skill: p.skillLabel, formula: p.formula, rolls: p.rolls, modifier: p.modifier, total: p.total }
        }
        // US-29: sanea narrações no replay — linhas persistidas antes do saneador
        // no persist ainda podem conter número inventado.
        const content = stripFabricatedRolls((log.payload as { text?: string }).text ?? '').clean
        return { role: log.type === 'NARRATION' || log.type === 'INTRODUCTION' ? 'dm' : 'user', content }
      })
      .filter((m) => m.role === 'roll' || m.content.trim().length > 0)

    // US-38: o evento DICE_ROLL é gravado DURANTE o streaming, mas ACTION/NARRATION
    // no onFinish (depois) — então por createdAt a rolagem vem ANTES da ação do
    // turno. Ao vivo a ordem está certa (ação → bloco → narração); só o replay
    // fica torto. Reordenamos: cada rolagem sai LOGO APÓS a ação a que pertence.
    // Padrão de um turno na timeline: [rolls..., ACTION, NARRATION].
    const ordered: ChatTurn[] = []
    let pendingRolls: ChatTurn[] = []
    for (const turn of turns) {
      if (turn.role === 'roll') { pendingRolls.push(turn); continue }
      if (turn.role === 'user') {
        ordered.push(turn, ...pendingRolls) // ação, depois as rolagens dela
      } else {
        ordered.push(...pendingRolls, turn) // narração após eventuais rolagens órfãs
      }
      pendingRolls = []
    }
    ordered.push(...pendingRolls) // rolagens sem ação seguinte (turno que falhou)

    // US-67: marca a ÚLTIMA ação do jogador como editável quando o turno pode ser
    // reescrito: existe, não foi resumido e não mutou o estado (nenhum
    // CHARACTER_UPDATE depois da narração anterior). Mesmo critério do guard do
    // endpoint (clearLastTurnForEdit); a UI usa isto para exibir o botão de editar.
    const lastActionIdx = logs.map((l) => l.type).lastIndexOf('ACTION')
    if (lastActionIdx !== -1 && !logs[lastActionIdx]!.summarized) {
      let prevNarrationIdx = -1
      for (let i = lastActionIdx - 1; i >= 0; i--) {
        if (logs[i]!.type === 'NARRATION') { prevNarrationIdx = i; break }
      }
      const mutated = logs.slice(prevNarrationIdx + 1).some((l) => l.type === 'CHARACTER_UPDATE')
      if (!mutated) {
        const lastUserIdx = ordered.map((t) => t.role).lastIndexOf('user')
        const t = ordered[lastUserIdx]
        if (t && t.role === 'user') ordered[lastUserIdx] = { ...t, editable: true }
      }
    }

    return ordered
  }

  /**
   * US-202: as seis fontes do export (Modelo de dados da US), no formato que
   * `buildAdventureExportView` consome — somente leitura, nenhum `create`/`update`/
   * `delete`/`upsert` no caminho. `adventureId` tem de pertencer a ESTE `characterId`
   * (via `participants`), não só existir — `assertCharacterOwner` (chamado pelo
   * controller antes desta função) já confirmou que o personagem pertence ao
   * utilizador, mas não que a aventura pertence a ele; sem isso um `adventureId` de
   * outro personagem vazaria o material dele. Inexistente ou de outro personagem: 404
   * (mesmo comportamento da rota de turnos, mesmo `assertOwner`).
   */
  async getExportData(characterId: string, adventureId: string): Promise<AdventureExportData> {
    const adventureRow = await this.prisma.adventure.findFirst({
      where: { id: adventureId, participants: { some: { characterId } } },
      select: { id: true, title: true, order: true, status: true, createdAt: true, memorySummary: true, entities: true, generatedAdventure: true, systemId: true },
    })
    if (!adventureRow) throw new NotFoundException(`Aventura ${adventureId} não encontrada para este personagem`)

    const [quests, characterRow, characterState, eventLogs, system] = await Promise.all([
      this.prisma.quest.findMany({
        where: { adventureId },
        select: { title: true, description: true, status: true, isPrimary: true, objective: true },
      }),
      this.prisma.character.findUniqueOrThrow({
        where: { id: characterId },
        select: { name: true, race: true, class: true, level: true, background: true, origin: true, user: { select: { locale: true } } },
      }),
      this.prisma.characterState.findUnique({
        where: { characterId_adventureId: { characterId, adventureId } },
        select: { hp: true, maxHp: true, inventory: true, conditions: true, sceneState: true },
      }),
      this.prisma.eventLog.findMany({
        where: { adventureId },
        orderBy: { createdAt: 'asc' },
        select: { type: true, payload: true, summarized: true, createdAt: true },
      }),
      getSystemCached(this.prisma, adventureRow.systemId),
    ])

    return {
      adventure: {
        id: adventureRow.id,
        title: adventureRow.title,
        order: adventureRow.order,
        status: adventureRow.status,
        createdAt: adventureRow.createdAt,
        memorySummary: adventureRow.memorySummary,
        entities: adventureRow.entities,
        generatedAdventure: adventureRow.generatedAdventure,
      },
      quests,
      character: {
        name: characterRow.name,
        race: characterRow.race,
        class: characterRow.class,
        level: characterRow.level,
        background: characterRow.background,
        origin: characterRow.origin,
        // US-202 Modelo de dados, redação: `User.email`/`User.name` nunca entram no dump —
        // só o locale (necessário pra `AdventureExportCharacter.locale`) atravessa a relação.
        locale: resolveLocale(characterRow.user?.locale),
      },
      characterState,
      eventLogs,
      system: { id: system.id, name: system.name, version: system.version, sourceType: system.sourceType },
    }
  }
}
