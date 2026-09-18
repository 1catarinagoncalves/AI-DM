import { GeneratedAdventureSchema, type GeneratedAdventure } from '@ai-dm/shared'
import { MONSTER_ROLE_CR } from '../adventure-generation/monster-roles'

// US-202: as fontes que o export junta — formato já achatado pro que `buildAdventureExportView`
// consome, não as rows cruas do Prisma (o service faz esse achatamento em `getExportData`).
export interface AdventureExportAdventure {
  id: string
  title: string
  order: number
  status: string
  createdAt: Date
  memorySummary: string | null
  entities: unknown
  generatedAdventure: unknown
}

// US-232: `conclusionHint` saiu da tabela Quest (fecho é ramificado, não pré-escrito).
export interface AdventureExportQuest {
  title: string
  description: string
  status: string
  isPrimary: boolean
  objective: string | null
}

export interface AdventureExportCharacter {
  name: string
  race: string
  class: string
  level: number
  background: unknown
  origin: unknown
  locale: string
}

export interface AdventureExportCharacterState {
  hp: number
  maxHp: number
  inventory: unknown
  conditions: unknown
  sceneState: unknown
}

export interface AdventureExportEventLog {
  type: string
  payload: unknown
  summarized: boolean
  createdAt: Date
}

export interface AdventureExportSystem {
  id: string
  name: string
  version: string
  sourceType: string
}

export interface AdventureExportData {
  adventure: AdventureExportAdventure
  quests: AdventureExportQuest[]
  character: AdventureExportCharacter
  characterState: AdventureExportCharacterState | null
  eventLogs: AdventureExportEventLog[]
  system: AdventureExportSystem
}

// US-202/US-232: rubrica fixa de leitura — o roteiro do que julgar à mão, sem nota nem chamada
// de modelo. Ajustada pra autoria mundo-primeiro (facções no lugar de antagonista único).
export const EXPORT_RUBRIC = [
  'NPCs se repetem com nomes diferentes? (mesmo papel, mesma função narrativa)',
  'As facções têm desejos que REALMENTE colidem, ou são rótulos intercambiáveis?',
  'unlocks de cada encontro encadeia no seguinte, ou é frase solta?',
  'O fecho é ramificado sem herói (cada rumo com um custo), ou há um "rumo certo" disfarçado?',
  'boxedText/description varia entre os locais, ou é a mesma prosa reciclada?',
  'A description de algum local cita NPC (não deveria — presença fica em occupants)?',
]

type ArtifactView =
  | { available: false }
  | { available: true; valid: false; raw: unknown; warning: string }
  | {
      available: true
      valid: true
      registry: GeneratedAdventure['registry']
      summary: string
      world: GeneratedAdventure['world']
      story: string
      start: string
      factions: GeneratedAdventure['factions']
      npcs: Array<GeneratedAdventure['npcs'][number] & { isGenericCombatant: boolean; factionName?: string }>
      locations: Array<GeneratedAdventure['locations'][number] & { occupantNames: string[]; factionName?: string }>
      challenges: Array<GeneratedAdventure['challenges'][number] & { locationTitle: string }>
      encounters: Array<{
        id: string
        type: string
        locationTitle: string
        npcNames: string[]
        fiction: string
        behaviors: string
        goal: string
        complications: string
        unlocks: string
      }>
      objective: { description: string; reward: GeneratedAdventure['objective']['reward']; locationTitle: string }
      branchedResolution: GeneratedAdventure['branchedResolution']
      followUps: string[]
    }

/**
 * US-202: tipa `Adventure.generatedAdventure` na leitura (nunca confia no `Json` cru) e resolve
 * toda referência por id para o nome/título real. `raw == null` = aventura sem artefato; parse
 * falho = artefato de schema antigo (US-232: sem world/factions, com conclusion/antagonist) que
 * não revalida — os dois casos degradam em vez de derrubar o export inteiro.
 */
function resolveArtifact(raw: unknown): ArtifactView {
  if (raw == null) return { available: false }
  const parsed = GeneratedAdventureSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      available: true,
      valid: false,
      raw,
      warning:
        'Artefato gravado não revalida contra o GeneratedAdventureSchema atual (provável artefato de schema anterior à US-232) — mostrado cru abaixo, sem resolução de referência.',
    }
  }

  const a = parsed.data
  const locationTitleById = new Map(a.locations.map((l) => [l.id, l.title]))
  const npcNameById = new Map(a.npcs.map((n) => [n.id, n.name]))
  const factionNameById = new Map(a.factions.map((f) => [f.id, f.name]))
  const resolveNpcNames = (ids: string[]) => ids.map((id) => npcNameById.get(id) ?? id)

  return {
    available: true,
    valid: true,
    registry: a.registry,
    summary: a.summary,
    world: a.world,
    story: a.story,
    start: a.start,
    factions: a.factions,
    // US-202 Notas: NPC de combate (`role` ∈ MONSTER_ROLE_CR) é combatente genérico do motor —
    // marcado pra não ser lido como "NPC sem personalidade". (Autoria mundo-primeiro não gera
    // mais esses, mas a marca é barata e robusta a mudança futura.)
    npcs: a.npcs.map((n) => ({
      ...n,
      isGenericCombatant: n.role in MONSTER_ROLE_CR,
      ...(n.factionId ? { factionName: factionNameById.get(n.factionId) ?? n.factionId } : {}),
    })),
    locations: a.locations.map((l) => ({
      ...l,
      occupantNames: resolveNpcNames(l.occupants),
      ...(l.factionId ? { factionName: factionNameById.get(l.factionId) ?? l.factionId } : {}),
    })),
    challenges: a.challenges.map((c) => ({ ...c, locationTitle: locationTitleById.get(c.locationId) ?? c.locationId })),
    encounters: a.encounters.map((e) => ({
      id: e.id,
      type: e.type,
      locationTitle: locationTitleById.get(e.locationId) ?? e.locationId,
      npcNames: resolveNpcNames(e.npcIds),
      fiction: e.fiction,
      behaviors: e.behaviors,
      goal: e.goal,
      complications: e.complications,
      unlocks: e.unlocks,
    })),
    objective: {
      description: a.objective.description,
      reward: a.objective.reward,
      locationTitle: locationTitleById.get(a.objective.locationId) ?? a.objective.locationId,
    },
    branchedResolution: a.branchedResolution,
    followUps: a.followUps,
  }
}

export interface AdventureExportView {
  rubric: string[]
  adventure: AdventureExportAdventure
  artifact: ArtifactView
  quests: AdventureExportQuest[]
  character: AdventureExportCharacter
  characterState: AdventureExportCharacterState | null
  eventLogs: AdventureExportEventLog[]
  system: AdventureExportSystem
}

// US-202: uma view só alimenta os dois formatos (`?format=json` serializa isto direto; o
// Markdown é `renderAdventureExportMarkdown` sobre o mesmo objeto).
export function buildAdventureExportView(data: AdventureExportData): AdventureExportView {
  return {
    rubric: EXPORT_RUBRIC,
    adventure: data.adventure,
    artifact: resolveArtifact(data.adventure.generatedAdventure),
    quests: data.quests,
    character: data.character,
    characterState: data.characterState,
    eventLogs: data.eventLogs,
    system: data.system,
  }
}

// US-202: ACTION/NARRATION viram diálogo legível; os demais tipos viram uma linha compacta.
// US-257: INTRODUCTION (prólogo do Mestre ANTES da cena) usa o MESMO formato de NARRATION.
function renderEventLine(log: AdventureExportEventLog): string {
  const ts = log.createdAt.toISOString()
  if (log.type === 'ACTION') return `**Jogador** (${ts}): ${(log.payload as { text?: string }).text ?? ''}`
  if (log.type === 'NARRATION' || log.type === 'INTRODUCTION') return `**Mestre** (${ts}): ${(log.payload as { text?: string }).text ?? ''}`
  return `- [${log.type}] ${JSON.stringify(log.payload)} — ${ts}`
}

/**
 * US-202/US-232: Markdown na ordem da autoria (mundo → story/facções → objetivo → NPCs →
 * locais → desafios → encontros com `unlocks` → fecho ramificado → desdobramentos → log).
 */
export function renderAdventureExportMarkdown(view: AdventureExportView): string {
  const lines: string[] = []

  lines.push(`# Export — Aventura ${view.adventure.id}`, '')
  lines.push('## Como ler isto')
  for (const item of view.rubric) lines.push(`- [ ] ${item}`)
  lines.push('')

  lines.push('## Sistema e aventura')
  lines.push(`- Sistema: ${view.system.name} v${view.system.version} (${view.system.sourceType})`)
  lines.push(`- Aventura: "${view.adventure.title}" | ordem ${view.adventure.order} | status ${view.adventure.status} | criada em ${view.adventure.createdAt.toISOString()}`)
  lines.push(`- Resumo de memória: ${view.adventure.memorySummary ?? '(nenhum)'}`, '')

  lines.push('## Personagem')
  lines.push(`- ${view.character.name} — ${view.character.race} ${view.character.class}, nível ${view.character.level} (${view.character.locale})`)
  lines.push(`- Background: ${JSON.stringify(view.character.background)}`)
  lines.push(`- Origin: ${JSON.stringify(view.character.origin)}`, '')

  lines.push(...renderArtifact(view.artifact))

  lines.push('## Quest registrada')
  for (const q of view.quests) {
    lines.push(`- **${q.title}** — status ${q.status}${q.isPrimary ? ' (primária)' : ''}`)
    if (q.objective) lines.push(`  - Objetivo: ${q.objective}`)
  }
  lines.push('')

  lines.push('## Entidades registadas (ledger)', '```json', JSON.stringify(view.adventure.entities ?? [], null, 2), '```', '')

  lines.push('## Estado do personagem')
  if (view.characterState) {
    const cs = view.characterState
    lines.push(`- HP: ${cs.hp}/${cs.maxHp}`)
    lines.push(`- Condições: ${JSON.stringify(cs.conditions)}`)
    lines.push(`- Inventário: ${JSON.stringify(cs.inventory)}`)
    lines.push(`- Cena: ${JSON.stringify(cs.sceneState)}`)
  } else {
    lines.push('(sem CharacterState para esta aventura)')
  }
  lines.push('')

  lines.push('## Log de jogo')
  for (const log of view.eventLogs) lines.push(renderEventLine(log))

  return lines.join('\n')
}

function renderArtifact(artifact: ArtifactView): string[] {
  if (!artifact.available) {
    return ['## Artefato da aventura gerada', '**Ausente** — esta aventura foi criada sem `generatedAdventure`.', '']
  }
  if (!artifact.valid) {
    return ['## Artefato da aventura gerada', `**Aviso:** ${artifact.warning}`, '```json', JSON.stringify(artifact.raw, null, 2), '```', '']
  }

  const a = artifact
  const lines: string[] = []
  lines.push('## Registro')
  lines.push(`- Tom: ${a.registry.tone} | Cenário: ${a.registry.setting} | Tipo de área: ${a.registry.areaType}`, '')

  lines.push('## Mundo')
  lines.push(`### ${a.world.name}`)
  lines.push(a.world.description)
  if (a.world.anchors && a.world.anchors.length > 0) lines.push(`- Âncoras: ${a.world.anchors.join(', ')}`)
  lines.push('')

  lines.push('## Sumário', a.summary, '')
  lines.push('## Story', a.story, '')
  lines.push('## Início', a.start, '')

  lines.push('## Facções')
  for (const f of a.factions) lines.push(`- **${f.name}** (${f.kind}) — quer: ${f.want}`)
  lines.push('')

  lines.push('## Objetivo')
  lines.push(a.objective.description)
  lines.push(`- Recompensa: ${a.objective.reward.name} — ${a.objective.reward.effect}`)
  lines.push(`- Resolve em: ${a.objective.locationTitle}`, '')

  lines.push('## NPCs')
  for (const npc of a.npcs) {
    const tag = npc.isGenericCombatant ? ' (combatente genérico do motor, não personagem)' : ''
    const faction = npc.factionName ? ` [${npc.factionName}]` : ''
    lines.push(`- **${npc.name}** — ${npc.role}${faction}${tag}`)
    lines.push(`  - Quer: ${npc.want}`)
  }
  lines.push('')

  lines.push('## Locais')
  for (const l of a.locations) {
    lines.push(`### ${l.title} — vibe: ${l.vibe}${l.factionName ? ` [${l.factionName}]` : ''}`)
    lines.push(`- Aspectos: ${l.aspects.join(', ') || '(nenhum)'}`)
    lines.push(`- Ocupantes: ${l.occupantNames.join(', ') || '(nenhum)'}`)
    lines.push(`- Boxed text: ${l.boxedText}`)
    lines.push(`- Descrição: ${l.description}`, '')
  }

  lines.push('## Desafios (não-combate)')
  for (const c of a.challenges) {
    lines.push(`### ${c.locationTitle}`)
    lines.push(`- Teste: ${c.test}`)
    lines.push(`- Situação: ${c.situation}`)
    lines.push(`- Consequência: ${c.consequence}`, '')
  }

  lines.push('## Encontros')
  a.encounters.forEach((e, i) => {
    lines.push(`### Encontro ${i + 1} — ${e.type} em ${e.locationTitle}`)
    lines.push(`- NPCs: ${e.npcNames.join(', ') || '(nenhum)'}`)
    lines.push(`- Ficção: ${e.fiction}`)
    lines.push(`- Comportamento: ${e.behaviors}`)
    lines.push(`- Objetivo: ${e.goal}`)
    lines.push(`- Complicação: ${e.complications}`)
    lines.push(`- Unlocks: ${e.unlocks}`, '')
  })

  lines.push('## Fecho ramificado')
  for (const b of a.branchedResolution) lines.push(`- **${b.choice}** → ${b.consequence}`)
  lines.push('')

  lines.push('## Desdobramentos')
  for (const f of a.followUps) lines.push(`- ${f}`)
  lines.push('')

  return lines
}
