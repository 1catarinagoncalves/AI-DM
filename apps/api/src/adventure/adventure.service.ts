import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { SystemConfigSchema, GeneratedAdventureSchema, buildSkillSheet, catalogLabel, resolveLocale, resolveSheetEntries, stripFabricatedRolls, getStartingInventory, getBackgroundEquipment, getRaceToolEquipment, MEMENTO_ITEM_LABEL, maxHpForLevel, proficiencyBonusForLevel, type InitialAdventureHook, type ChatTurn, type InventoryItem, type SystemConfig, type AdventureChallenge, type AdventureEncounter, type AdventureLocation, type AdventureNpc, type GeneratedAdventure, type Locale } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'
import { configForLocale, getSystemCached } from '../system/system-locale'
import { AiService } from '../ai/ai.service'
import { mergeSceneState, resolveAdventuresAndAdvancement, type CharacterBackground, type ClassFeature, type KnownSpell, type OriginNarrative } from '@ai-dm/ai-engine'
import { resolveInitialHook, resolveHookTemplate } from '../character/starting-inventory'
import { assignBudgetedCombatRoles, type EncounterChallenge } from '../adventure-generation/monster-roles'
import { rollRegistry, rollFactionCount, rollNamingRegister, type AdventureRegistryOverrides } from '../adventure-generation/roll-registry'
import { rollQuestSeed } from '../adventure-generation/roll-quest-seed'
import { generateWithGate, type GateResult } from '../adventure-generation/adventure-gate'
import { seedLedgerFromGeneratedAdventure } from '../adventure-generation/seed-ledger'
import { writeAuthoringDump } from './adventure-authoring-dump'
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

// US-235: título placeholder da linha `GENERATING` — trocado por `generated.summary` no
// sucesso (finalizeGeneratedAdventure). Locale-aware como MEMENTO_ITEM_LABEL (starting-kit.ts).
const GENERATING_ADVENTURE_TITLE: Record<Locale, string> = {
  'pt-BR': 'Aventura de {characterName}',
  'en-US': "{characterName}'s Adventure",
}

/**
 * US-235: tudo que `finalizeGeneratedAdventure` precisa para a abertura (US-34) e para o
 * `CharacterState`/inventário, calculado ANTES do gatilho assíncrono em `createForCharacter`
 * — o job em background não refaz nenhuma dessas consultas.
 */
interface AdventureOpeningContext {
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

  /**
   * US-232: orquestrador do motor mundo-primeiro — UMA chamada de autoria (`generateAdventureAuthoring`,
   * escada `authoringModels`) + montagem determinística (minta ids dos índices que o modelo
   * emitiu) + backstop de local órfão. Substitui o encadeamento de 6 `generate*` (MA-1). Devolve
   * um `GeneratedAdventure` que passa em `.parse()` (só FORMA; grafo/orçamento seguem no gate US-150).
   *
   * Contagem de FACÇÕES sorteada [2,4] no Game Server (`rollFactionCount`) e passada como
   * restrição do prompt; locais/NPCs/desafios/encontros FIXOS nos defaults (têm dial, US-162/163
   * — vira a alavanca de variação depois, nunca dado). `registry` continua vindo de `rollRegistry`
   * inteiro (dimensão de filtro/eval); só os eixos com override viram RÓTULO pt-BR no prompt
   * ("Aleatório" = omitido). `config` novo (US-232): resolve o rótulo — `registryOverrides` só
   * carrega a CHAVE.
   *
   * `attempt` (US-150): default `0`, repassado a `rollRegistry`/`rollFactionCount` — o gate
   * re-semeia com attempt+1, rolando registro/contagem novos em vez de reamostrar o mesmo.
   */
  async generateAdventure(
    profile: AdventureProfile,
    characterId: string,
    order: number,
    locale: Locale,
    config: SystemConfig,
    registryOverrides: AdventureRegistryOverrides = {},
    attempt = 0,
  ): Promise<GeneratedAdventure> {
    const registry = rollRegistry(characterId, order, registryOverrides, attempt)
    const factionCount = rollFactionCount(characterId, order, attempt)
    const namingRegister = rollNamingRegister(characterId, order, attempt)
    const questSeed = rollQuestSeed(characterId, order, attempt)

    // Params de mundo → RÓTULO pt-BR só pros eixos que o jogador escolheu (têm override); os
    // demais são omitidos do prompt (modelo livre nesse eixo). O `registry` gravado no artefato
    // continua vindo de `rollRegistry` inteiro, sem mudança — só a linha de restrição do prompt
    // difere entre "veio do jogador" e "Aleatório".
    const world = {
      setting: registryOverrides.setting ? catalogLabel(config.settings, registryOverrides.setting) : undefined,
      tone: registryOverrides.tone ? catalogLabel(config.tones, registryOverrides.tone) : undefined,
      areaType: registryOverrides.areaType ? catalogLabel(config.areaTypes, registryOverrides.areaType) : undefined,
    }
    const counts = { locations: 6, npcs: 7, challenges: 3, encounters: 3 }

    const { adventure: authored, modelId } = await this.ai.generateAdventureAuthoring({
      world,
      factionCount,
      counts,
      // US-232: background como TOM — só `character.story`; bonds/deity/flaws ficam de fora.
      characterStory: profile.background.story,
      namingRegister,
      questSeed,
      level: profile.level,
      className: catalogLabel(config.classes, profile.classKey),
      locale,
    })

    // Minting: a saída BRUTA referencia por índice (0-based na array irmã) — o código minta os
    // ids reais aqui. Índice fora de faixa é filtrado (occupants/npcIndices) ou clampa pro
    // primeiro local (locationIndex obrigatório), mesma disciplina de `occupants` da US-158.
    const factions = authored.factions.map((f, i) => ({ id: `faction-${i + 1}`, name: f.name, kind: f.kind, want: f.want }))
    const factionId = (idx: number | undefined): string | undefined =>
      idx !== undefined && idx >= 0 && idx < factions.length ? factions[idx]!.id : undefined

    const npcs: AdventureNpc[] = authored.npcs.map((n, i) => ({
      id: `npc-${i + 1}`,
      name: n.name,
      role: n.role,
      want: n.want,
      ...(factionId(n.factionIndex) ? { factionId: factionId(n.factionIndex) } : {}),
    }))

    const locations: AdventureLocation[] = authored.locations.map((l, i) => ({
      id: `loc-${i + 1}`,
      title: l.title,
      aspects: l.aspects,
      boxedText: l.boxedText,
      description: l.description,
      occupants: l.occupants.filter((idx) => idx < npcs.length).map((idx) => npcs[idx]!.id),
      ...(factionId(l.factionIndex) ? { factionId: factionId(l.factionIndex) } : {}),
      vibe: l.vibe,
    }))
    // Índice fora de faixa aqui LANÇA (ao contrário de occupants/npcIndices acima, que são
    // "melhor esforço" e filtram): challenge/encounter/objective.locationId são campos ÚNICOS e
    // OBRIGATÓRIOS — um clamp silencioso pro local 0 corrompia o local do Final sem erro nenhum
    // (achado ao ler um artefato real: Final e objective foram parar no local errado porque o
    // modelo mirou um `anchors` que nunca virou `locations[]`). Lançar aqui vira falha de estágio
    // 'parse' no gate (US-234), que re-semeia a CHAMADA 1 em vez de persistir o local errado.
    const locationId = (idx: number): string => {
      if (idx < 0 || idx >= locations.length) {
        throw new Error(`locationIndex ${idx} fora de faixa — esperado 0..${locations.length - 1} (${locations.length} locais autorados)`)
      }
      return locations[idx]!.id
    }

    const challenges: AdventureChallenge[] = authored.challenges.map((c, i) => ({
      id: `challenge-${i + 1}`,
      locationId: locationId(c.locationIndex),
      test: c.test,
      situation: c.situation,
      consequence: c.consequence,
    }))

    const encounters: AdventureEncounter[] = authored.encounters.map((e, i) => ({
      id: `encounter-${i + 1}`,
      locationId: locationId(e.locationIndex),
      npcIds: e.npcIndices.filter((idx) => idx < npcs.length).map((idx) => npcs[idx]!.id),
      type: e.type,
      fiction: e.fiction,
      behaviors: e.behaviors,
      goal: e.goal,
      complications: e.complications,
      unlocks: e.unlocks,
    }))

    const objective = {
      description: authored.objective.description,
      reward: authored.objective.reward,
      locationId: locationId(authored.objective.locationIndex),
    }

    // US-232 (Dúvidas de implementação #9): backstop determinístico de local órfão. Todo local
    // fora do conjunto ancorado (encounter/challenge/objective.locationId + occupants não-vazio)
    // recebe 1 npcId em `occupants`, round-robin sobre NPCs ainda sem local (ou sobre todos, se
    // nenhum estiver livre). Garante `checkNoOrphanLocations` passando SEMPRE, sem depender do
    // regenerate do MA-4. NPC ocupar 2 locais não é problema: continuidade é rastreada no ledger
    // por revelado/nome (global por NPC, não por local, US-199).
    const anchoredLocationIds = new Set<string>([
      ...encounters.map((e) => e.locationId),
      ...challenges.map((c) => c.locationId),
      objective.locationId,
      ...locations.filter((l) => l.occupants.length > 0).map((l) => l.id),
    ])
    const occupiedNpcIds = new Set(locations.flatMap((l) => l.occupants))
    const freeNpcs = npcs.filter((n) => !occupiedNpcIds.has(n.id))
    const pool = freeNpcs.length > 0 ? freeNpcs : npcs
    let rr = 0
    for (const loc of locations) {
      if (anchoredLocationIds.has(loc.id) || pool.length === 0) continue
      loc.occupants = [...loc.occupants, pool[rr % pool.length]!.id]
      rr++
    }

    // US-242: 2º passo do backstop — `interactions` saiu (era a válvula de escape de
    // `checkNoOrphanNpcs`), então TODO npc precisa de occupant/npcIds próprio agora, não só
    // os que couberam nos locais órfãos acima. Round-robin sobre `locations` inteiro (não só
    // as sem âncora): mesmo padrão de "NPC pode ocupar 2 locais, não é problema" (comentário
    // acima) — fecha o grafo por construção sem depender de conteúdo opcional da autoria.
    const referencedNpcIds = new Set<string>([...encounters.flatMap((e) => e.npcIds), ...locations.flatMap((l) => l.occupants)])
    const strandedNpcs = npcs.filter((n) => !referencedNpcIds.has(n.id))
    let rr2 = 0
    for (const npc of strandedNpcs) {
      if (locations.length === 0) break
      const loc = locations[rr2 % locations.length]!
      loc.occupants = [...loc.occupants, npc.id]
      rr2++
    }

    // US-233 (PASSO 2): casa a fiction (npcIds já resolvidos) com a mecânica 5e — papel de
    // statblock por posição, determinístico, sem pedir número ao modelo.
    // Bugfix (Paladina nível 3, 16/09/2026): orçamento pro nível AGORA é aplicado aqui também
    // (assignBudgetedCombatRoles), não só checado pelo gate depois — nível 1-3 modo 'adventure'
    // tem orçamento 0 (US-159), então dar papel a TODO npcId sempre estourava a verificação 3
    // do gate, sem chance de passar em nenhuma das 3 tentativas de regenerate. Posição que não
    // cabe no orçamento fica sem combatRole (figurante, não desaparece da ficção).
    for (const encounter of encounters) {
      if (encounter.type !== 'combat') continue
      const roles = assignBudgetedCombatRoles(encounter.npcIds.length, profile.level, profile.challenge)
      encounter.npcIds.forEach((npcId, i) => {
        const npc = npcs.find((n) => n.id === npcId)
        if (npc && roles[i]) npc.combatRole = roles[i]
      })
    }

    return GeneratedAdventureSchema.parse({
      id: `${characterId}:${order}`,
      levelRange: { min: profile.level, max: profile.level },
      registry,
      summary: authored.summary,
      world: authored.world,
      story: authored.story,
      factions,
      npcs,
      locations,
      challenges,
      encounters,
      start: authored.start,
      objective,
      branchedResolution: authored.branchedResolution,
      followUps: authored.followUps,
      generationModel: modelId,
    })
  }

  /**
   * US-150: gate antes de persistir — envolve `generateAdventure` com as verificações mecânicas
   * (parse, grafo fecha) e o reseed correto (ver adventure-gate.ts). US-232: `config` threading
   * pro rótulo pt-BR dos params de mundo. US-234: o mesmo `config` também alimenta o catálogo
   * de perícia/atributo da verificação 4 (saneamento) — não duplica a fonte de `buildSkillSheet`.
   */
  async generateGatedAdventure(
    profile: AdventureProfile,
    characterId: string,
    order: number,
    locale: Locale,
    config: SystemConfig,
    registryOverrides: AdventureRegistryOverrides = {},
    maxAttempts = 3,
  ): Promise<GateResult> {
    return generateWithGate(
      (attempt) => this.generateAdventure(profile, characterId, order, locale, config, registryOverrides, attempt),
      maxAttempts,
      profile.challenge,
      config,
    )
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

    // US-153: order calculado ANTES da transação — generateGatedAdventure roda fora do
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

      const generatedOpening = await this.ai.generateOpeningNarration({
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
      })
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
          where: { status: 'ACTIVE', participants: { some: { characterId } } },
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

        await tx.eventLog.create({
          data: { adventureId: adventure.id, characterId, type: 'NARRATION', payload: { text: openingText } },
        })

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
        where: { status: 'ACTIVE', participants: { some: { characterId } } },
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
    }

    void this.runAdventureGeneration(adventure.id, characterId, profile, order, locale, config, registryOverrides, opening)

    return adventure
  }

  /**
   * US-235: promise solta do controller/`createForCharacter` — sem fila no repo (sem
   * BullMQ/Redis) e Render Free é instância única, aceito para fase 1 (mesmo raciocínio
   * do doc de arquitetura §Artefatos do motor velho). Nunca lança: qualquer falha (gate
   * esgotado ou exceção inesperada) termina a linha em FAILED, nunca deixa a Adventure
   * presa em GENERATING por um erro não tratado.
   */
  async runAdventureGeneration(
    adventureId: string,
    characterId: string,
    profile: AdventureProfile,
    order: number,
    locale: Locale,
    config: SystemConfig,
    registryOverrides: AdventureRegistryOverrides,
    opening: AdventureOpeningContext,
  ): Promise<void> {
    try {
      const gateResult = await this.generateGatedAdventure(profile, characterId, order, locale, config, registryOverrides)
      if (!gateResult.ok) {
        await this.prisma.adventure.update({ where: { id: adventureId }, data: { status: 'FAILED', generationError: gateResult.reason } })
        return
      }
      await this.finalizeGeneratedAdventure(adventureId, characterId, gateResult.adventure, opening)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(JSON.stringify({ event: 'adventure_generation_crashed', adventureId, timestamp: new Date().toISOString(), errorMessage: message }))
      await this.prisma.adventure.update({ where: { id: adventureId }, data: { status: 'FAILED', generationError: message } }).catch(() => {})
    }
  }

  /**
   * US-235: 2ª metade do que `createForCharacter` fazia de uma vez só — abertura (US-34) +
   * extração de cena (US-35) + persistência do artefato aprovado pelo gate. `CharacterState`
   * já existe (criado síncrono); aqui só ganha `sceneState` quando a extração devolve patch.
   */
  private async finalizeGeneratedAdventure(
    adventureId: string,
    characterId: string,
    generated: GeneratedAdventure,
    opening: AdventureOpeningContext,
  ): Promise<void> {
    const mainQuest = `${generated.summary}\n${generated.start}`
    // US-151: ledger semeado do artefato JÁ VALIDADO — substitui `extractOpeningEntities`
    // (extração por LLM da prosa) como fonte, agora que a aventura sempre vem do motor
    // (US-153).
    const seededEntities = seedLedgerFromGeneratedAdventure(generated)

    const generatedOpening = await this.ai.generateOpeningNarration({
      systemName: opening.systemName,
      characterName: opening.characterName,
      characterGender: opening.characterGender,
      characterClass: opening.className,
      characterRace: opening.raceName,
      mainQuest,
      // US-168: mesmo ledger que a transação abaixo persiste — a abertura vê o elenco
      // que o motor já gerou, em vez de inventar um à parte (violando Onomástica).
      entities: seededEntities,
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
      // US-168: direto de `generated.registry.tone` — a abertura já nasce coerente, sem esperar
      // o round-trip pelo banco (que só existe depois da transação, abaixo).
      tone: generated.registry.tone,
      // US-185: mesmo registry do tone acima.
      setting: generated.registry.setting,
      areaType: generated.registry.areaType,
    })
    // US-101: o fallback estático já sai no idioma certo — `opening.hookSeed` veio do
    // `config` do locale do dono, e o gancho tem versão por idioma.
    const openingText = generatedOpening ?? opening.hookSeed

    // US-35: extrai a cena estruturada da abertura ANTES da transação (é LLM). Sem
    // isto o `sceneState` nasce nulo e o turno 1 fica sem âncora de continuidade
    // (a abertura roda sem tools, nunca chama `updateScene`). Falha/vazio → nulo,
    // idêntico ao comportamento pré-US-35; nunca derruba a criação.
    const scenePatch = await this.ai.extractOpeningScene(
      openingText,
      opening.fullInventory.map((i) => i.name),
    )
    const sceneState = scenePatch ? mergeSceneState(null, scenePatch) : null

    await this.prisma.$transaction(async (tx) => {
      // US-151: ledger semeado do artefato gerado. Vazio → coluna ausente (default do Prisma).
      // US-168: `generatedAdventure` (ADR 012 §D2/US-144) finalmente escrita — disponível
      // de graça a todo turno via `streamChat` (SELECT * implícito, sem query nova).
      await tx.adventure.update({
        where: { id: adventureId },
        data: {
          status: 'ACTIVE',
          title: generated.summary,
          generatedAdventure: generated as unknown as object,
          ...(seededEntities.length > 0 ? { entities: seededEntities as unknown as object } : {}),
        },
      })

      // US-35: cena extraída da abertura, aplicada ao CharacterState já criado (sync).
      if (sceneState) {
        await tx.characterState.update({
          where: { characterId_adventureId: { characterId, adventureId } },
          data: { sceneState: sceneState as unknown as object },
        })
      }

      // US-153: quest principal derivada do artefato gerado (não mais do gancho fixo por
      // classe) — dá objetivo ao DM (ver AiService).
      // US-169: `objective` (alvo concreto) é exposto ao Mestre todo turno (buildTurnStateBlock).
      // US-232: `objective` do artefato virou objeto — grava só `.description` (a coluna Quest é
      // texto). `Quest.conclusionHint` SAIU da tabela: a autoria mundo-primeiro tem fecho
      // RAMIFICADO (`branchedResolution`, sem herói), não uma conclusão única pré-escrita.
      // US-194: `description` = `generated.summary` (a premissa), não a cena de abertura.
      await tx.quest.create({
        data: {
          adventureId,
          title: generated.summary,
          description: generated.summary,
          objective: generated.objective.description,
          isPrimary: true,
        },
      })

      // Primeira narração persistida: aparece como mensagem do Mestre (getTurns)
      // e entra na janela de contexto do DM (historyLogs, summarized: false).
      await tx.eventLog.create({
        data: {
          adventureId,
          characterId,
          type: 'NARRATION',
          payload: { text: openingText },
        },
      })
    })

    // US-243: dump best-effort do artefato aprovado, só depois da transação confirmar
    // (senão o JSON em disco não bateria com o que foi persistido). Dev-only, mesmo gate de
    // `adventure.module.ts` (US-202); nunca bloqueia a criação — falha de disco é só logada.
    if (process.env.NODE_ENV !== 'production') {
      try {
        writeAuthoringDump(characterId, generated)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(JSON.stringify({ event: 'authoring_dump_failed', adventureId, characterId, timestamp: new Date().toISOString(), errorMessage: message }))
      }
    }
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
