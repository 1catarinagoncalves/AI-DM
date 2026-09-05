import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SystemConfigSchema, buildCharacterAttributesSchema, catalogLabel, resolveLocale, getClassFeatures, getClassSpells, getBackgroundFeatures, getRaceFeatures, DRACONIC_ANCESTRY_TABLE, DWARF_TOOL_PROFICIENCY_CHOICES, RACE_LANGUAGES, RACE_EXTRA_LANGUAGE_CHOICE, RACE_WEAPON_PROFICIENCIES, RACE_TOOL_PROFICIENCIES, type SystemConfig, type SystemBackgroundGrant, type SystemRaceGrant } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'
import { configForLocale, getSystemCached, getSystemsCached, localeOfUser } from '../system/system-locale'
// DTO derivado do schema Zod do controller (fonte única — ver character.schema.ts).
// Reexporta para quem importava o tipo daqui.
export type { CreateCharacterDto } from './character.schema'
import type { CreateCharacterDto } from './character.schema'

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCharacterDto) {
    // Da cache, não do banco: `System` é o SRD inteiro (~200KB/linha) e reviajava a rede
    // a cada ficha. `find` em vez de `getSystemCached` porque o id vem do DTO do cliente —
    // ausente é 404 dele, não o Error de invariante que a busca por FK levanta.
    const system = (await getSystemsCached(this.prisma)).find((candidate) => candidate.id === dto.systemId)
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
    // US-211: dragonborn exige a ancestralidade dracônica escolhida — validada contra
    // DRACONIC_ANCESTRY_TABLE (regra fixa do PHB 2014, packages/shared), não config.races
    // (a tabela não vem do SRD ingerido). Qualquer outra raça ignora o campo, mesmo se vier.
    const draconicAncestry = race === 'dragonborn'
      ? this.validateCatalogKey(DRACONIC_ANCESTRY_TABLE, dto.draconicAncestry ?? '', 'Ancestralidade dracônica')
      : undefined
    // Traço "Tool Proficiency" do anão: mesmo par condicional de draconicAncestry acima,
    // validado contra a tabela fixa (regra do PHB 2014, não catálogo do sistema) — só
    // 'hill-dwarf' (único anão jogável) exige o campo.
    const raceToolChoice = race === 'hill-dwarf'
      ? this.validateCatalogKey(
        DWARF_TOOL_PROFICIENCY_CHOICES.map((key) => ({ key })), dto.raceToolChoice ?? '', 'Ferramenta racial',
      )
      : undefined
    // US-214: idioma(s) fixo(s) que a raça concede de graça — RACE_LANGUAGES é regra fixa do
    // PHB 2014 (@ai-dm/shared), não catálogo do sistema. Incondicional (toda raça, não só
    // high-elf) porque a seção "Idiomas" da ficha precisa mostrar a verdade completa.
    const raceLanguages = RACE_LANGUAGES[race] ?? []
    // Traço "Extra Language" (Alto-elfo/Humano/Meio-elfo, RACE_EXTRA_LANGUAGE_CHOICE): mesmo par
    // condicional de raceToolChoice acima, mas validado contra config.languages (US-133,
    // catálogo do SISTEMA, não regra fixa do PHB) — o pool exclui `secret` (Druidic/Thieves'
    // Cant, mesmo motivo de US-129 §Modelo de dados) e os idiomas que `raceLanguages` já concede
    // de graça, para a escolha nunca oferecer o que o personagem já sabe.
    const raceLanguageChoice = RACE_EXTRA_LANGUAGE_CHOICE.includes(race)
      ? this.validateCatalogKey(
        (config.languages ?? []).filter((l) => !l.secret && !raceLanguages.includes(l.key)), dto.raceLanguageChoice ?? '', 'Idioma racial',
      )
      : undefined
    const charClass = this.validateCatalogKey(config.classes, dto.class, 'Classe')
    // US-205: subclasse pressupõe a classe já validada acima. `dto.subclass` presente →
    // valida contra o catálogo da classe (BadRequestException se pertencer a outra classe,
    // mesmo padrão de validateCatalogKey). Ausente + catálogo com 1 entrada só → preenche
    // sozinho (classe sem escolha real, 12 das 13). Ausente + catálogo com 0 ou 2+ entradas
    // → undefined (sem catálogo: sistema sem config.subclasses; 2+: escolha obrigatória que o
    // wizard já deveria ter mandado — sem entrada aqui não é erro do service, é DTO incompleto).
    const subclassCatalog = config.subclasses?.[charClass]
    const subclass = dto.subclass
      ? this.validateCatalogKey(subclassCatalog, dto.subclass, 'Subclasse')
      : subclassCatalog?.length === 1
        ? subclassCatalog[0]!.key
        : undefined
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
    const attributesWithOrigin = this.applyAbilityGrant(baseAttributes, config.attributes, abilityGrant, dto.origin?.abilityChoice)
    // US-212: bônus de atributo de RAÇA soma DEPOIS do de origem, sobre o resultado dele — os
    // dois são somadores independentes (podem tocar o mesmo atributo, sempre cumulativos no 5e).
    const raceGrant = this.findRaceGrant(config.races, race)
    const finalAttributes = this.applyRaceGrant(attributesWithOrigin, config.attributes, raceGrant, dto.raceAbilityChoice)
    // US-131: perícias do background (fixas + escolhida) são resolvidas ANTES de validar as
    // `choices` da etapa `skills` — `validateSkills` exclui essas chaves do catálogo que
    // valida, para o mesmo par não poder ser escolhido duas vezes nem sobrar de fora.
    const skillGrant = this.findSkillGrant(config.backgrounds, originKey)
    const originSkills = this.applySkillGrant(skillGrant, dto.origin?.skillChoice)
    const skills = [...originSkills, ...this.validateSkills(config, dto.skills ?? [], originSkills)]
    // US-132: ferramenta/veículo do background (`grant.kind === 'tools'`) — mesmo par find/apply
    // de perícia (US-131), mas sem etapa própria pra mesclar: a origem é a ÚNICA fonte.
    const toolGrant = this.findToolGrant(config.backgrounds, originKey)
    // US-215: ferramenta FIXA da raça (Tinker do gnomo das rochas) — RACE_TOOL_PROFICIENCIES é
    // regra fixa do PHB 2014 (@ai-dm/shared), não catálogo do sistema. Incondicional (mesmo
    // raciocínio de raceLanguages) porque a raça concede de graça, sem escolha do jogador.
    const raceTools = RACE_TOOL_PROFICIENCIES[race] ?? []
    // Ferramenta racial soma à de origem — as duas são proficiências independentes, mesmo
    // raciocínio cumulativo de applyRaceGrant/applyAbilityGrant acima.
    const tools = [...this.applyToolGrant(toolGrant, dto.origin?.toolChoice), ...(raceToolChoice ? [raceToolChoice] : []), ...raceTools]
    // US-214: união do(s) idioma(s) fixo(s) de raça com a escolha extra (quando exigida) — sem
    // coluna própria de raça (ver schema.prisma), tudo entra direto no mesmo array.
    const languages = [...raceLanguages, ...(raceLanguageChoice ? [raceLanguageChoice] : [])]
    // US-215: arma(s) fixa(s) da raça (combate do anão / armas do elfo) — RACE_WEAPON_PROFICIENCIES
    // é regra fixa do PHB 2014, mesmo raciocínio de raceLanguages/raceTools acima.
    const raceWeapons = RACE_WEAPON_PROFICIENCIES[race] ?? []

    return this.prisma.character.create({
      data: {
        userId: dto.userId,
        systemId: dto.systemId,
        name: dto.name,
        gender: dto.gender,
        race,
        draconicAncestry,
        raceToolChoice,
        class: charClass,
        subclass,
        level: 1,
        baseAttributes: finalAttributes,
        skills,
        tools,
        languages,
        weapons: raceWeapons,
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
   * US-212: resolve `config.races[].grant` da raça já validada, se o ingest reconheceu o
   * traço `ability-score-increase` para ela. Raça sem `grant` (config legado, ou raiz-com-
   * subespécie — não-jogável, ver ingest.mjs) devolve `undefined`, sem exigir nada do DTO.
   */
  private findRaceGrant(races: SystemConfig['races'], raceKey: string): SystemRaceGrant | undefined {
    return races?.find((r) => r.key === raceKey)?.grant
  }

  /**
   * US-212: soma cada `grant.fixed[].amount` incondicionalmente (a raça não pede escolha para
   * isso — Elfo, Anão da Colina, Humano com as 6 chaves). Se `grant.choice` presente (hoje só
   * Meio-Elfo), `raceAbilityChoice` precisa ter EXATAMENTE `choice.count` chaves de
   * `config.attributes`, distintas entre si e distintas de qualquer `grant.fixed[].attr`
   * (repetir o fixo da raça não é "outro atributo", mesmo raciocínio RAW de `applyAbilityGrant`
   * para background). Rejeita os três casos (contagem errada, chave fora do catálogo, colisão
   * com fixo) numa `BadRequestException` só, mesmo padrão de mensagem das demais validações.
   */
  private applyRaceGrant(
    baseAttributes: Record<string, number>,
    attributes: SystemConfig['attributes'],
    grant: SystemRaceGrant | undefined,
    raceAbilityChoice?: string[],
  ): Record<string, number> {
    if (!grant) return baseAttributes
    const out = { ...baseAttributes }
    for (const { attr, amount } of grant.fixed) out[attr] = (out[attr] ?? 0) + amount
    if (!grant.choice) return out

    const valid = new Set(attributes.map((a) => a.key))
    const fixedKeys = new Set(grant.fixed.map((f) => f.attr))
    const chosen = [...new Set(raceAbilityChoice ?? [])]
    const invalid = chosen.length !== grant.choice.count || chosen.some((k) => !valid.has(k) || fixedKeys.has(k))
    if (invalid) {
      throw new BadRequestException(
        `raceAbilityChoice inválido: [${(raceAbilityChoice ?? []).join(', ')}]. Esperado ${grant.choice.count} chave(s) de config.attributes, `
        + `distintas entre si e diferentes de [${[...fixedKeys].join(', ')}].`,
      )
    }
    for (const attr of chosen) out[attr] = (out[attr] ?? 0) + grant.choice.amount
    return out
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
