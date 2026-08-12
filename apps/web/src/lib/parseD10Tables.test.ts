import { describe, it, expect } from 'vitest'
import { parseD10Tables } from './parseD10Tables'

// US-124: fixtures espelham a forma real do dataset (medido no Acolyte, 08/08/2026) —
// preâmbulo, heading em nível MISTO (#### na 1ª tabela, ### na 2ª) e tabela d10 de 2 colunas.
const ACOLYTE = `Roll 1d10, choose, or make up your own.

#### Acolyte Connections
|d10|Connection|
|---|---|
|1|A beloved high priest or priestess awaiting your return to the temple.|
|2|A childhood friend who left the priesthood.|
|3|A rival acolyte competing for the same promotion.|

### Acolyte Memento
|d10|Memento|
|---|---|
|1|The timeworn holy symbol bequeathed to you by your beloved mentor.|
|2|A prayer book with handwritten notes in the margins.|
`

// US-124 §Contexto: anomalia real — a tabela "Sailor Mementos" aparece DUAS vezes, com as
// mesmas linhas, e "Sailor Connections" não existe. O parser deduplica (bloco idêntico ao
// anterior é descartado), senão a 2ª cópia ocuparia a posição de "conexão".
const SAILOR = `Roll 1d10, choose, or make up your own.

### Sailor Mementos
|d10|Memento|
|---|---|
|1|A compass that always points toward the sea.|
|2|A tattoo commemorating your first voyage.|

### Sailor Mementos
|d10|Memento|
|---|---|
|1|A compass that always points toward the sea.|
|2|A tattoo commemorating your first voyage.|
`

// US-124: forma REAL do dataset (medido 12/08/2026, scripts/srd/_data/BackgroundBenefit.json,
// a5e-ag_acolyte_connection-and-memento) — CRLF e uma linha em BRANCO entre o heading e a
// tabela. As fixtures acima (sem essa linha em branco) não pegavam essa regressão: o parser
// fechava o bloco na linha em branco antes de ler qualquer `|N|texto|`, produzindo 0 rows.
const ACOLYTE_REAL_SHAPE =
  'Roll 1d10, choose, or make up your own.\r\n\r\n#### Acolyte Connections\r\n\r\n' +
  '|d10|Connection|\r\n|---|---|\r\n' +
  '|1|A beloved high priest awaiting your return to the temple.|\r\n' +
  '|2|A former priest who swore revenge before fleeing.|\r\n\r\n' +
  '### Acolyte Memento\r\n\r\n' +
  '|d10|Memento|\r\n|---|---|\r\n' +
  '|1|The timeworn holy symbol bequeathed to you by your mentor.|\r\n'

// US-124: forma REALMENTE CONSUMIDA em produção — `norm()` do ingest
// (scripts/srd/ingest.mjs:141) achata toda quebra de linha, então `config.backgrounds[]
// .benefits[].description` chega numa LINHA SÓ. Copiado do artefato real
// (scripts/srd/srd-5e.config.en-US.json, a5e-ag_artisan, 12/08/2026). Esta é a fixture que
// faltava: as multi-linha abaixo vinham do dataset CRU, que nenhuma tela lê.
const ARTISAN_FLATTENED =
  'Roll 1d10, choose, or make up your own. #### Artisan Connections |d10|Connection| |---|---| ' +
  '|1|The cruel master who worked you nearly to death.| |2|The kind master who taught you the trade.| ' +
  '#### Artisan Mementos |d10|Memento| |---|---| ' +
  '|1|A set of artisan tools bequeathed by your master.| |2|An unfinished master work.|'

// pt-BR real: a tradução comeu o `|` de fechamento do ÚLTIMO item (medido em a5e-ag_criminal
// e a5e-ag_cultist) — exigir o pipe final descartava a 10ª linha dessas duas origens.
const FLATTENED_LAST_ROW_UNCLOSED =
  'Role 1d10, escolha ou crie a sua própria. #### Recordações Criminosas |d10|Recordação| |---|---| ' +
  '|1|Uma chave dourada para a qual você não descobriu a fechadura.| ' +
  '|2|Um manuscrito escrito por seu mentor.'

describe('parseD10Tables (US-124)', () => {
  it('extrai as linhas do texto ACHATADO pelo ingest (forma real do config, uma linha só)', () => {
    const { tables } = parseD10Tables(ARTISAN_FLATTENED)
    expect(tables).toHaveLength(2)
    expect(tables[0]!.rows).toEqual([
      { roll: '1', text: 'The cruel master who worked you nearly to death.' },
      { roll: '2', text: 'The kind master who taught you the trade.' },
    ])
    expect(tables[1]!.rows).toEqual([
      { roll: '1', text: 'A set of artisan tools bequeathed by your master.' },
      { roll: '2', text: 'An unfinished master work.' },
    ])
  })

  it('não perde o último item quando a tradução comeu o pipe de fechamento (pt-BR real)', () => {
    const { tables } = parseD10Tables(FLATTENED_LAST_ROW_UNCLOSED)
    expect(tables[0]!.rows).toEqual([
      { roll: '1', text: 'Uma chave dourada para a qual você não descobriu a fechadura.' },
      { roll: '2', text: 'Um manuscrito escrito por seu mentor.' },
    ])
  })

  it('lista numerada também achatada numa linha só (Gambler, forma do config)', () => {
    const { tables } = parseD10Tables(
      'Roll 1d10, choose, or make up your own. #### Gambler Connections 1. The mentor you have now surpassed. 2. The duelist who will never forgive you.',
    )
    expect(tables[0]!.rows).toEqual([
      { roll: '1', text: 'The mentor you have now surpassed.' },
      { roll: '2', text: 'The duelist who will never forgive you.' },
    ])
  })

  it('extrai as linhas mesmo com CRLF e linha em branco entre heading e tabela (forma real do dataset)', () => {
    const { tables } = parseD10Tables(ACOLYTE_REAL_SHAPE)
    expect(tables).toHaveLength(2)
    expect(tables[0]!.rows).toEqual([
      { roll: '1', text: 'A beloved high priest awaiting your return to the temple.' },
      { roll: '2', text: 'A former priest who swore revenge before fleeing.' },
    ])
    expect(tables[1]!.rows).toEqual([
      { roll: '1', text: 'The timeworn holy symbol bequeathed to you by your mentor.' },
    ])
  })

  it('extrai os 2 blocos do Acolyte, com heading em nível misto (#### e ###)', () => {
    const { tables } = parseD10Tables(ACOLYTE)
    expect(tables).toHaveLength(2)
    expect(tables[0]!.rows).toEqual([
      { roll: '1', text: 'A beloved high priest or priestess awaiting your return to the temple.' },
      { roll: '2', text: 'A childhood friend who left the priesthood.' },
      { roll: '3', text: 'A rival acolyte competing for the same promotion.' },
    ])
    expect(tables[1]!.rows).toEqual([
      { roll: '1', text: 'The timeworn holy symbol bequeathed to you by your beloved mentor.' },
      { roll: '2', text: 'A prayer book with handwritten notes in the margins.' },
    ])
  })

  it('não retorna heading nem preâmbulo — só tables[].rows', () => {
    const result = parseD10Tables(ACOLYTE)
    expect(result).toEqual({ tables: expect.any(Array) })
    expect(Object.keys(result)).toEqual(['tables'])
    for (const table of result.tables) {
      expect(Object.keys(table)).toEqual(['rows'])
    }
  })

  it('Sailor: as duas cópias idênticas de "Mementos" viram UM bloco só (nenhuma vira conexão)', () => {
    const { tables } = parseD10Tables(SAILOR)
    expect(tables).toHaveLength(1)
    expect(tables[0]!.rows).toEqual([
      { roll: '1', text: 'A compass that always points toward the sea.' },
      { roll: '2', text: 'A tattoo commemorating your first voyage.' },
    ])
  })

  it('texto sem heading/tabela nenhuma → 0 blocos, sem lançar', () => {
    expect(parseD10Tables('Just prose, no table here.')).toEqual({ tables: [] })
    expect(parseD10Tables('')).toEqual({ tables: [] })
  })

  it('ignora a linha de cabeçalho (|d10|...|) e a de separador (|---|---|) como dado', () => {
    const { tables } = parseD10Tables(SAILOR)
    expect(tables[0]!.rows.every((r) => r.roll !== 'd10' && r.roll !== '---')).toBe(true)
  })

  // US-124: segunda anomalia real do dataset (12/08/2026, a5e-ag_gambler) — os dois blocos
  // usam LISTA NUMERADA ("1. texto"), não tabela pipe. Mesmo heading, formato de linha diferente.
  it('reconhece lista numerada ("1. texto") além da tabela pipe (anomalia do Gambler)', () => {
    const GAMBLER = `Roll 1d10, choose, or make up your own.

#### Gambler Connections
1. The mentor you have now surpassed.
2. The duelist who will never forgive you for fleecing them.

#### Gambler Mementos

1. Gambling debts owed you by someone who's gone missing.
2. Your lucky coin that you've always won back after gambling it away.
`
    const { tables } = parseD10Tables(GAMBLER)
    expect(tables).toHaveLength(2)
    expect(tables[0]!.rows).toEqual([
      { roll: '1', text: 'The mentor you have now surpassed.' },
      { roll: '2', text: 'The duelist who will never forgive you for fleecing them.' },
    ])
    expect(tables[1]!.rows).toEqual([
      { roll: '1', text: "Gambling debts owed you by someone who's gone missing." },
      { roll: '2', text: 'Your lucky coin that you\'ve always won back after gambling it away.' },
    ])
  })
})
