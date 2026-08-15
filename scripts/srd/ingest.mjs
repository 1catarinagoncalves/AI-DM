// US-47 — ingest: mapeia o dataset SRD (scripts/srd/_data, do sync) → subset do SystemConfig,
// aplica o overlay pt-BR (locale/pt-BR.json), valida e grava os artefatos por locale.
//
// US-99: grava DOIS artefatos completos — a base EN (`srd-5e.config.en-US.json`, sem overlay)
// e a localização (`srd-5e.config.pt-BR.json`, com overlay). Gerar o inglês é rodar o MESMO
// código com o overlay vazio: `resolve()` já cai no texto do dataset quando falta tradução.
//
// Deriva 4 campos (attributes, skills, classFeatures, classSpells). Os demais campos do
// SystemConfig (startingKits, pointBuy, proficiency, initialAdventures) NÃO são regra de SRD
// numa fonte CC — ficam no seed.ts (decisão de produto). Ver US-47 "Fora do escopo".
//
// US-52: chave sem PT curado é traduzida por LLM e gravada de volta no overlay marcada
// `"_mt": true` — rascunho revisável, que aparece no diff do PR. Idempotente: o modelo só
// roda para chave AINDA sem PT nenhum, então uma segunda rodada não re-traduz nada.
//
// Uso: node scripts/srd/ingest.mjs [--strict] [--no-mt]
//   --strict: falha o build se QUALQUER chave cair no fallback EN (rede de segurança, não caminho normal).
//   --no-mt: não chama o modelo (build offline / CI sem GEMINI_API_KEY). Sem a key, é o padrão.
//
// Requer shared e ai-engine buildados (dist): pnpm --filter @ai-dm/ai-engine... build
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
// ponytail: import relativo ao dist do @ai-dm/shared (o root node_modules não simlinka o
// workspace). Precisa do shared buildado. Uma troca de resolução vira uma linha aqui.
import { SystemConfigSchema } from '../../packages/shared/dist/index.js'
// US-52: a chamada de LLM vive no ai-engine porque só lá `ai` e `@ai-sdk/google` resolvem
// (o node_modules da raiz não os tem). Mesmo motivo do narration-gen.ts na US-36.
import { translateSrdToPtBr } from '../../packages/ai-engine/dist/index.js'
// US-108: a tabela de modificadores do SRD 2024 vira artefato próprio (oráculo de teste, não
// campo do config). `TAG` vem do sync porque a procedência do artefato tem que ser a MESMA
// tag que baixou o dado — duas constantes divergiriam no primeiro bump.
import { parseAbilityModifiers } from './ability-modifiers.mjs'
// US-110: as tabelas de exemplo do d20 test — estas SIM têm consumidor de runtime (o system
// prompt do Mestre), por isso o artefato é gravado dentro do pacote que o importa.
import { parseD20Tests } from './d20-tests.mjs'
import { TAG } from './sync.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, '_data')
const OVERLAY_PATH = join(HERE, 'locale', 'pt-BR.json')
// US-110: único derivado que NÃO mora aqui. Ele é importado como JSON pelo builder do
// prompt, e importar de fora do pacote arrastaria o `rootDir` do tsc (armadilha da US-108).
const D20_TESTS_PATH = join(HERE, '..', '..', 'packages', 'ai-engine', 'src', 'prompts', 'd20-tests.srd-2024.json')
const STRICT = process.argv.includes('--strict')
const NO_MT = process.argv.includes('--no-mt')

// Domínios que a tradução automática atende. `attributes` e `skills` ficam de fora de
// propósito: o overlay os guarda como STRING crua (`"strength": "Força"`), sem lugar para
// a marca `_mt`, e são os 6 atributos e as 18 perícias fixos do 5e — não é conteúdo que um
// bump traga. Se um dia trouxer, ele cai no fallback EN e o `--strict` grita, como hoje.
// US-121: `backgrounds` entra — `benefit.desc` é prosa (chega a parágrafo), mesmo tratamento
// de `features`/`spells`. O nome do background em si (sem `desc` no dataset) fica de fora do
// rascunho automático (a chamada exige enName+enDesc) e segue curadoria manual, como races/classes.
// US-134: `tools` entra — 50 nomes é curadoria manual grande demais pra uma sentada só (contraste
// com races/skills/classes/kitItems, dezena ou menos cada). O `desc` que alimenta a tradução é o
// texto de regra do item (`Item.json.desc`), nunca guardado no artefato — só dá contexto ao
// modelo; ver `buildTools`.
const MT_DOMAINS = ['features', 'spells', 'backgrounds', 'tools']

// Mapa explícito das 13 classes (12 SRD + Marshal) → chave canônica do config. NÃO reusa o
// CLASS_SYNONYMS de starting-inventory.ts: aquele casa entrada do usuário em PT; este converte
// o slug do dataset.
//
// US-54: a chave canônica é EN (a base nativa dos dados é EN, ver ADR 005). O mapa virou quase
// identidade, mas continua explícito de propósito: é ele que FALHA ALTO quando o dataset traz uma
// classe base desconhecida (ver `Classe base sem entrada no CLASS_MAP` abaixo). Derivar do slug
// (`pk.replace(/^srd_/, '')`) troca estas linhas por uma classe sumindo em silêncio num bump.
//
// US-139 (ADR 009 §8): as 12 SRD apontam pro `pk` do `srd-2014` (5.1 é a referência agora, 5.2
// sai por completo — troca de fonte, não união). `a5e_marshal` é a 13ª entrada, primeira classe
// que não é uma das 12 do SRD.
const CLASS_MAP = {
  'srd_barbarian': 'barbarian',
  'srd_bard': 'bard',
  'srd_cleric': 'cleric',
  'srd_druid': 'druid',
  'srd_fighter': 'fighter',
  'srd_monk': 'monk',
  'srd_paladin': 'paladin',
  'srd_ranger': 'ranger',
  'srd_rogue': 'rogue',
  'srd_sorcerer': 'sorcerer',
  'srd_warlock': 'warlock',
  'srd_wizard': 'wizard',
  'a5e_marshal': 'marshal',
}

// Normaliza o `pk` tirando o prefixo do documento: `srd-2024_dwarf` e `srd_dwarf` → `dwarf`.
// Sobrevive mesmo sem o par 5.2 (races/classes/spells já não os carregam) porque `buildTools`
// ainda lê `Item.json` do `srd-2024` (US-134, fora do escopo desta troca de fonte).
const stripDocument = (pk) => String(pk).replace(/^srd(-2024)?_/, '')

// Atributo abreviado (dataset) → chave canônica. Ordem fixa = ordem do config (idempotência).
const ABILITY_MAP = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' }
const ATTR_ORDER = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']

// Faixa/point-buy 5e: decisão de PRODUTO (não SRD). Fica aqui só para montar o campo attributes;
// o orçamento (pointBuy.budget) segue no seed. Ver US-47 "Fora do escopo".
const ATTR_RANGE = { min: 10, max: 18, default: 10 }

// Stub dos campos que o ingest não deriva (o schema os exige; o valor real vive no seed).
// US-51: `startingKits` SAIU daqui — passou a ser derivado, ver buildStartingKits.
const STUB = { pointBuy: { budget: 27 } }

// US-51 — fallback de classe fora do catálogo (sistema custom, classe que o config não tem).
// NÃO vem do SRD: o dataset não tem "classe padrão". Mora aqui, em EN, para atravessar o
// mesmo overlay dos outros itens — no seed ele seria PT nos dois locales, que é o defeito
// que esta story conserta. Nunca devolvemos inventário vazio.
const DEFAULT_KIT = [
  { name: 'Dagger', qty: 1 },
  { name: 'Leather Armor', qty: 1 },
  { name: 'Backpack', qty: 1 },
  { name: 'Waterskin', qty: 1 },
]

// US-130 — Culture/Engineering: o Open5e nunca modelou as perícias do A5E como recurso
// `Skill` (Skill.json só tem as 18 do 5e core) — elas só existem como texto solto em
// `BackgroundBenefit.desc` (Noble, Sage, Charlatan, Entertainer, Trader), sem `ability`
// associada em lugar nenhum do dataset pinado. `ability` NÃO vem do SRD: confirmada em
// a5e.tools/rules/skills ("the most commonly used ability score is Intelligence" pras duas).
// Mesmo precedente do DEFAULT_KIT acima — literal EN, comentário citando a origem.
const A5E_SKILLS = [
  { key: 'culture', name: 'Culture', ability: 'intelligence' },
  { key: 'engineering', name: 'Engineering', ability: 'intelligence' },
]

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

async function load(name) {
  return JSON.parse(await readFile(join(DATA, name), 'utf8'))
}

// Relatórios: chave do overlay que traduz algo inexistente no dataset (órfã) vs. chave do
// dataset sem PT no overlay (cai no fallback EN). Dois problemas distintos, dois relatórios.
//
// US-99: o estado vive POR BUILD, não no módulo — o ingest roda duas vezes (base EN e pt-BR)
// e os relatórios de uma passagem não podem contaminar a outra.
function makeResolver() {
  const fallbacks = [] // { domain, key, enName, enDesc }
  const orphans = [] // { domain, key }
  const usedOverlay = { attributes: new Set(), skills: new Set(), races: new Set(), classes: new Set(), features: new Set(), spells: new Set(), kitItems: new Set(), backgrounds: new Set(), tools: new Set() }
  // US-52: vocabulário EN→PT dos termos CURADOS, para o prompt de tradução e para a
  // checagem mecânica. Montado aqui porque este é o único ponto onde o nome EN do dataset
  // e o nome PT do overlay se encontram — o overlay sozinho só guarda o PT.
  const glossary = new Map() // en → pt

  // Resolve texto do overlay; registra fallback quando ausente/vazio. `enName`/`enDesc` = base EN do dataset.
  function resolve(domain, key, overlayEntry, enName, enDesc) {
    const name = overlayEntry?.name?.trim()
    const description = overlayEntry?.description?.trim()
    if (name || description) usedOverlay[domain].add(key)
    // Rascunho de máquina NÃO entra no glossário: ele é o que se quer validar, não a régua.
    if (name && enName && !overlayEntry?._mt && !glossary.has(enName)) glossary.set(enName, name)
    const missing = !name || (enDesc !== undefined && !description)
    if (missing) fallbacks.push({ domain, key, enName, enDesc })
    return {
      name: name || enName,
      ...(enDesc !== undefined ? { description: description || enDesc } : {}),
    }
  }

  return { resolve, fallbacks, orphans, usedOverlay, glossary }
}

// --- attributes (6): dataset dá as chaves; label vem do overlay; min/max/default do produto ---
function buildAttributes(overlay, abilities, resolve) {
  const abilityKeys = new Set(abilities.map((a) => a.fields.describes))
  for (const canon of ATTR_ORDER) {
    const abbr = Object.keys(ABILITY_MAP).find((k) => ABILITY_MAP[k] === canon)
    if (!abilityKeys.has(abbr)) throw new Error(`Atributo ausente no dataset: ${abbr}`)
  }
  return ATTR_ORDER.map((canon) => ({
    key: canon,
    // US-99: `AbilityDescription` não tem campo de nome — só a abreviação (`describes: "str"`)
    // e uma frase de sabor. O rótulo EN é a chave canônica capitalizada, que É a palavra
    // inglesa ("strength" → "Strength"). Sem isto a base EN serviria a chave crua.
    label: resolve('attributes', canon, { name: overlay.attributes?.[canon] }, capitalize(canon)).name,
    ...ATTR_RANGE,
  }))
}

// --- skills (20): 18 do doc `core` (traz `ability`) + 2 literais A5E (US-130, ability fora
// do dataset — ver A5E_SKILLS); descarta a5e-ag_ (defensivo, nunca dispara — Open5e não
// modela A5E como recurso Skill, ver comentário de buildSkills acima da constante) ---
export function buildSkills(overlay, skillsRaw, resolve) {
  const core = skillsRaw
    .filter((s) => !String(s.pk).startsWith('a5e-ag_') && !String(s.fields.describes).startsWith('a5e-ag_'))
    .map((s) => {
      const key = String(s.pk).replace(/-/g, '_') // sleight-of-hand → sleight_of_hand
      const ability = ABILITY_MAP[s.fields.ability]
      if (!ability) throw new Error(`Perícia ${s.pk}: ability desconhecida "${s.fields.ability}"`)
      const label = resolve('skills', key, { name: overlay.skills?.[key] }, s.fields.name).name
      return { key, label, ability }
    })
  const a5e = A5E_SKILLS.map(({ key, name, ability }) => ({
    key,
    label: resolve('skills', key, { name: overlay.skills?.[key] }, name).name,
    ability,
  }))
  return [...core, ...a5e].sort((a, b) => a.key.localeCompare(b.key))
}

// --- races (13): as 9 RAÍZES do SRD 5.1 (ADR 009 §8, US-138) e as 4 subespécies que o
// mesmo dataset já tem (high-elf, hill-dwarf, lightfoot, rock-gnome — US-140). A união com
// o 5.2 que a US-105/ADR 009 D2 fixava segue revertida: goliath/orc (exclusivas do 5.2) saem,
// sem fonte nova pra recuperá-las. `Species.desc` vem VAZIO no dataset (a descrição está no
// SpeciesTrait.json, fora do escopo), então o catálogo é só {key, label, parentKey?}.
// US-140: sort NÃO é mais alfabético global — é raiz por raiz (alfabética entre si), cada
// raiz imediatamente seguida da(s) sua(s) subespécie(s) (também alfabética entre si). O
// wizard agrupa por POSIÇÃO da lista (optgroup logo após a raiz), não recalcula por
// `parentKey` — ver §Como aparece na criação de personagem da US-140.
export function buildRaces(overlay, species2014, resolve) {
  const toEntry = (s) => {
    const key = stripDocument(s.pk)
    const entry = { key, label: resolve('races', key, { name: overlay.races?.[key] }, s.fields.name).name }
    if (s.fields.subspecies_of !== null) entry.parentKey = stripDocument(s.fields.subspecies_of)
    return entry
  }
  const roots = species2014
    .filter((s) => s.fields.subspecies_of === null)
    .map(toEntry)
    .sort((a, b) => a.key.localeCompare(b.key))
  const subspeciesByParent = new Map()
  for (const s of species2014) {
    if (s.fields.subspecies_of === null) continue
    const parentKey = stripDocument(s.fields.subspecies_of)
    const list = subspeciesByParent.get(parentKey) ?? []
    list.push(toEntry(s))
    subspeciesByParent.set(parentKey, list)
  }
  return roots.flatMap((root) => [
    root,
    ...(subspeciesByParent.get(root.key) ?? []).sort((a, b) => a.key.localeCompare(b.key)),
  ])
}

// --- classes (12): o CLASS_MAP já ERA o catálogo; aqui ele passa a ser emitido ---
// Sem par 2014: as 12 classes base são idênticas nas duas edições (ADR 009 §4).
function buildClasses(overlay, classes, resolve) {
  return classes
    .filter((c) => c.fields.subclass_of === null)
    .map((c) => {
      const key = CLASS_MAP[c.pk]
      if (!key) throw new Error(`Classe base sem entrada no CLASS_MAP: ${c.pk}`)
      return { key, label: resolve('classes', key, { name: overlay.classes?.[key] }, c.fields.name).name }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}

// --- classFeatures: nível 1, só classe base, sem ruído de tabela nem motor de conjuração ---
export function buildClassFeatures(overlay, { classes, features, featureItems }, resolve) {
  const baseClasses = classes.filter((c) => c.fields.subclass_of === null)
  for (const c of baseClasses) {
    if (!CLASS_MAP[c.pk]) throw new Error(`Classe base sem entrada no CLASS_MAP: ${c.pk}`)
  }
  const lvl1 = new Set(featureItems.filter((i) => i.fields.level === 1).map((i) => i.fields.parent))
  // US-139: `[Column data]` é o ruído do 5.1 (mesmo texto do 5.2); o a5e-ag marca a MESMA coisa
  // (PROFICIENCY_BONUS, CLASS_TABLE_DATA) com `desc` VAZIO — medido em 15/08/2026 contra o
  // dataset real (`a5e_marshal_proficiency-bonus` etc.). Um só filtro por "sem descrição real"
  // cobre as duas fontes; não precisou de checagem por `feature_type`.
  const isNoise = (f) => { const d = norm(f.fields.desc); return d === '' || d === '[Column data]' }
  const isSpellEngine = (f) => /_(spellcasting|pact-magic)$/.test(f.pk) // conjuração é a US-42 (classSpells)

  const classFeatures = { default: [] }
  for (const f of features) {
    const canon = CLASS_MAP[f.fields.parent]
    if (!canon || !lvl1.has(f.pk) || isNoise(f) || isSpellEngine(f)) continue
    const slug = String(f.pk).slice(String(f.fields.parent).length + 1) // srd_paladin_lay-on-hands → lay-on-hands
    const featKey = `${canon}_${slug}`
    const entry = resolve('features', featKey, overlay.features?.[featKey], f.fields.name, norm(f.fields.desc))
    // US-139: source segue o documento de origem — a5e-ag pro Marshal, srd pras 12 SRD (5.1).
    const source = f.fields.document === 'a5e-ag' ? 'a5e-ag' : 'srd'
    // US-106: a chave DEIXA de ser campo temporário e vira campo do artefato. Ela já era
    // calculada aqui (para casar overlay, detectar órfão e ordenar) e era jogada fora na
    // gravação — é o que impedia a ficha de acompanhar o locale (US-100).
    ;(classFeatures[canon] ??= []).push({ key: featKey, ...entry, source })
  }
  for (const k of Object.keys(classFeatures)) {
    // Ordenar por `key` em vez de pelo slug nu dá a MESMA ordem (dentro de uma classe o prefixo
    // é constante) e mantém a idempotência byte-a-byte do artefato, critério da US-47.
    classFeatures[k] = classFeatures[k].sort((a, b) => a.key.localeCompare(b.key))
  }
  return classFeatures
}

// --- classSpells: nível <= 1 (truques + todas as de 1º), ligadas por classes[] ---
export function buildClassSpells(overlay, spells, resolve) {
  const classSpells = { default: [] }
  for (const s of spells) {
    if (s.fields.level > 1) continue
    const slug = stripDocument(s.pk)
    const entry = resolve('spells', slug, overlay.spells?.[slug], s.fields.name, norm(s.fields.desc))
    // US-106: `key` sobrevive (ver buildClassFeatures). Aqui ela é o slug nu — magia não é
    // prefixada por classe, e é por isso que a MESMA linha entra em várias listas.
    const row = { key: slug, name: entry.name, level: s.fields.level, description: entry.description, source: 'srd' }
    for (const cls of s.fields.classes || []) {
      const canon = CLASS_MAP[cls]
      if (!canon) throw new Error(`Magia ${s.pk}: classe "${cls}" sem entrada no CLASS_MAP`)
      ;(classSpells[canon] ??= []).push(row)
    }
  }
  for (const k of Object.keys(classSpells)) {
    classSpells[k] = classSpells[k].sort((a, b) => a.level - b.level || a.key.localeCompare(b.key))
  }
  return classSpells
}

// --- startingKits (13 + default): opção A do equipamento inicial da classe (US-51/US-139) ---
//
// Único campo que sai de TEXTO LIVRE. US-139: o 5.2 guardava isso numa linha de tabela markdown
// (`CORE_TRAITS_TABLE`) — o 5.1 e o a5e-ag usam outro feature_type, `STARTING_EQUIPMENT`, e outro
// formato de texto (prosa com bullets), medido em 15/08/2026 contra o dataset real. `parseStartingKit`
// (o parser de tabela) morreu com a fonte 5.2 — ver os dois parsers abaixo, escolhidos por `document`.
//
// "(*a*) X or (*b*) Y" / "(A) X ou (B) Y": sem modelo de dinheiro no jogo, só a primeira
// alternativa existe aqui — a alternativa em ouro e as moedas soltas são descartadas.

// "8 Javelins" → { name: 'Javelin', qty: 8 }. Singulariza SÓ quando havia numeral: "Thieves'
// Tools" e "Artisan's Tools" são plural no singular e viram "Tool" se a regra for cega.
function toKitItem(part) {
  // Escolha em prosa dentro da própria opção A ("Artisan's Tools or Musical Instrument…",
  // "Musical Instrument of your choice"): a PRIMEIRA alternativa vence, mesma regra do "sempre A".
  const name = part.replace(/\s+(or|of your choice|chosen for)\b.*$/, '')
  const counted = name.match(/^(\d+)\s+(.+)$/)
  if (!counted) return { name, qty: 1 }
  return { name: counted[2].replace(/s$/, ''), qty: Number(counted[1]) }
}

// "(*a*) X or (*b*) Y, or (*c*) Z" → texto da opção A, sem o marcador nem o "or"/vírgula que
// sobra da alternativa seguinte. Linha sem marcador (item obrigatório, sem escolha) sai intacta.
export function firstAlternative(line) {
  const segments = line.split(/\(\*[a-z]\*\)/i)
  const text = segments.length > 1 ? segments[1] : segments[0]
  return norm(text).replace(/,?\s*\bor\b\s*$/i, '').replace(/,\s*$/, '')
}

// srd-2014 (`document: 'srd-2014'`): um bullet (`* …`) por linha, ADITIVOS — todos entram no
// kit, cada um já reduzido à opção A. A frase de abertura ("You start with…") não é bullet.
export function parseSrdEquipmentBullets(desc) {
  return String(desc)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('*'))
    .map((l) => firstAlternative(l.slice(1).trim()))
    .flatMap((optionA) => optionA.split(',').map((part) => norm(part).replace(/^and\s+/i, '')).filter(Boolean))
    .map(toKitItem)
}

// a5e-ag (`document: 'a5e-ag'`): bullets (`- **Nome (Cost N gp):** itens`) são PACOTES
// alternativos INTEIROS, não itens aditivos — escolhe o primeiro pacote (mesma regra "sempre A"),
// descarta rótulo/custo, o resto vira lista de itens.
export function parseA5ePackageEquipment(desc) {
  const firstPackage = String(desc)
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('-'))
  if (!firstPackage) throw new Error('STARTING_EQUIPMENT do a5e-ag sem pacote em lista ("- **Nome:** itens")')
  const items = firstPackage.replace(/^-\s*\*\*[^:]+:\*\*\s*/, '')
  return items.split(',').map((part) => norm(part).replace(/^and\s+/i, '')).filter(Boolean).map(toKitItem)
}

// US-128: preposições/artigos que ficam em minúscula no meio de um nome de item — a
// primeira e a última palavra são SEMPRE maiúsculas, mesmo se estiverem nesta lista
// ("Of Mice and Men" continuaria com o "Of" maiúsculo). EN e PT juntos porque
// `titleCase` roda sobre o texto final, seja ele o fallback EN ou a tradução pt-BR.
const LOWERCASE_WORDS = new Set([
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'and', 'or', 'the', 'a', 'an', 'except',
  'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'para', 'por', 'e', 'ou', 'sem', 'no', 'na', 'nos', 'nas', 'ao', 'aos',
])

// US-128: nome de item não começa com artigo indefinido — "a prayer book" vira "prayer book"
// antes do titleCase (que então maiuscula a nova primeira palavra). EN ("a"/"an") e PT
// ("um"/"uma") juntos, mesmo motivo do LOWERCASE_WORDS acima. Só o INÍCIO da string conta —
// "One set of artisan's tools" não é artigo (é numeral), fica como está de propósito.
function stripLeadingArticle(text) {
  return text.replace(/^(a|an|um|uma)\s+/i, '')
}

// Nome de item de inventário, palavra por palavra maiúscula — exceto preposição/artigo no
// meio (LOWERCASE_WORDS), e exceto a primeira e a última palavra, que são sempre maiúsculas
// independente da lista. Pontuação (parênteses, apóstrofo) não é tocada; `'s`/`'` dentro da
// palavra ("artisan's") sobrevive porque o token inteiro é uma unidade só.
//
// Posição (índice do match), não o TEXTO da palavra, decide "é a última" — duas ocorrências
// da mesma palavra (uma no meio, outra no fim) não podem se confundir por comparação de string.
export function titleCase(text) {
  const matches = [...text.matchAll(/[\p{L}][\p{L}'’]*/gu)]
  if (!matches.length) return text
  const lastIndex = matches[matches.length - 1].index
  let result = text
  let shift = 0
  for (const [i, m] of matches.entries()) {
    const isFirst = i === 0
    const isLast = m.index === lastIndex
    const lower = m[0].toLowerCase()
    const replacement = !isFirst && !isLast && LOWERCASE_WORDS.has(lower)
      ? lower
      : lower.charAt(0).toUpperCase() + lower.slice(1)
    const start = m.index + shift
    result = result.slice(0, start) + replacement + result.slice(start + m[0].length)
    shift += replacement.length - m[0].length
  }
  return result
}

// Traduz nome de item de kit via `overlay.kitItems` (chave = nome EN, sem descrição — item só
// tem nome, não há onde pendurar a marca `_mt`, por isso fora de MT_DOMAINS). Compartilhado
// entre kit de classe (buildStartingKits, US-51) e equipamento de origem (buildBackgrounds,
// US-128) — mesmo mecanismo, mesma chave EN, mesmo relatório de órfão/fallback. A CHAVE do
// overlay continua o texto cru do dataset (`item.name`, nunca transformado) — só o nome final
// (fallback EN ou tradução pt-BR) passa por `stripLeadingArticle`/`titleCase`, senão a busca
// no overlay quebraria.
function localizeKitItems(overlay, resolve, items) {
  return items.map((item) => ({
    name: titleCase(stripLeadingArticle(resolve('kitItems', item.name, { name: overlay.kitItems?.[item.name] }, item.name).name)),
    qty: item.qty,
  }))
}

export function buildStartingKits(overlay, features, resolve) {
  const startingKits = { default: localizeKitItems(overlay, resolve, DEFAULT_KIT) }
  for (const f of features) {
    if (f.fields.feature_type !== 'STARTING_EQUIPMENT') continue
    const canon = CLASS_MAP[f.fields.parent]
    if (!canon) continue // subclasse/documento fora do mapa: o loop abaixo é quem cobra a base
    const items = f.fields.document === 'a5e-ag' ? parseA5ePackageEquipment(f.fields.desc) : parseSrdEquipmentBullets(f.fields.desc)
    startingKits[canon] = localizeKitItems(overlay, resolve, items)
  }
  for (const canon of Object.values(CLASS_MAP)) {
    if (!startingKits[canon]) throw new Error(`Classe sem kit inicial: ${canon} (nenhuma feature STARTING_EQUIPMENT em ClassFeature.json)`)
  }
  return startingKits
}

// --- backgroundEquipment (US-128): benefício type === 'equipment' → itens de inventário ---
//
// Duas regras gerais resolvem as armadilhas medidas contra as 21 entradas reais, ANTES do
// split por vírgula — nenhuma curadoria por origem:
//   1. parêntese que contém " or " some inteiro ("Holy symbol (amulet or reliquary)" →
//      "Holy symbol"): sem isto, cortar no primeiro " or" (como o toKitItem faz) deixaria
//      parêntese aberto e nunca fechado.
//   2. escolha composta no final ("...and a prayer book, prayer wheel, or prayer beads.")
//      vira só a primeira opção ("...and a prayer book.") ANTES do split — senão as 2
//      vírgulas internas da escolha fatiam em 3 itens errados.
// Sem extração de numeral (ao contrário do `toKitItem`): o número aqui nunca é contagem de
// item, é medida ("7 days rations", "50 feet of rope") — extrair como `qty` produziria
// "feet of rope (50)" na tela, lido como 50 cordas. Texto completo (numeral incluso) fica
// no nome, `qty` sempre 1.
export function parseBackgroundEquipment(desc) {
  const noParenOr = String(desc).replace(/\s*\([^)]*\bor\b[^)]*\)/gi, '')
  const firstOptionOnly = noParenOr.replace(
    /,\s*and\s+([^,]+),\s*[^,]+,\s*or\s+[^,.]+\.?\s*$/i,
    ', and $1.',
  )
  return firstOptionOnly
    .split(',')
    .map((part) => norm(part).replace(/^and\s+/i, '').replace(/\.\s*$/, ''))
    .filter(Boolean)
    .map((name) => ({ name, qty: 1 }))
}

// US-123 — parseAbilityGrant: "+1 to Wisdom and one other ability score." → grant estruturado.
// Padrão único medido nas 21 entradas de `ability_score` (US-123 §Contexto). Devolve
// `undefined` quando o texto não bate OU o atributo citado não existe em ATTR_ORDER — função
// pura e testável, mesmo contrato do `parseStartingKit` (US-51). Falhar alto por causa do
// `undefined` é decisão do CALLER (`buildBackgrounds`), não desta função.
export function parseAbilityGrant(desc) {
  const match = String(desc).match(/^\+1 to (\w+) and one other ability score\.$/)
  if (!match) return undefined
  const fixed = match[1].toLowerCase()
  if (!ATTR_ORDER.includes(fixed)) return undefined
  return { kind: 'ability', fixed, freeCount: 1 }
}

// US-131: "Sleight of Hand" → "sleight_of_hand" — mesma normalização que `buildSkills` já usa
// como chave (toLowerCase + espaço→"_"); não precisa de mapa novo.
const normalizeSkillKey = (name) => String(name).toLowerCase().replace(/\s+/g, '_')

const SKILL_FREE_CHOICE_WORDS = { one: 1, two: 2, three: 3, four: 4 }

// US-131 — parseSkillGrant: `skill_proficiency` → grant estruturado. Dois formatos medidos nas
// 21 entradas (US-131 §Contexto):
//   1. "<Fixas>, and either <opções>." — 1 a 3 perícias fixas + escolha de 1 entre 2-4 opções
//      (20/21 entradas).
//   2. "<N> of your choice." — escolha totalmente livre de N (só o Guildmember, 1/21):
//      `chooseFrom` vira o catálogo INTEIRO, única forma de expressar "qualquer perícia" sem
//      campo novo no schema.
// `resolveSkillKey(name)` resolve nome→chave do catálogo OU `undefined` — perícia sem entrada
// (caso defensivo: US-130 já fecha a lacuna real das 21 de hoje) é OMITIDA do array, nunca
// derruba a função inteira. `undefined` aqui é só padrão de TEXTO não reconhecido (mesmo
// contrato do `parseAbilityGrant`) — falhar alto por isso é decisão do CALLER.
export function parseSkillGrant(desc, resolveSkillKey, allSkillKeys) {
  const text = String(desc).trim().replace(/\.\s*$/, '')
  const free = text.match(/^(\w+) of your choice$/i)
  if (free) {
    const chooseCount = SKILL_FREE_CHOICE_WORDS[free[1].toLowerCase()]
    if (!chooseCount) return undefined
    return { fixed: [], chooseFrom: [...allSkillKeys].sort(), chooseCount }
  }
  const match = text.match(/^(.+), and either (.+)$/i)
  if (!match) return undefined
  const fixed = match[1].split(',').map((s) => s.trim()).filter(Boolean).map(resolveSkillKey).filter(Boolean)
  const chooseFrom = match[2]
    .replace(/,?\s+or\s+/i, ',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(resolveSkillKey)
    .filter(Boolean)
  return { fixed, chooseFrom, chooseCount: 1 }
}

// US-132 — normalizeToolName: "Smith's Tools"/"Smith’s Tools" → "smiths_tools" — mesma
// normalização de `normalizeSkillKey` (US-131) mais remoção de apóstrofo (reto ou curvo): a
// chave de config.tools nasce do `pk` do dataset (US-134), que já nunca teve apóstrofo.
const normalizeToolName = (name) => norm(name).replace(/[’']/g, '').toLowerCase().replace(/\s+/g, '_')

// US-132 — chaves de config.tools por categoria de escolha, mais a distinção terrestre/
// aquático que `config.tools` (US-134) colapsa em `category: 'vehicle'` (buildTools, `item.fields
// .category === 'tools' ? toolCategory(...) : 'vehicle'`) — só o `Item.json` BRUTO ainda
// distingue `land-vehicle`/`waterborne-vehicle`, por isso `itemsRaw` chega aqui como parâmetro
// extra (mesmo array que `buildTools` já recebe), não recalculado a partir de `config.tools`.
function buildToolCategories(tools, itemsRaw) {
  const byCategory = {}
  for (const t of tools) (byCategory[t.category] ??= []).push(t.key)
  const vehicleLand = []
  const vehicleWater = []
  for (const item of itemsRaw) {
    const key = stripDocument(item.pk).replace(/-/g, '_')
    if (item.fields.category === 'land-vehicle') vehicleLand.push(key)
    else if (item.fields.category === 'waterborne-vehicle') vehicleWater.push(key)
  }
  return {
    artisan: byCategory['artisan'] ?? [],
    'gaming-set': byCategory['gaming-set'] ?? [],
    'musical-instrument': byCategory['musical-instrument'] ?? [],
    vehicleAll: byCategory['vehicle'] ?? [],
    vehicleLand: vehicleLand.sort(),
    vehicleWater: vehicleWater.sort(),
  }
}

// US-132 — resolveToolUnit: reconhece a FORMA de um fragmento de `tool_proficiency` (uma parte
// separada por vírgula, ou um dos lados de "one/either ... or ..."). Nunca toca o catálogo —
// só decide se o texto é uma categoria conhecida (com sua REGRA de fixo-ou-escolha) ou um item
// concreto nomeado. `undefined` é o texto não bater com NENHUMA forma medida (falha alto no
// CALLER, mesmo contrato de `parseAbilityGrant`/`parseSkillGrant`).
//
// `mode: 'fixed'` (proficiência em TODAS as chaves da categoria, sem escolha) só ocorre pra
// veículo QUALIFICADO ("Land vehicles", "water vehicles" — plural, sem "one"). Toda outra
// categoria (artisan, gaming-set, musical-instrument, vehicle sem qualificação) é `'choice'`:
// o texto real nunca oferece TODAS as opções de uma vez, só "um tipo de".
function resolveToolUnit(unitText) {
  const clean = norm(unitText)
  if (/^land vehicles?$/i.test(clean)) return { category: 'vehicleLand', mode: 'fixed' }
  if (/^water vehicles?$/i.test(clean)) return { category: 'vehicleWater', mode: 'fixed' }
  if (/vehicles?$/i.test(clean)) return { category: 'vehicleAll', mode: 'choice' }
  if (/gaming set$/i.test(clean)) return { category: 'gaming-set', mode: 'choice' }
  if (/artisan/i.test(clean)) return { category: 'artisan', mode: 'choice' }
  if (/musical instrument$/i.test(clean)) return { category: 'musical-instrument', mode: 'choice' }
  if (/\b(kit|tools)$/i.test(clean)) return { name: clean, mode: 'fixed' }
  return undefined
}

// Resolve a FORMA reconhecida (`resolveToolUnit`) contra o catálogo real. Categoria ou item
// nomeado sem entrada em `config.tools` — caso defensivo, os 13 reais batem 100% hoje — é
// relatado como órfão (mesmo relatório de `resolveSkillKey`, US-131) e contribui zero chaves,
// nunca derruba a função inteira.
function resolveToolKeys(unit, toolsByKey, toolCategories, orphans) {
  if (unit.category) {
    const keys = toolCategories[unit.category]
    if (keys.length === 0) orphans.push({ domain: 'tools', key: unit.category })
    return keys
  }
  const key = normalizeToolName(unit.name)
  if (toolsByKey.has(key)) return [key]
  orphans.push({ domain: 'tools', key: unit.name })
  return []
}

// US-132 — parseToolGrant: `tool_proficiency` → grant estruturado. Texto bem mais irregular que
// `skill_proficiency` (US-131, 2 formatos): os 13 desc medidos (US-132 §Contexto) misturam item
// concreto ("Herbalism kit"), categoria fixa sem escolha ("Land vehicles" — TODAS as chaves, não
// uma), e escolha (dentro de uma categoria ou entre categorias via "or"). Resolvido em 2 formas
// top-level:
//   1. Contém "or"/"either": cláusula ÚNICA de escolha — união das partes (categoria inteira ou
//      item concreto) vira `chooseFrom`, `chooseCount` sempre 1 (as 3 entradas reais com "or"
//      nunca têm item fixo fora da cláusula).
//   2. Sem "or": lista separada por vírgula, cada parte julgada independente — cada uma soma a
//      `fixed` (item concreto, ou categoria plural sem qualificador) OU soma 1 a `chooseCount`/
//      `chooseFrom` (categoria com "one"/singular bare). Misturar fixo e escolha na MESMA origem
//      (Criminal: "Gaming set, thieves' tools." — thieves' tools fixo, gaming set é escolha) é o
//      motivo de não caber no par fixed-OU-choice do `parseSkillGrant`.
export function parseToolGrant(desc, toolsByKey, toolCategories, orphans = []) {
  const text = String(desc).trim().replace(/\.\s*$/, '')
  if (/\bor\b/i.test(text)) {
    let t = text.replace(/^either\s+/i, '').replace(/^one type of\s+/i, '')
    t = t.replace(/,?\s+or\s+/gi, ',')
    const parts = t.split(',').map((s) => s.trim()).filter(Boolean)
    const chooseFrom = new Set()
    for (const part of parts) {
      const unit = resolveToolUnit(part)
      if (!unit) return undefined
      resolveToolKeys(unit, toolsByKey, toolCategories, orphans).forEach((k) => chooseFrom.add(k))
    }
    return { fixed: [], chooseFrom: [...chooseFrom].sort(), chooseCount: 1 }
  }
  const parts = text.split(',').map((s) => s.trim().replace(/^one\s+/i, '')).filter(Boolean)
  const fixed = new Set()
  const chooseFrom = new Set()
  let chooseCount = 0
  for (const part of parts) {
    const unit = resolveToolUnit(part)
    if (!unit) return undefined
    const keys = resolveToolKeys(unit, toolsByKey, toolCategories, orphans)
    if (unit.mode === 'fixed') keys.forEach((k) => fixed.add(k))
    else {
      keys.forEach((k) => chooseFrom.add(k))
      chooseCount += 1
    }
  }
  return { fixed: [...fixed].sort(), chooseFrom: [...chooseFrom].sort(), chooseCount }
}

// --- backgrounds (21 + benefícios): a5e-ag (EN Publishing), CC-BY-4.0 via dual-licenciamento
// (ADR 004 §3.3) — join de Background + BackgroundBenefit por `parent → pk`, mesmo estilo de
// Map que ClassFeature/ClassFeatureItem (US-47) e StartingKit (US-51) já usam.
//
// `Background.desc` vem VAZIO nas 21 entradas — só o `name` do background passa por resolve
// (sem enDesc). Cada benefício é `resolve`ido por si (name+desc), com o próprio `pk` como
// chave de overlay: não precisa de mapa tipo CLASS_MAP porque `parent` já referencia o pk do
// Background diretamente (um nível só, não dois como classFeature/classFeatureItem).
// US-128: devolve `{ backgrounds, backgroundEquipment }` — o segundo é derivado do benefício
// `type === 'equipment'`, parseado a partir do `b.fields.desc` CRU (EN, igual a
// `startingEquipmentCell`/`parseStartingKit`), nunca do `entry.description` já resolvido —
// aquele pode vir traduzido por MT (backgrounds está em MT_DOMAINS) e um nome de item já em
// pt-BR não bate contra a chave EN de `overlay.kitItems`. Mesmo padrão de `buildStartingKits`:
// parse sobre o dataset EN, tradução por item via `localizeKitItems`.
// US-135: devolve também `backgroundFeatures`, derivado do benefício `type === 'feature'` —
// aqui SIM usa `entry.name`/`entry.description` já resolvidos (ao contrário de
// `backgroundEquipment`/`ability_score`/`skill_proficiency` acima): não há parse estrutural
// sobre o `desc` cru, é awareness igual a `SystemClassFeature` (US-41), então o texto traduzido
// serve direto. `key: b.pk` sem slug novo — já é `<parent>_<slug>`, a mesma chave que `resolve`
// já usa para este benefício (ver US-135 §Questões em aberto #1).
export function buildBackgrounds(overlay, backgroundsRaw, benefitsRaw, resolve, skills = [], tools = [], itemsRaw = [], orphans = []) {
  const bgKeys = new Set(backgroundsRaw.map((bg) => bg.pk))
  const skillKeys = skills.map((s) => s.key)
  const skillKeySet = new Set(skillKeys)
  const toolsByKey = new Set(tools.map((t) => t.key))
  const toolCategories = buildToolCategories(tools, itemsRaw)
  // US-131: perícia citada em `skill_proficiency` sem entrada em config.skills — relatada
  // (mesmo relatório de órfãos do overlay, US-47) e omitida do grant (`parseSkillGrant`
  // acima filtra o `undefined`). Caso defensivo: os 21 backgrounds de hoje batem 100%.
  const resolveSkillKey = (name) => {
    const key = normalizeSkillKey(name)
    if (skillKeySet.has(key)) return key
    orphans.push({ domain: 'skills', key: name })
    return undefined
  }
  const benefitsByParent = {}
  for (const b of benefitsRaw) {
    if (!bgKeys.has(b.fields.parent)) {
      throw new Error(`BackgroundBenefit ${b.pk}: parent "${b.fields.parent}" sem Background correspondente`)
    }
    ;(benefitsByParent[b.fields.parent] ??= []).push(b)
  }
  const backgroundEquipment = {}
  const backgroundFeatures = {}
  const backgrounds = backgroundsRaw
    .map((bg) => {
      const key = bg.pk
      const name = resolve('backgrounds', key, overlay.backgrounds?.[key], bg.fields.name).name
      const benefits = (benefitsByParent[bg.pk] ?? []).map((b) => {
        const entry = resolve('backgrounds', b.pk, overlay.backgrounds?.[b.pk], b.fields.name, norm(b.fields.desc))
        if (b.fields.type === 'equipment') {
          const items = parseBackgroundEquipment(norm(b.fields.desc))
          backgroundEquipment[key] = localizeKitItems(overlay, resolve, items)
        }
        if (b.fields.type === 'feature') {
          ;(backgroundFeatures[key] ??= []).push({ key: b.pk, name: entry.name, description: entry.description, source: 'a5e-ag' })
        }
        // US-123: `ability_score` vira `grant` estruturado sobre o `desc` CRU (EN), nunca sobre
        // `entry.description` (pode vir traduzido por MT) — mesmo cuidado de `backgroundEquipment`
        // acima. Falha alto se o padrão não bater: os 21 batem hoje, formato novo merece ser visto.
        let grant
        if (b.fields.type === 'ability_score') {
          grant = parseAbilityGrant(norm(b.fields.desc))
          if (!grant) throw new Error(`${b.pk}: ability_score fora do padrão "+1 to <Atributo> and one other ability score." (desc: "${norm(b.fields.desc)}")`)
        } else if (b.fields.type === 'skill_proficiency') {
          grant = parseSkillGrant(norm(b.fields.desc), resolveSkillKey, skillKeys)
          if (!grant) throw new Error(`${b.pk}: skill_proficiency fora do padrão "<Fixas>, and either <opções>." ou "<N> of your choice." (desc: "${norm(b.fields.desc)}")`)
          grant = { kind: 'skills', ...grant }
        } else if (b.fields.type === 'tool_proficiency') {
          grant = parseToolGrant(norm(b.fields.desc), toolsByKey, toolCategories, orphans)
          if (!grant) throw new Error(`${b.pk}: tool_proficiency fora dos padrões medidos (US-132) (desc: "${norm(b.fields.desc)}")`)
          grant = { kind: 'tools', ...grant }
        }
        return { type: b.fields.type, name: entry.name, description: entry.description, ...(grant ? { grant } : {}) }
      })
      return { key, name, benefits, source: 'a5e-ag' }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
  return { backgrounds, backgroundEquipment, backgroundFeatures }
}

// --- tools (50): Item.json category → catálogo de proficiência de ferramenta/veículo (US-134) ---
//
// Só 3 das 12 categorias do dataset correspondem a proficiência de ferramenta (US-134 §Contexto:
// `tools` 39, `land-vehicle` 5, `waterborne-vehicle` 6) — as outras 9 (weapon, armor, potion...)
// são equipamento geral, fora do escopo desta story.

// Os 2 itens que não seguem padrão nenhum de nome (sem prefixo, sem sufixo " Kit", sem preço) —
// tabela explícita, mesmo espírito do CLASS_MAP: são só 2, mapa erra alto em vez de engolir em
// silêncio se um Item.json futuro trouxer um terceiro.
const NAMED_ALONE_TOOLS = new Set(["Navigator's Tools", "Thieves' Tools"])
const PRICE_SUFFIX = / \(\d+\s*GP\)$/i
// "Smith's Tools (20 GP)", "Alchemist's Supplies (50 GP)", "Cook's Utensils (1 GP)" — o preço
// AQUI é parte do padrão (as 17 artisan são as únicas com preço no nome), não ruído genérico:
// distingue o padrão de um nome qualquer terminado em "(N GP)" que não seja ferramenta de ofício.
const ARTISAN_PATTERN = /'s (Tools|Supplies|Utensils) \(\d+\s*GP\)$/

// Categoria de PROFICIÊNCIA (2º nível, dentro de `category: 'tools'`) a partir do padrão do
// NOME — tabela explícita, mesmo contrato de `parseStartingKit`/`parseSkillGrant`: nome fora
// dos 5 padrões medidos falha alto, não é omitido em silêncio.
function toolCategory(name, key) {
  if (name.startsWith('Musical Instrument, ')) return 'musical-instrument'
  if (name.startsWith('Gaming Set, ')) return 'gaming-set'
  if (name.endsWith(' Kit')) return 'kit'
  if (NAMED_ALONE_TOOLS.has(name)) return key // item concreto fixo, sem 2º nível — a própria chave identifica
  if (ARTISAN_PATTERN.test(name)) return 'artisan'
  throw new Error(`Item.json category "tools" fora dos 5 padrões medidos (US-134): "${name}"`)
}

export function buildTools(overlay, itemsRaw, resolve) {
  const relevant = itemsRaw.filter((i) => ['tools', 'land-vehicle', 'waterborne-vehicle'].includes(i.fields.category))
  return relevant
    .map((item) => {
      const key = stripDocument(item.pk).replace(/-/g, '_')
      const enLabel = item.fields.name.replace(PRICE_SUFFIX, '')
      const category = item.fields.category === 'tools' ? toolCategory(item.fields.name, key) : 'vehicle'
      // `desc` do dataset (texto de regra do item) só alimenta a tradução (US-52) — nunca entra
      // no artefato: SystemToolSchema não tem campo description (US-134 §Fora do escopo).
      const label = resolve('tools', key, overlay.tools?.[key], enLabel, norm(item.fields.desc)).name
      return { key, label, category }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}

// Monta um artefato completo a partir do dataset + um overlay. Overlay `{}` = base EN crua.
function buildConfig(overlay, data) {
  const { resolve, fallbacks, orphans, usedOverlay, glossary } = makeResolver()
  const attributes = buildAttributes(overlay, data.abilities, resolve)
  const skills = buildSkills(overlay, data.skillsRaw, resolve)
  const races = buildRaces(overlay, data.species2014, resolve)
  const classes = buildClasses(overlay, data.classes, resolve)
  const classFeatures = buildClassFeatures(overlay, data, resolve)
  const classSpells = buildClassSpells(overlay, data.spells, resolve)
  const startingKits = buildStartingKits(overlay, data.features, resolve)
  // US-132: buildTools roda ANTES de buildBackgrounds — o grant `kind: 'tools'` do benefício
  // `tool_proficiency` precisa de `config.tools` já resolvido (chaves) mais o `data.items` bruto
  // (distinção terrestre/aquático que `config.tools` colapsa, ver buildToolCategories).
  const tools = buildTools(overlay, data.items, resolve)
  const { backgrounds, backgroundEquipment, backgroundFeatures } = buildBackgrounds(overlay, data.backgrounds, data.backgroundBenefits, resolve, skills, tools, data.items, orphans)

  // --- órfãos: chave do overlay que nenhum registro do dataset consumiu ---
  // US-138: `races` entra na lista pela primeira vez — antes da união reverter (ADR 009 §8),
  // as 11 chaves do overlay sempre casavam com as 11 do catálogo, então não fazia diferença.
  // Agora goliath/orc ficam no overlay sem chave no catálogo (9 raízes) e precisam aparecer aqui.
  for (const domain of ['races', 'features', 'spells', 'kitItems', 'backgrounds', 'tools']) {
    for (const key of Object.keys(overlay[domain] || {})) {
      if (!usedOverlay[domain].has(key)) orphans.push({ domain, key })
    }
  }

  // --- valida: SystemConfigSchema.parse falha cedo se a forma do dataset regrediu ---
  const artifact = { attributes, skills, races, classes, classFeatures, classSpells, startingKits, backgrounds, backgroundEquipment, backgroundFeatures, tools }
  SystemConfigSchema.parse({ ...artifact, ...STUB })
  return { artifact, fallbacks, orphans, glossary }
}

async function main() {
  const overlay = JSON.parse(await readFile(OVERLAY_PATH, 'utf8'))
  const [
    abilities, rules, skillsRaw, classes2014, features2014, featureItems2014, spells, species2014,
    backgrounds, backgroundBenefits, items, marshalClasses, marshalFeatures, marshalFeatureItems,
  ] = await Promise.all([
    load('AbilityDescription.json'),
    load('Rule.json'),
    load('Skill.json'),
    load('CharacterClass.json'),
    load('ClassFeature.json'),
    load('ClassFeatureItem.json'),
    load('Spell.json'),
    load('Species.2014.json'),
    load('Background.json'),
    load('BackgroundBenefit.json'),
    load('Item.json'),
    // US-139: o Marshal (a5e-ag) soma nos MESMOS três arrays do 5.1 — troca de fonte pras 12
    // SRD, união pro Marshal. CLASS_MAP é quem decide o que sobrevive (subclasse do Marshal
    // não tem entrada, cai fora nos builds do mesmo jeito que subclasse SRD já caía).
    load('CharacterClass.a5e-ag.json'),
    load('ClassFeature.a5e-ag.json'),
    load('ClassFeatureItem.a5e-ag.json'),
  ])
  const classes = [...classes2014, ...marshalClasses]
  const features = [...features2014, ...marshalFeatures]
  const featureItems = [...featureItems2014, ...marshalFeatureItems]
  const data = { abilities, skillsRaw, classes, features, featureItems, spells, species2014, backgrounds, backgroundBenefits, items }

  const base = buildConfig({}, data)
  let localized = buildConfig(overlay, data)

  // --- US-52: preenche as lacunas por tradução de máquina e RECONSTRÓI com o overlay novo ---
  const drafted = await draftMissing(overlay, localized)
  if (drafted.length) {
    await writeFile(OVERLAY_PATH, formatOverlay(overlay))
    localized = buildConfig(overlay, data)
  }

  // --- grava artefatos (chaves ordenadas → idempotente byte-a-byte) ---
  // US-100: o artefato ANTERIOR (o que está prestes a ser sobrescrito) é a única fonte do texto
  // que este bump retirou — por isso a leitura vem antes das duas escritas.
  const [prevEn, prevPtBr] = await Promise.all([
    readArtifactIfAny('srd-5e.config.en-US.json'),
    readArtifactIfAny('srd-5e.config.pt-BR.json'),
  ])
  await write('srd-5e.config.en-US.json', withRetired(base.artifact, prevEn))
  await write('srd-5e.config.pt-BR.json', withRetired(localized.artifact, prevPtBr))

  // US-108 — a tabela é numérica e atravessa locale sem tradução: um artefato só, sem overlay.
  const abilityModifiers = parseAbilityModifiers(rules, TAG)
  await write('ability-modifiers.srd-2024.json', abilityModifiers)
  console.log(`\n  ability-modifiers.srd-2024.json: ${abilityModifiers.rows.length} faixas, pontuação ${abilityModifiers.range.min}–${abilityModifiers.range.max} (US-108)`)

  // US-110 — as tabelas de exemplo do d20 test. As chaves de habilidade são conferidas
  // contra os atributos que ESTE bump construiu: tabela e catálogo discordando falha aqui,
  // não no prompt. Vai para dentro do ai-engine porque o builder do prompt o importa.
  const d20Tests = parseD20Tests(rules, TAG, base.artifact.attributes.map((a) => a.key))
  await writeFile(D20_TESTS_PATH, stableStringify(d20Tests) + '\n')
  console.log(`  ${relative(join(HERE, '..', '..'), D20_TESTS_PATH).replace(/\\/g, '/')}: ${d20Tests.abilityChecks.length} exemplos de teste, ${d20Tests.difficultyClasses.length} CDs (US-110)`)

  // Relatórios só da localização: na base EN toda chave "cai no fallback" por definição
  // (não há overlay), e avisar de tradução faltante ali seria ruído garantido. US-99.
  report(localized, drafted, overlay)
  if (STRICT && localized.fallbacks.length) {
    console.error(`\n--strict: ${localized.fallbacks.length} chave(s) só-EN. Build barrado.`)
    process.exit(1)
  }
}

/**
 * US-52 — traduz as chaves de `features`/`spells` que caíram no fallback EN e escreve os
 * rascunhos DENTRO de `overlay` (mutação: quem chama grava o arquivo e reconstrói).
 * Devolve `[{ domain, key, draft, missingTerms }]`; `[]` quando não há o que traduzir,
 * quando `--no-mt`, quando falta a `GEMINI_API_KEY`, ou quando a chamada falha.
 *
 * Falhar aqui NÃO quebra o ingest: a chave fica sem PT, cai no fallback EN da US-47, e é
 * o `--strict` que decide se isso barra o build. Tradução é conveniência, não pré-requisito.
 */
async function draftMissing(overlay, { fallbacks, glossary }) {
  const gaps = fallbacks.filter((f) => MT_DOMAINS.includes(f.domain) && f.enName && f.enDesc)
  if (!gaps.length) return []
  if (NO_MT) {
    console.log(`\n  --no-mt: ${gaps.length} lacuna(s) NÃO traduzida(s) — seguem no fallback EN.`)
    return []
  }
  if (!process.env.GEMINI_API_KEY) {
    console.log(`\n  AVISO: sem GEMINI_API_KEY — ${gaps.length} lacuna(s) seguem no fallback EN (US-52).`)
    return []
  }

  const terms = [...glossary].map(([en, pt]) => ({ en, pt }))
  const entries = gaps.map((g) => ({ key: `${g.domain}:${g.key}`, name: g.enName, description: g.enDesc }))
  console.log(`\n  Traduzindo ${entries.length} lacuna(s) com ${terms.length} termo(s) de glossário…`)
  let drafts
  try {
    drafts = await translateSrdToPtBr(entries, terms)
  } catch (e) {
    console.log(`  AVISO: tradução falhou (${e.message}) — lacunas seguem no fallback EN.`)
    return []
  }

  return applyDrafts(overlay, gaps, drafts, terms)
}

/** Escreve cada rascunho no overlay marcado `_mt` e passa pela checagem de glossário. */
function applyDrafts(overlay, gaps, drafts, terms) {
  const drafted = []
  for (const gap of gaps) {
    const draft = drafts[`${gap.domain}:${gap.key}`]
    if (!draft) continue
    ;(overlay[gap.domain] ??= {})[gap.key] = { name: draft.name, description: draft.description, _mt: true }
    drafted.push({ ...gap, draft, missingTerms: flagMissingGlossaryTerms(gap, draft, terms) })
  }
  return drafted
}

/**
 * Nível 1 da US-52 (mecânico, sem LLM): se o texto EN de origem cita um termo com PT
 * canônico no glossário e o rascunho não usa esse PT, devolve o par para o relatório.
 * SINALIZA, não bloqueia — pega o erro previsível ("Rage"→"Raiva" em vez de "Fúria").
 *
 * Termo de até 3 letras fica de fora (a magia `Hex`): casa como palavra solta em prosa
 * qualquer e o relatório vira ruído. Cobre só o que já está no glossário; frase livre é
 * revisão humana (nível 2) — ver "A fronteira honesta" na US-52.
 */
export function flagMissingGlossaryTerms(source, draft, terms) {
  const en = `${source.enName} ${source.enDesc}`
  const pt = `${draft.name} ${draft.description}`.toLowerCase()
  return terms
    .filter((t) => t.en.length >= 4 && !pt.includes(t.pt.toLowerCase()))
    .filter((t) => new RegExp(`\\b${t.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(en))
    .map((t) => `${t.en} → ${t.pt}`)
}

async function write(name, artifact) {
  await writeFile(join(HERE, name), stableStringify(artifact) + '\n')
}

/** Artefato da rodada anterior, ou null na primeira geração (ou se o arquivo sumiu). */
async function readArtifactIfAny(name) {
  try {
    return JSON.parse(await readFile(join(HERE, name), 'utf8'))
  } catch {
    return null
  }
}

/**
 * US-100 — CARRY-OVER do conteúdo aposentado. Chave que existia no artefato anterior e não está
 * neste bump é transportada para `retired*` com o texto do MESMO locale que ela já tinha (cada
 * artefato carrega do seu par), e o `retired*` anterior vem junto — conteúdo retirado há dois
 * bumps não evapora no terceiro.
 *
 * Por quê: a ficha guarda a CHAVE. Sem esta rede, um bump que retire conteúdo faz a linha sumir
 * da ficha de quem o tinha, sem erro nenhum. Hoje a lista sai VAZIA (o `retired*` nem chega ao
 * arquivo) — a última retirada foi resgatada pela união do ADR 009, e é sorte, não desenho.
 *
 * Chave que VOLTA ao catálogo vivo sai do `retired*` sozinha: quem manda é o `live` do bump novo.
 */
export function withRetired(artifact, prev) {
  const retiredFeatures = retireMissing(prev?.classFeatures, prev?.retiredFeatures, artifact.classFeatures)
  const retiredSpells = retireMissing(prev?.classSpells, prev?.retiredSpells, artifact.classSpells)
  return {
    ...artifact,
    // Só entra no arquivo quando há o que aposentar: mapa vazio seria ruído no diff de todo bump.
    ...(Object.keys(retiredFeatures).length ? { retiredFeatures } : {}),
    ...(Object.keys(retiredSpells).length ? { retiredSpells } : {}),
  }
}

/** Entradas do catálogo anterior (vivas ou já aposentadas) que o catálogo novo não tem. */
function retireMissing(prevByClass, prevRetired, nextByClass) {
  const live = new Set(Object.values(nextByClass ?? {}).flat().map((e) => e.key))
  const previous = [...Object.values(prevByClass ?? {}).flat(), ...Object.values(prevRetired ?? {})]
  const retired = {}
  for (const entry of previous) {
    if (!live.has(entry.key)) retired[entry.key] = entry
  }
  return retired
}

// Serializa com chaves ordenadas recursivamente (arrays preservam a ordem já definida).
function stableStringify(value, indent = 0) {
  const pad = '  '.repeat(indent)
  const pad1 = '  '.repeat(indent + 1)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return '[\n' + value.map((v) => pad1 + stableStringify(v, indent + 1)).join(',\n') + '\n' + pad + ']'
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    if (keys.length === 0) return '{}'
    return '{\n' + keys.map((k) => pad1 + JSON.stringify(k) + ': ' + stableStringify(value[k], indent + 1)).join(',\n') + '\n' + pad + '}'
  }
  return JSON.stringify(value)
}

/**
 * Serializa o overlay pt-BR NO FORMATO EM QUE ele é editado à mão: uma entrada por linha,
 * ordem de inserção preservada. Não é o `stableStringify` de propósito — aquele ordena
 * chave e quebra objeto em várias linhas; usá-lo aqui reescreveria o arquivo inteiro a
 * cada rodada e afogaria o rascunho `_mt` num diff de 90 linhas. O gate desta US é a
 * revisão do diff (nível 2): diff pequeno é o produto, não um detalhe.
 *
 * Round-trip verificado byte-a-byte em scripts/srd/ingest.test.mjs.
 */
export function formatOverlay(overlay) {
  const leaf = (v) =>
    typeof v === 'string'
      ? JSON.stringify(v)
      : `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(', ')} }`
  const block = (o) => `{\n${Object.entries(o).map(([k, v]) => `    ${JSON.stringify(k)}: ${leaf(v)}`).join(',\n')}\n  }`
  const top = Object.entries(overlay).map(
    ([k, v]) => `  ${JSON.stringify(k)}: ${typeof v === 'string' ? JSON.stringify(v) : block(v)}`,
  )
  return `{\n${top.join(',\n')}\n}\n`
}

// US-52 — o que foi traduzido AGORA (para revisar no diff), o que ignorou o glossário, e
// quanto rascunho `_mt` continua pendente no overlay. O pendente sai em TODA rodada, mesmo
// sem tradução nova: rascunho pode shipar (US-52 → Decisões #1), mas dívida invisível não.
function reportDrafts(drafted, overlay) {
  if (drafted.length) {
    console.log(`\n  RASCUNHOS _mt (${drafted.length}) — traduzidos agora e gravados em locale/pt-BR.json. REVISE NO DIFF:`)
    for (const d of drafted) console.log(`    ${d.domain}: ${d.key} → ${d.draft.name}`)
  }
  const flagged = drafted.filter((d) => d.missingTerms.length)
  if (flagged.length) {
    console.log(`\n  GLOSSÁRIO IGNORADO (${flagged.length}) — o EN cita um termo canônico que o PT não usou:`)
    for (const d of flagged) console.log(`    ${d.domain}: ${d.key} — ${d.missingTerms.join(' · ')}`)
  }
  const pending = MT_DOMAINS.flatMap((d) => Object.values(overlay[d] || {})).filter((e) => e?._mt).length
  if (pending) console.log(`\n  ${pending} entrada(s) ainda marcada(s) "_mt" no overlay — revisar e remover a marca promove a curada.`)
}

function report({ fallbacks, orphans, artifact }, drafted, overlay) {
  console.log('ingest OK → scripts/srd/srd-5e.config.{en-US,pt-BR}.json')
  console.log(`  attributes: 6 · skills: ${artifact.skills.length} · races: ${artifact.races.length} · classes: ${artifact.classes.length} · backgrounds: ${artifact.backgrounds.length} · tools: ${artifact.tools.length}`)
  reportDrafts(drafted, overlay)
  if (orphans.length) {
    // US-131: dois motivos possíveis por trás de `domain`: overlay com PT sem chave no SRD 5.2
    // (a maioria dos domínios), ou `domain: 'skills'` — perícia citada num `skill_proficiency`
    // sem entrada em config.skills (caso defensivo, ver `resolveSkillKey` em buildBackgrounds).
    console.log(`\n  ÓRFÃOS (${orphans.length}) — chave sem par no dataset/catálogo atual (decidir: sumiu, mudou de nome, ou não é SRD):`)
    for (const o of orphans) console.log(`    ${o.domain}: ${o.key}`)
  }
  if (fallbacks.length) {
    console.log(`\n  FALLBACK EN (${fallbacks.length}) — conteúdo do 5.2 sem PT no overlay (tradução = US-52):`)
    const byDomain = {}
    for (const f of fallbacks) (byDomain[f.domain] ??= []).push(f.key)
    for (const d of Object.keys(byDomain)) console.log(`    ${d} (${byDomain[d].length}): ${byDomain[d].join(', ')}`)
  }
  if (!orphans.length && !fallbacks.length) console.log('  Sem órfãos e sem fallback EN — overlay cobre tudo.')
}

// Guard de entrypoint: o ingest.test.mjs importa `formatOverlay` e
// `flagMissingGlossaryTerms` daqui, e sem isto o import rodaria o pipeline inteiro.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('ingest falhou:', e.message)
    process.exit(1)
  })
}
