import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parseD10Tables } from './parseD10Tables'

// US-124 — o parser contra o dado REAL, não contra fixture escrita à mão.
//
// Existe por causa de dois bugs de produção seguidos (12/08/2026), ambos invisíveis para
// `parseD10Tables.test.ts`: (1) a fixture inicial saiu do EXEMPLO do doc (US-124 §Contexto),
// que na transcrição para code-fence perdeu `\r\n` e a linha em branco entre heading e tabela;
// (2) depois de corrigir isso contra o dataset CRU, ainda quebrava — porque o que a tela lê não
// é o dataset cru, e sim o `config` gerado pelo ingest, cujo `norm()`
// (scripts/srd/ingest.mjs:141) achata TODA quebra de linha numa linha só.
//
// A lição das duas: fixture prova a forma que se ASSUME; só o artefato prova a que existe.
// Este teste lê os dois lados — o artefato consumido (`srd-5e.config.<locale>.json`, o que o
// seed grava e a criação lê) e o dataset cru (o que o ingest recebe) — para que uma mudança em
// qualquer um dos dois falhe aqui, e não na tela do jogador.
const SRD = join(process.cwd(), '..', '..', 'scripts', 'srd')

/** Origens com bloco único, medidas no dataset (US-124 §Contexto, armadilha 1). */
const SINGLE_BLOCK = new Set(['a5e-ag_sailor'])

function check(key: string, description: string): string | undefined {
  const { tables } = parseD10Tables(description)
  const counts = tables.map((t) => t.rows.length)
  const expectedBlocks = SINGLE_BLOCK.has(key) ? 1 : 2
  if (tables.length !== expectedBlocks || counts.some((c) => c !== 10)) {
    return `${key}: ${tables.length} bloco(s) [${counts.join(',')}]`
  }
  return undefined
}

describe('parseD10Tables — dado real (US-124)', () => {
  // Os dois locales: o pt-BR passa por tradução automática (US-52 `MT_DOMAINS`), que já comeu
  // o pipe de fechamento do último item em a5e-ag_criminal/a5e-ag_cultist. É a Questão em
  // aberto 1 da US-124 virando teste em vez de suposição.
  for (const locale of ['en-US', 'pt-BR']) {
    it(`config ${locale}: as 21 origens dão 2 blocos de 10 linhas (1 no Sailor)`, () => {
      const config = JSON.parse(readFileSync(join(SRD, `srd-5e.config.${locale}.json`), 'utf8'))
      const problems = config.backgrounds
        .map((bg: { key: string; benefits: { type: string; description: string }[] }) => {
          const cam = bg.benefits.find((b) => b.type === 'connection_and_memento')
          return cam ? check(bg.key, cam.description) : undefined
        })
        .filter(Boolean)
      expect(problems).toEqual([])
    })
  }

  // `_data/` é gitignored (US-47) e o CI nunca roda `srd:sync` (I/O externo de propósito,
  // ver .github/workflows/ci.yml) — só existe em quem já rodou o sync localmente. skipIf em
  // vez de falhar: ENOENT aqui não é regressão, é ambiente sem o dataset cru baixado.
  const rawPath = join(SRD, '_data', 'BackgroundBenefit.json')
  it.skipIf(!existsSync(rawPath))('dataset cru (multi-linha, antes do norm do ingest) parseia igual', () => {
    const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
    const problems = raw
      .filter((i: { fields: { type: string } }) => i.fields.type === 'connection_and_memento')
      .map((i: { fields: { parent: string; desc: string } }) => check(i.fields.parent, i.fields.desc))
      .filter(Boolean)
    expect(problems).toEqual([])
  })
})
