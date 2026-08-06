// US-110 — extrai as tabelas de exemplo do ruleset `srd-2024_d20-tests` (`Rule.json` do
// Open5e, baixado pelo sync.mjs) para o artefato que o system prompt do Mestre consome.
//
// O que a story compra: hoje a única orientação sobre QUAL teste rolar é "pick the single
// most relevant skill" — relevante segundo a memória do modelo. A tabela *Ability Check
// Examples* é a régua normativa da escolha, e ela vira bloco de prompt. Ver US-110.
//
// O artefato é gravado DENTRO de packages/ai-engine (não aqui, ao lado dos outros
// derivados): ele tem consumidor de runtime — o builder do prompt o importa como JSON —, e
// importar de fora do pacote arrastaria o `rootDir` do tsc (a armadilha documentada na
// US-108). Procedência e licença viajam dentro do próprio arquivo, no bloco `source`.
//
// Módulo separado do ingest.mjs pelo mesmo motivo da US-108: aquele já passa de 500 linhas,
// e aqui não há overlay, locale nem SystemConfig.

import { requireRule, toAscii } from './ability-modifiers.mjs'

// As três regras do ruleset que esta story lê. A quarta (`_advantage-disadvantage`) não é
// tabela e não é termo de soma — fica para a story de vantagem/desvantagem.
const ABILITY_CHECKS_PK = 'srd-2024_d20-tests_ability-checks'
const SAVING_THROWS_PK = 'srd-2024_d20-tests_saving-throw'
const ATTACK_ROLLS_PK = 'srd-2024_d20-tests_attack-rolls'

const RULESET = 'srd-2024_d20-tests'
const DOCUMENT = 'srd-2024'
const LICENSE = 'CC-BY-4.0'

/** Ataque mágico não tem atributo fixo no SRD — a tabela escreve "Varies" na coluna. */
const VARIES = 'varies'

/**
 * Tabelas markdown embutidas no `desc`, SEPARADAS. A regra dos exemplos de teste traz duas
 * (exemplos + Classes de Dificuldade); achatar todas as linhas `|…|` do campo numa lista só
 * — como faz o leitor da US-108, que lê um `desc` de tabela única — daria 12 "exemplos",
 * metade deles CD. Cada corrida de linhas `|…|` consecutivas é uma tabela; a primeira linha
 * da corrida é o cabeçalho.
 */
function markdownTables(desc) {
  const tables = []
  let current = null
  for (const raw of toAscii(desc).split('\n')) {
    const line = raw.trim()
    if (!line.startsWith('|') || !line.endsWith('|')) {
      current = null
      continue
    }
    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim())
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue
    if (current) current.rows.push(cells)
    else {
      current = { header: cells, rows: [] }
      tables.push(current)
    }
  }
  return tables
}

/** A tabela cujo cabeçalho começa por `heading` (case-insensitive), ou erro com o `pk`. */
function requireTable(rules, pk, heading) {
  const desc = requireRule(rules, pk).fields.desc
  const found = markdownTables(desc).find((t) => t.header[0]?.toLowerCase() === heading.toLowerCase())
  if (!found?.rows.length) {
    throw new Error(`Regra ${pk}: nenhuma tabela com cabeçalho "${heading}" no campo desc (bump de tag mudou o formato? ver scripts/srd/sync.mjs)`)
  }
  return found.rows
}

/**
 * Linhas `|Habilidade|Exemplo|` → `[{ ability, example }]`, com a habilidade na chave
 * CANÔNICA do catálogo ("Strength" → `strength`, que é a chave do config e do `Skill.json`
 * depois do ABILITY_MAP). Habilidade que o config não conhece falha: tabela e catálogo
 * discordando é bump silencioso, e o prompt renderizaria a chave crua como se fosse atributo.
 */
function abilityRows(rows, pk, attributeKeys, { allowVaries = false } = {}) {
  const known = new Set(attributeKeys)
  return rows.map(([name, example]) => {
    const ability = String(name).toLowerCase()
    if (allowVaries && ability === VARIES) return { ability: null, example }
    if (!known.has(ability)) {
      throw new Error(`Regra ${pk}: habilidade "${name}" não existe no catálogo de atributos (${[...known].join(', ')})`)
    }
    return { ability, example }
  })
}

/**
 * As 6 habilidades precisam estar TODAS na tabela, uma vez cada. Linha perdida deixaria uma
 * habilidade sem exemplo — e o modelo sem régua justamente naquela; a checagem de cobertura
 * pega isso e também a troca (duas linhas de Sabedoria, nenhuma de Inteligência).
 */
function assertCoversAbilities(rows, pk, attributeKeys) {
  const seen = rows.map((r) => r.ability)
  const missing = attributeKeys.filter((key) => !seen.includes(key))
  if (missing.length || seen.length !== attributeKeys.length) {
    throw new Error(`Regra ${pk}: tabela cobre ${seen.length} habilidade(s) ${JSON.stringify(seen)}; faltando: ${missing.join(', ') || 'nenhuma'}`)
  }
}

/** Linhas `|Dificuldade|CD|` → `[{ task, dc }]`. */
function difficultyRows(rows, pk) {
  return rows.map(([task, dc]) => {
    if (!/^\d+$/.test(dc)) throw new Error(`Regra ${pk}: CD ilegível "${dc}" para "${task}" (esperado inteiro)`)
    return { task, dc: Number(dc) }
  })
}

/**
 * Registros crus do `Rule.json` → artefato do d20 test. `attributeKeys` são as chaves
 * canônicas do catálogo já construído pelo ingest: passá-las (em vez de repetir o
 * ABILITY_MAP aqui) faz a tabela ser conferida CONTRA o config, não contra uma constante
 * paralela que pode divergir dele.
 */
export function parseD20Tests(rules, tag, attributeKeys) {
  const abilityChecks = abilityRows(requireTable(rules, ABILITY_CHECKS_PK, 'Ability'), ABILITY_CHECKS_PK, attributeKeys)
  assertCoversAbilities(abilityChecks, ABILITY_CHECKS_PK, attributeKeys)

  const savingThrows = abilityRows(requireTable(rules, SAVING_THROWS_PK, 'Ability'), SAVING_THROWS_PK, attributeKeys)
  assertCoversAbilities(savingThrows, SAVING_THROWS_PK, attributeKeys)

  const attackRolls = abilityRows(requireTable(rules, ATTACK_ROLLS_PK, 'Ability'), ATTACK_ROLLS_PK, attributeKeys, { allowVaries: true })
  const difficultyClasses = difficultyRows(requireTable(rules, ABILITY_CHECKS_PK, 'Task Difficulty'), ABILITY_CHECKS_PK)

  return {
    source: { document: DOCUMENT, license: LICENSE, ruleset: RULESET, rules: [ABILITY_CHECKS_PK, SAVING_THROWS_PK, ATTACK_ROLLS_PK], tag },
    abilityChecks,
    savingThrows,
    attackRolls,
    difficultyClasses,
  }
}
