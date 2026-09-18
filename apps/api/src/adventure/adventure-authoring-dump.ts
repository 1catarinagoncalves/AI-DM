import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GeneratedAdventure } from '@ai-dm/shared'

// US-243: mesmo formato de authoring-<characterId>-<timestamp>.json que `run-authoring.ts`
// (US-232) já grava manualmente — extraído pra cá pra `AdventureGenerationService.completeGeneration` (dump
// automático em dev) reusar em vez de duplicar. Escreve sempre que chamado: o gate de
// NODE_ENV é responsabilidade de quem chama (o script roda de propósito contra prod às
// vezes, pra inspecionar personagem real — não pode ficar mudo lá).
export function writeAuthoringDump(characterId: string, generated: GeneratedAdventure): string {
  const dir = resolve(__dirname, '../../../../evals/reports')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const path = resolve(dir, `authoring-${characterId}-${stamp}.json`)
  writeFileSync(path, JSON.stringify(generated, null, 2), 'utf8')
  return path
}
