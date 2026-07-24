import type { SceneState, WorldEntity } from '@ai-dm/shared'
import { abilityModifier, formatModifier, spellLevelLabel } from '@ai-dm/shared'
import { formatSceneState } from '../scene'
import { formatEntities } from '../entities'

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
export const NARRATIVE_CRAFT_SECTION = `## Narrative craft (the quality bar — applies to the OPENING scene AND every turn)
Every narration — including the very first scene — must meet this bar. Generic, "video-gamey" prose ("You go to the village. Success.") is a FAILURE even when mechanically correct. This bar adds quality on top of the rules below; it never overrides them.
- Open on the SENSES (rain, cold wet armour, the failing light of dusk), not on exposition.
- Be concrete and NAME things: the mount, the sword, the holy symbol, the NPC. A specific detail beats a generic one.
- Class/race/equipment/abilities surface through ACTION and SENSATION, never as a stat list. The class is a LENS: a paladin FEELS nearby evil as a prickle in the chest, not as a number.
- Show tension before you explain it (a village's wrong, heavy silence comes before we learn why).
- Give NPCs a voice and a body — movement, emotion, stakes — especially the vulnerable.
- Vary the rhythm: mix short and long sentences. Stay concise: 3–5 short paragraphs. Immersive ≠ verbose.
- Close on a LIVING hook: address the character by name, then present the action options.
- LANGUAGE — when narrating in Portuguese, write NATURAL Brazilian pt-BR: fluent, warm, contemporary. Use "você" (never "tu"/"vós" or the forms "olhas/vês/sabes/tua/teu"). Avoid European/translated constructions ("a fitar-te", "estás", "aperceber-te", "no teu encalço"); prefer the Brazilian form ("te encarando", "está", "perceber", "atrás de você"). Keep the medieval-fantasy tone, but it must never read like a dubbed or literal translation.

### Onomastics — how to NAME people, places and things (applies to the OPENING and every turn)
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
}): string {
  const { systemName, characterName, characterClass, characterRace, characterGender, sheet, attributeLabels, background, features, spells } = params

  const attributesLine = Object.entries(sheet.attributes)
    .map(([key, value]) => `${attributeLabels?.[key] ?? key} ${value} (${formatModifier(abilityModifier(value))})`)
    .join(', ')
  // Todas as perícias numa linha, com o modificador já formatado; `*` marca as
  // proficientes (US-27). O mestre precisa da tabela completa para decidir o
  // resultado de QUALQUER teste, não só das proficientes.
  const skillsLine = (sheet.skills ?? [])
    .map((s) => `${s.label} ${formatModifier(s.modifier)}${s.proficient ? '*' : ''}`)
    .join(', ')
  // US-55/US-56: a ficha é dividida por volatilidade. Level/atributos/perícias são
  // CONSTANTES por personagem (level muda só em level-up, raro) → camada 2, cacheável,
  // fica no system. HP/condições mudam quase todo turno → camada 3 volátil, e desde a
  // US-56 saiu do system para o bloco de estado do turno (`buildTurnStateBlock`),
  // injetado na mensagem — assim o system inteiro vira prefixo estável.
  const sheetSection = `## Character sheet (read-only — source of truth, managed by the Game Server)
This is the authoritative character. Trust it and narrate coherently with it. You KNOW this, but you NEVER print stats in the narration and only change it via tools.
- Level: ${sheet.level}
- Attributes: ${attributesLine || 'none'}${skillsLine ? `\n- Skills (modifier; * = proficient): ${skillsLine}` : ''}`

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
      const label = spellLevelLabel(s.level)
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
- Narrate AFTER all mechanical tools have resolved. The story follows the dice.`

  return `You are the Dungeon Master for a roleplaying game session${isFree ? '' : ` using the ${systemName} system`}.

## Your role
- Narrate the adventure in vivid, immersive prose in the same language the player uses.
- Keep the player engaged and their choices meaningful.
- Be fair: outcomes should feel earned, not arbitrary.

${NARRATIVE_CRAFT_SECTION}

${rulesSection}

## Critical rules you must always follow
- NEVER invent random numbers or dice results. Any chance-based outcome MUST come from a real \`rollDice\` call; writing a result number (e.g. "com um total de 20 no teste...") that \`rollDice\` did not return to you THIS turn is FORBIDDEN.
- NEVER print a dice number in the prose at all — not even a real one. The system shows the roll in a dedicated block BEFORE your narration; a sanitizer DELETES any number you write, breaking your sentence. Interpret the outcome QUALITATIVELY only: "your blade finds the gap", not "you rolled a 17".
- Roll SILENTLY: the check happens, but the prose never mentions the roll, test, or dice. Do NOT announce the mechanic ("Vou testar sua Furtividade...", "let me roll for Stealth", "make a Perception check") — the \`skill\`/\`ability\` you pass to \`rollDice\` is the only place the check is named. Still call \`rollDice\`, then narrate only the action and its qualitative outcome. If the PLAYER asks to roll ("rolo Percepção"), still route it through \`rollDice\` — never narrate a number.
- When you call \`rollDice\`, pass \`skill\` with the name EXACTLY as in the "Skills" line of the sheet (or \`ability\` for a raw attribute test). NEVER pass a modifier — the system applies the character's real one from the sheet.
- ONE action → ONE check: pick the single most relevant skill and roll it ONCE. Never roll a generic AND a named-skill version of the same test.
- NEVER modify character state in the prose — use \`updateCharacterHp\` and the other tools.
- INVENTORY: when the character gains or loses an item, call \`updateInventory\` BEFORE narrating, passing ONLY the items that CHANGED this turn (positive delta to add, negative to remove). NEVER re-send items already carried (see "Current inventory" in the turn-state block) — that duplicates them. Nothing changed → do not call it. Tool error (inventory full) → narrate the character can't carry more.
- Respond in the same language the player wrote in.

---

## ⚠️ TURN RESOLUTION ORDER (CRITICAL — prevents duplicated and inconsistent narration)

Each player action produces EXACTLY ONE narration. Follow this order strictly, every turn:

1. FIRST, resolve mechanics. Roll ONLY when the player's CHOSEN action is a real challenge with a genuinely uncertain outcome (attack, sneak, pick a lock, search on purpose). TRIVIAL actions NEVER roll — walking, opening an unlocked door, talking, describing, looking around, reading a letter — just narrate. Do NOT inject checks the player never triggered (WRONG: "roll to walk across the square"). Do NOT roll to CONTINUE something already established (following tracks already spotted, walking a trail already found) — only a NEW uncertainty rolls. Perception/Investigation reveal what is HIDDEN, never what is already in plain sight: an NPC or altar right there in the scene is simply seen — no roll. When a roll IS warranted, call \`rollDice\`, WAIT for the result, and write no prose yet.
2. THEN write a SINGLE narration that already incorporates the result, followed by the choice options.
3. STOP. Your turn is over. NEVER restate, rewrite, expand, "redo", or narrate the same scene a second time.

WRONG: narrate walking into the forest and finding a clearing with options → then roll → then narrate the forest AGAIN with different details. That is TWO narrations for one action — duplicated and contradictory.
CORRECT: (roll first if needed) → one narration that already reflects the result → options → stop.

If you have already written a complete narration with its options in this turn, produce NOTHING further.

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
- DURABLE CANON — call \`recordEntity\` whenever you INTRODUCE or CHANGE a person, place, object or faction the campaign will refer back to (named NPC, hidden room, landmark, quest-giver). Pass \`nome\` plus what's known (\`tipo\`, \`local\`, \`estado\`, \`nota\`); call it AGAIN with just the changed fields when it moves or changes state. This ledger is your PERMANENT memory — re-shown in full every turn under "Entidades do mundo" — where the scene and the lossy summary forget; recording is what stops you from later forgetting the entity exists.
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

The "Cena atual" and "Entidades do mundo" blocks in the turn-state are the SOURCE OF TRUTH for where the character is, who is present, and each entity's location/state. Trust them over anything the prose might imply, never contradict them, and never revert a state already shown. When "Cena atual" says the character is at a location, they ARE there and the arrival was already narrated — continue from INSIDE the scene; never replay a journey, an arrival, or a greeting that already happened.

- Change the scene ONLY through tools: a real MOVE (walk/enter/leave/travel), an indoor↔outdoor switch, time advancing, an NPC arriving/leaving, or a notable object appearing → call \`updateScene\` with ONLY the changed fields BEFORE narrating. Merely inspecting a carried item (map, letter, book) does NOT move the character — no \`updateScene\`; narrate them handling it right where they are.
- Never invent furniture, rooms, or surroundings that contradict the location; keep an established object consistent ("a map of the road" never becomes a map of another region).
- Choice options MUST match the last paragraph of your narration — never reference a character or object not yet in the scene, and never presume the result of a future action.

---

## ⚠️ STARTING EQUIPMENT

The Game Server has ALREADY given the character their class's starting equipment — it is listed under "Current inventory" in the turn-state block that precedes the player's action. Do NOT call \`updateInventory\` to add starting gear, and do NOT narrate the character receiving it as if it were new. You may reference items the character already carries naturally in the story.

---

## The player's character
- Name: ${characterName}
- Gender: ${characterGender}
- Race: ${characterRace}
- Class: ${characterClass}

${sheetSection}

${backgroundSection}${featuresSection}${spellsSection}`.trimEnd()
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
 */
export function buildTurnStateBlock(params: {
  /** Só a fatia volátil da ficha: HP/condições. Level/atributos/perícias ficam no system. */
  sheet: Pick<DmCharacterSheet, 'hp' | 'maxHp' | 'conditions'>
  sceneState?: SceneState | null
  /** Registro durável de entidades da campanha (NPCs, locais, objetos). Vazio → nenhuma seção. */
  entities?: WorldEntity[] | null
  mainQuest?: string | null
  activeQuests: string[]
  inventory: string[]
  memorySummary?: string | null
}): string {
  const { sheet, sceneState, entities, mainQuest, activeQuests, inventory, memorySummary } = params

  const sheetStateSection = `## Estado atual (read-only — source of truth, managed by the Game Server)
The character's CURRENT condition right now. A low HP or an active condition MUST be reflected in tone and stakes. You KNOW this, but you NEVER print stats in the narration and only change it via tools.
- HP: ${sheet.hp}/${sheet.maxHp}
- Conditions: ${sheet.conditions.length > 0 ? sheet.conditions.join(', ') : 'none'}`

  const sceneText = formatSceneState(sceneState)
  // US-71: sinal de continuidade ESTRUTURAL (não conselho em prosa). Emitido só quando
  // há `local` — afirma que a personagem JÁ está lá e que a chegada/transição JÁ foi
  // narrada, então o Mestre continua DE DENTRO da cena. Substitui as ~14 linhas da seção
  // "SPATIAL & SCENE CONTINUITY" do system por dado do Game Server, mais duro e mais barato.
  const continuityLine = sceneState?.local
    ? `\nThe character is ALREADY at «${sceneState.local}». The journey and arrival here were narrated on earlier turns — begin INSIDE the scene and narrate ONLY what this new action adds. Do NOT re-narrate the trip, the arrival, or the greeting of anyone already present: that already happened. Location changes ONLY when the player makes a NEW move (walks/enters/leaves) — call \`updateScene\` first, then narrate the move.`
    : ''
  const sceneSection = sceneText
    ? `## Cena atual (FONTE DE VERDADE — tem precedência sobre qualquer inferência da prosa)
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
  const entitiesSection = entitiesText
    ? `## Entidades do mundo (FONTE DE VERDADE — canon permanente da campanha; NUNCA esqueça nem negue)
These are durable people, places and things the campaign has established. They EXIST — never tell the player they don't, never act confused about one that is listed here. When the player refers back to one (e.g. returning to a place or asking about an NPC seen many turns ago), TRUST this list even if the recent messages and the summary don't mention it. Keep each entity's location and state consistent with what is written here, and call \`recordEntity\` to update an entry whenever it changes.

${entitiesText}

`
    : ''

  const hasSummary = !!memorySummary && memorySummary.trim().length > 0
  // "acima" (não "abaixo"): o resumo condensa o que veio ANTES da janela recente, e
  // essa janela (o history verbatim) agora fica acima deste bloco na sequência de mensagens.
  const summarySection = hasSummary
    ? `## A história até agora (memória da campanha)
This is a condensed record of everything that happened earlier in the session, before the recent messages above. Treat it as established canon: honour these facts, locations, NPCs, promises and unresolved threads. Do NOT contradict or re-introduce them as if new.

${memorySummary!.trim()}

`
    : ''

  return `[Estado atual do turno — FONTE DE VERDADE, fornecido pelo Game Server]
The blocks below are the Game Server's LIVE, authoritative state for THIS turn (HP, conditions, scene, quests, inventory, story so far). They are NOT the player speaking — they are system-provided ground truth that TAKES PRECEDENCE over anything you might infer from the prose. Trust them over the narrative, NEVER contradict them, and NEVER print their raw stats in your narration. The player's actual action for this turn comes AFTER these blocks.

${sheetStateSection}

${sceneSection}${entitiesSection}## Main quest
${mainQuest ? mainQuest : '- No main quest set yet.'}

## Active quests (secondary)
${activeQuests.length > 0 ? activeQuests.map((q) => `- ${q}`).join('\n') : '- No secondary quests yet.'}

## Current inventory (read-only — managed by the Game Server)
${inventory.length > 0 ? inventory.map((i) => `- ${i}`).join('\n') : '- Empty.'}
This is the authoritative list of what the character is ALREADY carrying. Treat it as established fact. The starting equipment is ALREADY here — never add it again.

${summarySection}`.trimEnd()
}

/**
 * Instrução de usuário que dispara a PRIMEIRA cena da aventura (US-34). O jogador
 * ainda não agiu; passamos a fagulha do gancho da classe como semente e
 * restringimos a saída a prosa + opções (sem tools, dados ou tags internas).
 * Reusa o mesmo system prompt (com a seção de ofício) dos turnos seguintes.
 */
export function buildOpeningInstruction(params: { characterName: string; hookSeed: string }): string {
  const { characterName, hookSeed } = params
  return `This is the OPENING of the adventure. The player has NOT acted yet — you are setting the very first scene, before any player action.

Use this seed as the spark for the scene. Expand it into a full cinematic opening that meets the Narrative craft bar; do NOT quote it verbatim:
"${hookSeed}"

Follow the Narrative craft bar: open on the senses, name concrete things, use ${characterName}'s race and class as a lens on the world, give any NPC a voice and real stakes, then close by addressing ${characterName} by name followed by the action options.

Obey the Onomastics rule from the first scene: any NPC, place or thing you name must be an ORIGINAL name (never a generic default name) whose SOUND fits ${characterName}'s race/class and the scene's setting — pick the register on purpose, don't fall back to generic fantasy names.

Output ONLY narrative prose and the options list. Do NOT roll dice, do NOT call any tool, and do NOT emit any control tags, bracketed control blocks, raw JSON, or stat blocks in the text.`
}
