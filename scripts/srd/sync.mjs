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
// ADR 009: o SRD 5.1 é IRMÃO do 5.2 no mesmo repositório, no mesmo tag — não é outra
// dependência nem outra licença (dual CC-BY-4.0 / OGL 1.0a; usamos a via CC-BY).
// A fusão (com o 5.2 vencendo) acontece no ingest.
const SRD_2014 = `${RAW}/wizards-of-the-coast/srd-2014`
const CORE = `${RAW}/open5e/core`
// US-121: primeiro documento fora de wizards-of-the-coast/*. Publisher EN Publishing, dual
// CC-BY-4.0/OGL 1.0a — usado pela via CC-BY-4.0 (mesmo padrão do SRD 5.1, ADR 009), mesmo
// repositório Open5e e mesmo TAG pinado. Ver NOTICE-open5e.md e ADR 004 §3.3.
const A5E_AG = `${RAW}/en-publishing/a5e-ag`

// [url, nome local]. A âncora de perícia (`ability`) só existe no doc `core`/Skill.json;
// a srd-2024/SkillDescription não a traz (só `describes` + desc). Ver ingest.mjs.
//
// US-138 (ADR 009 §8): `Species` do 5.1 é agora a ÚNICA fonte de `config.races` — o par 5.2
// (`srd-2024/Species.json`) saiu do sync porque nada mais o consome (era só `buildRaces`,
// via US-105/ADR 009 D2, revertida). O sufixo `.2014` no arquivo local é herança de quando os
// dois pares existiam lado a lado; mantido pra não mexer no nome que `ingest.mjs` já lê.
//
// US-139 (ADR 009 §8): mesma reversão em `classes`/`classFeatures`/`classSpells` — `CharacterClass.json`,
// `ClassFeature.json`, `ClassFeatureItem.json` e `Spell.json` locais viram os do `srd-2014` (as 12
// bases são idênticas entre edições, ADR 009 §4, só o `pk` muda de prefixo). O par 5.2 sai do sync por
// completo — nada mais o lê, mesma decisão de "troca de fonte, não união" da US-138 pra `races`; sem
// par 5.2 sobrevivendo, os quatro nomes locais não colidem e não precisam de sufixo `.2014`. O Marshal
// (`a5e-ag`) entra pelos MESMOS três documentos, mesmo publisher/licença que `Background`/`BackgroundBenefit`
// (US-121) — sufixados `.a5e-ag` porque, ao contrário de `races`, aqui os DOIS pares (5.1 + a5e-ag)
// convivem no artefato (fusão por `main()`, não por `mergeEditions` — ver `ingest.mjs`).
//
// US-108: `Rule.json` traz o TEXTO normativo das regras (56 no v2.1.0), entre elas a tabela
// de modificadores de habilidade. Ele não alimenta o `config` — só o artefato derivado
// `ability-modifiers.srd-2024.json`, que é oráculo de teste, não caminho de execução.
const FILES = [
  [`${SRD}/AbilityDescription.json`, 'AbilityDescription.json'],
  [`${SRD}/Rule.json`, 'Rule.json'],
  // US-134: mesmo documento srd-2024 de AbilityDescription/CharacterClass — sem tag nova,
  // sem entrada nova em NOTICE-open5e.md. Catálogo de ferramentas/veículos (config.tools).
  [`${SRD}/Item.json`, 'Item.json'],
  [`${CORE}/Skill.json`, 'Skill.json'],
  [`${SRD_2014}/CharacterClass.json`, 'CharacterClass.json'],
  [`${SRD_2014}/Species.json`, 'Species.2014.json'],
  [`${SRD_2014}/ClassFeature.json`, 'ClassFeature.json'],
  [`${SRD_2014}/ClassFeatureItem.json`, 'ClassFeatureItem.json'],
  [`${SRD_2014}/Spell.json`, 'Spell.json'],
  [`${A5E_AG}/Background.json`, 'Background.json'],
  [`${A5E_AG}/BackgroundBenefit.json`, 'BackgroundBenefit.json'],
  [`${A5E_AG}/CharacterClass.json`, 'CharacterClass.a5e-ag.json'],
  [`${A5E_AG}/ClassFeature.json`, 'ClassFeature.a5e-ag.json'],
  [`${A5E_AG}/ClassFeatureItem.json`, 'ClassFeatureItem.a5e-ag.json'],
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
  await writeFile(join(OUT, '.source'), `open5e/open5e-api ${TAG}\nCC-BY-4.0 (WotC / SRD 5.2 + SRD 5.1)\n`)
  console.log('OK. Rode: node scripts/srd/ingest.mjs')
}

// Guard de entrypoint (US-108): o ingest.mjs importa `TAG` daqui para gravar a procedência
// do artefato derivado. Sem isto, o import baixaria o dataset inteiro como efeito colateral.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('sync falhou:', e.message)
    process.exit(1)
  })
}
