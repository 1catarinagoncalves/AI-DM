// US-124: `connection_and_memento` é Markdown com 0-2 tabelas d10 (heading + linhas).
// Heading e preâmbulo servem só de marcador de corte — descartados, nunca retornados (a UI
// usa título/subtítulo FIXOS, não o texto do dataset, ver US-124 §Escopo).
//
// PARSE POR MARCADOR, NÃO POR LINHA (correção 12/08/2026): o `norm()` do ingest
// (`scripts/srd/ingest.mjs:141`, `replace(/\s+/g, ' ')`) achata TODA quebra de linha, então o
// que chega no `config` — e é o que esta função realmente recebe — é UMA LINHA só. Um parser
// que fizesse `split('\n')` veria uma linha, nenhum heading, zero tabelas: era o bug de
// produção. Regex sobre a string inteira funciona nas duas formas (achatada do config e
// multi-linha do dataset cru), então não depende de o ingest mudar.
const HEADING = /#{2,4}\s+/
// Duas formas de linha medidas no dataset (12/08/2026): tabela pipe (`|1|texto|`, 20 origens)
// e lista numerada (`1. texto`, só o Gambler). Não colidem — pipe começa com `|`.
//
// O `|` final é OPCIONAL (`(?:\||$)`): na tradução pt-BR o último item (`|10|texto.`) perdeu o
// pipe de fechamento em `a5e-ag_criminal` e `a5e-ag_cultist` — exigir o pipe comia a 10ª linha
// dessas duas (medido no artefato pt-BR real, não em fixture).
// `m` na lista numerada: sem ele o `$` só casa no fim da STRING, e no texto multi-linha
// (dataset cru) o último item da lista — que termina em fim de LINHA — ficava de fora.
const ROW_PIPE = /\|(\d+)\|([^|]*?)(?:\||$)/g
const ROW_LIST = /(?:^|\s)(\d+)\.\s+(.+?)(?=\s+\d+\.\s|$)/gm

export interface D10Row {
  roll: string
  text: string
}

export interface D10Table {
  rows: D10Row[]
}

function rowsOf(segment: string): D10Row[] {
  // `|d10|Connection|` (cabeçalho) e `|---|---|` (separador) não casam: a 1ª célula tem de ser
  // só dígitos. Célula vazia é descartada pelo filtro — não vira opção em branco no <select>.
  const piped = [...segment.matchAll(ROW_PIPE)].map((m) => ({ roll: m[1]!, text: m[2]!.trim() }))
  const rows = piped.length > 0 ? piped : [...segment.matchAll(ROW_LIST)].map((m) => ({ roll: m[1]!, text: m[2]!.trim() }))
  return rows.filter((r) => r.text)
}

/** Assinatura do bloco, para achar duplicata literal (ver `parseD10Tables`). */
function signature(table: D10Table): string {
  return table.rows.map((r) => `${r.roll}|${r.text}`).join('\n')
}

export function parseD10Tables(description: string): { tables: D10Table[] } {
  // Primeiro segmento é o preâmbulo ("Roll 1d10, choose…"), antes de qualquer heading — fora.
  const [, ...blocks] = description.split(HEADING)
  const tables = blocks.map((block) => ({ rows: rowsOf(block) })).filter((t) => t.rows.length > 0)
  // Bloco IDÊNTICO ao anterior é descartado: no `a5e-ag_sailor` a tabela "Sailor Mementos"
  // aparece DUAS vezes com as mesmas 10 linhas, e a de "Sailor Connections" não existe
  // (medido 12/08/2026 no dataset e nos dois artefatos de config). Sem isto, a segunda cópia
  // ocupava a posição de "conexão" e o jogador escolhia um memento achando que era conexão.
  // Comparação por CONTEÚDO, não por heading — heading é traduzido, conteúdo não engana.
  return { tables: tables.filter((t, i) => i === 0 || signature(t) !== signature(tables[i - 1]!)) }
}
