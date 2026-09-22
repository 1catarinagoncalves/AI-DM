// US-262: distribuição recomendada de atributos — a etapa `attributes` do SetupWizard só dá
// point-buy cru (US-207); este módulo calcula o preenchimento automático que o botão "Distribuição
// recomendada" aplica, gastando o orçamento por inteiro e priorizando os atributos `primary` da
// classe escolhida (US-203), depois Constituição.

// Custo acumulado por valor (point-buy 5e). Não é linear: 13→14 e 14→15 custam 2 cada. Movido
// de SetupWizard.tsx (era local ali) porque este módulo também precisa dele para calcular custo.
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9, 16: 11, 17: 13, 18: 15 }

// Contratos mínimos (não os tipos inteiros de @ai-dm/shared) — mesmo padrão de CatalogCardEntry
// em CatalogCardGroup.tsx: este módulo só lê os campos abaixo, nunca grava no catálogo.
type Attribute = { key: string; max: number; default: number }
type ClassEntry = { primary?: string[] }

type Candidate = { value: number; cost: number; weight: number }

// Peso por atributo: `primary` da classe domina qualquer combinação dos demais (maior salto de
// valor possível, 10→18, vale 13 pontos — 1000 é folga de sobra); Constituição vem em segundo
// quando não é `primary`; o resto empata em último. A ordem de prioridade da US-262 (primary,
// depois Constituição) sai desta escala, não de lógica condicional espalhada pela busca.
function priorityWeight(key: string, primary: readonly string[]): number {
  if (primary.includes(key)) return 1_000_000
  if (key === 'constitution') return 1_000
  return 1
}

// Cada candidato é um valor alcançável do atributo (do `default` — custo 0 — até `max`), com o
// custo RELATIVO ao default (mesma conta de `spent` em SetupWizard.tsx) e o peso de prioridade
// já aplicado ao valor, para a busca de soma exata abaixo maximizar.
function candidatesFor(attribute: Attribute, weight: number): Candidate[] {
  const baseCost = POINT_COST[attribute.default] ?? 0
  const list: Candidate[] = []
  for (let value = attribute.default; value <= attribute.max; value++) {
    list.push({ value, cost: (POINT_COST[value] ?? 0) - baseCost, weight: value * weight })
  }
  return list
}

// Busca de soma exata (programação dinâmica): um guloso puro maximiza peso mas não fecha o
// orçamento em cima da bala (custo por ponto não é linear, ver POINT_COST) — dp[c] guarda o
// maior peso total alcançável gastando EXATAMENTE `c`, com backtrack pela escolha de cada
// atributo. `attributes.length` × `budget` × 9 valores no máximo — pequeno o bastante para
// rodar a cada clique (US-262 §Notas de implementação).
function exactSumMaxWeight(perAttribute: Candidate[][], budget: number): Candidate[] {
  let dp: number[] = new Array(budget + 1).fill(-Infinity)
  dp[0] = 0
  const picks: number[][] = []
  for (const candidates of perAttribute) {
    const next: number[] = new Array(budget + 1).fill(-Infinity)
    const pick: number[] = new Array(budget + 1).fill(-1)
    for (let spent = 0; spent <= budget; spent++) {
      const dpSpent = dp[spent]!
      if (dpSpent === -Infinity) continue
      candidates.forEach((candidate, index) => {
        const nextSpent = spent + candidate.cost
        if (nextSpent > budget) return
        const score = dpSpent + candidate.weight
        if (score > next[nextSpent]!) { next[nextSpent] = score; pick[nextSpent] = index }
      })
    }
    dp = next
    picks.push(pick)
  }
  if (dp[budget] === -Infinity) {
    throw new Error(`recommendedAttributes: orçamento ${budget} inalcançável com os atributos dados`)
  }
  return backtrack(perAttribute, picks, budget)
}

function backtrack(perAttribute: Candidate[][], picks: number[][], budget: number): Candidate[] {
  const result: Candidate[] = []
  let remaining = budget
  for (let i = perAttribute.length - 1; i >= 0; i--) {
    const index = picks[i]![remaining]!
    const candidate = perAttribute[i]![index]!
    result.unshift(candidate)
    remaining -= candidate.cost
  }
  return result
}

/**
 * Devolve o mapa atributo→valor recomendado para `classEntry`, gastando `budget` pontos por
 * inteiro. Prioriza os atributos em `classEntry.primary` (US-203), depois Constituição — os
 * demais recebem só o troco necessário para fechar o orçamento exato.
 */
export function recommendedAttributes(classEntry: ClassEntry | undefined, attributes: Attribute[], budget: number): Record<string, number> {
  const primary = classEntry?.primary ?? []
  const perAttribute = attributes.map(a => candidatesFor(a, priorityWeight(a.key, primary)))
  const choice = exactSumMaxWeight(perAttribute, budget)
  return Object.fromEntries(attributes.map((a, i) => [a.key, choice[i]!.value]))
}
