import { generateObject } from 'ai'
import { z } from 'zod'
import { translateModel } from './model'

// US-52 — tradução EN→pt-BR do conteúdo do SRD que o overlay curado ainda não cobre.
// Chamado pelo `scripts/srd/ingest.mjs` no BUILD, nunca em runtime de jogo.
//
// Vive DENTRO do pacote (não em scripts/) pelo mesmo motivo do narration-gen.ts: só
// aqui `ai` e `@ai-sdk/google` resolvem — o node_modules da raiz não os tem, e o
// ingest já importa dist/ de workspace por isso (ver o comentário no topo dele).

/** Entrada EN do dataset a traduzir. `key` é `<domínio>:<chave canônica do overlay>`. */
export interface SrdEntry {
  key: string
  name: string
  description: string
}

/** Termo já curado no overlay: vocabulário fixo do prompt (nível 1 da US-52). */
export interface GlossaryTerm {
  en: string
  pt: string
}

const DraftsSchema = z.object({
  entries: z.array(z.object({ key: z.string(), name: z.string(), description: z.string() })),
})

// Lote pequeno de propósito: a descrição de uma magia do SRD chega a 1900 chars
// (medido em 02/08/2026), e resposta longa demais é resposta truncada. 10 entradas
// ≈ 3k chars de saída — folgado para o flash-lite, e um lote que falha não leva os
// outros 60 junto.
const BATCH_SIZE = 10

function systemPrompt(vocabulary: string): string {
  return [
    'Você traduz conteúdo de RPG D&D 5e do inglês para o português do Brasil.',
    'Traduza `name` e `description` de cada entrada. Devolva o mesmo `key`, sem alterá-lo.',
    'Mantenha o sentido e o comprimento do original: é tradução, não resumo nem reescrita.',
    'Preserve notação de regra intacta (1d4, CD 15, 30 pés, Força, ações, condições).',
    '',
    'GLOSSÁRIO — use EXATAMENTE estes termos onde o original os usar:',
    vocabulary,
  ].join('\n')
}

/**
 * Traduz `entries` para pt-BR em lotes, devolvendo `{ [key]: { name, description } }`.
 *
 * Só volta chave que foi PEDIDA: o resultado é gravado num arquivo do repo
 * (`locale/pt-BR.json`), então chave inventada pelo modelo é lixo persistido, não
 * um erro de uma request. Chave que o modelo deixou de devolver simplesmente não
 * aparece no retorno — quem chama a trata como não-traduzida (cai no fallback EN).
 */
export async function translateSrdToPtBr(
  entries: SrdEntry[],
  glossary: GlossaryTerm[],
): Promise<Record<string, { name: string; description: string }>> {
  const vocabulary = glossary.map((t) => `${t.en} = ${t.pt}`).join('\n')
  const drafts: Record<string, { name: string; description: string }> = {}
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    const { object } = await generateObject({
      model: translateModel(),
      schema: DraftsSchema,
      system: systemPrompt(vocabulary),
      prompt: JSON.stringify({ entries: batch }),
    })
    Object.assign(drafts, pickRequested(batch, object.entries))
  }
  return drafts
}

/** Descarta o que o modelo devolveu fora do lote pedido (chave inventada ou repetida). */
export function pickRequested(
  batch: SrdEntry[],
  returned: SrdEntry[],
): Record<string, { name: string; description: string }> {
  const wanted = new Set(batch.map((e) => e.key))
  const picked: Record<string, { name: string; description: string }> = {}
  for (const e of returned) {
    if (!wanted.has(e.key) || picked[e.key]) continue
    if (!e.name.trim() || !e.description.trim()) continue
    picked[e.key] = { name: e.name.trim(), description: e.description.trim() }
  }
  return picked
}
