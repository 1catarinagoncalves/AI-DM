// US-108 — extrai a tabela de modificadores de habilidade do texto normativo do SRD 2024
// (`Rule.json` do Open5e, baixado pelo sync.mjs) para o artefato versionado
// `ability-modifiers.srd-2024.json`.
//
// O artefato NÃO é caminho de execução: `abilityModifier()` continua sendo a fórmula de uma
// linha do 5e (`floor((score - 10) / 2)`), que reproduz as 16 faixas exatamente. A tabela é o
// ORÁCULO do teste (packages/shared/src/ability.test.ts) e a fonte da referência em
// docs/sdlc/01-requisitos/modificadores-atributos.md. Ver US-108 → "A proposta".
//
// Módulo separado do ingest.mjs por tamanho (aquele já passa de 500 linhas) e por
// responsabilidade: aqui não há overlay, locale nem SystemConfig.

// As duas regras da ruleset `srd-2024_the-six-abilities` que esta story consome. Os `pk`
// entram no artefato (bloco `source`) e nas mensagens de erro: é por eles que se descobre o
// que um bump de tag renomeou.
const ABILITY_SCORES_PK = 'srd-2024_the-six-abilities_ability-scores'
const ABILITY_MODIFIERS_PK = 'srd-2024_the-six-abilities_ability-modifiers'

const DOCUMENT = 'srd-2024'
const LICENSE = 'CC-BY-4.0'

// O texto do Open5e usa tipografia, não ASCII: o modificador vem com U+2212 MINUS SIGN
// (`−5`) e a faixa com U+2013 EN DASH (`2–3`). `Number('−5')` devolve NaN — normalizar os
// dois é o primeiro passo de qualquer leitura desta tabela.
// US-110: exportado porque o leitor das tabelas do d20 test (d20-tests.mjs) lê o MESMO
// campo do MESMO arquivo — dois normalizadores de tipografia é como um deles fica para trás.
export const toAscii = (text) => text.replace(/−/g, '-').replace(/–/g, '-')

/** US-110: exportado pelo mesmo motivo do `toAscii` — "regra ausente" é a mesma falha nos dois. */
export function requireRule(rules, pk) {
  const found = rules.find((r) => r.pk === pk)
  if (!found?.fields?.desc) {
    throw new Error(`Regra ausente ou sem texto no dataset: ${pk} (bump de tag renomeou ou removeu? ver scripts/srd/sync.mjs)`)
  }
  return found
}

/** Células das linhas de dado da tabela markdown embutida no `desc` (sem cabeçalho nem separador). */
function tableRows(desc, pk) {
  const rows = toAscii(desc)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
    .filter(([first]) => !/^:?-{3,}:?$/.test(first) && first.toLowerCase() !== 'score')
  if (!rows.length) throw new Error(`Regra ${pk}: nenhuma linha de tabela no campo desc (esperado markdown "|Score|…|")`)
  return rows
}

function parseSpan(cell, pk) {
  const match = /^(\d+)(?:-(\d+))?$/.exec(cell)
  if (!match) throw new Error(`Regra ${pk}: faixa de pontuação ilegível "${cell}" (esperado "12" ou "12-13")`)
  return { scoreMin: Number(match[1]), scoreMax: Number(match[2] ?? match[1]) }
}

function parseModifier(cell, pk) {
  if (!/^[+-]?\d+$/.test(cell)) throw new Error(`Regra ${pk}: modificador ilegível "${cell}" (esperado "+2", "0" ou "-1")`)
  return Number(cell)
}

/**
 * A tabela precisa cobrir a faixa inteira sem buraco e sem sobreposição: ela é o oráculo do
 * teste do `abilityModifier`, e faixa perdida some sem erro nenhum — o teste passaria a não
 * conferir justamente aqueles valores.
 */
function assertCoversRange(rows, range) {
  const first = rows[0]
  const last = rows.at(-1)
  if (first.scoreMin !== range.min || last.scoreMax !== range.max) {
    throw new Error(
      `Tabela de modificadores cobre ${first.scoreMin}–${last.scoreMax}, mas a faixa do SRD é ${range.min}–${range.max} (${ABILITY_SCORES_PK})`,
    )
  }
  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1]
    const current = rows[i]
    if (current.scoreMin !== previous.scoreMax + 1) {
      throw new Error(
        `Tabela de modificadores: buraco ou sobreposição — depois de ${previous.scoreMax} vem ${current.scoreMin} (esperado ${previous.scoreMax + 1})`,
      )
    }
  }
}

/**
 * Registros crus do `Rule.json` → `{ source, range, rows }`. `tag` é a do sync (a procedência
 * que torna o bump auditável no diff).
 *
 * A faixa válida (1–30) sai da tabela de SIGNIFICADO da pontuação, não de constante daqui: é
 * ela que diz que 30 é o teto absoluto, e é ela que mudaria se uma edição mudasse o teto.
 */
export function parseAbilityModifiers(rules, tag) {
  const spans = tableRows(requireRule(rules, ABILITY_SCORES_PK).fields.desc, ABILITY_SCORES_PK).map(([cell]) =>
    parseSpan(cell, ABILITY_SCORES_PK),
  )
  const range = { min: Math.min(...spans.map((s) => s.scoreMin)), max: Math.max(...spans.map((s) => s.scoreMax)) }

  const rows = tableRows(requireRule(rules, ABILITY_MODIFIERS_PK).fields.desc, ABILITY_MODIFIERS_PK)
    .map(([score, modifier]) => ({
      ...parseSpan(score, ABILITY_MODIFIERS_PK),
      modifier: parseModifier(modifier, ABILITY_MODIFIERS_PK),
    }))
    .sort((a, b) => a.scoreMin - b.scoreMin)
  assertCoversRange(rows, range)

  return { source: { document: DOCUMENT, license: LICENSE, rules: [ABILITY_MODIFIERS_PK, ABILITY_SCORES_PK], tag }, range, rows }
}
