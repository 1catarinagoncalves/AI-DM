import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SystemConfigSchema, buildCharacterAttributesSchema, catalogLabel, resolveLocale, getClassFeatures, getClassSpells, getBackgroundFeatures, getRaceFeatures, type SystemConfig, type SystemBackgroundGrant } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'
import { configForLocale, getSystemCached, localeOfUser } from '../system/system-locale'
// DTO derivado do schema Zod do controller (fonte única — ver character.schema.ts).
// Reexporta para quem importava o tipo daqui.
export type { CreateCharacterDto } from './character.schema'
import type { CreateCharacterDto } from './character.schema'

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCharacterDto) {
    const system = await this.prisma.system.findUnique({ where: { id: dto.systemId } })
    if (!system) throw new NotFoundException(`Sistema ${dto.systemId} não encontrado`)
    if (!system.config) {
      throw new BadRequestException(`Sistema ${dto.systemId} não tem configuração de regras (config ausente)`)
    }

    // US-100: nada de texto é materializado na ficha — feature e magia entram por CHAVE, como
    // as perícias (US-27). O locale segue sendo lido aqui porque a VALIDAÇÃO (raça, classe,
    // perícia) acontece contra o catálogo, e a mensagem de erro sai no idioma de quem cria.
    const locale = await localeOfUser(this.prisma, dto.userId)
    const config = SystemConfigSchema.parse(configForLocale(system, locale))
    const baseAttributes = buildCharacterAttributesSchema(config.attributes).parse(dto.attributes)
    // US-105: `race`/`class` são CHAVES do catálogo do sistema. A ficha guarda a chave; o
    // rótulo é resolvido na leitura, no locale de quem lê.
    // US-142: `raceFeatures`, quando presente, É o catálogo jogável — a raiz que tem subespécie
    // fica de fora dele (só a(s) subespécie(s) tem entrada), então validar contra ele em vez de
    // `config.races` reverte a raiz a chave inválida sem precisar filtrar `parentKey` aqui.
    // Config legado sem `raceFeatures` cai no `config.races` cheio de sempre, sem mudar comportamento.
    const raceCatalog = config.raceFeatures ? Object.keys(config.raceFeatures).map((key) => ({ key })) : config.races
    const race = this.validateCatalogKey(raceCatalog, dto.race, 'Raça')
    const charClass = this.validateCatalogKey(config.classes, dto.class, 'Classe')
    // US-42: magias conhecidas (truques + exceção nível 1 de paladino/patrulheiro),
    // do mesmo kit da classe. Não-conjurador → [] (sem seção, sem crash).
    const spells = getClassSpells(config, charClass)
    // US-122: origem do catálogo de backgrounds (US-121) — campo IRMÃO de `background`,
    // validado com o mesmo `validateCatalogKey` de raça/classe. Opcional: chave ausente
    // não dispara validação nenhuma (sistema sem catálogo, ou jogador que não escolheu).
    const originKey = dto.origin?.key
      ? this.validateCatalogKey(config.backgrounds, dto.origin.key, 'Origem')
      : undefined
    // US-41: features de classe de nível 1, derivadas do kit da classe (mesmo caminho
    // do inventário inicial). Classe sem kit de features → [] (sem crash, sem seção).
    // US-135: união com as features de nível 1 da ORIGEM escolhida (US-121 benefício
    // `type: 'feature'`, ex. Thieves' Cant) — mesmo campo, sem coluna nova no Prisma.
    // US-100: são CHAVES (`barbarian_rage`/`a5e-ag_criminal_thieves-cant`), resolvidas
    // para nome/descrição na leitura.
    // US-142: features de raça (raiz sem subespécie, ou subespécie já combinada com a raiz)
    // somadas ao mesmo array — mesmo pipeline de classe/origem, sem coluna nova no Prisma.
    const features = [...getClassFeatures(config, charClass), ...getBackgroundFeatures(config, originKey), ...getRaceFeatures(config, race)]
    // US-123: bônus de atributo do background soma POR CIMA do point-buy já validado acima —
    // por isso aplicado depois do parse de min/max, que segue valendo só para o point-buy puro.
    const abilityGrant = this.findAbilityGrant(config.backgrounds, originKey)
    const finalAttributes = this.applyAbilityGrant(baseAttributes, config.attributes, abilityGrant, dto.origin?.abilityChoice)
    // US-131: perícias do background (fixas + escolhida) são resolvidas ANTES de validar as
    // `choices` da etapa `skills` — `validateSkills` exclui essas chaves do catálogo que
    // valida, para o mesmo par não poder ser escolhido duas vezes nem sobrar de fora.
    const skillGrant = this.findSkillGrant(config.backgrounds, originKey)
    const originSkills = this.applySkillGrant(skillGrant, dto.origin?.skillChoice)
    const skills = [...originSkills, ...this.validateSkills(config, dto.skills ?? [], originSkills)]
    // US-132: ferramenta/veículo do background (`grant.kind === 'tools'`) — mesmo par find/apply
    // de perícia (US-131), mas sem etapa própria pra mesclar: a origem é a ÚNICA fonte.
    const toolGrant = this.findToolGrant(config.backgrounds, originKey)
    const tools = this.applyToolGrant(toolGrant, dto.origin?.toolChoice)

    return this.prisma.character.create({
      data: {
        userId: dto.userId,
        systemId: dto.systemId,
        name: dto.name,
        gender: dto.gender,
        race,
        class: charClass,
        level: 1,
        baseAttributes: finalAttributes,
        skills,
        tools,
        features,
        spells,
        background: this.normalizeBackground(dto.background),
        origin: this.normalizeOrigin(originKey, dto.origin),
      },
    })
  }

  /**
   * US-122: normaliza a origem escolhida — mesma forma de `normalizeBackground`, mas em
   * campo próprio e distinto (`Character.origin`), nunca dentro de `background`.
   *
   * US-124: `connection`/`memento` viajam SEM validação contra catálogo (são a linha que o
   * jogador escolheu no `<select>`, não uma chave) — só trim + descarte se vazio, mesmo
   * tratamento de `background.story`. Não fazem sentido sem `key` (não há bloco de
   * conexão/memento a mostrar sem origem escolhida), mas não bloqueiam a criação se vierem
   * sozinhos — o wizard sempre manda os três juntos, isto só evita lixo se algo mandar diferente.
   */
  private normalizeOrigin(key?: string, origin?: CreateCharacterDto['origin']): { key?: string; connection?: string; memento?: string } {
    const out: { key?: string; connection?: string; memento?: string } = {}
    if (key) out.key = key
    const connection = origin?.connection?.trim()
    if (connection) out.connection = connection
    const memento = origin?.memento?.trim()
    if (memento) out.memento = memento
    return out
  }

  /**
   * US-39: normaliza o background para persistir — trima a prosa, filtra strings
   * vazias das listas e descarta campos vazios. Sem nada preenchido → `{}` (o
   * builder não renderiza seção). Texto livre (US-39 §1); sem catálogo.
   */
  private normalizeBackground(bg?: CreateCharacterDto['background']): Record<string, string | string[] | { name: string; portfolio?: string }> {
    if (!bg) return {}
    const out: Record<string, string | string[] | { name: string; portfolio?: string }> = {}
    const story = bg.story?.trim()
    if (story) out['story'] = story
    for (const key of ['ideals', 'bonds', 'flaws'] as const) {
      const arr = (bg[key] ?? []).map((s) => s.trim()).filter(Boolean)
      if (arr.length > 0) out[key] = arr
    }
    // US-40: divindade só entra se tiver nome; portfolio é opcional. Sem nome → descartada.
    const name = bg.deity?.name?.trim()
    if (name) {
      const portfolio = bg.deity?.portfolio?.trim()
      out['deity'] = portfolio ? { name, portfolio } : { name }
    }
    return out
  }

  /**
   * Valida a chave de raça/classe contra o catálogo do config (US-105), espelhando o
   * `validateSkills`. O catálogo é FECHADO (US-105 → Questões em aberto #2): não há chave
   * `custom` nem campo de escape, e chave desconhecida é rejeitada em vez de gravada.
   *
   * Sistema cujo config ainda não traz o catálogo (`races`/`classes` são opcionais, para não
   * invalidar config legado) aceita o que vier — é o que impede um banco não re-semeado de
   * parar de criar personagem. Some sozinho no primeiro `db:seed`.
   */
  private validateCatalogKey(catalog: Array<{ key: string }> | undefined, key: string, field: string): string {
    if (!catalog || catalog.length === 0) return key
    if (!catalog.some((e) => e.key === key)) {
      throw new BadRequestException(
        `${field} inválida: "${key}". Esperado uma chave do catálogo do sistema: ${catalog.map((e) => e.key).join(', ')}`,
      )
    }
    return key
  }

  /**
   * US-123: resolve o `grant.kind === 'ability'` da origem escolhida, se houver — cada
   * background tem no máximo um benefício `ability_score` reconhecido pelo ingest.
   */
  private findAbilityGrant(
    backgrounds: SystemConfig['backgrounds'],
    originKey?: string,
  ): Extract<SystemBackgroundGrant, { kind: 'ability' }> | undefined {
    const grant = backgrounds?.find((b) => b.key === originKey)?.benefits
      .find((b) => b.grant?.kind === 'ability')?.grant
    return grant?.kind === 'ability' ? grant : undefined
  }

  /**
   * US-123: valida `abilityChoice` contra o grant (fora de `config.attributes`, ausente, ou
   * igual a `grant.fixed` — repetir o fixo não é "outro atributo", RAW) e soma os dois `+1`
   * (fixo + livre) por cima do `baseAttributes` já validado pelo point-buy. Sem grant (origem
   * sem esse benefício, ou nenhuma origem escolhida) devolve `baseAttributes` intocado.
   */
  private applyAbilityGrant(
    baseAttributes: Record<string, number>,
    attributes: SystemConfig['attributes'],
    grant: Extract<SystemBackgroundGrant, { kind: 'ability' }> | undefined,
    abilityChoice?: string,
  ): Record<string, number> {
    if (!grant) return baseAttributes
    const valid = new Set(attributes.map((a) => a.key))
    if (!abilityChoice || !valid.has(abilityChoice) || abilityChoice === grant.fixed) {
      throw new BadRequestException(
        `abilityChoice inválido: "${abilityChoice ?? ''}". Esperado uma chave de config.attributes diferente de "${grant.fixed}".`,
      )
    }
    return {
      ...baseAttributes,
      [grant.fixed]: (baseAttributes[grant.fixed] ?? 0) + 1,
      [abilityChoice]: (baseAttributes[abilityChoice] ?? 0) + 1,
    }
  }

  /**
   * US-131: resolve o `grant.kind === 'skills'` da origem escolhida, se houver — cada
   * background tem no máximo um benefício `skill_proficiency` reconhecido pelo ingest.
   * Mesmo par find/apply de `findAbilityGrant`/`applyAbilityGrant` (US-123).
   */
  private findSkillGrant(
    backgrounds: SystemConfig['backgrounds'],
    originKey?: string,
  ): Extract<SystemBackgroundGrant, { kind: 'skills' }> | undefined {
    const grant = backgrounds?.find((b) => b.key === originKey)?.benefits
      .find((b) => b.grant?.kind === 'skills')?.grant
    return grant?.kind === 'skills' ? grant : undefined
  }

  /**
   * US-131: perícias fixas do grant SEMPRE entram; `skillChoice` precisa ter EXATAMENTE
   * `chooseCount` chaves, todas dentro de `grant.chooseFrom` (array, não par fixo/escolhido —
   * `chooseCount` pode ser > 1, caso do Guildmember real, "Two of your choice"). Contagem ou
   * chave errada rejeita, mesmo padrão de `applyAbilityGrant`. Sem grant devolve `[]`.
   */
  private applySkillGrant(
    grant: Extract<SystemBackgroundGrant, { kind: 'skills' }> | undefined,
    skillChoice?: string[],
  ): string[] {
    if (!grant) return []
    if (grant.chooseCount === 0) return [...grant.fixed]
    const chosen = [...new Set(skillChoice ?? [])]
    const invalid = chosen.some((k) => !grant.chooseFrom.includes(k))
    if (chosen.length !== grant.chooseCount || invalid) {
      throw new BadRequestException(
        `skillChoice inválido: [${(skillChoice ?? []).join(', ')}]. Esperado ${grant.chooseCount} chave(s) de grant.chooseFrom: ${grant.chooseFrom.join(', ')}`,
      )
    }
    return [...grant.fixed, ...chosen]
  }

  /**
   * US-132: resolve o `grant.kind === 'tools'` da origem escolhida, se houver — cada
   * background tem no máximo um benefício `tool_proficiency` reconhecido pelo ingest.
   * Mesmo par find/apply de `findSkillGrant`/`applySkillGrant` (US-131).
   */
  private findToolGrant(
    backgrounds: SystemConfig['backgrounds'],
    originKey?: string,
  ): Extract<SystemBackgroundGrant, { kind: 'tools' }> | undefined {
    const grant = backgrounds?.find((b) => b.key === originKey)?.benefits
      .find((b) => b.grant?.kind === 'tools')?.grant
    return grant?.kind === 'tools' ? grant : undefined
  }

  /**
   * US-132: mesma validação de `applySkillGrant` — fixas sempre entram, `toolChoice` precisa
   * ter EXATAMENTE `chooseCount` chaves de `grant.chooseFrom` (Folk Hero real exige 2). Sem
   * etapa própria pra mesclar (ao contrário de perícia): a origem é a ÚNICA fonte de `tools`.
   */
  private applyToolGrant(
    grant: Extract<SystemBackgroundGrant, { kind: 'tools' }> | undefined,
    toolChoice?: string[],
  ): string[] {
    if (!grant) return []
    if (grant.chooseCount === 0) return [...grant.fixed]
    const chosen = [...new Set(toolChoice ?? [])]
    const invalid = chosen.some((k) => !grant.chooseFrom.includes(k))
    if (chosen.length !== grant.chooseCount || invalid) {
      throw new BadRequestException(
        `toolChoice inválido: [${(toolChoice ?? []).join(', ')}]. Esperado ${grant.chooseCount} chave(s) de grant.chooseFrom: ${grant.chooseFrom.join(', ')}`,
      )
    }
    return [...grant.fixed, ...chosen]
  }

  /**
   * Valida as perícias proficientes contra o config (US-27): cada key precisa
   * existir em config.skills e a quantidade precisa bater com proficiency.choices.
   * Sistema sem perícias no config → nenhuma proficiência aceita.
   *
   * US-131: `excluded` tira do catálogo as perícias já concedidas pelo background — evita
   * duplicar a mesma perícia entre a origem e a escolha da etapa `skills`.
   */
  private validateSkills(config: SystemConfig, chosen: string[], excluded: string[] = []): string[] {
    const catalog = (config.skills ?? []).filter((s) => !excluded.includes(s.key))
    const choices = config.proficiency?.choices ?? 0

    if (catalog.length === 0 || choices === 0) {
      if (chosen.length > 0) {
        throw new BadRequestException('Este sistema não tem perícias proficientes a escolher.')
      }
      return []
    }

    const unique = [...new Set(chosen)]
    if (unique.length !== choices) {
      throw new BadRequestException(`Escolha exatamente ${choices} perícia(s) proficiente(s).`)
    }
    const valid = new Set(catalog.map((s) => s.key))
    const invalid = unique.filter((k) => !valid.has(k))
    if (invalid.length > 0) {
      throw new BadRequestException(`Perícia(s) inválida(s): ${invalid.join(', ')}`)
    }
    return unique
  }

  /**
   * Lista os personagens do usuário para o hub (US-25): cada um com a aventura
   * em andamento (ACTIVE) embutida e a lista ordenada por último jogado.
   * Uma query só (findMany com includes) — sem loop por personagem.
   */
  async findAllByUser(userId: string) {
    // US-105: o hub exibe raça e classe, que agora são chave — precisa do config do sistema
    // de cada ficha para resolver o rótulo. Vem no mesmo findMany (o include não custa uma
    // query por personagem), e o locale é o do dono, lido uma vez.
    const locale = await localeOfUser(this.prisma, userId)
    const characters = await this.prisma.character.findMany({
      where: { userId },
      include: {
        // Estado mais recente → "último jogado" (CharacterState.updatedAt bumpa a cada turno).
        states: { orderBy: { updatedAt: 'desc' }, take: 1 },
        // Aventura em andamento: participação numa Adventure ACTIVE, a mais recente desempata.
        participations: {
          where: { adventure: { status: 'ACTIVE' } },
          include: { adventure: { select: { id: true, title: true } } },
          orderBy: { adventure: { createdAt: 'desc' } },
          take: 1,
        },
      },
    })
    // Poucos systemId distintos no MVP (Free/D&D) — getSystemCached colapsa em 1 fetch cada.
    const systems = await Promise.all(characters.map((c) => getSystemCached(this.prisma, c.systemId)))

    return characters
      .map((c, i) => {
        const config = configForLocale(systems[i]!, locale)
        return {
          id: c.id,
          name: c.name,
          race: catalogLabel(config?.races, c.race),
          class: catalogLabel(config?.classes, c.class),
          level: c.level,
          currentAdventure: c.participations[0]?.adventure ?? null,
          // Chave de ordenação: último turno jogado; nunca jogou cai em createdAt.
          _lastPlayed: c.states[0]?.updatedAt ?? c.createdAt,
        }
      })
      .sort((a, b) => b._lastPlayed.getTime() - a._lastPlayed.getTime())
      .map(({ _lastPlayed, ...rest }) => rest)
  }

  /**
   * Apaga o personagem, as aventuras dele e todos os dependentes (US-30).
   * Cascata manual numa transação — o schema não tem onDelete: Cascade.
   * Callback (não array) porque o passo 1 alimenta os deletes seguintes.
   */
  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({ where: { id } })
      if (!character) throw new NotFoundException(`Personagem ${id} não encontrado`)

      // Aventuras do personagem (single-player: pertencem só a ele).
      const [parts, states] = await Promise.all([
        tx.adventureParticipant.findMany({ where: { characterId: id }, select: { adventureId: true } }),
        tx.characterState.findMany({ where: { characterId: id }, select: { adventureId: true } }),
      ])
      const adventureIds = [...new Set([...parts, ...states].map((r) => r.adventureId))]

      // Filhos das aventuras → aventuras.
      const byAdventure = { where: { adventureId: { in: adventureIds } } }
      await tx.eventLog.deleteMany(byAdventure)
      await tx.quest.deleteMany(byAdventure)
      await tx.characterState.deleteMany(byAdventure)
      await tx.adventureParticipant.deleteMany(byAdventure)
      await tx.adventure.deleteMany({ where: { id: { in: adventureIds } } })

      // Rede de segurança: registros do personagem fora das aventuras achadas.
      const byCharacter = { where: { characterId: id } }
      await tx.eventLog.deleteMany(byCharacter)
      await tx.characterState.deleteMany(byCharacter)
      await tx.adventureParticipant.deleteMany(byCharacter)

      return tx.character.delete({ where: { id } })
    })
  }

  async findOne(id: string) {
    const character = await this.prisma.character.findUnique({
      where: { id },
      include: {
        states: { orderBy: { updatedAt: 'desc' }, take: 1 },
        // US-99: o locale do dono decide QUAL config sai daqui (os rótulos de perícia
        // da ficha vêm dele). Sem isto, `system.config` cru serviria a base EN a todos.
        user: { select: { locale: true } },
      },
    })
    if (!character) throw new NotFoundException(`Personagem ${id} não encontrado`)
    const fullSystem = await getSystemCached(this.prisma, character.systemId)

    const locale = resolveLocale(character.user?.locale)
    // US-27: o front deriva os modificadores das perícias do config do sistema.
    const { configLocales: _drop, ...system } = fullSystem
    return {
      ...character,
      system: { ...system, config: configForLocale(fullSystem, locale) },
    }
  }
}
