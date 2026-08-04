import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { SystemConfigSchema, buildSkillSheet, catalogLabel, resolveLocale, resolveSheetEntries, stripFabricatedRolls, type InitialAdventureHook, type ChatTurn } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'
import { configForLocale } from '../system/system-locale'
import { AiService } from '../ai/ai.service'
import { mergeSceneState, type CharacterBackground } from '@ai-dm/ai-engine'
import { getStartingInventory, resolveInitialHook, resolveHookTemplate } from '../character/starting-inventory'

export interface CreateAdventureDto {
  initialHookId: string
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
      primaryQuestTitle: resolveHookTemplate(hook.primaryQuestTitle, vars),
      primaryQuestDescription: resolveHookTemplate(hook.primaryQuestDescription, vars),
      openingNarration: resolveHookTemplate(hook.openingNarration, vars),
    }
  }

  async createForCharacter(characterId: string, dto: CreateAdventureDto) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      // US-97: `user.locale` decide o idioma da primeira cena — é o único texto que
      // nasce antes de o jogador escrever qualquer coisa (não há o que espelhar).
      include: { system: true, user: { select: { locale: true } } },
    })
    if (!character) throw new NotFoundException(`Personagem ${characterId} não encontrado`)

    const config = SystemConfigSchema.parse(configForLocale(character.system, resolveLocale(character.user?.locale)))

    // A classe é a fonte de verdade do gancho: resolvemos server-side e só usamos
    // o initialHookId do cliente para validar que ele não escolheu outro (US-28).
    // US-105: a chave vai para o lookup (hook, kit); o rótulo, para todo texto que uma
    // pessoa lê — mensagem de erro, placeholder do gancho e prompt do Mestre.
    const className = catalogLabel(config.classes, character.class)
    const raceName = catalogLabel(config.races, character.race)

    const rawHook = resolveInitialHook(config, character.class)
    if (!rawHook) throw new BadRequestException('O sistema deste personagem não tem aventuras iniciais configuradas')
    if (dto.initialHookId !== rawHook.id) {
      throw new BadRequestException(`Gancho inicial "${dto.initialHookId}" não é válido para a classe ${className}`)
    }
    const hook = this.resolveHook(rawHook, character.name, className)

    const attrs = character.baseAttributes as Record<string, number>
    const conMod = Math.floor(((attrs['constitution'] ?? 10) - 10) / 2)
    const maxHp = 10 + conMod

    // Inventário inicial calculado uma vez: alimenta o CharacterState e o system
    // prompt da geração de abertura (o DM precisa saber o que a personagem carrega).
    const startingInventory = getStartingInventory(config, character.class)

    // Abertura gerada pelo MESMO DM (US-34), FORA da transação (LLM é lento e não
    // deve segurar locks). Falha/vazio → cai no openingNarration estático do gancho.
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
      mainQuest: `${hook.primaryQuestTitle}\n${hook.primaryQuestDescription}`,
      inventory: startingInventory.map((i) => (i.qty > 1 ? `${i.name} (${i.qty})` : i.name)),
      sheet: { level: character.level, hp: maxHp, maxHp, attributes: attrs, conditions: [], skills },
      hookSeed: hook.openingNarration,
      attributeLabels: Object.fromEntries(labelPairs),
      background: (character.background ?? {}) as unknown as CharacterBackground,
      // US-41: features de classe do kit (o DM já as conhece na 1ª cena). US-100: a ficha guarda
      // a chave; o texto sai do `config` — que aqui já é o do locale do dono (`configForLocale`).
      features,
      // US-42: magias conhecidas — só os nomes vão ao prompt (descrição via getSpell nos turnos).
      spells: knownSpells.map((s) => ({ name: s.name, level: s.level })),
      locale: resolveLocale(character.user?.locale),
    })
    // US-101: o fallback estático já sai no idioma certo — `hook` veio do `config` do locale
    // (linha 85), e o gancho passou a ter versão por idioma. Antes ele era o único PT que
    // sobrava numa mesa em inglês, e só aparecia quando a geração falhava.
    const openingText = generatedOpening ?? hook.openingNarration

    // US-35: extrai a cena estruturada da abertura ANTES da transação (é LLM). Sem
    // isto o `sceneState` nasce nulo e o turno 1 fica sem âncora de continuidade
    // (a abertura roda sem tools, nunca chama `updateScene`). Falha/vazio → nulo,
    // idêntico ao comportamento pré-US-35; nunca derruba a criação.
    // US-75: em paralelo, semeia o ledger de entidades da abertura (nenhuma extração
    // depende da outra). Sem esta âncora estruturada, o Mestre pode contradizer depois
    // o que a abertura estabeleceu (Erro 1). Falha/vazio → ledger vazio (pré-US-75).
    const [scenePatch, seededEntities] = await Promise.all([
      this.ai.extractOpeningScene(
        openingText,
        startingInventory.map((i) => i.name),
      ),
      this.ai.extractOpeningEntities(openingText, `${hook.primaryQuestTitle}\n${hook.primaryQuestDescription}`),
    ])
    const sceneState = scenePatch ? mergeSceneState(null, scenePatch) : null

    return this.prisma.$transaction(async (tx) => {
      const order = (await tx.adventureParticipant.count({ where: { characterId } })) + 1

      // Fecha a aventura ativa anterior do personagem (continuidade sequencial, ver ADR 002)
      await tx.adventure.updateMany({
        where: { status: 'ACTIVE', participants: { some: { characterId } } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })

      const adventure = await tx.adventure.create({
        // US-75: ledger semeado da abertura. Nulo → coluna ausente (default do Prisma).
        data: {
          systemId: character.systemId,
          creatorId: character.userId,
          title: hook.title,
          order,
          ...(seededEntities ? { entities: seededEntities as unknown as object } : {}),
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
          inventory: startingInventory as unknown as object,
          // US-35: cena extraída da abertura. Nulo → coluna ausente (como antes).
          ...(sceneState ? { sceneState: sceneState as unknown as object } : {}),
        },
      })

      // Quest principal derivada do gancho (US-28): dá objetivo ao DM (ver AiService).
      await tx.quest.create({
        data: {
          adventureId: adventure.id,
          title: hook.primaryQuestTitle,
          description: hook.primaryQuestDescription,
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
