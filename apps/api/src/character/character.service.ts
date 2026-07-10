import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SystemConfigSchema, buildCharacterAttributesSchema, type SystemConfig } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'
import { getClassFeatures } from './starting-inventory'
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

    const config = SystemConfigSchema.parse(system.config)
    const baseAttributes = buildCharacterAttributesSchema(config.attributes).parse(dto.attributes)
    const skills = this.validateSkills(config, dto.skills ?? [])
    // US-41: features de classe de nível 1, derivadas do kit da classe (mesmo caminho
    // do inventário inicial). Classe sem kit de features → [] (sem crash, sem seção).
    const features = getClassFeatures(config, dto.class)

    return this.prisma.character.create({
      data: {
        userId: dto.userId,
        systemId: dto.systemId,
        name: dto.name,
        gender: dto.gender,
        race: dto.race,
        class: dto.class,
        level: 1,
        baseAttributes,
        skills,
        features,
        background: this.normalizeBackground(dto.background),
      },
    })
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
   * Valida as perícias proficientes contra o config (US-27): cada key precisa
   * existir em config.skills e a quantidade precisa bater com proficiency.choices.
   * Sistema sem perícias no config → nenhuma proficiência aceita.
   */
  private validateSkills(config: SystemConfig, chosen: string[]): string[] {
    const catalog = config.skills ?? []
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

    return characters
      .map((c) => ({
        id: c.id,
        name: c.name,
        race: c.race,
        class: c.class,
        level: c.level,
        currentAdventure: c.participations[0]?.adventure ?? null,
        // Chave de ordenação: último turno jogado; nunca jogou cai em createdAt.
        _lastPlayed: c.states[0]?.updatedAt ?? c.createdAt,
      }))
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
        // US-27: o front deriva os modificadores das perícias do config do sistema.
        system: true,
      },
    })
    if (!character) throw new NotFoundException(`Personagem ${id} não encontrado`)
    return character
  }
}
