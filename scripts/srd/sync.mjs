// US-47 — sync: baixa o dataset SRD do Open5e PINADO numa tag (reprodutível, nunca `main`).
// Reprodutibilidade > frescor: bump de tag é um PR, com o diff do artefato mostrando o que mudou.
// Grava em scripts/srd/_data/ (gitignored — só os artefatos derivados srd-5e.config.<locale>.json entram no repo).
// Fonte: open5e/open5e-api, CC-BY-4.0 (WotC / SRD 5.2). Ver NOTICE-open5e.md.
//
// Uso: node scripts/srd/sync.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// A versão registrada no repo. Trocar aqui é a decisão de bump (revisada pelo diff do artefato).
export const TAG = 'v2.1.0'

const RAW = `https://raw.githubusercontent.com/open5e/open5e-api/${TAG}/data/v2`
const SRD = `${RAW}/wizards-of-the-coast/srd-2024`
const CORE = `${RAW}/open5e/core`

// [url, nome local]. A âncora de perícia (`ability`) só existe no doc `core`/Skill.json;
// a srd-2024/SkillDescription não a traz (só `describes` + desc). Ver ingest.mjs.
const FILES = [
  [`${SRD}/AbilityDescription.json`, 'AbilityDescription.json'],
  [`${CORE}/Skill.json`, 'Skill.json'],
  [`${SRD}/CharacterClass.json`, 'CharacterClass.json'],
  [`${SRD}/ClassFeature.json`, 'ClassFeature.json'],
  [`${SRD}/ClassFeatureItem.json`, 'ClassFeatureItem.json'],
  [`${SRD}/Spell.json`, 'Spell.json'],
]

const OUT = join(dirname(fileURLToPath(import.meta.url)), '_data')

async function main() {
  await mkdir(OUT, { recursive: true })
  console.log(`Sync Open5e @ ${TAG} → ${OUT}`)
  for (const [url, name] of FILES) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
    const text = await res.text()
    JSON.parse(text) // falha cedo se vier HTML de erro / tarball movido
    await writeFile(join(OUT, name), text)
    console.log(`  ${name}  (${text.length} bytes)`)
  }
  await writeFile(join(OUT, '.source'), `open5e/open5e-api ${TAG}\nCC-BY-4.0 (WotC / SRD 5.2)\n`)
  console.log('OK. Rode: node scripts/srd/ingest.mjs')
}

main().catch((e) => {
  console.error('sync falhou:', e.message)
  process.exit(1)
})
