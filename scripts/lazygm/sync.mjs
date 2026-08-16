// US-145 — sync: baixa o Lazy GM Resource Document (LGMRD) e o 5e_Monster_Builder.json
// PINADOS num commit SHA fixo (reprodutível, nunca `main`/`HEAD`) e gera NOTICE-lazygm.md
// a partir do campo `attribution` de cada JSON.
// Grava dado cru em scripts/lazygm/_data/ (gitignored); NOTICE-lazygm.md é versionado.
// Fonte: crit-tech/LGMRD, CC-BY-4.0 (Michael Shea/SlyFlourish + SRD 5.1/WotC). Ver NOTICE-lazygm.md.
//
// Uso: node scripts/lazygm/sync.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Commit mais recente a tocar LGMRD.json OU 5e_Monster_Builder.json em crit-tech/LGMRD,
// resolvido em 16/08/2026 via GitHub API (`GET /repos/crit-tech/LGMRD/commits?path=<arquivo>`
// para cada arquivo, o mais recente dos dois venceu — equivalente a `git log -1 --format=%H --
// LGMRD.json 5e_Monster_Builder.json` num clone, sem precisar clonar). O repo não publica tag
// semver (workflow nightly, ver US-145). Trocar aqui é a decisão de bump.
export const SHA = 'c3d93cf91f84ac7726028d704e16320e0fa337b5'

const RAW = `https://raw.githubusercontent.com/crit-tech/LGMRD/${SHA}`

const FILES = [
  [`${RAW}/LGMRD.json`, 'LGMRD.json'],
  [`${RAW}/5e_Monster_Builder.json`, '5e_Monster_Builder.json'],
]

const OUT = join(dirname(fileURLToPath(import.meta.url)), '_data')
const NOTICE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'NOTICE-lazygm.md')

function quoteBlock(text) {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n')
}

// Concatena o `attribution` verbatim dos dois JSONs (cada um já embute a atribuição da
// SRD 5.1/WotC) — sem parser, sem varredura recursiva, campo top-level já pronto (US-145).
export function buildNotice({ lgmrd, monsterBuilder }) {
  return `# Atribuição — Lazy GM Resource Document + Lazy GM's 5e Monster Builder

Gerado por \`sync.mjs\` a partir do campo \`attribution\` de \`LGMRD.json\` e
\`5e_Monster_Builder.json\` — não editar à mão. Os dois artefatos são baixados por
commit fixo (constante \`SHA\` em [\`sync.mjs\`](./sync.mjs)) do repositório
[crit-tech/LGMRD](https://github.com/crit-tech/LGMRD) e consumidos pelo motor de
geração de aventuras (US-147 em diante). O dado cru não é versionado
(\`scripts/lazygm/_data/\`, gitignored) — baixe com \`node scripts/lazygm/sync.mjs\`.

## Licença

Creative Commons Attribution 4.0 International (CC-BY-4.0). Texto da licença:
<https://creativecommons.org/licenses/by/4.0/legalcode>.

## Atribuição exigida

Texto verbatim do campo \`attribution\` de cada JSON, sem parafrasear (inclusive
erros de digitação da fonte).

### Lazy GM Resource Document

${quoteBlock(lgmrd)}

### Lazy GM's 5e Monster Builder

${quoteBlock(monsterBuilder)}

## Escopo e limites

- **Licença única.** Todo o dado é CC-BY-4.0 — nenhum material OGL 1.0a entra aqui.
- **Marcas não licenciadas.** A CC-BY-4.0 cobre o texto, não marcas da Wizards of
  the Coast nem de SlyFlourish, Alphastream ou Insaneangel.
`
}

async function main() {
  await mkdir(OUT, { recursive: true })
  console.log(`Sync LGMRD @ ${SHA} → ${OUT}`)
  const attribution = {}
  for (const [url, name] of FILES) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
    const text = await res.text()
    const data = JSON.parse(text) // falha cedo se vier HTML de erro
    attribution[name] = data.attribution
    await writeFile(join(OUT, name), text)
    console.log(`  ${name}  (${text.length} bytes)`)
  }
  await writeFile(join(OUT, '.source'), `crit-tech/LGMRD ${SHA}\nCC-BY-4.0 (SlyFlourish + SRD 5.1/WotC)\n`)
  await writeFile(
    NOTICE_PATH,
    buildNotice({ lgmrd: attribution['LGMRD.json'], monsterBuilder: attribution['5e_Monster_Builder.json'] }),
  )
  console.log('  NOTICE-lazygm.md')
}

// Guard de entrypoint (mesmo padrão do sync.mjs do SRD): permite importar SHA/buildNotice
// sem disparar o download como efeito colateral.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('sync falhou:', e.message)
    process.exit(1)
  })
}
