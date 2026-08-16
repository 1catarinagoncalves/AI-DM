// US-52 — testes das duas peças não-triviais da camada de tradução do ingest.
// `node --test scripts/srd/ingest.test.mjs` (ou `pnpm srd:ingest:test`).
//
// Não exercita o modelo: a chamada de LLM é I/O externo e a US-52 decidiu que o gate de
// correção é glossário + revisão humana, não teste automatizado de tradução.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import { formatOverlay, flagMissingGlossaryTerms, buildRaces, buildRaceFeatures, buildClassFeatures, buildClassSpells, buildStartingKits, firstAlternative, parseSrdEquipmentBullets, parseA5ePackageEquipment, withRetired, buildBackgrounds, buildSkills, buildTools, parseBackgroundEquipment, parseAbilityGrant, parseSkillGrant, parseToolGrant, titleCase } from './ingest.mjs'
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

// --- US-138 (ADR 009 §8) — buildRaces vira single-source: só o SRD 5.1, sem mergeEditions ---
// --- US-140 — subespécie entra no catálogo, com `parentKey`, agrupada por posição ---

const raceRow = (pk, name, subspeciesOf = null) => ({ pk, fields: { name, subspecies_of: subspeciesOf } })
const raceIdentityResolve = (_domain, _key, _entry, enName) => ({ name: enName })

test('buildRaces: raiz com subespécie emite as duas com parentKey normalizado; raiz sem emite só ela', () => {
  const species2014 = [
    raceRow('srd_dragonborn', 'Dragonborn'), // raiz sem subespécie — sem entrada fantasma
    raceRow('srd_dwarf', 'Dwarf'),
    raceRow('srd_elf', 'Elf'),
    // subespécie: subspecies_of é o `pk` CRU da raiz (`srd_elf`), não a key já normalizada —
    // é a normalização (mesmo strip de `stripDocument`) que buildRaces tem de fazer.
    raceRow('srd_high-elf', 'High Elf', 'srd_elf'),
    raceRow('srd_hill-dwarf', 'Hill Dwarf', 'srd_dwarf'),
  ]
  const result = buildRaces({}, species2014, raceIdentityResolve)

  // Emissão agrupa por raiz (raízes em ordem alfabética, cada uma seguida da sua subespécie) —
  // NÃO é sort alfabético global (`high-elf` não fica perto de `human`/`half-elf`).
  assert.deepEqual(result.map((r) => r.key), ['dragonborn', 'dwarf', 'hill-dwarf', 'elf', 'high-elf'])

  const highElf = result.find((r) => r.key === 'high-elf')
  const hillDwarf = result.find((r) => r.key === 'hill-dwarf')
  assert.equal(highElf.parentKey, 'elf')
  assert.equal(hillDwarf.parentKey, 'dwarf')

  // Raízes não ganham parentKey (ausente = raiz, mesmo contrato do RaceCatalogEntrySchema).
  for (const key of ['dragonborn', 'dwarf', 'elf']) {
    assert.equal(result.find((r) => r.key === key).parentKey, undefined)
  }
})

// Proteção contra reintrodução acidental: `buildRaces` não tem mais parâmetro pro 5.2, então
// goliath/orc só voltariam se alguém reintroduzisse a fusão — este teste falha se isso acontecer.
test('buildRaces: goliath/orc não aparecem — não existem no 5.1 e a função não recebe o 5.2', () => {
  const species2014 = [raceRow('srd_dwarf', 'Dwarf'), raceRow('srd_human', 'Human')]
  const result = buildRaces({}, species2014, raceIdentityResolve)
  assert.deepEqual(result.map((r) => r.key), ['dwarf', 'human'])
  assert.equal(buildRaces.length, 3, 'assinatura tem 3 parâmetros — não sobra espaço pro species2024')
})

// --- US-142 — buildRaceFeatures: SpeciesTrait.json vira config.raceFeatures, por chave jogável ---

const traitRow = (pk, name, desc, parent) => ({ pk, fields: { name, desc, parent, type: null } })

test('buildRaceFeatures: raiz com subespécie combina raiz+próprios sem dedupe; raiz some da chave jogável', () => {
  const races = [
    { key: 'dwarf', label: 'Dwarf' },
    { key: 'hill-dwarf', label: 'Hill Dwarf', parentKey: 'dwarf' },
    { key: 'human', label: 'Human' },
  ]
  const speciesTraits = [
    traitRow('srd_dwarf_ability-score-increase', 'Ability Score Increase', '+2 Con.', 'srd_dwarf'),
    traitRow('srd_dwarf_darkvision', 'Darkvision', '60 feet.', 'srd_dwarf'),
    traitRow('srd_hill-dwarf_ability-score-increase', 'Ability Score Increase', '+1 Wis.', 'srd_hill-dwarf'),
    traitRow('srd_hill-dwarf_dwarven-toughness', 'Dwarven Toughness', '+1 HP per level.', 'srd_hill-dwarf'),
    traitRow('srd_human_ability-score-increase', 'Ability Score Increase', '+1 all.', 'srd_human'),
  ]
  const result = buildRaceFeatures(races, speciesTraits)

  // Raiz-com-subespécie some do mapa — não é mais chave jogável (US-142 reverte a US-140 #1).
  assert.equal(result.dwarf, undefined)

  // Subespécie: raiz PRIMEIRO, depois os próprios — concatenação simples, sem dedupe por key
  // (as duas "Ability Score Increase" sobrevivem como entradas separadas).
  assert.deepEqual(result['hill-dwarf'], [
    { key: 'ability-score-increase', name: 'Ability Score Increase', description: '+2 Con.', source: 'dwarf' },
    { key: 'darkvision', name: 'Darkvision', description: '60 feet.', source: 'dwarf' },
    { key: 'ability-score-increase', name: 'Ability Score Increase', description: '+1 Wis.', source: 'hill-dwarf' },
    { key: 'dwarven-toughness', name: 'Dwarven Toughness', description: '+1 HP per level.', source: 'hill-dwarf' },
  ])

  // Raiz SEM subespécie: só os próprios traços, sob a própria chave.
  assert.deepEqual(result.human, [
    { key: 'ability-score-increase', name: 'Ability Score Increase', description: '+1 all.', source: 'human' },
  ])
})

test('buildRaceFeatures: raça sem trait nenhum no dataset entra com lista vazia (nunca some da chave)', () => {
  const races = [{ key: 'tiefling', label: 'Tiefling' }]
  assert.deepEqual(buildRaceFeatures(races, []), { tiefling: [] })
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
      // US-139: Marshal (classFeatures.marshal) é a5e-ag; magia não tem Marshal (sem conjuração) —
      // continua 100% srd. As outras 12 classes continuam srd (5.1 agora, não mais 5.2).
      assert.ok(['srd', 'a5e-ag'].includes(entry.source), `entrada derivada do dataset com source errado: ${entry.key}`)
    }
    const marshalFeatures = artifact.classFeatures.marshal ?? []
    assert.ok(marshalFeatures.length > 0, 'classFeatures.marshal vazio')
    assert.ok(marshalFeatures.every((f) => f.source === 'a5e-ag'), 'classFeatures.marshal com source fora de a5e-ag')
  })
}

// `races`/`classes` são catálogo FECHADO e pequeno (9/13) — ao contrário de `kitItems` (US-134,
// "curadoria manual, grande demais pra uma sentada só"), aqui dá pra exigir 100% curado sempre.
// Sem este teste, uma classe/raça nova (ex.: Marshal, US-139) pode entrar sem tradução e só
// aparecer no relatório `FALLBACK EN` do `srd:ingest` — texto de console que ninguém é obrigado
// a ler linha a linha. Isto falha o teste, não só o `--strict`.
// Checa contra o OVERLAY (locale/pt-BR.json), não contra "label PT === label EN" — "Dragonborn"
// e "Tiefling" são curados de propósito com o MESMO texto (empréstimo, comum em raça de D&D em
// pt-BR); comparar por igualdade de texto dava falso positivo nos dois. O que importa é a chave
// EXISTIR no overlay (curada, mesmo que idêntica ao EN por escolha) — não o valor bater.
test('artefato pt-BR: toda classe e raça tem entrada curada no overlay — nenhuma cai no fallback EN', () => {
  const en = JSON.parse(readFileSync(join(import.meta.dirname, 'srd-5e.config.en-US.json'), 'utf8'))
  const overlay = JSON.parse(readFileSync(OVERLAY_PATH, 'utf8'))
  for (const domain of ['classes', 'races']) {
    for (const { key } of en[domain]) {
      assert.ok(overlay[domain]?.[key], `${domain}.${key}: sem entrada em locale/pt-BR.json — cai no fallback EN`)
    }
  }
})

// --- US-139 — buildClassFeatures/buildClassSpells: 5.1 é a fonte, Marshal soma no mesmo mapa ---
// `identityResolve` é definida mais abaixo (US-121) — a referência aqui é segura porque o
// callback do `test()` só roda depois que o módulo inteiro terminou de avaliar (TDZ não pega).

const classRow = (pk, subclassOf = null) => ({ pk, fields: { subclass_of: subclassOf } })
const featureRow = (pk, parent, name, desc, document = 'srd-2014') => ({ pk, fields: { parent, name, desc, document } })
const featureItemRow = (parent, level) => ({ pk: `${parent}_${level}`, fields: { parent, level } })

test('buildClassFeatures: Marshal soma no mesmo CLASS_MAP; source por documento; ruído de desc vazio (a5e-ag) filtrado', () => {
  const classes = [classRow('srd_barbarian'), classRow('a5e_marshal')]
  const features = [
    featureRow('srd_barbarian_rage', 'srd_barbarian', 'Rage', 'You can enter a rage.'),
    featureRow('a5e_marshal_commanding-presence', 'a5e_marshal', 'Commanding Presence', 'You have a Commanding Presence.', 'a5e-ag'),
    // US-139: ruído do a5e-ag vem com desc VAZIO (não '[Column data]' como o 5.1) — mesma
    // linha de nível 1 que precisa ficar de fora do artefato.
    featureRow('a5e_marshal_proficiency-bonus', 'a5e_marshal', 'Proficiency Bonus', '', 'a5e-ag'),
  ]
  const featureItems = [
    featureItemRow('srd_barbarian_rage', 1),
    featureItemRow('a5e_marshal_commanding-presence', 1),
    featureItemRow('a5e_marshal_proficiency-bonus', 1),
  ]
  const result = buildClassFeatures({}, { classes, features, featureItems }, identityResolve)
  assert.deepEqual(result.barbarian.map((f) => f.key), ['barbarian_rage'])
  assert.equal(result.barbarian[0].source, 'srd')
  assert.deepEqual(result.marshal.map((f) => f.key), ['marshal_commanding-presence'])
  assert.equal(result.marshal[0].source, 'a5e-ag')
})

const spellRow = (pk, name, level, classes) => ({ pk, fields: { name, level, desc: 'Texto.', classes } })

test('buildClassSpells: slug via stripDocument — pk "srd_light" (5.1) vira key "light", não "srd_light"', () => {
  const spells = [spellRow('srd_light', 'Light', 0, ['srd_wizard', 'srd_cleric'])]
  const result = buildClassSpells({}, spells, identityResolve)
  assert.equal(result.wizard[0].key, 'light')
  assert.equal(result.cleric[0].key, 'light')
})

// --- US-139 — startingKits: o formato mudou de tabela (5.2) pra bullets em prosa (5.1/a5e-ag) ---
//
// As strings abaixo são o texto CRU de `ClassFeature.STARTING_EQUIPMENT` (Open5e v2.1.0,
// srd-2014 e a5e-ag), copiado sem correção.

test('firstAlternative: escolha "(*a*) X or (*b*) Y" vira só o texto de A', () => {
  assert.equal(firstAlternative('(*a*) a greataxe or (*b*) any martial melee weapon'), 'a greataxe')
})

test('firstAlternative: escolha de TRÊS opções ("(*a*) X, (*b*) Y, or (*c*) Z") para em A', () => {
  assert.equal(firstAlternative('(*a*) a rapier, (*b*) a longsword, or (*c*) any simple weapon'), 'a rapier')
})

test('firstAlternative: linha sem marcador (item obrigatório) sai intacta', () => {
  assert.equal(firstAlternative("An explorer's pack and four javelins"), "An explorer's pack and four javelins")
})

test('parseSrdEquipmentBullets: barbeiro do dataset real — bullets aditivos, cada um reduzido à opção A', () => {
  const desc =
    'You start with the following equipment, in addition to the equipment granted by your background:\n' +
    '* (*a*) a greataxe or (*b*) any martial melee weapon\n' +
    '* (*a*) two handaxes or (*b*) any simple weapon\n' +
    "* An explorer’s pack and four javelins"
  assert.deepEqual(parseSrdEquipmentBullets(desc), [
    { name: 'a greataxe', qty: 1 },
    { name: 'two handaxes', qty: 1 },
    { name: "An explorer’s pack and four javelins", qty: 1 },
  ])
})

// O clérigo tem escolha de TRÊS opções numa das linhas — mesma regra "sempre a primeira".
test('parseSrdEquipmentBullets: clérigo — linha de 3 opções para na primeira, itens obrigatórios com "e" ficam juntos', () => {
  const desc =
    'You start with the following equipment, in addition to the equipment granted by your background:\n' +
    '* (*a*) a mace or (*b*) a warhammer (if proficient)\n' +
    '* (*a*) scale mail, (*b*) leather armor, or (*c*) chain mail (if proficient)\n' +
    '* (*a*) a light crossbow and 20 bolts or (*b*) any simple weapon\n' +
    "* (*a*) a priest’s pack or (*b*) an explorer’s pack\n" +
    '* A shield and a holy symbol'
  assert.deepEqual(parseSrdEquipmentBullets(desc).map((i) => i.name), [
    'a mace',
    'scale mail',
    'a light crossbow and 20 bolts',
    "a priest’s pack",
    'A shield and a holy symbol',
  ])
})

test('parseA5ePackageEquipment: Marshal — escolhe o primeiro pacote, descarta rótulo e custo', () => {
  const desc =
    'You begin the game with 200 gp. You can select your own gear or choose one of the following equipment packages.\n\n' +
    "- **Skirmisher’s Set (Cost 193 gp):** 6 javelins, longsword, hauberk, light shield, explorer's pack\n" +
    "- **Soldier's Set (Cost 111 gp):** Battleaxe, scimitar, 2 spears, longbow and quiver with 20 arrows, padded leather, dungeoneer's pack"
  assert.deepEqual(parseA5ePackageEquipment(desc), [
    { name: 'javelin', qty: 6 },
    { name: 'longsword', qty: 1 },
    { name: 'hauberk', qty: 1 },
    { name: 'light shield', qty: 1 },
    { name: "explorer's pack", qty: 1 },
  ])
})

test('parseA5ePackageEquipment: sem pacote em lista falha alto (formato inesperado)', () => {
  assert.throws(() => parseA5ePackageEquipment('You begin the game with 200 gp, no packages listed.'), /sem pacote em lista/)
})

// buildStartingKits não é testável com fixture parcial: `CLASS_MAP` é fechado no módulo com as
// 13 classes e a função FALHA ALTO se alguma ficar sem kit (rede de segurança contra bump que
// esquece uma classe) — cobertura de integração vem dos testes de artefato logo abaixo, contra
// o `srd:ingest` real. Aqui só os parsers puros (`firstAlternative`/`parseSrdEquipmentBullets`/
// `parseA5ePackageEquipment`), que não dependem do CLASS_MAP.

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
  assert.equal(Object.keys(en).length, 14, '12 classes SRD + Marshal + default')
  for (const [classKey, items] of Object.entries(en)) {
    assert.ok(items.length > 0, `kit vazio: ${classKey}`)
    assert.deepEqual(items.map((i) => i.qty), pt[classKey].map((i) => i.qty), `quantidades divergem em ${classKey}`)
  }
})

// US-139: o kit do mago mudou de CONTEÚDO, não só de fonte — "opção A" do 5.1 escolhe
// itens diferentes da tabela do 5.2 (ex.: Quarterstaff em vez de Dagger×2). Medido contra o
// artefato real de 15/08/2026.
test('artefato: en-US traz o kit em inglês', () => {
  const read = (locale) =>
    JSON.parse(readFileSync(join(import.meta.dirname, `srd-5e.config.${locale}.json`), 'utf8')).startingKits
  assert.deepEqual(read('en-US').wizard, [
    { name: 'Quarterstaff', qty: 1 },
    { name: 'Component Pouch', qty: 1 },
    { name: 'Scholar’s Pack', qty: 1 },
    { name: 'Spellbook', qty: 1 },
  ])
})

// US-139: a troca de fonte (5.2 → 5.1 + a5e-ag) mudou o TEXTO CRU do equipamento inicial das
// 13 classes (de linha de tabela pra prosa com bullets) — o overlay `kitItems` curado pro
// formato antigo não casa mais com as chaves novas. Kit inicial não é MT_DOMAINS (mesma decisão
// da US-134 pra `tools`: curadoria manual, "grande demais pra uma sentada só"), então esta
// lacuna NÃO é gate de teste — é gate de `--strict` (o mesmo mecanismo genérico de fallback que
// já cobre features/spells/backgrounds/tools, ver `resolve()`), igual a todo outro domínio.
// Pendência registrada: `pnpm srd:ingest --strict` falha até a curadoria de `locale/pt-BR.json`
// → `kitItems` cobrir as novas chaves (ver relatório "FALLBACK EN" do ingest).

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

// US-139 (critério de aceite): `classSpells` vem do 5.1 (`srd_*`/sem prefixo) — falha se
// `stripDocument` regredir e alguma chave voltar a carregar o prefixo `srd-2024_` do 5.2.
test('artefato: nenhuma entrada de classSpells carrega o prefixo srd-2024_', () => {
  const artifact = JSON.parse(readFileSync(join(import.meta.dirname, 'srd-5e.config.en-US.json'), 'utf8'))
  for (const entries of Object.values(artifact.classSpells)) {
    for (const entry of entries) assert.ok(!entry.key.startsWith('srd-2024_'), `${entry.key}: ainda carrega o prefixo do 5.2`)
  }
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

  // US-135: 20 das 21 origens têm exatamente 1 benefício `type: 'feature'` (Acólito é a
  // exceção, medida em 13/08/2026 — ver US-135 §Contexto e motivação).
  test(`artefato ${locale}: backgroundFeatures cobre 20 das 21 origens (Acólito é a exceção)`, () => {
    const artifact = JSON.parse(readFileSync(join(import.meta.dirname, `srd-5e.config.${locale}.json`), 'utf8'))
    assert.deepEqual(Object.keys(artifact.backgroundFeatures).sort(), artifact.backgrounds.map((bg) => bg.key).filter((k) => k !== 'a5e-ag_acolyte').sort())
    for (const [key, features] of Object.entries(artifact.backgroundFeatures)) {
      assert.equal(features.length, 1, `${key}: esperada 1 feature, achou ${features.length}`)
      assert.ok(features[0].key.startsWith(`${key}_`), `${key}: feature.key "${features[0].key}" não prefixado pelo pk da origem`)
      assert.ok(features[0].name.length > 0, `${key}: feature sem name`)
      assert.ok(features[0].description.length > 0, `${key}: feature sem description`)
      assert.equal(features[0].source, 'a5e-ag', `${key}: source errado`)
    }
  })
}

// US-142: raceFeatures cobre exatamente as 9 chaves JOGÁVEIS (5 raízes sem subespécie + as 4
// subespécies) — as 4 raízes COM subespécie (dwarf/elf/gnome/halfling) ficaram de fora.
for (const locale of ['en-US', 'pt-BR']) {
  test(`artefato ${locale}: raceFeatures cobre as 9 chaves jogáveis, sem as 4 raízes com subespécie`, () => {
    const artifact = JSON.parse(readFileSync(join(import.meta.dirname, `srd-5e.config.${locale}.json`), 'utf8'))
    assert.deepEqual(Object.keys(artifact.raceFeatures).sort(), [
      'dragonborn', 'half-elf', 'half-orc', 'high-elf', 'hill-dwarf', 'human', 'lightfoot', 'rock-gnome', 'tiefling',
    ])
    for (const [key, features] of Object.entries(artifact.raceFeatures)) {
      assert.ok(features.length > 0, `${key}: raceFeatures vazio`)
      for (const f of features) {
        assert.ok(f.key.length > 0, `${key}: feature sem key`)
        assert.ok(f.name.length > 0, `${key}: feature sem name`)
        assert.ok(f.description.length > 0, `${key}: feature sem description`)
        assert.ok(f.source.length > 0, `${key}: feature sem source`)
      }
    }
  })
}

// US-142: subespécie combina raiz + próprios — o par mais visível (Alto-elfo, 2 Ability Score
// Increase separados) prova a concatenação sem dedupe direto no artefato gravado.
test('artefato en-US: high-elf combina os 10 traços de elf + os 4 próprios, ASI da raiz e da subespécie sobrevivem separados', () => {
  const artifact = JSON.parse(readFileSync(join(import.meta.dirname, 'srd-5e.config.en-US.json'), 'utf8'))
  const highElf = artifact.raceFeatures['high-elf']
  assert.equal(highElf.length, 14)
  const asi = highElf.filter((f) => f.key === 'ability-score-increase')
  assert.deepEqual(asi.map((f) => f.source), ['elf', 'high-elf'])
})

// US-142: raceFeatures nasce EN puro nos dois locales (decisão de produto, §Fora do escopo) —
// sem overlay pt-BR, os dois artefatos têm de ser byte-a-byte iguais neste campo.
test('raceFeatures: EN e pt-BR são idênticos (sem overlay de tradução nesta story)', () => {
  const en = JSON.parse(readFileSync(join(import.meta.dirname, 'srd-5e.config.en-US.json'), 'utf8'))
  const ptBr = JSON.parse(readFileSync(join(import.meta.dirname, 'srd-5e.config.pt-BR.json'), 'utf8'))
  assert.deepEqual(ptBr.raceFeatures, en.raceFeatures)
})

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
    benefit('a5e-ag_acolyte_skills', 'a5e-ag_acolyte', 'Skill Proficiencies', 'Religion, and either Insight or Persuasion.', 'skill_proficiency'),
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
  const benefits = [benefit('a5e-ag_acolyte_feature', 'a5e-ag_acolyte', 'Shelter of the Faithful', 'Você pode contar com hospedagem gratuita.', 'feature')]
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, benefits, identityResolve)
  assert.equal('grant' in result[0].benefits[0], false)
})

// --- US-131 — parseSkillGrant: skill_proficiency → grant estruturado ---

const identitySkillKey = (name) => name.toLowerCase().replace(/\s+/g, '_')

test('parseSkillGrant: "Fixas, and either opções." vira { fixed, chooseFrom, chooseCount: 1 }', () => {
  assert.deepEqual(
    parseSkillGrant('Religion, and either Insight or Persuasion.', identitySkillKey, []),
    { fixed: ['religion'], chooseFrom: ['insight', 'persuasion'], chooseCount: 1 },
  )
})

test('parseSkillGrant: duas fixas (Noble) e chooseFrom com 4 opções (Sage) — vírgula de Oxford tratada', () => {
  assert.deepEqual(
    parseSkillGrant('Culture, History, and either Animal Handling or Persuasion.', identitySkillKey, []),
    { fixed: ['culture', 'history'], chooseFrom: ['animal_handling', 'persuasion'], chooseCount: 1 },
  )
  assert.deepEqual(
    parseSkillGrant('History, and either Arcana, Culture, Engineering, or Religion.', identitySkillKey, []),
    { fixed: ['history'], chooseFrom: ['arcana', 'culture', 'engineering', 'religion'], chooseCount: 1 },
  )
})

test('parseSkillGrant: "N of your choice." vira escolha livre — chooseFrom é o catálogo inteiro', () => {
  assert.deepEqual(
    parseSkillGrant('Two of your choice.', identitySkillKey, ['religion', 'insight', 'athletics']),
    { fixed: [], chooseFrom: ['athletics', 'insight', 'religion'], chooseCount: 2 },
  )
})

test('parseSkillGrant: texto fora dos dois padrões devolve undefined (função pura, não falha)', () => {
  assert.equal(parseSkillGrant('Religion and Insight.', identitySkillKey, []), undefined)
  assert.equal(parseSkillGrant('Any three skills.', identitySkillKey, []), undefined)
})

test('parseSkillGrant: perícia sem chave no catálogo é OMITIDA do array, não derruba a função', () => {
  const resolve = (name) => (name === 'Culture' ? undefined : identitySkillKey(name))
  assert.deepEqual(
    parseSkillGrant('Culture, History, and either Animal Handling or Persuasion.', resolve, []),
    { fixed: ['history'], chooseFrom: ['animal_handling', 'persuasion'], chooseCount: 1 },
  )
})

// --- US-131 — buildBackgrounds: skill_proficiency vira benefits[].grant (kind: 'skills') ---

const SKILLS = [
  { key: 'religion', label: 'Religion', ability: 'wisdom' },
  { key: 'insight', label: 'Insight', ability: 'wisdom' },
  { key: 'persuasion', label: 'Persuasion', ability: 'charisma' },
  { key: 'history', label: 'History', ability: 'intelligence' },
  { key: 'animal_handling', label: 'Animal Handling', ability: 'wisdom' },
]

test('buildBackgrounds: benefit "skill_proficiency" reconhecido vira benefits[].grant (kind: "skills")', () => {
  const backgrounds = [background('a5e-ag_noble', 'Noble')]
  const benefits = [benefit('a5e-ag_noble_skills', 'a5e-ag_noble', 'Skill Proficiencies', 'History, and either Animal Handling or Persuasion.', 'skill_proficiency')]
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, benefits, identityResolve, SKILLS)
  assert.deepEqual(result[0].benefits[0].grant, { kind: 'skills', fixed: ['history'], chooseFrom: ['animal_handling', 'persuasion'], chooseCount: 1 })
})

test('buildBackgrounds: "N of your choice" vira grant com chooseFrom = catálogo inteiro', () => {
  const backgrounds = [background('a5e-ag_guildmember', 'Guildmember')]
  const benefits = [benefit('a5e-ag_guildmember_skills', 'a5e-ag_guildmember', 'Skill Proficiencies', 'Two of your choice.', 'skill_proficiency')]
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, benefits, identityResolve, SKILLS)
  assert.deepEqual(result[0].benefits[0].grant, {
    kind: 'skills',
    fixed: [],
    chooseFrom: ['animal_handling', 'history', 'insight', 'persuasion', 'religion'],
    chooseCount: 2,
  })
})

test('buildBackgrounds: perícia sem entrada no catálogo some do grant E entra no relatório de órfãos', () => {
  const backgrounds = [background('a5e-ag_sage', 'Sage')]
  const benefits = [benefit('a5e-ag_sage_skills', 'a5e-ag_sage', 'Skill Proficiencies', 'History, and either Arcana, Culture, Engineering, or Religion.', 'skill_proficiency')]
  const orphans = []
  // Catálogo sintético SEM "Arcana"/"Culture"/"Engineering" — simula a lacuna que a US-130
  // fechou de verdade (Culture/Engineering); Arcana some da mesma forma, caso defensivo.
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, benefits, identityResolve, SKILLS, [], [], orphans)
  assert.deepEqual(result[0].benefits[0].grant, { kind: 'skills', fixed: ['history'], chooseFrom: ['religion'], chooseCount: 1 })
  assert.deepEqual(orphans, [
    { domain: 'skills', key: 'Arcana' },
    { domain: 'skills', key: 'Culture' },
    { domain: 'skills', key: 'Engineering' },
  ])
})

test('buildBackgrounds: benefit "skill_proficiency" fora dos dois padrões falha alto', () => {
  const backgrounds = [background('a5e-ag_acolyte', 'Acolyte')]
  const benefits = [benefit('a5e-ag_acolyte_skills', 'a5e-ag_acolyte', 'Skill Proficiencies', 'Any three skills.', 'skill_proficiency')]
  assert.throws(() => buildBackgrounds({}, backgrounds, benefits, identityResolve, SKILLS), /skill_proficiency fora do padrão/)
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

// --- US-135 — backgroundFeatures: benefit type === "feature" popula backgroundFeatures[key] ---

test('buildBackgrounds: benefit type === "feature" popula backgroundFeatures[key], key = b.pk cru', () => {
  const backgrounds = [background('a5e-ag_criminal', 'Criminal')]
  const benefits = [benefit('a5e-ag_criminal_thieves-cant', 'a5e-ag_criminal', "Thieves' Cant", "You know thieves' cant.", 'feature')]
  const { backgroundFeatures } = buildBackgrounds({}, backgrounds, benefits, identityResolve)
  assert.deepEqual(backgroundFeatures['a5e-ag_criminal'], [
    { key: 'a5e-ag_criminal_thieves-cant', name: "Thieves' Cant", description: "You know thieves' cant.", source: 'a5e-ag' },
  ])
})

test('buildBackgrounds: origem sem benefit "feature" (Acólito) não entra em backgroundFeatures', () => {
  const backgrounds = [background('a5e-ag_acolyte', 'Acolyte')]
  const benefits = [benefit('a5e-ag_acolyte_ability-scores', 'a5e-ag_acolyte', 'Ability Score Increases', '+1 to Wisdom and one other ability score.', 'ability_score')]
  const { backgroundFeatures } = buildBackgrounds({}, backgrounds, benefits, identityResolve)
  assert.deepEqual(backgroundFeatures, {})
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

// --- US-134 — buildTools: Item.json (category tools/land-vehicle/waterborne-vehicle) → config.tools ---

const item = (pk, name, category, desc = 'Rule text.') => ({ pk, fields: { name, category, desc } })

test('buildTools: um item de cada um dos 5 padrões de nome, category correta, key sem "srd-2024_"', () => {
  const items = [
    item('srd-2024_smiths-tools', "Smith's Tools (20 GP)", 'tools'),
    item('srd-2024_musical-instrument-lute', 'Musical Instrument, Lute', 'tools'),
    item('srd-2024_gaming-set-dice', 'Gaming Set, Dice', 'tools'),
    item('srd-2024_herbalism-kit', 'Herbalism Kit', 'tools'),
    item('srd-2024_thieves-tools', "Thieves' Tools", 'tools'),
    item('srd-2024_cart', 'Cart', 'land-vehicle'),
    item('srd-2024_galley', 'Galley', 'waterborne-vehicle'),
  ]
  const result = buildTools({}, items, identityResolve)
  assert.deepEqual(result.find((t) => t.key === 'smiths_tools'), { key: 'smiths_tools', label: "Smith's Tools", category: 'artisan' })
  assert.deepEqual(result.find((t) => t.key === 'musical_instrument_lute'), { key: 'musical_instrument_lute', label: 'Musical Instrument, Lute', category: 'musical-instrument' })
  assert.deepEqual(result.find((t) => t.key === 'gaming_set_dice'), { key: 'gaming_set_dice', label: 'Gaming Set, Dice', category: 'gaming-set' })
  assert.deepEqual(result.find((t) => t.key === 'herbalism_kit'), { key: 'herbalism_kit', label: 'Herbalism Kit', category: 'kit' })
  assert.deepEqual(result.find((t) => t.key === 'thieves_tools'), { key: 'thieves_tools', label: "Thieves' Tools", category: 'thieves_tools' })
  assert.deepEqual(result.find((t) => t.key === 'cart'), { key: 'cart', label: 'Cart', category: 'vehicle' })
  assert.deepEqual(result.find((t) => t.key === 'galley'), { key: 'galley', label: 'Galley', category: 'vehicle' })
})

test('buildTools: "(N GP)" some do label mas não do key', () => {
  const result = buildTools({}, [item('srd-2024_tinkers-tools', "Tinker's Tools (50 GP)", 'tools')], identityResolve)
  assert.deepEqual(result, [{ key: 'tinkers_tools', label: "Tinker's Tools", category: 'artisan' }])
})

test('buildTools: item category "tools" com nome fora dos 5 padrões falha alto', () => {
  const items = [item('srd-2024_mystery-box', 'Mystery Box (10 GP)', 'tools')]
  assert.throws(() => buildTools({}, items, identityResolve), /fora dos 5 padrões/)
})

test('buildTools: categorias fora do escopo (weapon, armor...) são descartadas', () => {
  const items = [item('srd-2024_dagger', 'Dagger', 'weapon'), item('srd-2024_cart', 'Cart', 'land-vehicle')]
  const result = buildTools({}, items, identityResolve)
  assert.deepEqual(result.map((t) => t.key), ['cart'])
})

test('buildTools: label pt-BR vem do overlay igual aos outros domínios MT', () => {
  const overlay = { tools: { smiths_tools: { name: 'Ferramentas de Ferreiro', description: 'Regra.' } } }
  const ptResolve = (_domain, _key, entry, enName) => ({ name: entry?.name?.trim() || enName })
  const result = buildTools(overlay, [item('srd-2024_smiths-tools', "Smith's Tools (20 GP)", 'tools')], ptResolve)
  assert.equal(result[0].label, 'Ferramentas de Ferreiro')
})

// Contra o dataset PINADO real (não fixture): as 50 entradas medidas em US-134 §Contexto batem.
test('buildTools: as 50 entradas reais do Item.json pinado batem a contagem por categoria', () => {
  const itemsRaw = JSON.parse(readFileSync(join(import.meta.dirname, '_data', 'Item.json'), 'utf8'))
  const result = buildTools({}, itemsRaw, identityResolve)
  assert.equal(result.length, 50)
  const byCategory = {}
  for (const t of result) byCategory[t.category] = (byCategory[t.category] || 0) + 1
  assert.equal(byCategory.artisan, 17)
  assert.equal(byCategory['musical-instrument'], 10)
  assert.equal(byCategory['gaming-set'], 4)
  assert.equal(byCategory.kit, 6)
  assert.equal(byCategory.vehicle, 11)
  assert.equal(byCategory.navigators_tools, 1)
  assert.equal(byCategory.thieves_tools, 1)
})

// --- artefato: config.tools sai gravado nos dois locales, mesma contagem que o dataset real ---
for (const locale of ['en-US', 'pt-BR']) {
  test(`artefato ${locale}: config.tools tem 50 entradas com key/label/category`, () => {
    const artifact = JSON.parse(readFileSync(join(import.meta.dirname, `srd-5e.config.${locale}.json`), 'utf8'))
    assert.equal(artifact.tools.length, 50)
    for (const t of artifact.tools) {
      assert.ok(t.key && t.label && t.category, `entrada incompleta: ${JSON.stringify(t)}`)
    }
  })
}

// --- US-132 — parseToolGrant: tool_proficiency → grant estruturado (kind: 'tools') ---

const TOOLS = [
  { key: 'smiths_tools', label: "Smith's Tools", category: 'artisan' },
  { key: 'weavers_tools', label: "Weaver's Tools", category: 'artisan' },
  { key: 'gaming_set_dice', label: 'Gaming Set, Dice', category: 'gaming-set' },
  { key: 'gaming_set_cards', label: 'Gaming Set, Cards', category: 'gaming-set' },
  { key: 'musical_instrument_lute', label: 'Musical Instrument, Lute', category: 'musical-instrument' },
  { key: 'disguise_kit', label: 'Disguise Kit', category: 'kit' },
  { key: 'forgery_kit', label: 'Forgery Kit', category: 'kit' },
  { key: 'herbalism_kit', label: 'Herbalism Kit', category: 'kit' },
  { key: 'thieves_tools', label: "Thieves' Tools", category: 'thieves_tools' },
  { key: 'navigators_tools', label: "Navigator's Tools", category: 'navigators_tools' },
  { key: 'cart', label: 'Cart', category: 'vehicle' },
  { key: 'galley', label: 'Galley', category: 'vehicle' },
]
const toolsByKeySet = new Set(TOOLS.map((t) => t.key))
const TOOL_CATEGORIES = {
  artisan: ['smiths_tools', 'weavers_tools'],
  'gaming-set': ['gaming_set_cards', 'gaming_set_dice'],
  'musical-instrument': ['musical_instrument_lute'],
  vehicleAll: ['cart', 'galley'],
  vehicleLand: ['cart'],
  vehicleWater: ['galley'],
}

test('parseToolGrant: item concreto único (Hermit) vira { fixed: [chave], chooseFrom: [], chooseCount: 0 }', () => {
  assert.deepEqual(parseToolGrant('Herbalism kit.', toolsByKeySet, TOOL_CATEGORIES), { fixed: ['herbalism_kit'], chooseFrom: [], chooseCount: 0 })
})

test('parseToolGrant: lista de 2 itens concretos (Charlatan) vira fixed com os 2, sem escolha', () => {
  assert.deepEqual(parseToolGrant('Disguise kit, forgery kit.', toolsByKeySet, TOOL_CATEGORIES), { fixed: ['disguise_kit', 'forgery_kit'], chooseFrom: [], chooseCount: 0 })
})

test('parseToolGrant: fixo + escolha na MESMA origem (Criminal) — categoria bare sem "one" ainda é escolha', () => {
  assert.deepEqual(
    parseToolGrant("Gaming set, thieves' tools.", toolsByKeySet, TOOL_CATEGORIES),
    { fixed: ['thieves_tools'], chooseFrom: ['gaming_set_cards', 'gaming_set_dice'], chooseCount: 1 },
  )
})

test('parseToolGrant: categoria PLURAL sem "one" (Farmer) vira fixed com TODAS as chaves — não escolha', () => {
  assert.deepEqual(parseToolGrant('Land vehicles.', toolsByKeySet, TOOL_CATEGORIES), { fixed: ['cart'], chooseFrom: [], chooseCount: 0 })
})

test('parseToolGrant: item concreto + categoria terrestre/aquática (Sailor) — só a água entra, não as 2', () => {
  assert.deepEqual(
    parseToolGrant("Navigator's tools, water vehicles.", toolsByKeySet, TOOL_CATEGORIES),
    { fixed: ['galley', 'navigators_tools'], chooseFrom: [], chooseCount: 0 },
  )
})

test('parseToolGrant: "One vehicle." (Trader) — categoria sem restrição terrestre/aquática vira escolha', () => {
  assert.deepEqual(parseToolGrant('One vehicle.', toolsByKeySet, TOOL_CATEGORIES), { fixed: [], chooseFrom: ['cart', 'galley'], chooseCount: 1 })
})

test('parseToolGrant: "One gaming set."/"One type of gaming set." (Noble/Soldier) — mesmo resultado', () => {
  const expected = { fixed: [], chooseFrom: ['gaming_set_cards', 'gaming_set_dice'], chooseCount: 1 }
  assert.deepEqual(parseToolGrant('One gaming set.', toolsByKeySet, TOOL_CATEGORIES), expected)
  assert.deepEqual(parseToolGrant('One type of gaming set.', toolsByKeySet, TOOL_CATEGORIES), expected)
})

test('parseToolGrant: "X or Y" (Artisan) — item concreto já dentro da categoria não duplica o chooseFrom', () => {
  assert.deepEqual(
    parseToolGrant("One type of artisan's tools or smith's tools.", toolsByKeySet, TOOL_CATEGORIES),
    { fixed: [], chooseFrom: ['smiths_tools', 'weavers_tools'], chooseCount: 1 },
  )
})

test('parseToolGrant: "X or Y" entre 2 categorias (Marauder) — união dos dois catálogos', () => {
  assert.deepEqual(
    parseToolGrant("One type of artisan's tools or vehicle.", toolsByKeySet, TOOL_CATEGORIES),
    { fixed: [], chooseFrom: ['cart', 'galley', 'smiths_tools', 'weavers_tools'], chooseCount: 1 },
  )
})

test('parseToolGrant: "Either A, B, or C" entre 3 categorias (Guildmember) — vírgula de Oxford tratada', () => {
  assert.deepEqual(
    parseToolGrant("Either one type of artisan's tools, musical instrument, or vehicle.", toolsByKeySet, TOOL_CATEGORIES),
    { fixed: [], chooseFrom: ['cart', 'galley', 'musical_instrument_lute', 'smiths_tools', 'weavers_tools'], chooseCount: 1 },
  )
})

test('parseToolGrant: 2 slots de escolha independentes na mesma origem (Folk Hero) — chooseCount 2, união dos 2 catálogos', () => {
  assert.deepEqual(
    parseToolGrant("One type of artisan's tools, one vehicle.", toolsByKeySet, TOOL_CATEGORIES),
    { fixed: [], chooseFrom: ['cart', 'galley', 'smiths_tools', 'weavers_tools'], chooseCount: 2 },
  )
})

test('parseToolGrant: texto fora dos padrões medidos devolve undefined (função pura, não falha)', () => {
  assert.equal(parseToolGrant('Any three tools of your choice.', toolsByKeySet, TOOL_CATEGORIES), undefined)
})

test('parseToolGrant: categoria reconhecida sem entrada no catálogo vira órfã e some do chooseFrom (não derruba)', () => {
  const orphans = []
  const emptyArtisan = { ...TOOL_CATEGORIES, artisan: [] }
  assert.deepEqual(
    parseToolGrant("One type of artisan's tools or smith's tools.", toolsByKeySet, emptyArtisan, orphans),
    { fixed: [], chooseFrom: ['smiths_tools'], chooseCount: 1 },
  )
  assert.deepEqual(orphans, [{ domain: 'tools', key: 'artisan' }])
})

// --- US-132 — buildBackgrounds: tool_proficiency vira benefits[].grant (kind: 'tools') ---

const TOOL_ITEMS_RAW = [
  item('srd-2024_cart', 'Cart', 'land-vehicle'),
  item('srd-2024_galley', 'Galley', 'waterborne-vehicle'),
]

test('buildBackgrounds: benefit "tool_proficiency" reconhecido vira benefits[].grant (kind: "tools")', () => {
  const backgrounds = [background('a5e-ag_hermit', 'Hermit')]
  const benefits = [benefit('a5e-ag_hermit_tools', 'a5e-ag_hermit', 'Tool Proficiencies', 'Herbalism kit.', 'tool_proficiency')]
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, benefits, identityResolve, [], TOOLS, TOOL_ITEMS_RAW)
  assert.deepEqual(result[0].benefits[0].grant, { kind: 'tools', fixed: ['herbalism_kit'], chooseFrom: [], chooseCount: 0 })
})

test('buildBackgrounds: benefit "tool_proficiency" fora dos padrões medidos falha alto', () => {
  const backgrounds = [background('a5e-ag_hermit', 'Hermit')]
  const benefits = [benefit('a5e-ag_hermit_tools', 'a5e-ag_hermit', 'Tool Proficiencies', 'Any three tools of your choice.', 'tool_proficiency')]
  assert.throws(() => buildBackgrounds({}, backgrounds, benefits, identityResolve, [], TOOLS, TOOL_ITEMS_RAW), /tool_proficiency fora dos padrões/)
})

test('buildBackgrounds: ferramenta sem entrada no catálogo some do grant E entra no relatório de órfãos', () => {
  const backgrounds = [background('a5e-ag_hermit', 'Hermit')]
  const benefits = [benefit('a5e-ag_hermit_tools', 'a5e-ag_hermit', 'Tool Proficiencies', 'Poisoner’s kit.', 'tool_proficiency')]
  const orphans = []
  const { backgrounds: result } = buildBackgrounds({}, backgrounds, benefits, identityResolve, [], TOOLS, TOOL_ITEMS_RAW, orphans)
  assert.deepEqual(result[0].benefits[0].grant, { kind: 'tools', fixed: [], chooseFrom: [], chooseCount: 0 })
  assert.deepEqual(orphans, [{ domain: 'tools', key: 'Poisoner’s kit' }])
})

// Contra o dataset PINADO real (não fixture): os 13 backgrounds tool_proficiency medidos em
// US-132 §Contexto — farmer/sailor só terrestre/aquático (não os 11 misturados), artisan-bg e
// marauder e guildmember resolvem via união de categorias, folk-hero com 2 slots.
test('buildBackgrounds: as 13 entradas reais de tool_proficiency batem os formatos medidos (US-132)', () => {
  const backgroundsRaw = JSON.parse(readFileSync(join(import.meta.dirname, '_data', 'Background.json'), 'utf8'))
  const benefitsRaw = JSON.parse(readFileSync(join(import.meta.dirname, '_data', 'BackgroundBenefit.json'), 'utf8'))
  const itemsRaw = JSON.parse(readFileSync(join(import.meta.dirname, '_data', 'Item.json'), 'utf8'))
  const toolBenefits = benefitsRaw.filter((b) => b.fields.type === 'tool_proficiency')
  assert.equal(toolBenefits.length, 13, 'dataset mudou de tamanho — reveja os formatos medidos')

  const tools = buildTools({}, itemsRaw, identityResolve)
  const orphans = []
  const { backgrounds: result } = buildBackgrounds({}, backgroundsRaw, benefitsRaw, identityResolve, [], tools, itemsRaw, orphans)
  // `skills` vazio de propósito (não é o foco deste teste) — filtra só órfãos de 'tools'.
  assert.deepEqual(orphans.filter((o) => o.domain === 'tools'), [])

  const grantOf = (key) => result.find((b) => b.key === key).benefits.find((b) => b.type === 'tool_proficiency').grant

  assert.deepEqual(grantOf('a5e-ag_hermit'), { kind: 'tools', fixed: ['herbalism_kit'], chooseFrom: [], chooseCount: 0 })
  assert.deepEqual(grantOf('a5e-ag_charlatan'), { kind: 'tools', fixed: ['disguise_kit', 'forgery_kit'], chooseFrom: [], chooseCount: 0 })
  assert.deepEqual(grantOf('a5e-ag_urchin'), { kind: 'tools', fixed: ['disguise_kit', 'thieves_tools'], chooseFrom: [], chooseCount: 0 })

  const criminal = grantOf('a5e-ag_criminal')
  assert.deepEqual(criminal.fixed, ['thieves_tools'])
  assert.equal(criminal.chooseFrom.length, 4) // gaming-set inteiro
  assert.equal(criminal.chooseCount, 1)

  const farmer = grantOf('a5e-ag_farmer')
  assert.equal(farmer.fixed.length, 5) // land: carriage, cart, chariot, sled, wagon
  assert.deepEqual(farmer.chooseFrom, [])
  assert.deepEqual(farmer.fixed.sort(), ['carriage', 'cart', 'chariot', 'sled', 'wagon'])

  const sailor = grantOf('a5e-ag_sailor')
  assert.equal(sailor.fixed.length, 7) // navigators_tools + 6 water
  assert.ok(sailor.fixed.includes('navigators_tools'))
  assert.deepEqual(sailor.fixed.filter((k) => k !== 'navigators_tools').sort(), ['galley', 'keelboat', 'longship', 'rowboat', 'sailing_ship', 'warship'])

  const trader = grantOf('a5e-ag_trader')
  assert.equal(trader.chooseFrom.length, 11) // vehicle inteiro, sem restrição terrestre/aquática
  assert.equal(trader.chooseCount, 1)

  const noble = grantOf('a5e-ag_noble')
  assert.equal(noble.chooseFrom.length, 4)
  const soldier = grantOf('a5e-ag_soldier')
  assert.deepEqual(soldier.chooseFrom, noble.chooseFrom)

  const artisanBg = grantOf('a5e-ag_artisan')
  assert.equal(artisanBg.chooseFrom.length, 17) // smith's tools já dentro da categoria, sem duplicar
  assert.equal(artisanBg.chooseCount, 1)

  const marauder = grantOf('a5e-ag_marauder')
  assert.equal(marauder.chooseFrom.length, 28) // 17 artisan + 11 vehicle
  assert.equal(marauder.chooseCount, 1)

  const guildmember = grantOf('a5e-ag_guildmember')
  assert.equal(guildmember.chooseFrom.length, 38) // 17 artisan + 10 musical-instrument + 11 vehicle
  assert.equal(guildmember.chooseCount, 1)

  const folkHero = grantOf('a5e-ag_folk-hero')
  assert.equal(folkHero.chooseFrom.length, 28) // 17 artisan + 11 vehicle, união dos 2 slots
  assert.equal(folkHero.chooseCount, 2)
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
