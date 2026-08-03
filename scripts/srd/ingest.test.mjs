// US-52 — testes das duas peças não-triviais da camada de tradução do ingest.
// `node --test scripts/srd/ingest.test.mjs` (ou `pnpm srd:ingest:test`).
//
// Não exercita o modelo: a chamada de LLM é I/O externo e a US-52 decidiu que o gate de
// correção é glossário + revisão humana, não teste automatizado de tradução.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import { formatOverlay, flagMissingGlossaryTerms, mergeEditions, parseStartingKit, withRetired } from './ingest.mjs'

const OVERLAY_PATH = join(import.meta.dirname, 'locale', 'pt-BR.json')

// Regressão do diff pequeno: se o serializador deixar de reproduzir o arquivo como ele é
// editado à mão, gravar UM rascunho reescreve as ~90 linhas e o gate de revisão da US-52
// (ler o `_mt` no diff do PR) morre afogado.
// `\r\n` normalizado: com `core.autocrlf=true` (Windows) o checkout entrega o overlay em
// CRLF e o ingest o regrava em LF. Git não vê mudança nenhuma nisso (`* text=auto` no
// .gitattributes normaliza os dois para LF no índice) — o que este teste guarda é a FORMA
// (ordem das chaves, entrada por linha, espaçamento), não o fim de linha da plataforma.
test('formatOverlay reproduz o overlay curado byte-a-byte', () => {
  const raw = readFileSync(OVERLAY_PATH, 'utf8').replace(/\r\n/g, '\n')
  assert.equal(formatOverlay(JSON.parse(raw)), raw)
})

test('formatOverlay grava o rascunho como uma linha com a marca _mt', () => {
  const out = formatOverlay({
    features: { wizard_arcane_recovery: { name: 'Recuperação Arcana', description: 'Recupera.', _mt: true } },
  })
  assert.equal(
    out,
    '{\n  "features": {\n    "wizard_arcane_recovery": { "name": "Recuperação Arcana", "description": "Recupera.", "_mt": true }\n  }\n}\n',
  )
})

// --- US-105 / ADR 009 — a fusão dos dois SRD ---

const row = (pk, name) => ({ pk, fields: { name } })

// D2: o jogador recebe o texto da EDIÇÃO CORRENTE onde as duas descrevem a mesma coisa.
// Este teste falha se a precedência inverter — que é o modo silencioso de errar, porque a
// chave continua certa e só o conteúdo volta a ser o de 2014.
test('mergeEditions: onde as duas edições têm a chave, vence o 5.2', () => {
  const merged = new Map(mergeEditions([row('srd-2024_dwarf', 'Dwarf')], [row('srd_dwarf', 'Dwarf 5.1')]))
  assert.equal(merged.size, 1)
  assert.equal(merged.get('dwarf').fields.name, 'Dwarf')
})

test('mergeEditions: chave que só o 5.1 tem entra na união', () => {
  const merged = mergeEditions([row('srd-2024_orc', 'Orc')], [row('srd_half-elf', 'Half-Elf')])
  assert.deepEqual(merged.map(([k]) => k), ['half-elf', 'orc']) // ordenado por chave
})

// D3: sem o mapa, conceito renomeado entre as edições vira DUAS entradas do mesmo conceito.
test('mergeEditions: o SRD_EQUIVALENTS deduplica o conceito que mudou de slug', () => {
  const rows2024 = [row('srd-2024_bard_cantrips', 'Cantrips')]
  const rows2014 = [row('srd_bard_cantrips-known', 'Cantrips Known')]
  assert.equal(mergeEditions(rows2024, rows2014, {}).length, 2, 'sem mapa, duplica')
  const deduped = mergeEditions(rows2024, rows2014, { 'bard_cantrips-known': 'bard_cantrips' })
  assert.deepEqual(deduped.map(([k]) => k), ['bard_cantrips'])
})

const RAGE = { en: 'Rage', pt: 'Fúria' }
const SNEAK = { en: 'Sneak Attack', pt: 'Ataque Furtivo' }

test('flagMissingGlossaryTerms sinaliza o termo canônico que o rascunho ignorou', () => {
  const source = { enName: 'Reckless Attack', enDesc: 'While you are in a Rage, you attack recklessly.' }
  const draft = { name: 'Ataque Imprudente', description: 'Enquanto está em Raiva, ataca sem cuidado.' }
  assert.deepEqual(flagMissingGlossaryTerms(source, draft, [RAGE, SNEAK]), ['Rage → Fúria'])
})

test('flagMissingGlossaryTerms cala quando o rascunho usa o termo canônico', () => {
  const source = { enName: 'Reckless Attack', enDesc: 'While you are in a Rage, you attack recklessly.' }
  const draft = { name: 'Ataque Imprudente', description: 'Enquanto está em Fúria, ataca sem cuidado.' }
  assert.deepEqual(flagMissingGlossaryTerms(source, draft, [RAGE, SNEAK]), [])
})

test('flagMissingGlossaryTerms cala quando o EN nem cita o termo', () => {
  const source = { enName: 'Second Wind', enDesc: 'You regain hit points.' }
  const draft = { name: 'Retomar o Fôlego', description: 'Recupera pontos de vida.' }
  assert.deepEqual(flagMissingGlossaryTerms(source, draft, [RAGE, SNEAK]), [])
})

// `Rage` não pode casar dentro de `Outrageous`: o relatório é lido à mão e falso positivo
// treina a gente a ignorá-lo.
test('flagMissingGlossaryTerms exige palavra inteira', () => {
  const source = { enName: 'Outrageous Luck', enDesc: 'An outrageous stroke of fortune.' }
  const draft = { name: 'Sorte Escandalosa', description: 'Um golpe escandaloso de fortuna.' }
  assert.deepEqual(flagMissingGlossaryTerms(source, draft, [RAGE]), [])
})

// --- US-106 — a chave e a origem sobrevivem à gravação ---
//
// Contra os ARTEFATOS versionados, não contra o dataset: é o arquivo gravado que a ficha e o
// seed consomem, e era exatamente na gravação que o `_slug` era descartado antes desta story.
for (const locale of ['en-US', 'pt-BR']) {
  test(`artefato ${locale}: toda feature e magia tem key e source`, () => {
    const artifact = JSON.parse(readFileSync(join(import.meta.dirname, `srd-5e.config.${locale}.json`), 'utf8'))
    const entries = [...Object.values(artifact.classFeatures).flat(), ...Object.values(artifact.classSpells).flat()]
    assert.ok(entries.length > 0, 'artefato sem entradas — ingest não rodou?')
    for (const entry of entries) {
      assert.ok(entry.key, `entrada sem key: ${entry.name}`)
      assert.equal(entry.source, 'srd', `entrada derivada do dataset com source errado: ${entry.key}`)
    }
  })
}

// --- US-51 — o kit inicial sai de TEXTO LIVRE, então cada armadilha do dataset vira teste ---
//
// As células abaixo são o texto CRU de `ClassFeature.CORE_TRAITS_TABLE` (Open5e v2.1.0),
// copiado sem correção — inclusive as palavras que a extração de PDF partiu no meio.

test('parseStartingKit: opção A do clérigo, sem o ouro', () => {
  const cell = "Choose A or B: (A) Chain Shirt, Shield, Mace, Holy Symbol, Priest's Pack, and 7 GP; or (B) 110 GP"
  assert.deepEqual(parseStartingKit(cell), [
    { name: 'Chain Shirt', qty: 1 },
    { name: 'Shield', qty: 1 },
    { name: 'Mace', qty: 1 },
    { name: 'Holy Symbol', qty: 1 },
    { name: "Priest's Pack", qty: 1 },
  ])
})

// O guerreiro é a única classe com TRÊS opções. Cortar em "; " (e não no último ";") é o que
// impede a opção B de entrar no kit como se fosse continuação da A.
test('parseStartingKit: guerreiro para na opção A, sem B nem C', () => {
  const cell =
    "Choose A, B, or C: (A) Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer's Pack, and 4 GP; (B) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Dungeoneer's Pack, and 11 GP; or (C) 155 GP"
  assert.deepEqual(parseStartingKit(cell), [
    { name: 'Chain Mail', qty: 1 },
    { name: 'Greatsword', qty: 1 },
    { name: 'Flail', qty: 1 },
    { name: 'Javelin', qty: 8 },
    { name: "Dungeoneer's Pack", qty: 1 },
  ])
})

// `Leather Ar mor` é o dataset, não erro de digitação daqui. Sem o reparo, o item vira uma
// chave de overlay que nunca casa e o kit sai com "Ar mor" na ficha do jogador.
test('parseStartingKit: repara a palavra partida pela extração de PDF', () => {
  const cell =
    "Choose A or B: (A) Leather Ar mor, Shield, Sickle, Druidic Focus (Quarterstaff), Explorer's Pack, Herbalism Kit, and 9 GP; or (B) 50 GP"
  assert.deepEqual(parseStartingKit(cell).map((i) => i.name), [
    'Leather Armor',
    'Shield',
    'Sickle',
    'Druidic Focus (Quarterstaff)',
    "Explorer's Pack",
    'Herbalism Kit',
  ])
})

// Singularizar cego transforma "Thieves' Tools" (plural no singular) em "Thieves' Tool".
// A regra é: só singulariza o que TINHA numeral.
test('parseStartingKit: numeral singulariza, plural sem numeral fica intacto', () => {
  const cell =
    "Choose A or B: (A) Leather Armor, 2 Daggers, Shortsword, Shortbow, 20 Arrows, Quiver, Thieves' Tools, Burglar's Pack, and 8 GP; or (B) 100 GP"
  assert.deepEqual(parseStartingKit(cell), [
    { name: 'Leather Armor', qty: 1 },
    { name: 'Dagger', qty: 2 },
    { name: 'Shortsword', qty: 1 },
    { name: 'Shortbow', qty: 1 },
    { name: 'Arrow', qty: 20 },
    { name: 'Quiver', qty: 1 },
    { name: "Thieves' Tools", qty: 1 },
    { name: "Burglar's Pack", qty: 1 },
  ])
})

// Escolha em prosa DENTRO da opção A: a primeira alternativa vence, mesma regra do "sempre A".
test('parseStartingKit: corta a escolha em prosa do monge e do bardo', () => {
  const monk =
    "Choose A or B: (A) Spear, 5 Daggers, Artisan's Tools or Musical Instrument chosen for the tool proficiency above, Explorer's Pack, and 11 GP; or (B) 50 GP"
  assert.deepEqual(parseStartingKit(monk).map((i) => i.name), ['Spear', 'Dagger', "Artisan's Tools", "Explorer's Pack"])

  const bard =
    "Choose A or B: (A) Leather Armor, 2 Daggers, Musical Instrument of your choice, Entertainer's Pack, and 19 GP; or (B) 90 GP"
  assert.deepEqual(parseStartingKit(bard).map((i) => i.name), [
    'Leather Armor',
    'Dagger',
    'Musical Instrument',
    "Entertainer's Pack",
  ])
})

// --- US-51 — os kits nos DOIS artefatos ---
//
// O defeito que esta story conserta era invisível no PT: o kit vinha do seed, em português,
// e o config en-US servia "Cajado arcano" para quem joga em inglês. Testar os dois lados.
test('artefato: os kits têm as mesmas classes e as mesmas quantidades nos dois locales', () => {
  const read = (locale) =>
    JSON.parse(readFileSync(join(import.meta.dirname, `srd-5e.config.${locale}.json`), 'utf8')).startingKits
  const en = read('en-US')
  const pt = read('pt-BR')

  assert.deepEqual(Object.keys(en).sort(), Object.keys(pt).sort())
  assert.equal(Object.keys(en).length, 13, '12 classes + default')
  for (const [classKey, items] of Object.entries(en)) {
    assert.ok(items.length > 0, `kit vazio: ${classKey}`)
    assert.deepEqual(items.map((i) => i.qty), pt[classKey].map((i) => i.qty), `quantidades divergem em ${classKey}`)
  }
})

test('artefato: en-US traz o kit em inglês e pt-BR em português', () => {
  const read = (locale) =>
    JSON.parse(readFileSync(join(import.meta.dirname, `srd-5e.config.${locale}.json`), 'utf8')).startingKits
  assert.deepEqual(read('en-US').wizard, [
    { name: 'Dagger', qty: 2 },
    { name: 'Arcane Focus (Quarterstaff)', qty: 1 },
    { name: 'Robe', qty: 1 },
    { name: 'Spellbook', qty: 1 },
    { name: "Scholar's Pack", qty: 1 },
  ])
  // Nenhum nome do kit PT pode ter sobrado igual ao EN por falta de overlay (kit misto).
  const pt = read('pt-BR')
  const en = read('en-US')
  const untranslated = Object.keys(en).flatMap((k) =>
    en[k].map((item, i) => (item.name === pt[k][i].name ? `${k}: ${item.name}` : null)).filter(Boolean),
  )
  assert.deepEqual(untranslated, [], 'item sem entrada em kitItems — kit sai misto EN/PT')
})

// A chave de feature é prefixada pela classe (duas classes têm "Defesa sem Armadura"); a de
// magia não (a mesma `light` serve mago e clérigo). Trocar isso quebra o casamento com o overlay.
test('artefato: chave de feature é prefixada pela classe, a de magia não', () => {
  const artifact = JSON.parse(readFileSync(join(import.meta.dirname, 'srd-5e.config.en-US.json'), 'utf8'))
  for (const [classKey, entries] of Object.entries(artifact.classFeatures)) {
    for (const entry of entries) assert.ok(entry.key.startsWith(`${classKey}_`), `${entry.key} fora da classe ${classKey}`)
  }
  assert.equal(artifact.classSpells.wizard.find((s) => s.name === 'Light').key, 'light')
  assert.equal(artifact.classSpells.cleric.find((s) => s.name === 'Light').key, 'light')
})

// --- US-100: carry-over do conteúdo aposentado -------------------------------------------------
// A rede que impede um bump de apagar, sem erro nenhum, a linha da ficha de quem tinha a chave.
// O `withRetired` é puro: recebe o artefato novo e o anterior, devolve o novo + `retired*`.

test('withRetired: chave que sumiu do bump é transportada com o texto que ela tinha', () => {
  const prev = {
    classFeatures: { ranger: [{ key: 'ranger_natural-explorer', name: 'Explorador Nato', description: 'Maestria no terreno.', source: 'srd' }] },
    classSpells: { wizard: [{ key: 'friends', name: 'Amizade', level: 0, description: 'Influencia alguém.', source: 'srd' }] },
  }
  const next = { classFeatures: { ranger: [] }, classSpells: { wizard: [] } }
  const out = withRetired(next, prev)
  assert.equal(out.retiredFeatures['ranger_natural-explorer'].name, 'Explorador Nato')
  assert.equal(out.retiredSpells.friends.name, 'Amizade')
})

test('withRetired: chave viva NÃO entra no retired, e a que volta ao catálogo sai dele', () => {
  const viva = { key: 'barbarian_rage', name: 'Fúria', description: 'Entra em fúria.', source: 'srd' }
  const prev = { classFeatures: { barbarian: [viva] }, retiredFeatures: { 'paladin_divine-sense': { key: 'paladin_divine-sense', name: 'Sentido Divino', source: 'srd' } } }
  const next = { classFeatures: { barbarian: [viva], paladin: [{ key: 'paladin_divine-sense', name: 'Sentido Divino', source: 'srd' }] } }
  assert.equal(withRetired(next, prev).retiredFeatures, undefined)
})

test('withRetired: o retired anterior sobrevive ao bump seguinte (não evapora no terceiro)', () => {
  const prev = { classFeatures: {}, retiredFeatures: { 'ranger_natural-explorer': { key: 'ranger_natural-explorer', name: 'Explorador Nato', source: 'srd' } } }
  const out = withRetired({ classFeatures: { ranger: [] } }, prev)
  assert.equal(out.retiredFeatures['ranger_natural-explorer'].name, 'Explorador Nato')
})

test('withRetired: sem artefato anterior (1ª geração) e sem nada aposentado → campo ausente', () => {
  const artifact = { classFeatures: { barbarian: [{ key: 'barbarian_rage', name: 'Fúria', source: 'srd' }] }, classSpells: {} }
  assert.deepEqual(withRetired(artifact, null), artifact)
  assert.deepEqual(withRetired(artifact, artifact), artifact)
})
