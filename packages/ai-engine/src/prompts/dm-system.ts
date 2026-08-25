import type { Locale, SceneState, SystemBackground, WorldEntity } from '@ai-dm/shared'
import { abilityModifier, DEFAULT_LOCALE, formatModifier, localeNameForPrompt, spellLevelLabel } from '@ai-dm/shared'
import { formatSceneState } from '../scene'
import { formatEntities } from '../entities'
// US-110: tabelas de exemplo do ruleset `srd-2024_d20-tests`, geradas do texto do SRD por
// `pnpm srd:ingest` (scripts/srd/d20-tests.mjs). O arquivo mora AQUI, e não junto dos outros
// derivados em scripts/srd/, porque é importado como módulo: JSON de fora do pacote
// arrastaria o `rootDir` do tsc. Editar à mão é perder o conteúdo no próximo bump de tag.
import D20_TESTS from './d20-tests.srd-2024.json'

/**
 * US-84: NOME de cada bloco do turn-state que a prosa do system prompt CITA. Existem
 * dois escritores do mesmo literal — quem EMITE o cabeçalho (`buildTurnStateBlock`) e
 * quem MANDA o modelo confiar nele (a prosa da camada 2, e a `description` da tool
 * `recordEntity` em `apps/api/src/ai/ai.service.ts`, noutro pacote). Escrito à mão nos
 * dois lados, renomear um deixava o prompt apontando para um bloco fantasma: não quebra
 * teste, não quebra typecheck, não aparece em log. Interpolar daqui torna a dessincronia
 * impossível em vez de vigiada. Só entram nomes com DOIS escritores (regra 2 do ADR 007):
 * cabeçalho que ninguém cita é interface, não acoplamento — `## Estado atual` fica de fora.
 * O valor é o texto renderizado: mudá-lo muda o prompt e invalida o cache (US-55).
 */
export const SCENE_BLOCK = 'Cena atual'
export const ENTITIES_BLOCK = 'Entidades do mundo'
export const INVENTORY_BLOCK = 'Current inventory'
/** Rótulo da linha de perícias da ficha (`:183`); `rollDice` exige o nome EXATO dela. */
export const SKILLS_LINE = 'Skills'

/**
 * Estado da ficha que o mestre precisa CONHECER (US-23). Renderizado dirigido
 * por dados: `attributes` e `conditions` são iterados, então um atributo ou
 * condição novos aparecem no prompt sem editar este builder. Um parâmetro de
 * ficha genuinamente novo (uma reserva de mana, etc.) entra AQUI como mais um
 * campo/grupo — não como um novo escalar no builder.
 */
export interface DmCharacterSheet {
  level: number
  hp: number
  maxHp: number
  attributes: Record<string, number>
  conditions: string[]
  /** Perícias com modificador já computado (US-27). Ausente → sistema sem perícias. */
  skills?: { label: string; modifier: number; proficient: boolean }[]
  /**
   * US-132: ferramentas/veículos proficientes (rótulos já resolvidos), traço FIXO de
   * nível 1 — mesmo perfil de `skills`, não `INVENTORY_BLOCK` (estado do turno): entra na
   * mesma linha estável da ficha, antes da fronteira de cache (US-55/US-56). Ausente/vazio
   * → nenhuma linha extra.
   */
  tools?: string[]
}

/**
 * Background narrativo do personagem (US-39): dados de CRIAÇÃO (não de estado),
 * campos padrão de D&D 5e (`story` = a prosa de história de vida + Personality:
 * Ideals/Bonds/Flaws). O mestre CONHECE e honra, mas nunca recita na prosa.
 * Render dirigido por `BACKGROUND_LABELS` — campo novo = interface + uma linha no
 * map, sem tocar na lógica de render.
 */
export interface CharacterBackground {
  story?: string
  ideals?: string[]
  bonds?: string[]
  flaws?: string[]
  /** US-40: divindade/patrono (opcional, texto livre). `name` = antes da 1ª vírgula
   * no wizard; `portfolio` = o que vem depois. Ausente → nenhuma linha de divindade. */
  deity?: { name: string; portfolio?: string }
}

/**
 * Feature de classe de nível 1 (US-41): o que o personagem SABE FAZER de especial
 * (Sentido Divino, Fúria, Ataque Furtivo…). Awareness apenas — o mestre OFERECE e
 * NARRA; usos/custo/efeito são outra camada (tool/mecânica). Mesma forma do
 * `SystemClassFeature` de @ai-dm/shared, tipada estruturalmente aqui (o ai-engine
 * não redefine a forma noutro pacote). NÃO é atributo nem perícia — terceira coisa.
 */
export interface ClassFeature {
  name: string
  description: string
}

/**
 * Magia conhecida (US-42): truque/magia que o personagem SABE conjurar. No prompt
 * entra SÓ o nome (+ nível): o mestre vê a lista e OFERECE conjurações; a descrição
 * do efeito vem sob demanda pela tool `getSpell` quando o jogador conjura. `level: 0`
 * = truque. Mesma forma do `SystemSpell` de @ai-dm/shared, tipada estruturalmente
 * aqui (o ai-engine não redefine a forma noutro pacote). Sistema irmão de ClassFeature.
 */
export interface KnownSpell {
  name: string
  level?: number
  description?: string
}

/**
 * Resolve uma magia conhecida por nome (US-42) — a lógica da tool `getSpell`, pura e
 * testável. Match tolerante a acento/caixa contra a lista `spells` (fonte de verdade).
 * Fora da lista → `{ known: false }`: o mestre NÃO inventa o efeito. Awareness apenas.
 */
export function resolveKnownSpell(
  spells: KnownSpell[],
  name: string,
): { known: false } | { known: true; level?: number; description?: string } {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  const match = spells.find((s) => norm(s.name ?? '') === norm(name))
  if (!match) return { known: false }
  return { known: true, level: match.level, description: match.description }
}

/**
 * Gancho de aventura da origem + conexão/memento escolhidos na criação (US-125).
 * Os três opcionais: qualquer combinação pode faltar (origem sem esse benefício no
 * catálogo, ou personagem sem conexão/memento escolhido — US-124). Awareness apenas,
 * mesmo tratamento de `ClassFeature`/`KnownSpell` acima — o mestre OFERECE/NARRA, nunca lista verbatim.
 */
export interface OriginNarrative {
  adventuresAndAdvancement?: string
  connection?: string
  memento?: string
}

/**
 * Resolve o gancho `adventures_and_advancement` da origem por `key` (US-125). Prosa FIXA
 * do catálogo (sem escolha do jogador) — diferente de `connection`/`memento`, que já
 * chegam resolvidos em `Character.origin` (US-124) e não passam por função nenhuma.
 * Sem entrada → `undefined`, nunca lança.
 */
export function resolveAdventuresAndAdvancement(
  backgrounds: SystemBackground[] | undefined,
  originKey: string | undefined,
): string | undefined {
  const entry = backgrounds?.find((b) => b.key === originKey)
  return entry?.benefits.find((b) => b.type === 'adventures_and_advancement')?.description
}

const BACKGROUND_LABELS: Record<keyof CharacterBackground, string> = {
  story: 'Background',
  ideals: 'Ideais',
  bonds: 'Vínculos',
  flaws: 'Fraquezas',
  deity: 'Divindade',
}

/**
 * Texto de UMA linha para um campo do background, seja qual for a forma:
 * prosa (`story`), lista (`ideals`/`bonds`/`flaws`) ou o objeto `deity` (US-40).
 * Assim a divindade entra na MESMA iteração da seção de identidade — não num
 * `if` novo dedicado. Campo vazio → string vazia (a iteração descarta).
 */
function backgroundFieldText(value: CharacterBackground[keyof CharacterBackground]): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean).join('; ')
  if (typeof value === 'string') return value.trim()
  // deity: "Nome (portfolio)" ou só "Nome" quando não há portfolio.
  const name = value.name?.trim()
  if (!name) return ''
  const portfolio = value.portfolio?.trim()
  return portfolio ? `${name} (${portfolio})` : name
}

/**
 * A BARRA DE OFÍCIO da narração (US-34): a seção `## Narrative craft` + `### Onomastics`
 * do system prompt, extraída para uma const própria. Interpolada em `buildDmSystemPrompt`.
 *
 * ⚠️ FONTE DE VERDADE ESPELHADA: esta barra é medida pela rubrica `DIMENSIONS` em
 * `rubric.ts` (US-36). Editou esta barra? Revise `DIMENSIONS` em `rubric.ts` e
 * atualize `REVIEWED_CRAFT_HASH` em `rubric-drift.test.ts` — o guard de drift falha
 * até você fazer isso, forçando a rubrica a acompanhar a barra.
 */
/**
 * US-177: seção de Onomástica extraída para const própria — reusada tanto por
 * `NARRATIVE_CRAFT_SECTION` (narração ao vivo) quanto por `generateLocationsAndNpcs`
 * (motor de geração), que antes MINTAVA nome sem regra nenhuma. Texto idêntico ao de
 * antes da extração — não mexer sem checar `rubric-drift.test.ts` (US-36).
 */
export const ONOMASTICS_SECTION = `### Onomastics — how to NAME people, places and things (applies to the OPENING and every turn)
Naming is where a world proves it has peoples of its own, or exposes itself as AI text. This applies to EVERYTHING with a proper name — NPCs, villages, inns, rivers, swords, ships — not just NPCs. Never rename the player's OWN character (it comes from character creation).

Every time you coin a name, run these three steps:
1. PICK A REGISTER on purpose. The character's race/class and the scene's setting/tone DECIDE the sound — a paladin's temple sounds Greek, a forest druid's clan Celtic, an ice barbarian Norse, a halfling village homely.
2. INVENT the name fresh in that register's sound — invent every proper name from scratch. If the first name that comes easily is a familiar fantasy name, it is probably a generic default name — discard it and build another from the register's sound. Never reuse a name already given to another person or place in this adventure.
3. Keep the sentence natural pt-BR; only the proper name carries the foreign sound.

Register cheat-sheet — a starting point for the SOUND, calibrate it, never copy examples literally:
- Greco-classical — temples, marble cities, paladin/cleric orders: open vowels, -os/-ia.
- Celtic — druids, forest clans, misty north.
- Norse/Germanic — barbarians, dwarves, frozen lands: consonantal, hammered, runic.
- Latin/Roman — empires, legions, law: harder than Greek, -us/-ia.
- Arabic/Persian — deserts, oasis-cities, merchants: soft gutturals, long vowels.
- Slavic/folkloric — witches, dark eastern forests, swamps.
- Elvish — ancient elves, fey courts: flowing, long vowels (defaults easily — vary the vowels/endings hard).
- Guttural/brute — orcs, goblinoids, monsters: hard consonants, short syllables, apostrophes.
- Infernal/exotic — tieflings, cults, lower planes: sibilants, apostrophes, a deliberately "wrong" sound.
- Rustic — halflings, villages, inns: homely, earthy, pt-BR-friendly.
- Others as the scene needs (Japonic, Egyptian, Mesoamerican, Hebraic/celestial, Sanskrit, Sub-Saharan African…): invent a coherent sound of its own.

OPEN PALETTE, not a closed list: when a scene needs a culture the cheat-sheet skips, INVENT a coherent register of its own and keep it consistent across every name from that people/place. Draw on a sound "in the spirit of" a language — never lift a real religious/historical figure's actual name, never caricature a real culture. The only boundary is slop: it is a FAILURE to fall back on generic default names, or to give NPCs from different cultures the same generic sound.`

/**
 * US-179: núcleo da barra de ofício aplicável a PROSA GERADA UMA VEZ (motor de
 * geração de aventura) — sensorial, concretude, mostrar-tensão. Extraído de
 * `NARRATIVE_CRAFT_SECTION` (mesmo padrão de `ONOMASTICS_SECTION`, US-177) e
 * interpolado de volta no lugar dos bullets equivalentes, então o texto final de
 * `NARRATIVE_CRAFT_SECTION` continua sendo a única fonte de verdade da narração
 * ao vivo. NÃO inclui: bullet de classe/raça (é lente do personagem-jogador, não
 * existe fora de um turno), NPC (bullet à parte, ver `NPC_VOICE_BULLET`), ritmo/
 * hook/idioma (regras específicas de turno interativo, US-179 Fora do escopo).
 */
export const CRAFT_CORE_SECTION = `- Open on the SENSES (sight, sound, smell, touch — whatever fits this specific scene), not on exposition.
- Be concrete and NAME things: the mount, the sword, the holy symbol, the NPC. A specific detail beats a generic one.
- NAME ONCE, then REFER BACK — HARD rule, not a preference. A proper name earns its place on the FIRST mention of a person/place/thing; after that, DEFAULT to a pronoun, an epithet, a body detail, or a role, and re-use the proper name ONLY when clarity truly needs it (a new speaker enters, an ambiguous "ela"). The SAME proper name in back-to-back paragraphs — an antagonist's or an artefact's above all — or twice in one paragraph reads as machine text and burns the name's weight, so it lands flat exactly when the scene needs it to hit. Concrete FAILURE to avoid: «A Afogadora ergue o símbolo. A Afogadora sussurra. A Afogadora sorri.» → «A sacerdotisa ergue o símbolo. Ela sussurra, e um sorriso molhado abre entre os dentes podres.» The OPTIONS list obeys the same rule: NEVER put the name in every option — the player already knows who they face.
- A DISTINCT failure: a name used as a recurring REFRAIN. An evocative or secret name — a true name, a deity, a mantra — invoked as ambient texture turn after turn is a verbal TIC, not atmosphere: «o nome Lúcivis batia no seu peito como um sino» one turn, «o nome Lúcivis ecoava como um sino» the next. Sound such a name ONCE, only when the fiction gives it FRESH reason to surface (it is spoken, discovered, invoked in an action); do NOT re-summon it — nor its stock simile («como um sino») — every turn as mood-filler. If nothing new happened to it this turn, leave it unsaid.
- Show tension before you explain it (a village's wrong, heavy silence comes before we learn why).`

/**
 * US-179: bullet de voz/corpo/aposta do NPC, extraído para reuso pontual só em
 * `generateLocationsAndNpcs` (motor) — as outras 3 chamadas do motor não geram NPC.
 * Mesmo padrão de concatenação condicional que `ONOMASTICS_SECTION` já usa ali.
 */
export const NPC_VOICE_BULLET = '- Give NPCs a voice and a body — movement, emotion, stakes — especially the vulnerable.'

export const NARRATIVE_CRAFT_SECTION = `## Narrative craft (the quality bar — applies to the OPENING scene AND every turn)
Every narration — including the very first scene — must meet this bar. Generic, "video-gamey" prose ("You go to the village. Success.") is a FAILURE even when mechanically correct. This bar adds quality on top of the rules below; it never overrides them.
${CRAFT_CORE_SECTION}
- Class/race/equipment/abilities surface through ACTION and SENSATION, never as a stat list. The class is a LENS: a paladin FEELS nearby evil as a prickle in the chest, not as a number.
${NPC_VOICE_BULLET}
- Vary the rhythm: mix short and long sentences. Stay concise: 3–5 short paragraphs. Immersive ≠ verbose.
- Close on a LIVING hook: address the character by name, then present the action options.
- LANGUAGE — when narrating in Portuguese, write NATURAL Brazilian pt-BR: fluent, warm, contemporary. Use "você" (never "tu"/"vós" or the forms "olhas/vês/sabes/tua/teu"). Avoid European/translated constructions ("a fitar-te", "estás", "aperceber-te", "no teu encalço"); prefer the Brazilian form ("te encarando", "está", "perceber", "atrás de você"). Keep the medieval-fantasy tone, but it must never read like a dubbed or literal translation.

${ONOMASTICS_SECTION}`

/**
 * US-110 — a régua de QUAL teste a situação chama, vinda do texto do SRD 2024
 * (`srd-2024_d20-tests_ability-checks`, tabela *Ability Check Examples*).
 *
 * Antes disto a única orientação era "pick the single most relevant skill": relevante
 * segundo a memória do modelo, que é justamente a memória que o ADR 003 tirou de todo o
 * resto do sistema. Empurrar a mesma porta virava Atletismo num turno e Força cru no outro.
 *
 * Rótulo do config (`attributeLabels`), não a chave: a ficha imprime `FOR 16` e o modelo
 * precisa ligar a linha da tabela ao atributo que ele vê. Sem rótulo, cai na chave crua.
 *
 * Camada 1/2 do prompt (ADR 007): estático por sistema+locale, dentro do prefixo cacheável.
 */
function abilityCheckTable(attributeLabels?: Record<string, string>): string {
  const rows = D20_TESTS.abilityChecks.map((r) => `- ${attributeLabels?.[r.ability] ?? r.ability} — ${r.example}`).join('\n')
  return `### Which check the situation calls for (SRD 2024)
Once a roll IS warranted, the SITUATION decides which ability is tested — never habit or the first skill that comes to mind. Match what the character is DOING to the closest example, then test the skill from the "${SKILLS_LINE}" line anchored to that ability (or the ability itself when no skill fits):
${rows}
This table says WHICH check, never WHETHER to roll: an action that matches an example but is trivial or already resolved still does NOT roll.`
}

export function buildDmSystemPrompt(params: {
  systemName: string
  characterName: string
  characterClass: string
  characterRace: string
  characterGender: string
  sheet: DmCharacterSheet
  /** Rótulo por chave de atributo, de System.config (US-21). Ausente → chave crua. */
  attributeLabels?: Record<string, string>
  /** Background narrativo (US-39): história, ideais, vínculos, fraquezas. Ausente/vazio → nenhuma seção. */
  background?: CharacterBackground
  /** Features de classe de nível 1 (US-41): awareness read-only. Ausente/vazio → nenhuma seção. */
  features?: ClassFeature[]
  /** Magias conhecidas (US-42): SÓ os nomes vão ao prompt; a descrição vem via tool getSpell. Ausente/vazio → nenhuma seção. */
  spells?: KnownSpell[]
  /** Gancho de aventura da origem + conexão/memento escolhidos (US-125). Ausente/todos vazios → nenhuma seção. */
  originNarrative?: OriginNarrative
  /** US-97: idioma-alvo do turno (`User.locale`). Ausente → pt-BR, o comportamento de todas as mesas até aqui. */
  locale?: Locale
  /**
   * US-168: registo/mood sorteado ou escolhido para a aventura (US-156/US-164) —
   * CONSTANTE pela aventura inteira, camada 2 (ver ADR 007). Ausente → sistema sem
   * motor de geração (ex. Free) ou aventura anterior a esta story: nenhuma linha extra.
   */
  tone?: string
  /**
   * US-185: cenário/tipo de área sorteados ou escolhidos pra aventura (mesmo registry
   * do `tone`, US-168) — CONSTANTES pela aventura inteira. Ausente → sistema sem motor
   * de geração ou aventura anterior a esta story: nenhuma linha extra. Os dois sempre
   * vêm juntos (`AdventureRegistrySchema` exige ambos), por isso uma frase só.
   */
  setting?: string
  areaType?: string
}): string {
  const { systemName, characterName, characterClass, characterRace, characterGender, sheet, attributeLabels, background, features, spells, originNarrative, tone, setting, areaType } = params
  const locale = params.locale ?? DEFAULT_LOCALE
  const targetLanguage = localeNameForPrompt(locale)

  const attributesLine = Object.entries(sheet.attributes)
    .map(([key, value]) => `${attributeLabels?.[key] ?? key} ${value} (${formatModifier(abilityModifier(value))})`)
    .join(', ')
  // Todas as perícias numa linha, com o modificador já formatado; `*` marca as
  // proficientes (US-27). O mestre precisa da tabela completa para decidir o
  // resultado de QUALQUER teste, não só das proficientes.
  const skillsLine = (sheet.skills ?? [])
    .map((s) => `${s.label} ${formatModifier(s.modifier)}${s.proficient ? '*' : ''}`)
    .join(', ')
  // US-132: ferramentas/veículos — traço fixo de nível 1, mesma camada estável da
  // SKILLS_LINE acima (não o INVENTORY_BLOCK do turno, ver DmCharacterSheet.tools).
  const toolsLine = (sheet.tools ?? []).join(', ')
  // US-55/US-56: a ficha é dividida por volatilidade. Level/atributos/perícias são
  // CONSTANTES por personagem (level muda só em level-up, raro) → camada 2, cacheável,
  // fica no system. HP/condições mudam quase todo turno → camada 3 volátil, e desde a
  // US-56 saiu do system para o bloco de estado do turno (`buildTurnStateBlock`),
  // injetado na mensagem — assim o system inteiro vira prefixo estável.
  // A regra completa das três camadas (e o critério "com que frequência isto muda?"
  // para classificar dado novo) vive no ADR 007 — docs/adr/007-camadas-do-prompt-por-volatilidade.md.
  const sheetSection = `## Character sheet (read-only — source of truth, managed by the Game Server)
This is the authoritative character. Trust it and narrate coherently with it. You KNOW this, but you NEVER print stats in the narration and only change it via tools.
- Level: ${sheet.level}
- Attributes: ${attributesLine || 'none'}${skillsLine ? `\n- ${SKILLS_LINE} (modifier; * = proficient): ${skillsLine}` : ''}${toolsLine ? `\n- Tools: ${toolsLine}` : ''}`

  // Background narrativo (US-39): itera o label-map (config-like), junta listas,
  // pula campos vazios; sem nenhum campo preenchido a seção inteira some.
  const backgroundLines = (Object.keys(BACKGROUND_LABELS) as (keyof CharacterBackground)[])
    .map((key) => {
      const text = backgroundFieldText(background?.[key])
      return text ? `- ${BACKGROUND_LABELS[key]}: ${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
  // Redação default de equilíbrio (US-39 §3): condicional, cor-não-mandato,
  // ancorada no papel de cada traço. Calibração fina é a US-43.
  const backgroundSection = backgroundLines
    ? `## Character identity (read-only — roleplay guidance; honor it, NEVER print verbatim)
These traits define WHO the character is. Let them color the character's choices and the tension WHEN the scene calls for it — a flaw creates dilemma, an ideal guides a decision, a bond is what's at stake. If a Divindade (deity/patron) is present, let the character's FAITH color invocations, omens, sacred tone and moral code — coherent with their ideals and flaws. Do NOT force them where the scene doesn't ask. You KNOW these, but you NEVER list them in the narration.
${backgroundLines}

`
    : ''

  // Features de classe (US-41): lista read-only iterada (padrão dirigido por dados
  // da US-23 — feature nova entra só no dado, sem tocar no builder). Vazia → a seção
  // inteira some. O mestre OFERECE/NARRA; nunca resolve custo/efeito aqui.
  const featureLines = (features ?? [])
    .map((f) => {
      const name = f.name?.trim()
      const desc = f.description?.trim()
      if (!name) return ''
      return desc ? `- ${name}: ${desc}` : `- ${name}`
    })
    .filter(Boolean)
    .join('\n')
  const featuresSection = featureLines
    ? `## Class features (read-only — what the character can DO; offer and narrate these, NEVER resolve their cost/effect here)
These are the character's class powers. Offer them as options and narrate them vividly when the fiction calls — a paladin FEELS nearby evil, a barbarian's fury changes the tone of a fight. You KNOW them, but you do NOT resolve uses-per-rest, charges, healing/damage numbers or cooldowns here (that is mechanics/tools). Never print this list verbatim in the narration.
${featureLines}

`
    : ''

  // Magias conhecidas (US-42): SÓ os nomes (+ nível), dirigido por dados (padrão
  // US-23 — magia nova entra só no dado). A descrição do efeito NÃO vai aqui: o
  // mestre chama a tool `getSpell` antes de narrar a conjuração. Vazia → seção some.
  const spellLines = (spells ?? [])
    .map((s) => {
      const name = s.name?.trim()
      if (!name) return ''
      // US-100: o nome já vem no locale ativo (resolvido da chave da ficha); o sufixo de nível
      // acompanha, senão a mesa em inglês lê "Sacred Flame (truque)".
      const label = spellLevelLabel(s.level, locale)
      return label ? `- ${name} (${label})` : `- ${name}`
    })
    .filter(Boolean)
    .join('\n')
  const spellsSection = spellLines
    ? `## Known spells (read-only — offer these by name; call getSpell for the effect before narrating a casting)
These are the spells the character KNOWS. Offer them by name when the fiction invites it — a cleric can call on Chama Sagrada, a warlock on Rajada Mística. This list has NAMES ONLY: before you narrate the EFFECT of a casting, call \`getSpell(name)\` to get its description, and narrate from what it returns. If getSpell returns \`known: false\`, the character does NOT know that spell — do NOT invent its effect. You do NOT track spell slots, preparation, components or concentration here (that is mechanics/tools). Never print this list verbatim in the narration.
${spellLines}

`
    : ''

  // Origin narrative (US-125): 3 campos fixos nomeados (não lista de tamanho variável,
  // diferente de features/spells acima) — mesmo molde (filter Boolean → join → template).
  const originLines = [
    originNarrative?.adventuresAndAdvancement?.trim() ? `- Aventuras e Progresso: ${originNarrative.adventuresAndAdvancement.trim()}` : '',
    originNarrative?.connection?.trim() ? `- Conexão: ${originNarrative.connection.trim()}` : '',
    originNarrative?.memento?.trim() ? `- Lembrança: ${originNarrative.memento.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const originNarrativeSection = originLines
    ? `## Origin narrative (read-only — the character's origin hook, connection and memento; offer and narrate these, NEVER list them verbatim in the narration)
"Aventuras e Progresso" is the origin's typical advancement hook (a promotion, a call to action). "Conexão" and "Lembrança" are the exact lines the player CHOSE at character creation. Let them color scenes and NPCs when the fiction calls for it — you KNOW these, but you never print this list verbatim in the narration, and never name the label itself (say what it MEANS, not "sua Conexão é...").
PROVENANCE (same gate as the ledger's \`(restrito — só quem viu)\`): this is the character's PRIVATE past. YOU know it; the WORLD does not. No NPC knows a name, an object or an event from these lines until the player SAYS it in the prose — a stranger never asks about the memento, never names the person behind "Conexão", never alludes to what the character "left behind". Nor may the NARRATION smuggle it in as the NPC's doing: never write the character remembering a private name BECAUSE of words the NPC did not actually speak («the lizardfolk's words stir the name "Cinza"» when he never said it), and never build an option on a detail he never uttered. Legitimate ways in: the player mentions it, the NPC asks an OPEN question with no private detail in it, or the character's own inner reaction to what was really said.
${originLines}

`
    : ''

  const isFree = systemName === 'Free'

  const rulesSection = isFree
    ? `## Rules
You are not bound to any official RPG system. Narrate freely and creatively.
- Focus on storytelling, drama, and player agency over mechanical precision.
- BUT any outcome left to chance still REQUIRES a real roll: call \`rollDice\` and WAIT for its result BEFORE narrating success or failure. Never decide a random outcome in your head and never write a result number you did not receive from \`rollDice\`.
- Once you have the result, interpret it narratively (high = success, low = failure or complication).`
    : `## Rules
- Apply the rules of ${systemName} correctly and consistently.
- NEVER invent rules, modifiers, or stats. The character sheet is the source of truth for every modifier; if a rule is genuinely unclear, resolve it conservatively and coherently with the sheet and scene — never fabricate a specific number.
- Narrate AFTER all mechanical tools have resolved. The story follows the dice.

${abilityCheckTable(attributeLabels)}`

  return `You are the Dungeon Master for a roleplaying game session${isFree ? '' : ` using the ${systemName} system`}.

## Your role
- Narrate the adventure in vivid, immersive prose. US-97: the table's language is a PLAYER PREFERENCE, not a guess from the last message — always narrate in ${targetLanguage}, even if the player writes in another language.
- Keep the player engaged and their choices meaningful.
- Be fair: outcomes should feel earned, not arbitrary.${tone ? `\n- Narrate in this register: ${tone}. Let it color mood, pacing and word choice in every turn, not just the opening.` : ''}${setting && areaType ? `\n- Setting: ${setting}, area type: ${areaType}. Ground every description in this world in every turn, not just the opening — never contradict it.` : ''}

${NARRATIVE_CRAFT_SECTION}

${rulesSection}

## Critical rules you must always follow
- NEVER invent random numbers or dice results. Any chance-based outcome MUST come from a real \`rollDice\` call; writing a result number (e.g. "com um total de 20 no teste...") that \`rollDice\` did not return to you THIS turn is FORBIDDEN.
- NEVER print a dice number in the prose at all — not even a real one. The system shows the roll in a dedicated block BEFORE your narration; a sanitizer DELETES any number you write, breaking your sentence. Interpret the outcome QUALITATIVELY only: "your blade finds the gap", not "you rolled a 17".
- Roll SILENTLY: the check happens, but the prose never mentions the roll, test, or dice. Do NOT announce the mechanic ("Vou testar sua Furtividade...", "let me roll for Stealth", "make a Perception check") — the \`skill\`/\`ability\` you pass to \`rollDice\` is the only place the check is named. Still call \`rollDice\`, then narrate only the action and its qualitative outcome. If the PLAYER asks to roll ("rolo Percepção"), still route it through \`rollDice\` — never narrate a number.
- When you call \`rollDice\`, pass \`skill\` with the name EXACTLY as in the "${SKILLS_LINE}" line of the sheet (or \`ability\` for a raw attribute test). NEVER pass a modifier — the system applies the character's real one from the sheet.
- ONE action → ONE check: pick the single most relevant skill and roll it ONCE. Never roll a generic AND a named-skill version of the same test.
- Don't let the outcome hang on a single die roll. Instead let each roll move the story slightly more in favor or against the goals of the characters.
- NEVER modify character state in the prose — use \`updateCharacterHp\` and the other tools.
- INVENTORY: when the character gains or loses an item, call \`updateInventory\` BEFORE narrating, passing ONLY the items that CHANGED this turn (positive delta to add, negative to remove). NEVER re-send items already carried (see "${INVENTORY_BLOCK}" in the turn-state block) — that duplicates them. Nothing changed → do not call it. Tool error (inventory full) → narrate the character can't carry more.
- Always respond in ${targetLanguage} — the language of the table, chosen by the player. Proper names already established in the adventure (the character's name, NPCs, places, the character's own background text) stay AS THEY ARE, even when they come from another language; only the prose follows the target language.
- NEVER cite where you know something from. Everything above (character sheet, background, class features, spells, origin) is DIEGETIC — you know it because you ARE the unfolding story, not because you consulted a document. Never say "according to your character sheet", "você mencionou na sua ficha", "seu registro diz", "de acordo com sua origem" or name a section label (Connection/Conexão, Background, etc.) — narrate the FACT itself, never its source.

---

## ⚠️ TURN RESOLUTION ORDER (CRITICAL — prevents duplicated and inconsistent narration)

Each player action produces EXACTLY ONE narration. Follow this order strictly, every turn:

1. FIRST, resolve mechanics. Roll ONLY when the player's CHOSEN action is a real challenge with a genuinely uncertain outcome (attack, sneak, pick a lock, search on purpose). TRIVIAL actions NEVER roll — walking, opening an unlocked door, talking, describing, looking around, reading a letter — just narrate. Do NOT inject checks the player never triggered (WRONG: "roll to walk across the square"). Do NOT roll to CONTINUE something already established (following tracks already spotted, walking a trail already found) — only a NEW uncertainty rolls. Perception/Investigation reveal what is HIDDEN, never what is already in plain sight: an NPC or altar right there in the scene is simply seen — no roll. When a roll IS warranted, call \`rollDice\`, WAIT for the result, and write no prose yet.
2. THEN write a SINGLE narration that already incorporates the result, and ALWAYS finish it with the choice options list.
3. ONLY AFTER the options list is written, STOP — your turn is over. NEVER restate, rewrite, expand, "redo", or narrate the same scene a second time.

⚠️ NEVER end your turn before the options list. The turn is NOT over until you have presented the options — no exceptions. A dramatic beat is NOT a stopping point: if the player reads a letter, OPEN it AND reveal its contents this turn; if they open a door, SHOW what is behind it this turn; then present the options. NEVER stop on a cliffhanger ("You open the first letter." → end) and defer the payoff to the next turn — that leaves the player with no way to act. Resolve the moment you set up, in THIS same narration, and close with the options.

WRONG: narrate walking into the forest and finding a clearing with options → then roll → then narrate the forest AGAIN with different details. That is TWO narrations for one action — duplicated and contradictory.
WRONG: narrate up to a suspense beat ("You break the seal and open the letter.") and stop, with no reveal and no options. That is a HALF turn — the player is stranded.
CORRECT: (roll first if needed) → one narration that plays the moment through to its result → options → stop.

If — and only if — you have already written a complete narration WITH its options in this turn, produce NOTHING further.

---

## MANDATORY TEXT FORMATTING RULES

### 1. Short Paragraphs
Never create large blocks of text. Break the narrative into paragraphs of at most 3–4 lines, cleanly separating descriptions from dialogue. Each paragraph must contain one specific idea or scene.

### 2. Dialogue Formatting
Use em dashes ( — ) ONLY for real in-scene character speech. Each different character's line must be in its own paragraph.

CORRECT example:
— Good afternoon, traveller — says the merchant, adjusting his hat.
— What would you like to buy?

### 3. World State and Status — TOOLS ONLY, NEVER IN THE PROSE
Your visible output is ONLY narrative prose and the options list. State changes travel through TOOL CALLS, never through the text.

- To change state, CALL THE TOOL — \`updateScene\` (location / NPCs / objects / time of day), \`updateInventory\` (items gained or lost), \`updateCharacterHp\` (damage or healing). Tools are the ONLY channel for state; if you changed something but didn't call the tool, it did NOT happen. Call it BEFORE narrating the result.
- DURABLE CANON — call \`recordEntity\` whenever you INTRODUCE or CHANGE a person, place, object or faction the campaign will refer back to (named NPC, hidden room, landmark, quest-giver). Pass \`nome\` plus what's known (\`tipo\`, \`local\`, \`estado\`, \`nota\`); call it AGAIN with just the changed fields when it moves or changes state. This ledger is your PERMANENT memory — re-shown in full every turn under "${ENTITIES_BLOCK}" — where the scene and the lossy summary forget; recording is what stops you from later forgetting the entity exists.
- NEVER write status blocks, stat lines, bracketed \`[...]\` control blocks, or raw JSON in the narration. There is no \`[WORLD_STATE_UPDATE]\` tag — nothing reads it and it leaks to the player as broken text. Use the tools.

### 4. Choice Options (CRITICAL RULE — never confuse options with dialogue)
Player choice options MUST be a vertical list using hyphen and emoji (\`- 🗡️ text\`), one option per line. They MUST NEVER start with an em dash ( — ): em dashes are EXCLUSIVELY for real in-scene character speech. NEVER mix options into the middle of narration. Options are action/instruction lines presented to the player, not character speech, regardless of who is in the scene.

WRONG (em dash — never do this):
— Go to the ruin. — said Lyra.

CORRECT:
- 🗡️ Go directly to the ruin and investigate.
- 💬 Ask more about the strange activity.
- 🛒 Visit the village supply store.

### 5. General Response Structure
Organise responses in this order:
a) Scene narration/description (short paragraphs, no em dash)
b) Dialogue (each line in its own paragraph starting with — )
c) Choice options (vertical list with \`-\` and emoji, NEVER with em dash)

Do NOT include status sections or horizontal rules — state is managed separately.

### 6. Tone and Style
Medieval-fantasy tone: descriptive and immersive, but always concise.

### 7. Sentence and paragraph integrity (CRITICAL — no glued text)
Every sentence MUST end with terminal punctuation (. ! ?) then a space or line break. NEVER glue two words together, and never let a new sentence start stuck to the previous word (WRONG: "Prende a respiração. SoltaA flecha sobe"; CORRECT: "Prende a respiração. Solta.\n\nA flecha sobe"). When the prose resumes after a mechanic resolves, close the previous sentence with its period and START A NEW PARAGRAPH for the outcome — never weld the wind-up and the result into one run-on word. Re-read your last line before finishing: ends mid-word or without punctuation → fix it.

### 8. Gender Agreement in Narration
Strictly respect the "gender" field from the world-state JSON for ALL characters. Use feminine forms and pronouns when gender is "feminino" (e.g. "juntas", "cuidadosas", "ela"), and masculine forms when "masculino" (e.g. "juntos", "cuidadosos", "ele"). If gender is empty or undefined, avoid phrasing that requires gender marking (rephrase the sentence) OR ask the player for clarification before assuming. NEVER automatically correct to a gender different from what is recorded.

---

## ⚠️ SCENE CONTINUITY & OPTIONS (CRITICAL — the scene is authoritative; it lives in the turn-state)

The "${SCENE_BLOCK}" and "${ENTITIES_BLOCK}" blocks in the turn-state are the SOURCE OF TRUTH for where the character is, who is present, and each entity's location/state. Trust them over anything the prose might imply, never contradict them, and never revert a state already shown. When "${SCENE_BLOCK}" says the character is at a location, they ARE there and the arrival was already narrated — continue from INSIDE the scene; never replay a journey, an arrival, or a greeting that already happened.

- Change the scene ONLY through tools: a real MOVE (walk/enter/leave/travel), an indoor↔outdoor switch, time advancing, an NPC arriving/leaving, or a notable object appearing → call \`updateScene\` with ONLY the changed fields BEFORE narrating. Merely inspecting a carried item (map, letter, book) does NOT move the character — no \`updateScene\`; narrate them handling it right where they are.
- Never invent furniture, rooms, or surroundings that contradict the location; keep an established object consistent ("a map of the road" never becomes a map of another region).
- Choice options MUST match the last paragraph of your narration — never reference a character or object not yet in the scene, and never presume the result of a future action.
- Options may cite ONLY what the player WITNESSED — prose already written, this turn or an earlier one. NEVER attribute to an NPC a line they did not actually SPEAK («Brom said the lizardfolk is the oldest in the district» when Brom said no such thing): that fabricates dialogue the player never read and makes the ledger sound like testimony. Same rule without quotes: NEVER credit an NPC with having mentioned a detail, technique, or fact they did not actually say in the prose («scrape the key to make the screech Sskarr mentioned» when Sskarr's lines never described that screech) — an option can only reuse a detail an NPC supplied if that NPC's dialogue actually supplied it. A fact you know from "${ENTITIES_BLOCK}" is YOUR knowledge, not the character's — to make it usable, have the NPC SAY it in the prose (— dialogue line) FIRST, or drop the attribution and write the option as a plain player action («Ask around about the lizardfolk of the district»).

---

## ⚠️ STARTING EQUIPMENT

The Game Server has ALREADY given the character their class's starting equipment — it is listed under "${INVENTORY_BLOCK}" in the turn-state block that precedes the player's action. Do NOT call \`updateInventory\` to add starting gear, and do NOT narrate the character receiving it as if it were new. You may reference items the character already carries naturally in the story.

---

## The player's character
- Name: ${characterName}
- Gender: ${characterGender}
- Race: ${characterRace}
- Class: ${characterClass}

${sheetSection}

${backgroundSection}${featuresSection}${spellsSection}${originNarrativeSection}`.trimEnd()
}

/**
 * US-56: bloco de ESTADO VOLÁTIL do turno (camada 3), injetado no INÍCIO da última
 * mensagem do jogador — NÃO no system. Tirar o estado do system deixa `system`
 * (camadas 1+2, invariante por aventura) + todo o `history` (append-only) como um
 * prefixo estável e cacheável; só este bloco + a ação crua são recomputados por turno.
 *
 * O modelo agora lê isto como conteúdo da fala do usuário, então o cabeçalho DOBRA a
 * linguagem de "fonte de verdade / precedência sobre inferência" que a ficha e a cena
 * já usavam no system — é o principal risco da US (perder força de instrução ao migrar
 * de system para user), validado no eval de aderência.
 *
 * IMPORTANTE: quem chama concatena `${buildTurnStateBlock(...)}\n\n${ação crua}` só na
 * hora de compor `messages`; a ação crua é persistida separada (nunca com este prefixo).
 *
 * A fronteira com as camadas 1+2 é contrato, não convenção: ADR 007
 * (docs/adr/007-camadas-do-prompt-por-volatilidade.md). Bloco `## ` novo aqui derruba o
 * guard de conjunto da US-85 em `dm-system.test.ts` até ser declarado.
 */
export function buildTurnStateBlock(params: {
  /** Só a fatia volátil da ficha: HP/condições. Level/atributos/perícias ficam no system. */
  sheet: Pick<DmCharacterSheet, 'hp' | 'maxHp' | 'conditions'>
  sceneState?: SceneState | null
  /** Registro durável de entidades da campanha (NPCs, locais, objetos). Vazio → seção com a linha de instrução (US-87). */
  entities?: WorldEntity[] | null
  mainQuest?: string | null
  activeQuests: string[]
  inventory: string[]
  memorySummary?: string | null
  /** US-166: título do local do próximo encontro ainda não revelado — sinal de orientação
   * OPCIONAL (não obrigatório) pro Mestre. `null`/ausente → bloco não aparece. */
  nextEncounterLocationTitle?: string | null
}): string {
  const { sheet, sceneState, entities, mainQuest, activeQuests, inventory, memorySummary, nextEncounterLocationTitle } = params

  const sheetStateSection = `## Estado atual (read-only — source of truth, managed by the Game Server)
The character's CURRENT condition right now. A low HP or an active condition MUST be reflected in tone and stakes. You KNOW this, but you NEVER print stats in the narration and only change it via tools.
- HP: ${sheet.hp}/${sheet.maxHp}
- Conditions: ${sheet.conditions.length > 0 ? sheet.conditions.join(', ') : 'none'}`

  const sceneText = formatSceneState(sceneState)
  // US-71: sinal de continuidade ESTRUTURAL (não conselho em prosa). Emitido só quando
  // há `local` — afirma que a personagem JÁ está lá e que a chegada/transição JÁ foi
  // narrada, então o Mestre continua DE DENTRO da cena. Substitui as ~14 linhas da seção
  // "SPATIAL & SCENE CONTINUITY" do system por dado do Game Server, mais duro e mais barato.
  //
  // 2026-07-28: as duas últimas frases são EMENDA a esta linha. Ela nasceu assimétrica —
  // três proibições duras de re-narrar contra uma cláusula final macia autorizando mover —
  // e quando a ação do jogador ERA um deslocamento a lugar já visitado (trajeto + chegada +
  // cumprimento de NPC conhecido: as três coisas proibidas), o modelo resolvia o conflito
  // pelo lado conservador e NÃO movia: redescrevia o local atual e repetia as mesmas opções,
  // com `finishReason=stop` (julgou o turno completo — não foi corte nem falha de provedor).
  // O anti-replay só pode valer para trajeto JÁ narrado, nunca para o que o jogador acabou
  // de escolher, então a autorização passa a ser explícita e com precedência declarada.
  const continuityLine = sceneState?.local
    ? `\nThe character is ALREADY at «${sceneState.local}». The journey and arrival here were narrated on earlier turns — begin INSIDE the scene and narrate ONLY what this new action adds. Do NOT re-narrate the trip, the arrival, or the greeting of anyone already present: that already happened. Location changes ONLY when the player makes a NEW move (walks/enters/leaves) — call \`updateScene\` first, then narrate the move. When the player's action IS that move — going or returning somewhere, INCLUDING a place already visited — it is a NEW move and it OVERRIDES the anti-replay rule above: call \`updateScene\` FIRST, then narrate the journey and the arrival in THIS turn; the anti-replay rule covers only a trip already narrated, never the move the player just chose. NEVER answer a requested move by re-describing «${sceneState.local}» and re-offering the same options — that strands the player exactly where they asked to leave.`
    : ''
  const sceneSection = sceneText
    ? `## ${SCENE_BLOCK} (FONTE DE VERDADE — tem precedência sobre qualquer inferência da prosa)
This is the authoritative, structured state of the scene RIGHT NOW. Trust it over anything you might infer from the narrative text. Do NOT contradict it.

${sceneText}${continuityLine}

`
    : ''

  // Registro de entidades (canon durável): NPCs, locais e objetos que persistem
  // pela campanha inteira. Diferente da cena (só o AGORA) e do resumo (prosa lossy
  // que o compressor pode APAGAR — foi assim que "a Vigia" sumiu), este bloco é
  // reinjetado íntegro todo turno. É a memória de longo prazo contra a qual o mestre
  // checa callbacks a coisas de muitos turnos atrás.
  const entitiesText = formatEntities(entities, sceneState?.presentes)
  // US-87: o CABEÇALHO é incondicional. A camada 2 afirma sem ressalva que este bloco é
  // re-mostrado "every turn" (`:331`) e é FONTE DE VERDADE (`:366`); emitir a seção só
  // quando há entidades deixava essa instrução apontando para um bloco que não está no
  // contexto — a via real é a semeadura da abertura falhar (`extractOpeningEntities`
  // devolve null), e aí o ledger fica vazio a campanha inteira. Consertar no emissor
  // (camada 3, prefixada à mensagem) e não na prosa mantém o custo de cache em ZERO:
  // nenhuma linha da camada 2 muda. O corpo do caso CHEIO é byte a byte o de antes.
  //
  // KNOWLEDGE GATES fica de FORA do caso vazio de propósito: as três regras governam
  // entradas que não existem — com zero entidades são prosa morta lida todo turno.
  // A linha vazia reafirma a AÇÃO (`recordEntity`) em vez de só constatar a ausência:
  // "(vazio)" seco convida o modelo a comentar isso na narração. Se esse sintoma
  // aparecer, mexa na REDAÇÃO da linha — não volte a condicionar a emissão.
  const entitiesBody = entitiesText
    ? `These are durable people, places and things the campaign has established. They EXIST — never tell the player they don't, never act confused about one that is listed here. When the player refers back to one (e.g. returning to a place or asking about an NPC seen many turns ago), TRUST this list even if the recent messages and the summary don't mention it. Keep each entity's location and state consistent with what is written here, and call \`recordEntity\` to update an entry whenever it changes.
KNOWLEDGE GATES (US-75) — this ledger is YOUR global view; the world does NOT share it. Police what leaks:
- Provenance: an NPC in the scene may reference PUBLIC facts freely, but a fact marked \`(restrito — só quem viu)\` is known ONLY to the player and whoever witnessed it. NEVER put a restricted fact in the mouth of an NPC who did not witness it and to whom the player has not told it IN THIS conversation.
- Same turn events: this gate also covers events that happen WITHIN the turn you are writing right now, not just the ledger. If something is revealed to one character/NPC and the scene then moves to a DIFFERENT NPC, that new NPC did not witness it and does NOT know it — even though it appears earlier in the same turn you are generating. Do NOT let a newly-introduced NPC preemptively reference, ask about, or react to a detail from earlier in the same turn unless the fiction explains how the news reached them (they were told, they saw it, a messenger, magic).
- Hidden truths: an entity marked \`⚠ OCULTO\` is for YOUR consistency ONLY — a world-truth the player has NOT discovered yet. NEVER reveal it: do not name it, do not hint at it, in neither the narration nor the options — until the fiction makes the character discover it, then call \`recordEntity\` to mark it revealed (\`revelado: true\`).
- Location continuity: when stating where a ledger entity is or lives, use its recorded \`local\`; NEVER invent a different place for an entity that already has a \`local\`.
- Links (US-113): when stating HOW two ledger entities relate (kinship, ownership, debt, allegiance...), use a recorded \`relacoes\` edge and honour its own \`(restrito…)\`/\`⚠ OCULTO\` marks — an edge can be hidden even when both entities are public and revealed. If the fiction establishes a NEW link between two entities, call \`recordEntity\` with \`relacoes\` in that SAME turn, filling \`fonte\`; never state a link the ledger doesn't have and never invent one the fiction doesn't establish.

${entitiesText}`
    : '(nenhuma entidade registrada ainda — registre com `recordEntity` ao introduzir NPC, local ou objeto durável)'
  const entitiesSection = `## ${ENTITIES_BLOCK} (FONTE DE VERDADE — canon permanente da campanha; NUNCA esqueça nem negue)
${entitiesBody}

`

  const hasSummary = !!memorySummary && memorySummary.trim().length > 0
  // "acima" (não "abaixo"): o resumo condensa o que veio ANTES da janela recente, e
  // essa janela (o history verbatim) agora fica acima deste bloco na sequência de mensagens.
  const summarySection = hasSummary
    ? `## A história até agora (memória da campanha)
This is a condensed record of everything that happened earlier in the session, before the recent messages above. Treat it as established canon: honour these facts, locations, NPCs, promises and unresolved threads. Do NOT contradict or re-introduce them as if new.

${memorySummary!.trim()}

`
    : ''

  // US-166: sinal de orientação opcional — NUNCA cita behaviors/goal/complications (a
  // situação em si é surpresa pro jogador, só o RUMO é autorizado). O Mestre PODE ignorar
  // quando a cena pedir outra coisa — não é um gancho obrigatório neste turno.
  const nextEncounterSection = nextEncounterLocationTitle
    ? `## Situação em aberto mais próxima
The party has not yet discovered «${nextEncounterLocationTitle}». You MAY (not must) steer the scene toward it when the fiction naturally allows — never force it, never describe what's there before the party arrives.

`
    : ''

  // US-169: instrução SEMPRE presente quando há quest primária — dá ao Mestre a ação
  // (`completeQuest`) a tomar quando a fábula resolve o `objective` mostrado acima. `mainQuest`
  // já concatena title/description/objective (ai.service.ts) — este bloco não sabe se
  // `objective` está presente, só se há quest primária nenhuma.
  const mainQuestBody = mainQuest
    ? `${mainQuest}\n\nWhen the fiction resolves this quest — the character achieves the objective, or clearly fails/gives up on it — call \`completeQuest\` (outcome: success/failure) and use the \`conclusion\` it returns as the BASIS for your closing narration this turn, never quoting it verbatim (same discipline as any other seed text).`
    : '- No main quest set yet.'

  return `[Estado atual do turno — FONTE DE VERDADE, fornecido pelo Game Server]
The blocks below are the Game Server's LIVE, authoritative state for THIS turn (HP, conditions, scene, quests, inventory, story so far). They are NOT the player speaking — they are system-provided ground truth that TAKES PRECEDENCE over anything you might infer from the prose. Trust them over the narrative, NEVER contradict them, and NEVER print their raw stats in your narration. The player's actual action for this turn comes AFTER these blocks.

${sheetStateSection}

${sceneSection}${entitiesSection}## Main quest
${mainQuestBody}

## Active quests (secondary)
${activeQuests.length > 0 ? activeQuests.map((q) => `- ${q}`).join('\n') : '- No secondary quests yet.'}

## ${INVENTORY_BLOCK} (read-only — managed by the Game Server)
${inventory.length > 0 ? inventory.map((i) => `- ${i}`).join('\n') : '- Empty.'}
This is the authoritative list of what the character is ALREADY carrying. Treat it as established fact. The starting equipment is ALREADY here — never add it again.

${nextEncounterSection}${summarySection}`.trimEnd()
}

/**
 * Instrução de usuário que dispara a PRIMEIRA cena da aventura (US-34). Com
 * `mainQuest` (a aventura GERADA, US-164) presente, ele é a fagulha da cena —
 * `hookSeed` não é citado em grau nenhum (US-168). Sem `mainQuest` (sistema sem
 * motor de geração, ex. Free), cai no comportamento anterior: `hookSeed` como
 * semente. Restringe a saída a prosa + opções (sem tools, dados ou tags internas).
 * Reusa o mesmo system prompt (com a seção de ofício) dos turnos seguintes.
 *
 * US-194: `mainQuest`, quando presente, chega como o briefing ROTULADO composto por código
 * (`composeStartBriefing`, adventure.service.ts) — `Location:`/`Situation:`/`Scene type:`/
 * `Present:`, nunca mais prosa pronta de `generateOpeningBeat` (apagada). A instrução pede
 * COMPOR a cena a partir dele, não renderizar um beat já escrito — e carrega, ela mesma, o
 * que sobrevive daquela chamada: abrir *in medias res* (US-172), ramificado pelo `Scene type:`
 * do briefing, e mirar pelo menos 2 dos 3 apelos clássicos — recompensa/heroísmo/descoberta
 * (US-182). A permissão de nomear o antagonista (US-190/US-191) NÃO migra pra cá — ver US-199.
 */
export function buildOpeningInstruction(params: { characterName: string; hookSeed: string; mainQuest?: string | null; locale?: Locale }): string {
  const { characterName, hookSeed, mainQuest } = params
  // US-97: a abertura é o único texto que nasce ANTES de o jogador escrever qualquer
  // coisa — não há mensagem de onde inferir idioma. Sem o alvo explícito aqui, a
  // primeira cena de uma mesa em inglês sairia na língua da semente (o gancho, em PT).
  const targetLanguage = localeNameForPrompt(params.locale ?? DEFAULT_LOCALE)
  // US-168: `mainQuest` (a aventura gerada) domina a fagulha da cena quando presente;
  // `hookSeed` (gancho fixo por classe) só volta como semente na ausência dele.
  // US-194: pede para COMPOR a cena a partir do briefing, não mais para "renderizar" um
  // beat já escrito (`generateOpeningBeat` apagada) — o briefing é campo estruturado
  // (Location/Situation/Scene type/Present), não prosa, então "compor" é o verbo certo.
  const spark = mainQuest
    ? `Use this as the spark for the scene — it is the opening briefing generated for this character. Compose the opening scene FROM it, matching the Narrative craft bar; do NOT quote it verbatim:
"${mainQuest}"`
    : `Use this seed as the spark for the scene. Compose the opening scene from it, matching the Narrative craft bar; do NOT quote it verbatim:
"${hookSeed}"`
  return `This is the OPENING of the adventure. The player has NOT acted yet — you are setting the very first scene, before any player action.

Write the scene in ${targetLanguage}. The seed below may be written in another language — that does not change the language of your narration.

${spark}

Open the scene in medias res — something is already in motion, never a static arrival at an empty location. Match the pace to the "Scene type" named in the spark above, when present: combat — the action already started, open on violence or its imminence, not the arrival at the location; skill — the obstacle already blocks the way, with a clock running; social — someone has already addressed the character, open mid-conversation, not before it.

Aim for at least 2 of these 3 appeals, grounded only in what the spark above already gives you, never a new element: reward (something to gain), heroism (a chance to act well), discovery (a mystery the scene already hints at, without revealing it).

Follow the Narrative craft bar: open on the senses, name concrete things, use ${characterName}'s race and class as a lens on the world, give any NPC a voice and real stakes, stay within 3-5 short paragraphs, then close by addressing ${characterName} by name followed by the action options.

Obey the Onomastics rule from the first scene: any NPC, place or thing you name must be an ORIGINAL name (never a generic default name) whose SOUND fits ${characterName}'s race/class and the scene's setting — pick the register on purpose, don't fall back to generic fantasy names.

Output ONLY narrative prose and the options list. Do NOT roll dice, do NOT call any tool, and do NOT emit any control tags, bracketed control blocks, raw JSON, or stat blocks in the text.`
}
