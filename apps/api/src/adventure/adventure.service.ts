import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { SystemConfigSchema, GeneratedAdventureSchema, buildSkillSheet, catalogLabel, resolveLocale, resolveSheetEntries, stripFabricatedRolls, getStartingInventory, getBackgroundEquipment, MEMENTO_ITEM_LABEL, type InitialAdventureHook, type ChatTurn, type InventoryItem, type SystemConfig, type AdventureEncounter, type GeneratedAdventure } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'
import { configForLocale } from '../system/system-locale'
import { AiService } from '../ai/ai.service'
import { mergeSceneState, resolveAdventuresAndAdvancement, type CharacterBackground, type OriginNarrative } from '@ai-dm/ai-engine'
import { resolveInitialHook, resolveHookTemplate } from '../character/starting-inventory'
import { rollAdventure } from '../adventure-generation/roll-adventure'
import { composeEncounterRoles, buildEncounterNpcs } from '../adventure-generation/monster-roles'
import { readSecretPrompts } from '../adventure-generation/lgmrd-tables'
import type { AdventureRegistryOverrides } from '../adventure-generation/roll-registry'
import { generateWithGate, type GateResult } from '../adventure-generation/adventure-gate'
import { seedLedgerFromGeneratedAdventure } from '../adventure-generation/seed-ledger'

export interface CreateAdventureDto {
  // initialHookId REMOVIDO (US-153): a aventura é sempre gerada, não escolhida pelo cliente.
  setting?: string // US-156: chave do catálogo, ou ausente = sorteado pelo seed
  tone?: string
  areaType?: string
}

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
}

@Injectable()
export class AdventureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /**
   * Cria a aventura do personagem, liga-o como participante e gera o
   * CharacterState inicial — tudo numa transação (cobre o caso single-player
   * numa única chamada, ver US-22). `systemId`/`creatorId` vêm do próprio
   * personagem, então a invariante "mesmo sistema" vale por construção.
   */
  /**
   * Aventura inicial resolvida para o personagem (US-28), com placeholders já
   * aplicados. Alimenta a etapa "Aventura inicial" da UI antes de iniciar.
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

  async getInitialAdventure(characterId: string): Promise<InitialAdventureHook> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { system: true, user: { select: { locale: true } } },
    })
    if (!character) throw new NotFoundException(`Personagem ${characterId} não encontrado`)

    // US-99: os ganchos são iguais nos dois artefatos hoje (seguem em PT, ver US-101),
    // mas o config sai pelo locale como em todo lugar — quando a US-101 os traduzir,
    // esta linha já está certa em vez de virar um bug silencioso.
    const config = SystemConfigSchema.parse(configForLocale(character.system, resolveLocale(character.user?.locale)))
    const hook = resolveInitialHook(config, character.class)
    if (!hook) throw new BadRequestException('O sistema deste personagem não tem aventuras iniciais configuradas')

    // US-105: `character.class` é a CHAVE; o placeholder {characterClass} é texto narrativo,
    // e leva o rótulo no locale do dono — nunca a chave crua.
    return this.resolveHook(hook, character.name, catalogLabel(config.classes, character.class))
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
  ): AdventureProfile {
    const origin = (character.origin ?? {}) as { key?: string; connection?: string; memento?: string }
    const rawHook = resolveInitialHook(config, character.class)
    const className = catalogLabel(config.classes, character.class)
    const hookSeed = rawHook ? this.resolveHook(rawHook, character.name, className).openingNarration : ''

    return {
      level: character.level,
      classKey: character.class,
      background: (character.background ?? {}) as CharacterBackground,
      origin: {
        adventuresAndAdvancement: resolveAdventuresAndAdvancement(config.backgrounds, origin.key),
        connection: origin.connection,
        memento: origin.memento,
      },
      hookSeed,
    }
  }

  /**
   * US-164: orquestrador do motor — executa os passos 1-6 da *Ordem de geração*
   * (backlog do motor de aventuras) e devolve um `GeneratedAdventure` que passa em
   * `.parse()` (só FORMA; grafo fechar/orçamento continuam sendo o gate da US-150).
   * `encounters` tem sempre um elemento (`encounter-1`, mintado no código, nunca pelo
   * modelo) cujo `locationId` é `locations[0]` (Questão em aberto #1, resolvida) e cujos
   * `npcIds` vêm de `composeEncounterRoles`/`buildEncounterNpcs` (US-152/US-160) — os
   * NPCs de combate entram também em `npcs[]` (referência real, não solta).
   *
   * `attempt` (US-150): default `0`, repassado a `rollAdventure` — o gate que envolve esta
   * função incrementa a cada reseed, pra rolar registro/conteúdo NOVOS, não reamostrar em cima
   * do mesmo material (ver adventure-gate.ts).
   */
  async generateAdventure(
    profile: AdventureProfile,
    characterId: string,
    order: number,
    registryOverrides: AdventureRegistryOverrides = {},
    attempt = 0,
  ): Promise<GeneratedAdventure> {
    const { registry, content } = rollAdventure(characterId, order, registryOverrides, attempt)

    const { locations, npcs } = await this.ai.generateLocationsAndNpcs({
      rolled: content,
      registry,
      background: profile.background,
      hookSeed: profile.hookSeed,
    })

    const secrets = await this.ai.generateSecrets({
      locations,
      npcs,
      secretPrompts: readSecretPrompts(),
      background: profile.background,
      origin: profile.origin,
      hookSeed: profile.hookSeed,
    })

    const encounterNpcs = buildEncounterNpcs(composeEncounterRoles(profile.level), npcs)
    const allNpcs = [...npcs, ...encounterNpcs]
    const encounters: AdventureEncounter[] = [
      { id: 'encounter-1', locationId: locations[0]!.id, npcIds: encounterNpcs.map((npc) => npc.id) },
    ]

    const { conclusion, followUps } = await this.ai.generateClosing({
      locations,
      npcs: allNpcs,
      secrets,
      registry,
      complicacao: content.complicacao,
      hookSeed: profile.hookSeed,
      premissa: content.premissa,
    })

    return GeneratedAdventureSchema.parse({
      id: `${characterId}:${order}`,
      levelRange: { min: profile.level, max: profile.level },
      setting: registry.setting,
      tone: registry.tone,
      areaType: registry.areaType,
      summary: content.premissa,
      npcs: allNpcs,
      secrets,
      locations,
      encounters,
      start: profile.hookSeed,
      conclusion,
      followUps,
    })
  }

  /**
   * US-150: gate antes de persistir — envolve `generateAdventure` com as três verificações
   * mecânicas (parse, grafo fecha, orçamento do encontro) e o reseed correto por verificação
   * (ver adventure-gate.ts). Não lança: devolve `GateResult`, quem chama decide o que fazer
   * com `ok: false` (nenhum consumidor de persistência ainda — fora do escopo desta story).
   */
  async generateGatedAdventure(
    profile: AdventureProfile,
    characterId: string,
    order: number,
    registryOverrides: AdventureRegistryOverrides = {},
    maxAttempts = 3,
  ): Promise<GateResult> {
    return generateWithGate(
      (attempt) => this.generateAdventure(profile, characterId, order, registryOverrides, attempt),
      maxAttempts,
    )
  }

  async createForCharacter(characterId: string, dto: CreateAdventureDto) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      // US-97: `user.locale` decide o idioma da primeira cena — é o único texto que
      // nasce antes de o jogador escrever qualquer coisa (não há o que espelhar).
      include: { system: true, user: { select: { locale: true } } },
    })
    if (!character) throw new NotFoundException(`Personagem ${characterId} não encontrado`)

    // US-128: um só resolveLocale — reusado no config, na abertura gerada e no rótulo do
    // item de memento (`MEMENTO_ITEM_LABEL`), em vez de recalcular a mesma coisa 3 vezes.
    const locale = resolveLocale(character.user?.locale)
    const config = SystemConfigSchema.parse(configForLocale(character.system, locale))

    // US-153: a classe não escolhe mais a aventura inteira — o gancho continua vivo só
    // como hookSeed do motor de geração (buildAdventureProfile), via US-148.
    // US-105: a chave vai para o lookup (kit); o rótulo, para todo texto que uma
    // pessoa lê — mensagem de erro e prompt do Mestre.
    const className = catalogLabel(config.classes, character.class)
    const raceName = catalogLabel(config.races, character.race)

    const rawHook = resolveInitialHook(config, character.class)
    if (!rawHook) throw new BadRequestException('O sistema deste personagem não tem aventuras iniciais configuradas')

    const attrs = character.baseAttributes as Record<string, number>
    const conMod = Math.floor(((attrs['constitution'] ?? 10) - 10) / 2)
    const maxHp = 10 + conMod

    // Inventário inicial calculado uma vez: alimenta o CharacterState e o system
    // prompt da geração de abertura (o DM precisa saber o que a personagem carrega).
    const startingInventory = getStartingInventory(config, character.class)

    // US-128: equipamento da origem escolhida + memento, somados ao kit da classe — mesmo
    // momento de materialização, mesma lista que vai para `CharacterState.inventory`. Nome do
    // memento é o RÓTULO FIXO (`MEMENTO_ITEM_LABEL`), nunca o texto completo escolhido no
    // wizard — esse continua só em `Character.origin.memento`, lido pela aba Background.
    const origin = (character.origin ?? {}) as { key?: string; connection?: string; memento?: string }
    const originItems: InventoryItem[] = [
      ...getBackgroundEquipment(config, origin.key ?? '').map((item) => ({ ...item, origin: 'equipment' as const })),
      ...(origin.memento ? [{ name: MEMENTO_ITEM_LABEL[locale], qty: 1, origin: 'memento' as const }] : []),
    ]
    const fullInventory = [...startingInventory, ...originItems]

    // US-153: order calculado ANTES da transação — generateGatedAdventure roda fora do
    // lock (LLM é lento, mesma disciplina de generateOpeningNarration abaixo) e precisa
    // do valor pronto; a transação recebe este MESMO `order`, não recalcula.
    const order = (await this.prisma.adventureParticipant.count({ where: { characterId } })) + 1
    const profile = this.buildAdventureProfile(character, config)

    // US-153: motor de geração (US-164) substitui o catálogo fixo por classe (US-28) — o
    // gancho (`profile.hookSeed`) só ancora a abertura, não decide mais locais/NPCs/segredos/
    // quest. Gate (US-150) antes de persistir; teto de tentativas esgotado → sem fallback
    // estático (ao contrário de generateOpeningNarration, não existe aventura fixa pra cair).
    const gateResult = await this.generateGatedAdventure(profile, characterId, order, {
      setting: dto.setting,
      tone: dto.tone,
      areaType: dto.areaType,
    })
    if (!gateResult.ok) throw new Error(gateResult.reason)
    const generated = gateResult.adventure
    const mainQuest = `${generated.summary}\n${generated.start}`
    // US-151: ledger semeado do artefato JÁ VALIDADO — substitui `extractOpeningEntities`
    // (extração por LLM da prosa) como fonte, agora que a aventura sempre vem do motor
    // (US-153). Síncrono: não entra no Promise.all abaixo, que é só para chamadas de LLM.
    const seededEntities = seedLedgerFromGeneratedAdventure(generated)

    // Abertura gerada pelo MESMO DM (US-34), FORA da transação (LLM é lento e não
    // deve segurar locks). Falha/vazio → cai no hookSeed estático do perfil.
    const labelPairs = (config.attributes ?? []).map((a) => [a.key, a.label] as const)
    // Perícias com modificador para a abertura (US-27): o DM já conhece as competências desde a 1ª cena.
    const skills = config.skills
      ? buildSkillSheet(config.skills, attrs, (character.skills ?? []) as string[], config.proficiency?.bonus ?? 2)
        .map(({ label, modifier, proficient }) => ({ label, modifier, proficient }))
      : undefined
    const features = resolveSheetEntries(config.classFeatures, config.retiredFeatures, character.class, (character.features ?? []) as string[])
    const knownSpells = resolveSheetEntries(config.classSpells, config.retiredSpells, character.class, (character.spells ?? []) as string[])
    const generatedOpening = await this.ai.generateOpeningNarration({
      systemName: character.system.name,
      characterName: character.name,
      characterGender: character.gender,
      characterClass: className,
      characterRace: raceName,
      mainQuest,
      inventory: fullInventory.map((i) => (i.qty > 1 ? `${i.name} (${i.qty})` : i.name)),
      sheet: { level: character.level, hp: maxHp, maxHp, attributes: attrs, conditions: [], skills },
      hookSeed: profile.hookSeed,
      attributeLabels: Object.fromEntries(labelPairs),
      background: (character.background ?? {}) as unknown as CharacterBackground,
      // US-41: features de classe do kit (o DM já as conhece na 1ª cena). US-100: a ficha guarda
      // a chave; o texto sai do `config` — que aqui já é o do locale do dono (`configForLocale`).
      features,
      // US-42: magias conhecidas — só os nomes vão ao prompt (descrição via getSpell nos turnos).
      spells: knownSpells.map((s) => ({ name: s.name, level: s.level })),
      locale,
    })
    // US-101: o fallback estático já sai no idioma certo — `profile.hookSeed` veio do
    // `config` do locale (linha 85), e o gancho passou a ter versão por idioma. Antes ele
    // era o único PT que sobrava numa mesa em inglês, e só aparecia quando a geração falhava.
    const openingText = generatedOpening ?? profile.hookSeed

    // US-35: extrai a cena estruturada da abertura ANTES da transação (é LLM). Sem
    // isto o `sceneState` nasce nulo e o turno 1 fica sem âncora de continuidade
    // (a abertura roda sem tools, nunca chama `updateScene`). Falha/vazio → nulo,
    // idêntico ao comportamento pré-US-35; nunca derruba a criação.
    const scenePatch = await this.ai.extractOpeningScene(
      openingText,
      fullInventory.map((i) => i.name),
    )
    const sceneState = scenePatch ? mergeSceneState(null, scenePatch) : null

    return this.prisma.$transaction(async (tx) => {
      // Fecha a aventura ativa anterior do personagem (continuidade sequencial, ver ADR 002)
      await tx.adventure.updateMany({
        where: { status: 'ACTIVE', participants: { some: { characterId } } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })

      const adventure = await tx.adventure.create({
        // US-151: ledger semeado do artefato gerado. Vazio → coluna ausente (default do Prisma).
        data: {
          systemId: character.systemId,
          creatorId: character.userId,
          title: generated.summary,
          order,
          ...(seededEntities.length > 0 ? { entities: seededEntities as unknown as object } : {}),
        },
      })

      await tx.adventureParticipant.create({
        data: { adventureId: adventure.id, characterId },
      })

      await tx.characterState.create({
        data: {
          characterId,
          adventureId: adventure.id,
          hp: maxHp,
          maxHp,
          attributes: character.baseAttributes as object,
          inventory: fullInventory as unknown as object,
          // US-35: cena extraída da abertura. Nulo → coluna ausente (como antes).
          ...(sceneState ? { sceneState: sceneState as unknown as object } : {}),
        },
      })

      // US-153: quest principal derivada do artefato gerado (não mais do gancho fixo por
      // classe) — dá objetivo ao DM (ver AiService). `conclusion` fica de fora de propósito
      // (vazaria o desfecho antes do jogo começar, ver US-153 Questões em aberto #4).
      await tx.quest.create({
        data: {
          adventureId: adventure.id,
          title: generated.summary,
          description: generated.start,
          isPrimary: true,
        },
      })

      // Primeira narração persistida: aparece como mensagem do Mestre (getTurns)
      // e entra na janela de contexto do DM (historyLogs, summarized: false).
      await tx.eventLog.create({
        data: {
          adventureId: adventure.id,
          characterId,
          type: 'NARRATION',
          payload: { text: openingText },
        },
      })

      return adventure
    })
  }

  /**
   * Histórico visível ao jogador (US-18): turnos ACTION/NARRATION/DICE_ROLL em
   * ordem cronológica, mapeados para o formato do chat. Inclui os já
   * `summarized` — a condensação da memória não deve apagar a conversa da tela.
   */
  async getTurns(characterId: string, adventureId: string): Promise<ChatTurn[]> {
    // US-67: inclui CHARACTER_UPDATE (não renderizado) só para decidir a
    // editabilidade do último turno — ele não é editável se mutou o estado.
    const logs = await this.prisma.eventLog.findMany({
      where: { adventureId, characterId, type: { in: ['ACTION', 'NARRATION', 'DICE_ROLL', 'CHARACTER_UPDATE'] } },
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
        return { role: log.type === 'NARRATION' ? 'dm' : 'user', content }
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
}
