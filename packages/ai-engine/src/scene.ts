import type { SceneState } from '@ai-dm/shared'

// US-03 — estado de cena estruturado.
// Um patch traz só os campos que mudaram no turno; o merge é PARCIAL: campos
// omitidos preservam o valor anterior. Arrays (presentes / objetos_em_cena),
// quando informados, substituem a lista inteira — o agente envia a lista
// completa e atual da cena, não um delta.
export type ScenePatch = Partial<Omit<SceneState, 'atualizadoEm'>>

const EMPTY: SceneState = {
  local: '',
  ambiente: 'externo',
  periodo: '',
  presentes: [],
  objetos_em_cena: [],
  atualizadoEm: '',
}

export function mergeSceneState(
  current: SceneState | null | undefined,
  patch: ScenePatch,
): SceneState {
  const base = current ?? EMPTY
  return {
    local: patch.local ?? base.local,
    ambiente: patch.ambiente ?? base.ambiente,
    periodo: patch.periodo ?? base.periodo,
    presentes: patch.presentes ?? base.presentes,
    objetos_em_cena: patch.objetos_em_cena ?? base.objetos_em_cena,
    atualizadoEm: new Date().toISOString(),
  }
}

// 2026-09-18: o Mestre movia a cena mas abria o turno JÁ no destino, sem narrar o trajeto.
// Este é o texto mais recente que o modelo lê antes de escrever a prosa (vai no resultado
// da tool `updateScene`), só em turno que de fato mudou o `local` — custo zero nos demais e
// fora do prefixo cacheado. Igualdade por string aparada: um `local` só reescrito ("Círculo"
// → "borda do Círculo") dispara a dica à toa; inofensivo, e comparar semântica exigiria modelo.
export type SceneMoveHint = { de: string; para: string; instrucao: string }

export function sceneMoveHint(
  before: SceneState | null | undefined,
  after: SceneState,
): SceneMoveHint | null {
  const de = before?.local.trim()
  const para = after.local.trim()
  if (!de || de === para) return null
  return {
    de,
    para,
    instrucao: `The scene moved from «${de}» to «${para}». Narrate the way there FIRST (terrain, a landmark, time passing), and only then the arrival. NEVER open the turn already at the destination.`,
  }
}

// Formato compacto chave: valor, para reinjeção no prompt e no resumo.
// Vazio quando não há cena estabelecida ainda — nada a injetar.
export function formatSceneState(scene: SceneState | null | undefined): string {
  if (!scene) return ''
  if (!scene.local && scene.presentes.length === 0 && scene.objetos_em_cena.length === 0) return ''
  const lines = [
    `- local: ${scene.local || '(indefinido)'}`,
    `- ambiente: ${scene.ambiente}`,
    `- período: ${scene.periodo || '(indefinido)'}`,
    `- presentes: ${scene.presentes.length > 0 ? scene.presentes.join(', ') : '(ninguém além do personagem)'}`,
    `- objetos em cena: ${scene.objetos_em_cena.length > 0 ? scene.objetos_em_cena.join(', ') : '(nenhum)'}`,
  ]
  return lines.join('\n')
}
