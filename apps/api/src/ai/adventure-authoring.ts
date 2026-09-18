import { z } from 'zod'
import { CRAFT_CORE_SECTION, NPC_VOICE_BULLET, ONOMASTICS_SECTION } from '@ai-dm/ai-engine'
import { localeNameForPrompt, type Locale } from '@ai-dm/shared'
import type { AdventureSlice } from '../adventure-generation/adventure-slice'

// US-256: a autoria mundo-primeiro (US-232) virou DUAS chamadas — a fatia inicial (1A) e o resto
// (1B), esta com a fatia inteira no prompt como contexto FIXO. Este módulo tem os dois schemas,
// os dois system prompts e os dois prompts; `ai.service.ts` só orquestra a escada de modelos.
// Saiu de ai.service.ts (que já passava de 1900 linhas) na mesma story.

// US-232: schemas BRUTOS da autoria mundo-primeiro. Referências cruzadas por ÍNDICE (0-based na
// array irmã), NUNCA por id — mesmo padrão de `occupants` (US-158): o modelo aponta pra uma
// posição de um array que ele mesmo escreveu (na 1B, que a fatia já trouxe pronta no prompt); o
// código minta os ids reais (`faction-N`/`npc-N`/`loc-N`/…) depois do `.parse()`
// (adventure-generation/mint-adventure.ts).

/** US-256: chamada 1A — o que a jogadora lê primeiro. `start` por último (US-255): nesse ponto o
 * modelo já tem facção/NPC/local nomeados, mas ainda não viu challenges/encounters/objective. */
export const AUTHORING_SLICE_SCHEMA = z.object({
  world: z.object({
    name: z.string().min(1).describe('Nome próprio do mundo/lugar inventado — específico, não genérico'),
    description: z.string().min(1).describe('2-3 parágrafos de worldbuilding sensorial'),
    anchors: z.array(z.string()).describe('Localidades-âncora nomeadas'),
  }),
  summary: z.string().min(1).describe('Sinopse de UMA linha da aventura (lista/quest)'),
  story: z.string().min(1).describe('A seção Story: o que está errado + as forças (facções dissolvidas na prosa)'),
  factions: z.array(z.object({
    name: z.string().min(1),
    kind: z.string().min(1).describe('poder / submundo / culto / ordem / …'),
    want: z.string().min(1).describe('o que a facção quer — os desejos das facções COLIDEM'),
  })).min(1),
  npcs: z.array(z.object({
    name: z.string().min(1),
    role: z.string().min(1).describe('papel + descrição breve, 1 frase'),
    want: z.string().min(1).describe('motivação INDIVIDUAL do NPC (mais específica que a da facção)'),
    // `.nullish()`, não `.optional()`: v4.1-flash emite `"factionIndex": null` pro NPC neutro e o
    // Zod jogava fora o artefato INTEIRO (~8k tokens válidos) por causa de um campo (18/09/2026).
    factionIndex: z.number().int().min(0).nullish().describe('Índice (0-based) em factions[] — NÚMERO; omitir se NPC neutro'),
  })).min(1),
  locations: z.array(z.object({
    title: z.string().min(1),
    aspects: z.array(z.string()).describe('2-3 aspectos curtos, estilo Fate'),
    boxedText: z.string().min(1).describe('Texto lido em voz alta ao chegar, 2-3 frases'),
    description: z.string().min(1).describe('Notas do mestre — SÓ o lugar e itens, NUNCA cite NPCs aqui'),
    occupants: z.array(z.number().int().min(0)).describe('Índices (0-based) de npcs[] presentes — NÚMERO, [] se nenhum'),
    factionIndex: z.number().int().min(0).nullish().describe('Índice (0-based) em factions[] que controla o local — omitir se neutro'),
    vibe: z.enum(['combat', 'skill', 'social']),
  })).min(1),
  start: z.string().min(1).describe(
    'SÓ o gancho — a última parte da Story ("O gancho: …"). Escrito AGORA, com facção/NPC/local já nomeados: cite pelo menos um nome próprio. NÃO cite challenges/encounters/objective/branchedResolution — ainda não foram escritos.',
  ),
})

/** US-256: chamada 1B — escrita em segundo plano, com a fatia como contexto fixo. Os índices
 * (`locationIndex`, `npcIndices`) apontam pras arrays da FATIA, numeradas no prompt. */
export const AUTHORING_REST_SCHEMA = z.object({
  challenges: z.array(z.object({
    locationIndex: z.number().int().min(0).describe('Índice (0-based) em locations[] onde o desafio acontece'),
    test: z.string().min(1).describe('perícia/atributo nomeado, SEM CD'),
    situation: z.string().min(1),
    consequence: z.string().min(1).describe('consequência da falha'),
  })).min(1),
  encounters: z.array(z.object({
    locationIndex: z.number().int().min(0).describe('Índice (0-based) em locations[]'),
    npcIndices: z.array(z.number().int().min(0)).describe('Índices (0-based) em npcs[] que participam — [] se nenhum'),
    type: z.enum(['combat', 'skill', 'social']),
    fiction: z.string().min(1).describe('A NARRATIVA da cena que o jogador lê — sem números de mecânica'),
    behaviors: z.string().min(1).describe('o que os presentes fazem agora'),
    goal: z.string().min(1).describe('por que o personagem foi até lá'),
    complications: z.string().min(1).describe('o que pode virar o jogo de cabeça pra baixo'),
    unlocks: z.string().min(1).describe('o que ESTE encontro entrega que faz o próximo existir'),
  })).min(1),
  objective: z.object({
    description: z.string().min(1),
    reward: z.object({
      name: z.string().min(1).describe('item mágico nomeado'),
      effect: z.string().min(1).describe('efeito em FICÇÃO, SEM números'),
    }),
    locationIndex: z.number().int().min(0).describe('Índice (0-based) em locations[] onde a meta se resolve'),
  }),
  branchedResolution: z.array(z.object({
    choice: z.string().min(1),
    consequence: z.string().min(1).describe('o custo dessa escolha — nenhum rumo é "o certo"'),
  })).min(1),
  followUps: z.array(z.string()).min(1).describe('um gancho pós-aventura por rumo do fecho'),
})

export type AuthoredSlice = z.infer<typeof AUTHORING_SLICE_SCHEMA>
export type AuthoredRest = z.infer<typeof AUTHORING_REST_SCHEMA>

export type CombatCast = Array<Array<{ nominalCreature: string; strongerThanRest: boolean }>>
export type CombatBudget = { maxHostileCount: number; viable: boolean }

// US-232: instruções da autoria mundo-primeiro. Portadas do Spike (adventure-authoring-spike.mjs:
// authoringPrompt), com a divergência deliberada de *tábula rasa* das Notas de implementação: o
// exemplar (Khemsar) NÃO entra verbatim — ensina QUALIDADE de forma abstrata (corta a
// convergência de motivo "ossos de titã" que o Spike expôs).
// US-256: o system prompt se parte em blocos — cada chamada monta o seu a partir dos blocos que
// lhe cabem (texto movido verbatim do `buildAuthoringSystem` original, sem reescrever).
const AUTHORING_ROLE =
  'Você é um designer de aventuras de RPG de mesa (D&D 5e), no nível de um módulo publicado. Escreva uma aventura one-shot ORIGINAL e AUTORAL para UM único personagem.'

const FIRST_ADVENTURE_RULES = [
  'PRIMEIRA AVENTURA — o personagem CHEGA NOVO a este mundo, é a primeira sessão dele: NÃO existe história prévia jogada. Portanto:',
  '- NENHUM NPC já conhece o personagem, deve favores a ele, ou o reconhece — todos são estranhos no início; qualquer vínculo se constrói DURANTE a aventura.',
  '- NÃO pressuponha eventos anteriores como fato (dívidas antigas, inimigos que já o caçam, aliados do passado, parentes na trama).',
  '- NÃO ancore item, recompensa, lugar ou pista no passado específico do personagem — a proveniência das coisas é do MUNDO, não da biografia dele.',
  '- Follow-ups introduzem ganchos NOVOS do mundo; NÃO afirmam dívidas/inimigos/parentes do personagem que "voltam a persegui-lo".',
  'O enredo nasce de um gancho que qualquer forasteiro poderia receber ao chegar, não de um passado que o personagem já tem aqui.',
].join('\n')

const MECHANICS_RULE =
  'MECÂNICA: NÃO escreva número mecânico na prosa — nada de CD, dano, HP, CA, bônus. Testes são nomeados QUALITATIVAMENTE por perícia/atributo ("teste de Sabedoria (Percepção)"), sem CD. Statblocks de inimigo NÃO se escrevem aqui; descreva o inimigo e seu papel só em ficção.'

const FACTIONS_RULE =
  'FACÇÕES: invente as facções pedidas com desejos que COLIDEM — elas SÃO o antagonismo (não há um vilão único). Dissolva-as na `story` e nos `npcs` (a alma vem dessa tensão), mas preencha `factions[]` como dado estruturado. NPC neutro tem `want` SEM `factionIndex`.'

const LOCATIONS_RULE =
  'LOCAIS: a `description` fala SÓ do lugar e dos itens — NÃO cite NPCs que estão nele (quem os habita fica em `occupants`, por índice). Ex.: descreva "o balcão de uma taverna esfumaçada e o mural nos fundos", não "onde o estalajadeiro Tobias serve bebida".'

const OBJECTIVE_RULE =
  'OBJETIVO E FECHO: `objective` tem meta + recompensa (item mágico nomeado, efeito em ficção, sem números) + local. `branchedResolution` é a escolha final RAMIFICADA — um rumo por facção, cada um com um custo, nenhum "o certo". O último encontro (o Final) amarra essa escolha ramificada. A ameaça/criatura central da premissa (a que dá nome ao conflito) PRECISA estar presente, fisicamente, em pelo menos um encontro no local do objetivo — a resolução não pode acontecer só entre NPCs alheios, em outro lugar, sem ela.'

const ENCOUNTERS_RULE =
  'ENCONTROS: `fiction` é a NARRATIVA da cena que o jogador lê; `behaviors`/`goal`/`complications`/`unlocks` são a decomposição (Sly Flourish + trilha) que o motor usa. `unlocks` do encontro N faz o N+1 existir; o Final ecoa o conflito de `branchedResolution`.'

function languageRule(locale: Locale): string {
  return `Responda SEMPRE em ${localeNameForPrompt(locale)} — idioma da mesa, escolhido pelo jogador; nomes próprios seguem a Onomástica abaixo, não o idioma-alvo. Prosa densa e sensorial, sem placeholders.`
}

const CRAFT_BAR = `Barra de qualidade da prosa (world/story/boxedText/fiction/role):\n${CRAFT_CORE_SECTION}\n${NPC_VOICE_BULLET}\n\n${ONOMASTICS_SECTION}`

/** US-256: system da chamada 1A (fatia). */
export function buildSliceSystem(locale: Locale): string {
  const targetLanguage = localeNameForPrompt(locale)
  return [
    AUTHORING_ROLE,
    '',
    'Esta chamada escreve SÓ a primeira metade da aventura: mundo, facções, NPCs, locais e o gancho. Encontros, desafios, objetivo e fecho ramificado são escritos DEPOIS, sobre o que você fizer aqui — dê aos NPCs um `want` que possa virar cena e aos locais tipos de cena (`vibe`) variados.',
    '',
    'INVENTE UM MUNDO NOVO — não use cenários de prateleira (nada de Costa da Espada, Faerûn, etc.). O mundo é seu, específico e nomeado, com detalhe sensorial concreto.',
    '',
    FIRST_ADVENTURE_RULES,
    '',
    MECHANICS_RULE,
    '',
    FACTIONS_RULE,
    '',
    LOCATIONS_RULE,
    '',
    languageRule(locale),
    '',
    // US-241: a semente de `summary` (restrição no prompt, `questSeed`) chega EM INGLÊS — mesma
    // categoria de risco de `patronsandnpcs` (roll-content.ts:89-97, o bug real de
    // "lizardfolk"/"cheery" vazando cru na narração pt-BR), mas aqui não há mapa fixo possível
    // (combinatória grande demais, ver US-241 §Fora do escopo): o guarda-corpo é de PROMPT.
    `A semente de gancho (abaixo, "Gancho central desta aventura") vem EM INGLÊS — TRADUZA/ADAPTE a ideia pro ${targetLanguage} ao escrever \`summary\`; NUNCA copie a palavra em inglês crua para a prosa.`,
    '',
    CRAFT_BAR,
  ].join('\n')
}

/** US-256: system da chamada 1B (resto). A fatia entra no PROMPT, não aqui — este texto só fixa as regras. */
export function buildRestSystem(locale: Locale): string {
  return [
    AUTHORING_ROLE,
    '',
    'Esta chamada escreve a SEGUNDA metade da aventura: desafios, encontros, objetivo, fecho ramificado e follow-ups. O mundo, as facções, os NPCs, os locais e o gancho JÁ EXISTEM (estão no prompt) e a jogadora já os leu: são FIXOS — não invente outros, não renomeie, não contradiga. Refira-os SEMPRE por ÍNDICE (0-based), do jeito que o prompt os numera.',
    '',
    FIRST_ADVENTURE_RULES,
    '',
    MECHANICS_RULE,
    '',
    OBJECTIVE_RULE,
    '',
    ENCOUNTERS_RULE,
    '',
    languageRule(locale),
    '',
    CRAFT_BAR,
  ].join('\n')
}

// US-232: restrições POR AVENTURA (contagens, params de mundo, background como tom). Param de
// mundo entra pelo RÓTULO pt-BR (nunca a chave, US-156); eixo "Aleatório" = omitido = modelo
// livre. `challenge` (dial de dificuldade) NÃO entra na autoria (é MA-3). `characterStory` entra
// só como TOM/ressonância — nunca como fato literal de plot; bonds/deity/flaws ficam de fora.
// US-256: só a 1A lê estes params — na 1B o mundo já está escrito na fatia.
export function buildSlicePrompt(params: {
  world: { setting?: string; tone?: string; areaType?: string }
  factionCount: number
  counts: { locations: number; npcs: number }
  characterStory?: string
  namingRegister: string
  level: number
  className: string
  questSeed: string
}): string {
  const worldLines = [
    params.world.setting && `- Cenário: ${params.world.setting}`,
    params.world.tone && `- Tom: ${params.world.tone}`,
    params.world.areaType && `- Tipo de área: ${params.world.areaType}`,
  ].filter((l): l is string => Boolean(l))
  const { counts } = params
  // US-241: `questSeed` (rollQuestSeed, fórmula do LGMRD) vira restrição obrigatória de
  // `summary` — mesmo tratamento de `worldLines`/`characterStory`, sem chamada de IA nova. Com
  // `setting` fixado, soma a instrução de TRANSPOR o vocabulário medieval-padrão do MacGuffin
  // pro eixo de Cenário restringido (o LGMRD é nativamente fantasia medieval; `SETTINGS` inclui
  // eixos que destoam disso, ex. `cyberpunk`/`sci-fi-space-opera`) — mesmo condicional de
  // `worldLines.length > 0` logo abaixo: sem Cenário fixado (Aleatório), o modelo fica livre
  // pra manter ou não o registro medieval-padrão.
  const questSeedLines = [
    `Gancho central desta aventura (semente em inglês — ver instrução de tradução no system): "${params.questSeed}". Escreva \`summary\` TRADUZINDO/ADAPTANDO essa ideia pro idioma-alvo, nunca copiando a palavra em inglês; \`story\` não pode contradizê-la.`,
    params.world.setting &&
      `O MacGuffin da semente acima é vocabulário PADRÃO do LGMRD (fantasia medieval) — TRANSPONHA os substantivos pro eixo de Cenário já restringido acima (ex.: obelisco/cripta → núcleo de reator/estação abandonada, num Cenário sci-fi), mantendo conceito+motivo; NÃO force cripta/obelisco/patrono élfico se o Cenário destoar.`,
  ].filter((l): l is string => Boolean(l))
  return [
    `Personagem: ${params.className}, nível ${params.level}. (Contexto de escala — a aventura NÃO gira em torno dele nem do passado dele.)`,
    params.characterStory?.trim()
      ? `História do personagem (use SÓ como TOM/ressonância temática, NUNCA como fato de plot nem teia de relações pré-existentes): ${params.characterStory.trim()}`
      : 'Sem história de personagem registrada — o tom vem só do mundo e dos params abaixo.',
    '',
    worldLines.length > 0
      ? `Restrições de mundo (respeite estes eixos):\n${worldLines.join('\n')}`
      : 'Sem eixos de mundo fixados — você é livre em cenário/tom/tipo de área.',
    '',
    questSeedLines.join('\n'),
    '',
    // US-240: UM registro pra toda a aventura — nunca um por facção/local/NPC (colcha de
    // retalhos cultural sem razão narrativa). Prima sobre o passo 1 da Onomástica (registro por
    // raça/classe/cena) só NESTA chamada; a Onomástica compartilhada não muda esse passo, que
    // continua certo pra narração ao vivo.
    `Registro de nomenclatura desta aventura: ${params.namingRegister}. Todo nome próprio que você inventar — mundo, facções, locais-âncora, NPCs, item de recompensa — soa nesse mesmo registro: é a identidade sonora de UM mundo específico, nunca uma mistura de culturas sem relação. Isto tem prioridade sobre o passo 1 da Onomástica pra esta aventura.`,
    '',
    'Contagens (respeite exatamente):',
    `- ${params.factionCount} facções com desejos concorrentes`,
    `- ~${counts.locations} locais`,
    `- ~${counts.npcs} NPCs`,
    '',
    'Emita na ordem do schema: mundo → sinopse (summary) → story → facções → NPCs (e o que cada um quer) → locais → o gancho (start), por último.',
  ].join('\n')
}

const npcName = (slice: AdventureSlice, id: string): string => slice.npcs.find((n) => n.id === id)?.name ?? id

// US-256: a fatia inteira vira contexto FIXO da 1B, com o índice 0-based que o modelo tem de
// devolver em `locationIndex`/`npcIndices` (a posição na array é o que `mintRestOntoSlice` usa).
function describeSlice(slice: AdventureSlice): string {
  const factionName = (id: string | undefined) => slice.factions.find((f) => f.id === id)?.name
  const factions = slice.factions.map((f, i) => `[${i}] ${f.name} (${f.kind}) — quer: ${f.want}`)
  const npcs = slice.npcs.map((n, i) => {
    const faction = factionName(n.factionId)
    return `[${i}] ${n.name} — ${n.role} — quer: ${n.want}${faction ? ` — facção: ${faction}` : ''}`
  })
  const locations = slice.locations.map((l, i) => {
    const occupants = l.occupants.map((id) => npcName(slice, id)).join(', ')
    return `[${i}] ${l.title} (vibe: ${l.vibe}) — aspectos: ${l.aspects.join(', ')} — ao chegar: ${l.boxedText} — notas: ${l.description}${occupants ? ` — moradores: ${occupants}` : ''}`
  })
  return [
    `Mundo: ${slice.world.name}\n${slice.world.description}${slice.world.anchors?.length ? `\nLocais-âncora: ${slice.world.anchors.join('; ')}` : ''}`,
    `Sinopse: ${slice.summary}`,
    `Story: ${slice.story}`,
    `Gancho (o que a jogadora já leu): ${slice.start}`,
    `Facções (use o índice entre colchetes):\n${factions.join('\n')}`,
    `NPCs (use o índice entre colchetes em npcIndices):\n${npcs.join('\n')}`,
    `Locais (use o índice entre colchetes em locationIndex):\n${locations.join('\n')}`,
  ].join('\n\n')
}

/**
 * US-256: prompt da 1B. A fatia entra por inteiro (nome de toda facção/NPC/local, com índice); o que
 * era param de MUNDO/semente da 1A não volta — já está materializado na fatia. `combatBudget`/
 * `combatCast` (US-250/US-253) ficam aqui porque falam de encontros, que só a 1B escreve.
 */
export function buildRestPrompt(params: {
  slice: AdventureSlice
  counts: { challenges: number; encounters: number }
  namingRegister: string
  level: number
  className: string
  combatBudget: CombatBudget
  combatCast?: CombatCast
}): string {
  const { counts } = params
  // US-250: orçamento de CR (composeEncounterRoles, calculado no motor ANTES desta chamada) vira
  // restrição de prompt — sem isso a autoria promete N inimigos que o PASSO 2
  // (assignBudgetedCombatRoles) descarta em silêncio por estourar o nível. Nível 1-3 modo
  // 'adventure' tem orçamento SEMPRE 0 (US-159): proíbe `combat` de vez, no lugar de deixar todo
  // encontro combat estourar por construção.
  const combatBudgetLine = params.combatBudget.viable
    ? `- Em qualquer encontro type: 'combat', NO MÁXIMO ${params.combatBudget.maxHostileCount} inimigo(s) — o personagem não sustenta mais que isso neste nível.`
    : `- PROIBIDO usar type: 'combat' em qualquer encontro desta aventura — o personagem não tem orçamento de combate neste nível/modo.`
  // US-253: elenco nominal por POSIÇÃO de encontro (buildCombatCast) — a ficção já sabe qual
  // criatura real vai lutar em cada slot ANTES de escrever, no lugar de a mecânica (US-252)
  // encaixar o nome depois de a prosa já ter decidido outro inimigo. Ausente (`combatCast`
  // undefined) quando o orçamento não é viável — nenhum nome é oferecido, consistente com a
  // proibição de `combat` que `combatBudgetLine` já instrui.
  const combatCastLines = (params.combatCast ?? []).map((cast, slotIndex) => {
    const parts = cast.map(
      ({ nominalCreature, strongerThanRest }) => `${nominalCreature}${strongerThanRest ? ' (mais forte, lidera)' : ' (apoio)'}`,
    )
    return `- Se o Encontro ${slotIndex + 1} for de combate, os inimigos são: ${parts.join(' + ')}. Narre ESSAS criaturas pra essa posição (pode adaptar/traduzir o nome pro idioma-alvo, mesma espécie), não invente outras.`
  })
  const factionCount = params.slice.factions.length
  return [
    `Personagem: ${params.className}, nível ${params.level}. (Contexto de escala — a aventura NÃO gira em torno dele nem do passado dele.)`,
    '',
    'A PRIMEIRA METADE da aventura já está escrita e a jogadora já a leu. É FIXA — escreva a segunda metade sobre ela, sem inventar nem renomear nada:',
    '',
    describeSlice(params.slice),
    '',
    '`objective` e o Final não podem contradizer a sinopse nem a story acima. Prefira pôr cada encontro num local cuja `vibe` combine com o `type` dele, e espalhe encontros e desafios por locais diferentes.',
    '',
    `Registro de nomenclatura desta aventura: ${params.namingRegister} (o mesmo do mundo acima). Todo nome próprio NOVO que você inventar — item de recompensa, qualquer nome que surja nas cenas — soa nesse mesmo registro.`,
    '',
    'Contagens (respeite exatamente):',
    `- ${counts.challenges} desafios NÃO-COMBATE (cada um preso a um local)`,
    `- ${counts.encounters} encontros (inclua um Final que amarra o fecho ramificado)`,
    combatBudgetLine,
    `- ${factionCount} rumos em branchedResolution e ${factionCount} followUps (um por facção)`,
    '',
    ...(combatCastLines.length > 0 ? [combatCastLines.join('\n'), ''] : []),
    'Emita na ordem do schema: desafios não-combate → encontros (o último é o Final) → objetivo+recompensa → fecho ramificado → followUps.',
  ].join('\n')
}
