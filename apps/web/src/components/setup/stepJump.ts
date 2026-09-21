// US-260: a trilha só andava para trás (`i < idx`), então corrigir a classe a partir da revisão
// custava atravessar de novo as etapas 3 a 8 com "Próximo". Agora a trilha lembra a etapa mais
// distante já alcançada (`furthest`, um índice) e deixa saltar até ela — mas o salto passa por
// `canAdvance` de cada etapa que atravessa, porque a edição pode ter invalidado alguma (trocar
// de classe zera as perícias). Função pura, fora do SetupWizard (2300+ linhas).
//
// Devolve a etapa onde o wizard deve ficar: `to` se o caminho está limpo, a primeira inválida
// se não, `from` se `to` nunca foi alcançada em ordem. Para trás não consulta `canAdvance`
// (voltar nunca exigiu nada).
export function resolveJump<S extends string>(
  steps: readonly S[],
  from: S,
  to: S,
  furthest: number,
  canAdvance: (s: S) => boolean,
): S {
  const fromIndex = indexOrThrow(steps, from)
  const toIndex = indexOrThrow(steps, to)
  if (toIndex <= fromIndex) return to
  if (toIndex > furthest) return from
  const blocked = steps.slice(fromIndex, toIndex).find(s => !canAdvance(s))
  return blocked ?? to
}

function indexOrThrow(steps: readonly string[], step: string): number {
  const index = steps.indexOf(step)
  if (index === -1) throw new Error(`etapa "${step}" fora da trilha: ${steps.join(', ')}`)
  return index
}
