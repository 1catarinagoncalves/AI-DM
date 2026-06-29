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
