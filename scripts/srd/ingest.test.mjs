// US-52 — testes das duas peças não-triviais da camada de tradução do ingest.
// `node --test scripts/srd/ingest.test.mjs` (ou `pnpm srd:ingest:test`).
//
// Não exercita o modelo: a chamada de LLM é I/O externo e a US-52 decidiu que o gate de
// correção é glossário + revisão humana, não teste automatizado de tradução.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import { formatOverlay, flagMissingGlossaryTerms, mergeEditions, parseStartingKit, withRetired, buildBackgrounds, buildSkills, parseBackgroundEquipment, parseAbilityGrant, titleCase } from './ingest.mjs'
// US-108: a tabela de modificadores mora em módulo próprio (o ingest.mjs já passa de 500
// linhas), mas os testes ficam AQUI porque é este arquivo que o CI roda (`pnpm srd:ingest:test`).
import { parseAbilityModifiers } from './ability-modifiers.mjs'
import { parseD20Tests } from './d20-tests.mjs'

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

// --- US-121 — os 21 backgrounds nos DOIS artefatos, cada um com source a5e-ag ---
for (const locale of ['en-US', 'pt-BR']) {
  test(`artefato ${locale}: 21 backgrounds do a5e-ag, cada um com key/name/benefits/source`, () => {
    const artifact = JSON.parse(readFileSync(join(import.meta.dirname, `srd-5e.config.${locale}.json`), 'utf8'))
    assert.equal(artifact.backgrounds.length, 21)
    for (const bg of artifact.backgrounds) {
      assert.ok(bg.key.startsWith('a5e-ag_'), `key fora do namespace a5e-ag: ${bg.key}`)
      assert.ok(bg.name, `background sem name: ${bg.key}`)
      assert.equal(bg.source, 'a5e-ag', `source errado: ${bg.key}`)
      for (const benefit of bg.benefits) {
        assert.ok(benefit.type, `benefit sem type: ${bg.key}`)
        assert.ok(benefit.name, `benefit sem name: ${bg.key}`)
        assert.ok(benefit.description, `benefit sem description: ${bg.key}`)
      }
    }
  })

  // US-128: mesmas invariantes do parser, agora sobre o ARTEFATO gravado (não o dataset cru) —
  // fecha a Questão em aberto 5 do doc: o parser roda sobre `b.fields.desc` cru (nunca sobre
  // texto MT-traduzido), então EN e pt-BR têm exatamente os mesmos nomes de item em inglês
  // aqui — a tradução por item acontece via kitItems, não via re-parse de prosa traduzida.
  test(`artefato ${locale}: backgroundEquipment cobre as 21 origens, sem item vazio`, () => {
    const artifact = JSON.parse(readFileSync(join(import.meta.dirname, `srd-5e.config.${locale}.json`), 'utf8'))
    const keys = artifact.backgrounds.map((bg) => bg.key)
    assert.deepEqual(Object.keys(artifact.backgroundEquipment).sort(), [...keys].sort())
    for (const [key, items] of Object.entries(artifact.backgroundEquipment)) {
      assert.ok(items.length > 0, `${key}: backgroundEquipment vazio`)
      for (const item of items) {
        assert.ok(item.name.length > 0, `${key}: item com nome vazio`)
        assert.equal(item.qty, 1, `${key}: qty diferente de 1 em "${item.name}"`)
      }
    }
  })
}

// US-128: os dois artefatos concordam nos nomes EN dos itens (mesma fonte, `b.fields.desc`
// cru) — só a tradução por item (kitItems) pode divergir, nunca a estrutura/contagem.
test('backgroundEquipment: EN e pt-BR têm a mesma contagem de itens por origem', () => {
  const en = JSON.parse(readFileSync(join(import.meta.dirname, 'srd-5e.config.en-US.json'), 'utf8'))
  const ptBr = JSON.parse(readFileSync(join(import.meta.dirname, 'srd-5e.config.pt-BR.json'), 'utf8'))
  for (const key of Object.keys(en.backgroundEquipment)) {
    assert.equal(
      ptBr.backgroundEquipment[key]?.length,
      en.backgroundEquipment[key].length,
      `${key}: contagem de itens diverge entre EN e pt-BR`,
    )
  }
})

// --- US-128 — titleCase: nome de item, cada palavra maiúscula exceto preposição no meio ---

test('titleCase: palavras simples ficam todas maiúsculas', () => {
  assert.equal(titleCase('common clothes'), 'Common Clothes')
})

test('titleCase: preposição no MEIO fica minúscula (EN)', () => {
  assert.equal(titleCase("One set of artisan's tools"), "One Set of Artisan's Tools")
})

test('titleCase: preposição no MEIO fica minúscula (PT, duas ocorrências de "de")', () => {
  assert.equal(titleCase('conjunto de ferramentas de artesão'), 'Conjunto de Ferramentas de Artesão')
})

test('titleCase: primeira e última palavra SEMPRE maiúsculas, mesmo se estiverem na lista', () => {
  assert.equal(titleCase('sword of'), 'Sword Of') // "of" é a última — não a mesma ocorrência de um "of" do meio
  assert.equal(titleCase('of the tools'), 'Of the Tools') // "of" é a primeira; "the", no meio, minúsculo
})

test('titleCase: apóstrofo dentro da palavra sobrevive ("artisan\'s", não "Artisan\'S")', () => {
  assert.equal(titleCase("artisan's tools"), "Artisan's Tools")
})

test('titleCase: parênteses não são tocados; conteúdo dentro também vira Title Case', () => {
  assert.equal(titleCase('Book (occult lore)'), 'Book (Occult Lore)')
  assert.equal(titleCase('Arcane Focus (Quarterstaff)'), 'Arcane Focus (Quarterstaff)') // já correto, idempotente
})

test('titleCase: numeral no início não conta como palavra — a primeira LETRA que aparece vira maiúscula', () => {
  assert.equal(titleCase('50 feet of rope'), '50 Feet of Rope')
})

test('titleCase: palavra única fica maiúscula (é primeira E última ao mesmo tempo)', () => {
  assert.equal(titleCase('abacus'), 'Abacus')
})

// US-128: nome de item não começa com artigo indefinido — testado via localizeKitItems
// (stripLeadingArticle não é exportada; o efeito observável é no item final).
test('localizeKitItems (via buildBackgrounds): artigo indefinido no início some, EN e PT', () => {
  const backgrounds = [{ pk: 'a5e-ag_acolyte', fields: { name: 'Acolyte', desc: '', document: 'a5e-ag' } }]
  const benefits = [{ pk: 'a5e-ag_acolyte_equipment', fields: { parent: 'a5e-ag_acolyte', name: 'Equipment', desc: 'A prayer book, common clothes.', type: 'equipment' } }]
  const { backgroundEquipment: en } = buildBackgrounds({}, backgrounds, benefits, identityResolve)
  assert.deepEqual(en['a5e-ag_acolyte'], [{ name: 'Prayer Book', qty: 1 }, { name: 'Common Clothes', qty: 1 }])

  const ptOverlay = { kitItems: { 'A prayer book': 'um livro de orações' } }
  const ptResolve = (_domain, _key, entry, enName) => ({ name: entry?.name?.trim() || enName })
  const { backgroundEquipment: pt } = buildBackgrounds(ptOverlay, backgrounds, benefits, ptResolve)
  assert.deepEqual(pt['a5e-ag_acolyte'], [{ name: 'Livro de Orações', qty: 1 }, { name: 'Common Clothes', qty: 1 }])
})

// "Any"/"Artisan's" não são o artigo "a"/"an" sozinho — não podem ser cortados.
test('localizeKitItems: palavra que só COMEÇA com "a"/"an" (Any, Arcane...) não é confundida com artigo', () => {
  const backgrounds = [{ pk: 'a5e-ag_folk-hero', fields: { name: 'Folk Hero', desc: '', document: 'a5e-ag' } }]
  const benefits = [{ pk: 'a5e-ag_folk-hero_equipment', fields: { parent: 'a5e-ag_folk-hero', name: 'Equipment', desc: 'Any artisan\'s tools.', type: 'equipment' } }]
  const { backgroundEquipment } = buildBackgrounds({}, backgrounds, benefits, identityResolve)
  assert.deepEqual(backgroundEquipment['a5e-ag_folk-hero'], [{ name: "Any Artisan's Tools", qty: 1 }])
})

// --- US-121 — backgrounds do a5e-ag: join Background + BackgroundBenefit por parent → pk ---

const identityResolve = (_domain, _key, _entry, enName, enDesc) => ({
  name: enName,
  ...(enDesc !== undefined ? { description: enDesc } : {}),
})

const background = (pk, name) => ({ pk, fields: { name, desc: '', document: 'a5e-ag' } })
const benefit = (pk, parent, name, desc, type) => ({ pk, fields: { parent, name, desc, type } })

test('buildBackgrounds: agrupa benefícios por parent; type cru sobrevive sem normalização', () => {
  const backgrounds = [background('a5e-ag_acolyte', 'Acolyte'), background('a5e-ag_criminal', 'Criminal')]
  const benefits = [
    benefit('a5e-ag_acolyte_ability-scores', 'a5e-ag_acolyte', 'Ability Score Increases', '+1 to Wisdom and one other ability score.', 'ability_score'),
    benefit('a5e-ag_acolyte_skills', 'a5e-ag_acolyte', 'Skill Proficiencies', 'Religion and Insight.', 'skill_proficiency'),
  ]
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, benefits, identityResolve)
  assert.deepEqual(result.map((b) => b.key), ['a5e-ag_acolyte', 'a5e-ag_criminal'])
  const acolyte = result.find((b) => b.key === 'a5e-ag_acolyte')
  assert.equal(acolyte.source, 'a5e-ag')
  assert.equal(acolyte.benefits.length, 2)
  assert.equal(acolyte.benefits[0].type, 'ability_score')
})

// --- US-123 — parseAbilityGrant: "+1 to <Fixo> and one other ability score." → grant ---

test('parseAbilityGrant: padrão do dataset vira { kind: "ability", fixed, freeCount: 1 }', () => {
  assert.deepEqual(parseAbilityGrant('+1 to Wisdom and one other ability score.'), { kind: 'ability', fixed: 'wisdom', freeCount: 1 })
  assert.deepEqual(parseAbilityGrant('+1 to Strength and one other ability score.'), { kind: 'ability', fixed: 'strength', freeCount: 1 })
})

test('parseAbilityGrant: texto fora do padrão devolve undefined (função pura, não falha)', () => {
  assert.equal(parseAbilityGrant('Wisdom, Intelligence, or Charisma.'), undefined)
  assert.equal(parseAbilityGrant('+1 to Wisdom.'), undefined)
})

test('parseAbilityGrant: atributo desconhecido no texto devolve undefined', () => {
  assert.equal(parseAbilityGrant('+1 to Luck and one other ability score.'), undefined)
})

test('buildBackgrounds: benefit "ability_score" reconhecido vira benefits[].grant', () => {
  const backgrounds = [background('a5e-ag_acolyte', 'Acolyte')]
  const benefits = [benefit('a5e-ag_acolyte_ability-scores', 'a5e-ag_acolyte', 'Ability Score Increases', '+1 to Wisdom and one other ability score.', 'ability_score')]
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, benefits, identityResolve)
  assert.deepEqual(result[0].benefits[0].grant, { kind: 'ability', fixed: 'wisdom', freeCount: 1 })
})

test('buildBackgrounds: benefit "ability_score" fora do padrão falha alto', () => {
  const backgrounds = [background('a5e-ag_acolyte', 'Acolyte')]
  const benefits = [benefit('a5e-ag_acolyte_ability-scores', 'a5e-ag_acolyte', 'Ability Score Increases', 'Wisdom, Intelligence, or Charisma.', 'ability_score')]
  assert.throws(() => buildBackgrounds({}, backgrounds, benefits, identityResolve), /ability_score fora do padrão/)
})

test('buildBackgrounds: benefit de outro type nunca ganha grant', () => {
  const backgrounds = [background('a5e-ag_acolyte', 'Acolyte')]
  const benefits = [benefit('a5e-ag_acolyte_skills', 'a5e-ag_acolyte', 'Skill Proficiencies', 'Religion and Insight.', 'skill_proficiency')]
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, benefits, identityResolve)
  assert.equal('grant' in result[0].benefits[0], false)
})

test('buildBackgrounds: background sem benefit correspondente aparece com benefits: []', () => {
  const backgrounds = [background('a5e-ag_urchin', 'Urchin')]
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, [], identityResolve)
  assert.deepEqual(result, [{ key: 'a5e-ag_urchin', name: 'Urchin', benefits: [], source: 'a5e-ag' }])
})

test('buildBackgrounds: benefit com parent órfão falha alto', () => {
  const backgrounds = [background('a5e-ag_acolyte', 'Acolyte')]
  const benefits = [benefit('a5e-ag_ghost_trait', 'a5e-ag_ghost', 'Trait', 'Texto.', 'feature')]
  assert.throws(() => buildBackgrounds({}, backgrounds, benefits, identityResolve), /a5e-ag_ghost/)
})

// --- US-128 — parseBackgroundEquipment: 3 armadilhas medidas contra as 21 entradas reais ---

test('buildBackgrounds: benefit type === "equipment" popula backgroundEquipment[key]', () => {
  const backgrounds = [background('a5e-ag_acolyte', 'Acolyte')]
  const benefits = [benefit('a5e-ag_acolyte_equipment', 'a5e-ag_acolyte', 'Equipment', 'Common clothes, robe.', 'equipment')]
  const { backgroundEquipment } = buildBackgrounds({}, backgrounds, benefits, identityResolve)
  // US-128: localizeKitItems aplica titleCase no nome final — "robe" (cru, minúsculo no
  // meio da frase do dataset) sai "Robe" (nome de item, Title Case).
  assert.deepEqual(backgroundEquipment['a5e-ag_acolyte'], [{ name: 'Common Clothes', qty: 1 }, { name: 'Robe', qty: 1 }])
})

test('buildBackgrounds: origem sem benefit "equipment" não entra em backgroundEquipment', () => {
  const backgrounds = [background('a5e-ag_urchin', 'Urchin')]
  const { backgroundEquipment } = buildBackgrounds({}, backgrounds, [], identityResolve)
  assert.deepEqual(backgroundEquipment, {})
})

test('parseBackgroundEquipment: formato simples, split por vírgula com "and" antes do último', () => {
  assert.deepEqual(parseBackgroundEquipment('Common clothes, halberd, uniform.'), [
    { name: 'Common clothes', qty: 1 },
    { name: 'halberd', qty: 1 },
    { name: 'uniform', qty: 1 },
  ])
})

// Armadilha 1: parêntese com "or" dentro some inteiro — senão cortar no 1º " or" (como o
// toKitItem faz) deixaria "Holy symbol (amulet" com parêntese aberto e nunca fechado.
test('parseBackgroundEquipment: descarta parêntese com "or" dentro (Acolyte/Cultist)', () => {
  const result = parseBackgroundEquipment('Holy symbol (amulet or reliquary), common clothes, robes, 5 torches.')
  assert.deepEqual(result, [
    { name: 'Holy symbol', qty: 1 },
    { name: 'common clothes', qty: 1 },
    { name: 'robes', qty: 1 },
    { name: '5 torches', qty: 1 },
  ])
})

// Parêntese SEM "or" dentro não é tocado — a regra é específica pro caso com alternativa.
test('parseBackgroundEquipment: parêntese sem "or" permanece intocado (Marauder)', () => {
  const result = parseBackgroundEquipment("Traveler's clothes, signal whistle, tent (one person).")
  assert.deepEqual(result, [
    { name: "Traveler's clothes", qty: 1 },
    { name: 'signal whistle', qty: 1 },
    { name: 'tent (one person)', qty: 1 },
  ])
})

// Armadilha 2: escolha composta no final ("and a X, Y, or Z") tem 2 vírgulas internas — um
// split ingênuo fatiaria em 3 itens errados. Fica só a primeira opção.
test('parseBackgroundEquipment: escolha composta no final vira só a primeira opção (Acolyte)', () => {
  const result = parseBackgroundEquipment(
    'Holy symbol (amulet or reliquary), common clothes, robe, and a prayer book, prayer wheel, or prayer beads.',
  )
  assert.deepEqual(result, [
    { name: 'Holy symbol', qty: 1 },
    { name: 'common clothes', qty: 1 },
    { name: 'robe', qty: 1 },
    { name: 'a prayer book', qty: 1 },
  ])
})

test('parseBackgroundEquipment: escolha composta no final vira só a primeira opção (Hermit)', () => {
  const result = parseBackgroundEquipment(
    "Healer's satchel, herbalism kit, common clothes, 7 days rations, and a prayer book, prayer wheel, or prayer beads.",
  )
  assert.deepEqual(result, [
    { name: "Healer's satchel", qty: 1 },
    { name: 'herbalism kit', qty: 1 },
    { name: 'common clothes', qty: 1 },
    { name: '7 days rations', qty: 1 },
    { name: 'a prayer book', qty: 1 },
  ])
})

// Armadilha 3: numeral é MEDIDA (dias, pés, folhas), não contagem de item — nunca extraído
// como `qty`. Extrair produziria "feet of rope (50)" na tela, lido como 50 cordas.
test('parseBackgroundEquipment: numeral+unidade fica no nome, qty sempre 1 (Sailor)', () => {
  const result = parseBackgroundEquipment("Common clothes, navigator's tools, 50 feet of rope.")
  assert.deepEqual(result.at(-1), { name: '50 feet of rope', qty: 1 })
})

test('parseBackgroundEquipment: "or" fora de parêntese e fora da escolha final fica inteiro (Entertainer)', () => {
  const result = parseBackgroundEquipment('Lute or other musical instrument, costume.')
  assert.deepEqual(result, [
    { name: 'Lute or other musical instrument', qty: 1 },
    { name: 'costume', qty: 1 },
  ])
})

// --- US-128: as 21 entradas reais de type === 'equipment' não podem produzir item vazio, ---
// --- parêntese desbalanceado, nem alternativa "or" cortada em item separado. ---
test('parseBackgroundEquipment: as 21 entradas reais de equipment não quebram', () => {
  const backgroundsRaw = JSON.parse(readFileSync(join(import.meta.dirname, '_data', 'Background.json'), 'utf8'))
  const benefitsRaw = JSON.parse(readFileSync(join(import.meta.dirname, '_data', 'BackgroundBenefit.json'), 'utf8'))
  const equipmentBenefits = benefitsRaw.filter((b) => b.fields.type === 'equipment')
  assert.equal(equipmentBenefits.length, 21, 'dataset mudou de tamanho — reveja as armadilhas medidas')
  for (const b of equipmentBenefits) {
    const items = parseBackgroundEquipment(b.fields.desc)
    assert.ok(items.length > 0, `${b.pk}: nenhum item extraído`)
    for (const item of items) {
      assert.ok(item.name.length > 0, `${b.pk}: item com nome vazio`)
      assert.equal((item.name.match(/\(/g) || []).length, (item.name.match(/\)/g) || []).length, `${b.pk}: parêntese desbalanceado em "${item.name}"`)
      assert.ok(!/^or\s/i.test(item.name), `${b.pk}: item começa com "or " — alternativa cortada errado: "${item.name}"`)
    }
  }
  const { backgrounds: allBackgrounds } = buildBackgrounds({}, backgroundsRaw, benefitsRaw, identityResolve)
  assert.equal(allBackgrounds.length, 21)
})

// US-128 (Gap 1 do doc): toda string que o parser produz precisa ter tradução curada em
// kitItems — nome de item no inventário é a primeira coisa visível ao jogador pt-BR depois de
// criar personagem, diferente dos fallbacks EN "enterrados" de features/spells (US-52).
test('parseBackgroundEquipment: nenhum item novo de equipamento fica sem tradução em kitItems', () => {
  const benefitsRaw = JSON.parse(readFileSync(join(import.meta.dirname, '_data', 'BackgroundBenefit.json'), 'utf8'))
  const overlay = JSON.parse(readFileSync(OVERLAY_PATH, 'utf8'))
  const names = new Set()
  for (const b of benefitsRaw.filter((b) => b.fields.type === 'equipment')) {
    for (const item of parseBackgroundEquipment(b.fields.desc)) names.add(item.name)
  }
  const untranslated = [...names].filter((n) => !overlay.kitItems?.[n])
  assert.deepEqual(untranslated, [], `item(ns) de equipamento sem entrada em kitItems: ${untranslated.join(', ')}`)
})

// --- US-130 — Culture/Engineering: literal A5E fora do Skill.json, mesma resolução via overlay ---

const SKILL_ROW = (pk, name, ability) => ({ pk, fields: { ability, document: 'core', name } })

test('buildSkills: concatena as 18 do Skill.json com culture/engineering, todas ordenadas por key', () => {
  const skillsRaw = [SKILL_ROW('acrobatics', 'Acrobatics', 'dex'), SKILL_ROW('history', 'History', 'int')]
  const result = buildSkills({}, skillsRaw, identityResolve)
  assert.deepEqual(result.map((s) => s.key), ['acrobatics', 'culture', 'engineering', 'history'])
  assert.deepEqual(result.find((s) => s.key === 'culture'), { key: 'culture', label: 'Culture', ability: 'intelligence' })
  assert.deepEqual(result.find((s) => s.key === 'engineering'), { key: 'engineering', label: 'Engineering', ability: 'intelligence' })
})

test('buildSkills: culture/engineering pegam o label pt-BR do overlay igual às outras 18', () => {
  const overlay = { skills: { history: 'História', culture: 'Cultura', engineering: 'Engenharia' } }
  const ptResolve = (_domain, _key, entry, enName) => ({ name: entry?.name?.trim() || enName })
  const result = buildSkills(overlay, [SKILL_ROW('history', 'History', 'int')], ptResolve)
  assert.deepEqual(result.map((s) => s.label), ['Cultura', 'Engenharia', 'História'])
})

// --- US-108 — a tabela de modificadores de habilidade do SRD 2024 ---
//
// Os `desc` abaixo são o texto CRU do Open5e v2.1.0 (`Rule.json`), copiado sem correção —
// inclusive os sinais que NÃO são ASCII: `−` é U+2212 MINUS SIGN e `–` é U+2013 EN DASH.
// É a armadilha da story: `Number('−5')` devolve NaN.

const SCORES_DESC = [
  'Each ability has a score from 1 to 20, although some monsters have a score as high as 30.',
  '',
  '|Score|Meaning|',
  '|---|---|',
  '|1| This is the lowest a score can normally go. |',
  '|2–9| This represents a weak capability.|',
  '|10–11| This represents the human average.|',
  '|12–19| This represents a strong capability.|',
  "|20| This is the highest an adventurer's score can go unless a feature says otherwise. |",
  '|21–29| This represents an extraordinary capability. |',
  '|30| This is the highest a score can go.|',
].join('\n')

const MOD_ROWS = [
  ['1', '−5'], ['2–3', '−4'], ['4–5', '−3'], ['6–7', '−2'], ['8–9', '−1'], ['10–11', '+0'],
  ['12–13', '+1'], ['14–15', '+2'], ['16–17', '+3'], ['18–19', '+4'], ['20–21', '+5'],
  ['22–23', '+6'], ['24–25', '+7'], ['26–27', '+8'], ['28–29', '+9'], ['30', '+10'],
]

const modifiersDesc = (rows = MOD_ROWS) =>
  ['An ability modifier is derived from its score.', '', '|Score|Modifier|', '|---|---|']
    .concat(rows.map(([score, mod]) => `|${score}|${mod}|`))
    .join('\n')

const rules = (modRows) => [
  { pk: 'srd-2024_the-six-abilities_ability-scores', fields: { desc: SCORES_DESC, ruleset: 'srd-2024_the-six-abilities' } },
  { pk: 'srd-2024_the-six-abilities_ability-modifiers', fields: { desc: modifiersDesc(modRows), ruleset: 'srd-2024_the-six-abilities' } },
  { pk: 'srd-2024_d20-tests_ability-checks', fields: { desc: 'Not this one.', ruleset: 'srd-2024_d20-tests' } },
]

test('parseAbilityModifiers: lê as 16 faixas com MINUS SIGN e EN DASH', () => {
  const { rows } = parseAbilityModifiers(rules(), 'v2.1.0')
  assert.equal(rows.length, 16)
  assert.deepEqual(rows[0], { scoreMin: 1, scoreMax: 1, modifier: -5 })
  assert.deepEqual(rows[5], { scoreMin: 10, scoreMax: 11, modifier: 0 })
  assert.deepEqual(rows.at(-1), { scoreMin: 30, scoreMax: 30, modifier: 10 })
})

// A faixa sai da tabela de SIGNIFICADO (`_ability-scores`), não de constante daqui: é ela
// que diz que 30 é o teto absoluto, e é ela que muda se uma edição mudar o teto.
test('parseAbilityModifiers: a faixa 1–30 vem do dado, e a procedência vai junto', () => {
  const table = parseAbilityModifiers(rules(), 'v2.1.0')
  assert.deepEqual(table.range, { min: 1, max: 30 })
  assert.equal(table.source.tag, 'v2.1.0')
  assert.equal(table.source.document, 'srd-2024')
  assert.equal(table.source.license, 'CC-BY-4.0')
  assert.ok(table.source.rules.includes('srd-2024_the-six-abilities_ability-modifiers'))
})

// Bump que renomeie ou remova a regra não pode gerar artefato vazio em silêncio: a tabela
// vira oráculo do teste do `abilityModifier`, e oráculo vazio aprova qualquer fórmula.
test('parseAbilityModifiers: regra ausente no bump falha alto', () => {
  const semModificadores = rules().filter((r) => !r.pk.endsWith('_ability-modifiers'))
  assert.throws(() => parseAbilityModifiers(semModificadores, 'v2.1.0'), /srd-2024_the-six-abilities_ability-modifiers/)
})

// Buraco = parser quebrado ou tabela mudada. Sem esta checagem, uma faixa perdida some sem
// erro e o `abilityModifier` deixa de ser conferido justamente naqueles valores.
test('parseAbilityModifiers: buraco na cobertura da faixa falha alto', () => {
  const comBuraco = MOD_ROWS.filter(([score]) => score !== '12–13')
  assert.throws(() => parseAbilityModifiers(rules(comBuraco), 'v2.1.0'), /12/)
})

test('parseAbilityModifiers: modificador ilegível falha com o valor ofensor', () => {
  const corrompida = MOD_ROWS.map(([score, mod]) => (score === '4–5' ? [score, 'menos três'] : [score, mod]))
  assert.throws(() => parseAbilityModifiers(rules(corrompida), 'v2.1.0'), /menos três/)
})

// --- US-110 — as tabelas de exemplo do ruleset `srd-2024_d20-tests` ---
//
// Mesma disciplina do bloco acima: os `desc` são o texto CRU do Open5e v2.1.0, com a
// tipografia dele (aspas curvas, reticências `…`). O que muda aqui é que UM `desc` traz
// DUAS tabelas (exemplos de teste + Classes de Dificuldade) — por isso o leitor separa
// tabelas em vez de achatar todas as linhas `|…|` do campo numa lista só.

const CHECKS_DESC = [
  'An ability check represents a creature using talent and training.',
  '',
  '|Ability|Make a Check To …|',
  '|---|---|',
  '|Strength|Lift, push, pull, or break something|',
  '|Dexterity|Move nimbly, quickly, or quietly|',
  '|Constitution|Push your body beyond normal limits|',
  '|Intelligence|Reason or remember|',
  '|Wisdom|Notice things in the environment or in creatures’ behavior|',
  '|Charisma|Influence, entertain, or deceive|',
  '',
  'Table: Typical Difficulty Classes',
  '',
  '|Task Difficulty|DC|',
  '|---|---|',
  '|Very easy|5|',
  '|Easy|10|',
  '|Medium|15|',
  '|Hard|20|',
  '|Very hard|25|',
  '|Nearly impossible|30|',
].join('\n')

const SAVES_DESC = [
  'A saving throw represents an attempt to evade or resist a threat.',
  '',
  '|Ability|Make a Save To …|',
  '|---|---|',
  '|Strength|Physically resist direct force|',
  '|Dexterity|Dodge out of harm’s way|',
  '|Constitution|Endure a toxic hazard|',
  '|Intelligence|Recognize an illusion as fake|',
  '|Wisdom|Resist a mental assault|',
  '|Charisma|Assert your identity|',
].join('\n')

const ATTACKS_DESC = [
  'An attack roll determines whether an attack hits a target.',
  '',
  '|Ability|Attack Type|',
  '|---|---|',
  '|Strength|Melee attack with a weapon or an Unarmed Strike|',
  '|Dexterity|Ranged attack with a weapon|',
  '|Varies|Spell attack (determined by the spellcaster’s spellcasting feature)|',
].join('\n')

const ATTR_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']

const d20Rules = ({ checks = CHECKS_DESC, saves = SAVES_DESC, attacks = ATTACKS_DESC } = {}) =>
  [
    { pk: 'srd-2024_d20-tests_ability-checks', fields: { desc: checks, ruleset: 'srd-2024_d20-tests' } },
    { pk: 'srd-2024_d20-tests_saving-throw', fields: { desc: saves, ruleset: 'srd-2024_d20-tests' } },
    { pk: 'srd-2024_d20-tests_attack-rolls', fields: { desc: attacks, ruleset: 'srd-2024_d20-tests' } },
    // Uma regra de OUTRO ruleset no meio: o parser tem de achar as suas por `pk`, não por posição.
    { pk: 'srd-2024_the-six-abilities_ability-modifiers', fields: { desc: modifiersDesc(), ruleset: 'srd-2024_the-six-abilities' } },
  ]

test('parseD20Tests: as 6 linhas de exemplo de teste saem com a chave canônica do catálogo', () => {
  const { abilityChecks } = parseD20Tests(d20Rules(), 'v2.1.0', ATTR_KEYS)
  assert.equal(abilityChecks.length, 6)
  assert.deepEqual(abilityChecks[0], { ability: 'strength', example: 'Lift, push, pull, or break something' })
  assert.deepEqual(abilityChecks.at(-1), { ability: 'charisma', example: 'Influence, entertain, or deceive' })
})

// A regra do `desc` de exemplos traz DUAS tabelas. Achatar as duas numa lista só daria 12
// "exemplos", metade deles Classe de Dificuldade — e o prompt exibiria "Very easy — 5".
test('parseD20Tests: a segunda tabela do mesmo desc vira difficultyClasses, não exemplo', () => {
  const { abilityChecks, difficultyClasses } = parseD20Tests(d20Rules(), 'v2.1.0', ATTR_KEYS)
  assert.equal(abilityChecks.length, 6)
  assert.deepEqual(difficultyClasses[0], { task: 'Very easy', dc: 5 })
  assert.deepEqual(difficultyClasses.at(-1), { task: 'Nearly impossible', dc: 30 })
})

test('parseD20Tests: saves e ataques saem no artefato, e `Varies` não vira atributo', () => {
  const { savingThrows, attackRolls } = parseD20Tests(d20Rules(), 'v2.1.0', ATTR_KEYS)
  assert.equal(savingThrows.length, 6)
  assert.deepEqual(savingThrows[1], { ability: 'dexterity', example: 'Dodge out of harm’s way' })
  assert.equal(attackRolls.length, 3)
  assert.equal(attackRolls.at(-1).ability, null)
})

test('parseD20Tests: a procedência vai junto', () => {
  const { source } = parseD20Tests(d20Rules(), 'v2.1.0', ATTR_KEYS)
  assert.equal(source.tag, 'v2.1.0')
  assert.equal(source.document, 'srd-2024')
  assert.equal(source.license, 'CC-BY-4.0')
  assert.equal(source.ruleset, 'srd-2024_d20-tests')
  assert.ok(source.rules.includes('srd-2024_d20-tests_ability-checks'))
})

// Bump que renomeie a regra não pode gerar bloco vazio: o prompt perderia a régua de
// escolha sem ninguém perceber (o prompt continua válido, só volta a ser palpite).
test('parseD20Tests: regra ausente no bump falha alto', () => {
  const semExemplos = d20Rules().filter((r) => r.pk !== 'srd-2024_d20-tests_ability-checks')
  assert.throws(() => parseD20Tests(semExemplos, 'v2.1.0', ATTR_KEYS), /srd-2024_d20-tests_ability-checks/)
})

// Uma linha perdida deixaria uma habilidade sem exemplo — e o modelo sem régua justamente
// naquela. Cobertura das 6 é a checagem, não a contagem: ela pega troca também.
test('parseD20Tests: exemplo faltando para uma habilidade falha alto', () => {
  const semSabedoria = CHECKS_DESC.split('\n').filter((l) => !l.startsWith('|Wisdom|')).join('\n')
  assert.throws(() => parseD20Tests(d20Rules({ checks: semSabedoria }), 'v2.1.0', ATTR_KEYS), /wisdom/i)
})

// Habilidade que o config não tem = tabela e catálogo discordando. Sem esta checagem o
// prompt renderiza a chave crua ("bravery — …") como se fosse atributo da ficha.
test('parseD20Tests: habilidade fora do catálogo falha com o valor ofensor', () => {
  const inventada = CHECKS_DESC.replace('|Wisdom|', '|Bravery|')
  assert.throws(() => parseD20Tests(d20Rules({ checks: inventada }), 'v2.1.0', ATTR_KEYS), /Bravery/)
})
