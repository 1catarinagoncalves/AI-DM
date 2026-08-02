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
import { dirname, join } from 'node:path'
// ponytail: import relativo ao dist do @ai-dm/shared (o root node_modules não simlinka o
// workspace). Precisa do shared buildado. Uma troca de resolução vira uma linha aqui.
import { SystemConfigSchema } from '../../packages/shared/dist/index.js'
// US-52: a chamada de LLM vive no ai-engine porque só lá `ai` e `@ai-sdk/google` resolvem
// (o node_modules da raiz não os tem). Mesmo motivo do narration-gen.ts na US-36.
import { translateSrdToPtBr } from '../../packages/ai-engine/dist/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, '_data')
const OVERLAY_PATH = join(HERE, 'locale', 'pt-BR.json')
const STRICT = process.argv.includes('--strict')
const NO_MT = process.argv.includes('--no-mt')

// Domínios que a tradução automática atende. `attributes` e `skills` ficam de fora de
// propósito: o overlay os guarda como STRING crua (`"strength": "Força"`), sem lugar para
// a marca `_mt`, e são os 6 atributos e as 18 perícias fixos do 5e — não é conteúdo que um
// bump traga. Se um dia trouxer, ele cai no fallback EN e o `--strict` grita, como hoje.
const MT_DOMAINS = ['features', 'spells']

// Mapa explícito das 12 classes do SRD → chave canônica do config. NÃO reusa o CLASS_SYNONYMS
// de starting-inventory.ts: aquele casa entrada do usuário em PT; este converte o slug do dataset.
//
// US-54: a chave canônica é EN (a base nativa dos dados é EN, ver ADR 005). O mapa virou quase
// identidade, mas continua explícito de propósito: é ele que FALHA ALTO quando o dataset traz uma
// classe base desconhecida (ver `Classe base sem entrada no CLASS_MAP` abaixo). Derivar do slug
// (`pk.replace(/^srd-2024_/, '')`) troca estas 12 linhas por uma classe sumindo em silêncio num bump.
const CLASS_MAP = {
  'srd-2024_barbarian': 'barbarian',
  'srd-2024_bard': 'bard',
  'srd-2024_cleric': 'cleric',
  'srd-2024_druid': 'druid',
  'srd-2024_fighter': 'fighter',
  'srd-2024_monk': 'monk',
  'srd-2024_paladin': 'paladin',
  'srd-2024_ranger': 'ranger',
  'srd-2024_rogue': 'rogue',
  'srd-2024_sorcerer': 'sorcerer',
  'srd-2024_warlock': 'warlock',
  'srd-2024_wizard': 'wizard',
}

// Atributo abreviado (dataset) → chave canônica. Ordem fixa = ordem do config (idempotência).
const ABILITY_MAP = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' }
const ATTR_ORDER = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']

// Faixa/point-buy 5e: decisão de PRODUTO (não SRD). Fica aqui só para montar o campo attributes;
// o orçamento (pointBuy.budget) segue no seed. Ver US-47 "Fora do escopo".
const ATTR_RANGE = { min: 10, max: 18, default: 10 }

// Stub dos campos que o ingest não deriva (o schema os exige; o valor real vive no seed).
const STUB = { startingKits: { default: [{ name: '—', qty: 1 }] }, pointBuy: { budget: 27 } }

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
  const usedOverlay = { attributes: new Set(), skills: new Set(), features: new Set(), spells: new Set() }
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

// --- skills (18): doc `core` (traz `ability`); descarta a5e-ag_ (defensivo, AC) ---
function buildSkills(overlay, skillsRaw, resolve) {
  return skillsRaw
    .filter((s) => !String(s.pk).startsWith('a5e-ag_') && !String(s.fields.describes).startsWith('a5e-ag_'))
    .map((s) => {
      const key = String(s.pk).replace(/-/g, '_') // sleight-of-hand → sleight_of_hand
      const ability = ABILITY_MAP[s.fields.ability]
      if (!ability) throw new Error(`Perícia ${s.pk}: ability desconhecida "${s.fields.ability}"`)
      const label = resolve('skills', key, { name: overlay.skills?.[key] }, s.fields.name).name
      return { key, label, ability }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}

// --- classFeatures: nível 1, só classe base, sem ruído de tabela nem motor de conjuração ---
function buildClassFeatures(overlay, { classes, features, featureItems }, resolve) {
  const baseClasses = classes.filter((c) => c.fields.subclass_of === null)
  for (const c of baseClasses) {
    if (!CLASS_MAP[c.pk]) throw new Error(`Classe base sem entrada no CLASS_MAP: ${c.pk}`)
  }
  const lvl1 = new Set(featureItems.filter((i) => i.fields.level === 1).map((i) => i.fields.parent))
  const isNoise = (f) => norm(f.fields.desc) === '[Column data]' // linhas de coluna de tabela
  const isSpellEngine = (f) => /_(spellcasting|pact-magic)$/.test(f.pk) // conjuração é a US-42 (classSpells)

  const classFeatures = { default: [] }
  for (const f of features) {
    const canon = CLASS_MAP[f.fields.parent]
    if (!canon || !lvl1.has(f.pk) || isNoise(f) || isSpellEngine(f)) continue
    const slug = String(f.pk).slice(String(f.fields.parent).length + 1) // srd-2024_paladin_lay-on-hands → lay-on-hands
    const featKey = `${canon}_${slug}`
    const entry = resolve('features', featKey, overlay.features?.[featKey], f.fields.name, norm(f.fields.desc))
    ;(classFeatures[canon] ??= []).push({ _slug: slug, ...entry })
  }
  for (const k of Object.keys(classFeatures)) {
    classFeatures[k] = classFeatures[k]
      .sort((a, b) => a._slug.localeCompare(b._slug))
      .map(({ _slug, ...e }) => e)
  }
  return classFeatures
}

// --- classSpells: nível <= 1 (truques + todas as de 1º), ligadas por classes[] ---
function buildClassSpells(overlay, spells, resolve) {
  const classSpells = { default: [] }
  for (const s of spells) {
    if (s.fields.level > 1) continue
    const slug = String(s.pk).replace(/^srd-2024_/, '')
    const entry = resolve('spells', slug, overlay.spells?.[slug], s.fields.name, norm(s.fields.desc))
    const row = { _slug: slug, name: entry.name, level: s.fields.level, description: entry.description }
    for (const cls of s.fields.classes || []) {
      const canon = CLASS_MAP[cls]
      if (!canon) throw new Error(`Magia ${s.pk}: classe "${cls}" sem entrada no CLASS_MAP`)
      ;(classSpells[canon] ??= []).push(row)
    }
  }
  for (const k of Object.keys(classSpells)) {
    classSpells[k] = classSpells[k]
      .sort((a, b) => a.level - b.level || a._slug.localeCompare(b._slug))
      .map(({ _slug, ...e }) => e)
  }
  return classSpells
}

// Monta um artefato completo a partir do dataset + um overlay. Overlay `{}` = base EN crua.
function buildConfig(overlay, data) {
  const { resolve, fallbacks, orphans, usedOverlay, glossary } = makeResolver()
  const attributes = buildAttributes(overlay, data.abilities, resolve)
  const skills = buildSkills(overlay, data.skillsRaw, resolve)
  const classFeatures = buildClassFeatures(overlay, data, resolve)
  const classSpells = buildClassSpells(overlay, data.spells, resolve)

  // --- órfãos: chave do overlay que nenhum registro do dataset consumiu ---
  for (const domain of ['features', 'spells']) {
    for (const key of Object.keys(overlay[domain] || {})) {
      if (!usedOverlay[domain].has(key)) orphans.push({ domain, key })
    }
  }

  // --- valida: SystemConfigSchema.parse falha cedo se a forma do dataset regrediu ---
  SystemConfigSchema.parse({ attributes, skills, classFeatures, classSpells, ...STUB })
  return { artifact: { attributes, skills, classFeatures, classSpells }, fallbacks, orphans, glossary }
}

async function main() {
  const overlay = JSON.parse(await readFile(OVERLAY_PATH, 'utf8'))
  const [abilities, skillsRaw, classes, features, featureItems, spells] = await Promise.all([
    load('AbilityDescription.json'),
    load('Skill.json'),
    load('CharacterClass.json'),
    load('ClassFeature.json'),
    load('ClassFeatureItem.json'),
    load('Spell.json'),
  ])
  const data = { abilities, skillsRaw, classes, features, featureItems, spells }

  const base = buildConfig({}, data)
  let localized = buildConfig(overlay, data)

  // --- US-52: preenche as lacunas por tradução de máquina e RECONSTRÓI com o overlay novo ---
  const drafted = await draftMissing(overlay, localized)
  if (drafted.length) {
    await writeFile(OVERLAY_PATH, formatOverlay(overlay))
    localized = buildConfig(overlay, data)
  }

  // --- grava artefatos (chaves ordenadas → idempotente byte-a-byte) ---
  await write('srd-5e.config.en-US.json', base.artifact)
  await write('srd-5e.config.pt-BR.json', localized.artifact)

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

function report({ fallbacks, orphans }, drafted, overlay) {
  console.log('ingest OK → scripts/srd/srd-5e.config.{en-US,pt-BR}.json')
  console.log(`  attributes: 6 · skills: 18`)
  reportDrafts(drafted, overlay)
  if (orphans.length) {
    console.log(`\n  ÓRFÃOS (${orphans.length}) — PT curado sem chave no SRD 5.2 (decidir: sumiu, mudou de nome, ou não é SRD):`)
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
