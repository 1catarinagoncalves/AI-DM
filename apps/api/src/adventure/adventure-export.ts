import { GeneratedAdventureSchema, type GeneratedAdventure } from '@ai-dm/shared'
import { MONSTER_ROLE_CR } from '../adventure-generation/monster-roles'

// US-202: as seis fontes que o export junta (ver Modelo de dados da US) — formato já
// achatado pro que `buildAdventureExportView` consome, não as rows cruas do Prisma
// (o service faz esse achatamento em `getExportData`; este ficheiro fica testável sem banco).
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

export interface AdventureExportQuest {
  title: string
  description: string
  status: string
  isPrimary: boolean
  objective: string | null
  conclusionHint: string | null
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

// US-202: rubrica fixa de leitura — o roteiro do que julgar à mão, sem nota nem chamada de
// modelo (Questão em aberto #1 da US, resolvida por texto estático colado no output).
export const EXPORT_RUBRIC = [
  'NPCs se repetem com nomes diferentes? (mesmo papel, mesma função narrativa)',
  'Algum "segredo" não é segredo — já dado a conhecer em boxedText/description?',
  'unlocks de cada encontro encadeia no seguinte, ou é frase solta?',
  'O antagonista está ancorado nos segredos/locais, ou colado genérico no fim?',
  'boxedText varia entre os locais, ou é a mesma prosa reciclada?',
  'connection do antagonista cita o personagem real (origin/background), ou é genérica?',
]

type ArtifactView =
  | { available: false }
  | { available: true; valid: false; raw: unknown; warning: string }
  | {
      available: true
      valid: true
      registry: GeneratedAdventure['registry']
      summary: string
      start: string
      antagonist: GeneratedAdventure['antagonist'] & { npcName: string }
      npcs: Array<GeneratedAdventure['npcs'][number] & { isGenericCombatant: boolean }>
      secrets: Array<GeneratedAdventure['secrets'][number] & { locationTitle: string }>
      locations: Array<GeneratedAdventure['locations'][number] & { occupantNames: string[] }>
      encounters: Array<{
        id: string
        type: string
        locationTitle: string
        npcNames: string[]
        behaviors: string
        goal: string
        complications: string
        unlocks: string
      }>
      objective: string
      conclusion: string
      followUps: string[]
    }

/**
 * US-202: tipa `Adventure.generatedAdventure` na leitura (nunca confia no `Json` cru) e
 * resolve toda referência por id para o nome/título real — a junção que hoje se faz no
 * olho no Prisma Studio. `raw == null` é aventura pré-US-168 (sem artefato); parse falho é
 * artefato pré-US-193 que não revalida (US-193, "reparse de artefato antigo não é caminho
 * suportado") — os dois casos degradam em vez de derrubar o export inteiro.
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
        'Artefato gravado não revalida contra o GeneratedAdventureSchema atual (provável artefato pré-US-193/pré-US-168) — mostrado cru abaixo, sem resolução de referência.',
    }
  }

  const a = parsed.data
  const locationTitleById = new Map(a.locations.map((l) => [l.id, l.title]))
  const npcNameById = new Map(a.npcs.map((n) => [n.id, n.name]))
  const resolveNpcNames = (ids: string[]) => ids.map((id) => npcNameById.get(id) ?? id)

  return {
    available: true,
    valid: true,
    registry: a.registry,
    summary: a.summary,
    start: a.start,
    antagonist: { ...a.antagonist, npcName: npcNameById.get(a.antagonist.npcId) ?? a.antagonist.name },
    // US-202 Notas de implementação: NPC de combate (`role` ∈ MONSTER_ROLE_CR) é combatente
    // genérico do motor, não personagem — marcado para não ser lido como "NPC sem
    // personalidade" por falha do modelo.
    npcs: a.npcs.map((n) => ({ ...n, isGenericCombatant: n.role in MONSTER_ROLE_CR })),
    secrets: a.secrets.map((s) => ({ ...s, locationTitle: locationTitleById.get(s.locationId) ?? s.locationId })),
    locations: a.locations.map((l) => ({ ...l, occupantNames: resolveNpcNames(l.occupants) })),
    encounters: a.encounters.map((e) => ({
      id: e.id,
      type: e.type,
      locationTitle: locationTitleById.get(e.locationId) ?? e.locationId,
      npcNames: resolveNpcNames(e.npcIds),
      behaviors: e.behaviors,
      goal: e.goal,
      complications: e.complications,
      unlocks: e.unlocks,
    })),
    objective: a.objective,
    conclusion: a.conclusion,
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

// US-202: uma view só alimenta os dois formatos (`?format=json` serializa isto direto;
// o Markdown é `renderAdventureExportMarkdown` sobre o mesmo objeto) — "mesmo conteúdo",
// não duas montagens que podem divergir.
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

// US-202 Notas de implementação: ACTION/NARRATION viram diálogo legível; os demais tipos
// (DICE_ROLL, QUEST_UPDATE, CHARACTER_UPDATE) viram uma linha compacta — o log é contexto
// para a leitura, não o objeto principal dela.
function renderEventLine(log: AdventureExportEventLog): string {
  const ts = log.createdAt.toISOString()
  if (log.type === 'ACTION') return `**Jogador** (${ts}): ${(log.payload as { text?: string }).text ?? ''}`
  if (log.type === 'NARRATION') return `**Mestre** (${ts}): ${(log.payload as { text?: string }).text ?? ''}`
  return `- [${log.type}] ${JSON.stringify(log.payload)} — ${ts}`
}

/**
 * US-202: Markdown na ordem do pipeline de geração (registro → sumário → antagonista →
 * NPCs → segredos → locais → encontros com `unlocks` → objetivo → conclusão →
 * desdobramentos → log de jogo) — ler de cima a baixo é reconstituir a geração.
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
    if (q.conclusionHint) lines.push(`  - Conclusão prevista: ${q.conclusionHint}`)
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
    return ['## Artefato da aventura gerada', '**Ausente** — esta aventura foi criada antes da US-168 (sem `generatedAdventure`).', '']
  }
  if (!artifact.valid) {
    return ['## Artefato da aventura gerada', `**Aviso:** ${artifact.warning}`, '```json', JSON.stringify(artifact.raw, null, 2), '```', '']
  }

  const a = artifact
  const lines: string[] = []
  lines.push('## Registro')
  lines.push(`- Tom: ${a.registry.tone} | Cenário: ${a.registry.setting} | Tipo de área: ${a.registry.areaType}`, '')

  lines.push('## Sumário', a.summary, '')
  lines.push('## Início', a.start, '')

  lines.push('## Antagonista')
  lines.push(`- Nome: ${a.antagonist.name} (NPC: ${a.antagonist.npcName})`)
  lines.push(`- Quer: ${a.antagonist.want}`)
  lines.push(`- Método: ${a.antagonist.method}`)
  lines.push(`- Traço: ${a.antagonist.trait}`)
  lines.push(`- Fraqueza: ${a.antagonist.weakness}`)
  lines.push(`- Conexão: ${a.antagonist.connection}`, '')

  lines.push('## NPCs')
  for (const npc of a.npcs) {
    const tag = npc.isGenericCombatant ? ' (combatente genérico do motor, não personagem)' : ''
    lines.push(`- **${npc.name}** — ${npc.role}${tag}`)
    for (const it of npc.interactions) lines.push(`  - "${it.narrative}"`)
  }
  lines.push('')

  lines.push('## Segredos')
  for (const s of a.secrets) lines.push(`- Em ${s.locationTitle}: ${s.text}`)
  lines.push('')

  lines.push('## Locais')
  for (const l of a.locations) {
    lines.push(`### ${l.title} — vibe: ${l.vibe}`)
    lines.push(`- Aspectos: ${l.aspects.join(', ') || '(nenhum)'}`)
    lines.push(`- Ocupantes: ${l.occupantNames.join(', ') || '(nenhum)'}`)
    lines.push(`- Boxed text: ${l.boxedText}`)
    lines.push(`- Descrição: ${l.description}`, '')
  }

  lines.push('## Encontros')
  a.encounters.forEach((e, i) => {
    lines.push(`### Encontro ${i + 1} — ${e.type} em ${e.locationTitle}`)
    lines.push(`- NPCs: ${e.npcNames.join(', ') || '(nenhum)'}`)
    lines.push(`- Comportamento: ${e.behaviors}`)
    lines.push(`- Objetivo: ${e.goal}`)
    lines.push(`- Complicação: ${e.complications}`)
    lines.push(`- Unlocks: ${e.unlocks}`, '')
  })

  lines.push('## Objetivo', a.objective, '')
  lines.push('## Conclusão (spoiler)', a.conclusion, '')
  lines.push('## Desdobramentos')
  for (const f of a.followUps) lines.push(`- ${f}`)
  lines.push('')

  return lines
}
