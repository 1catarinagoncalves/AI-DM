// US-52 — testes das duas peças não-triviais da camada de tradução do ingest.
// `node --test scripts/srd/ingest.test.mjs` (ou `pnpm srd:ingest:test`).
//
// Não exercita o modelo: a chamada de LLM é I/O externo e a US-52 decidiu que o gate de
// correção é glossário + revisão humana, não teste automatizado de tradução.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import { formatOverlay, flagMissingGlossaryTerms, mergeEditions } from './ingest.mjs'

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
