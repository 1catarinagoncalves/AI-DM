import type { Step } from './SetupWizard'

// US-263: `spells` só entra na trilha quando há o que mostrar — magia de classe (`previewSpells`)
// ou o truque bônus do Alto-elfo (`wizardCantrips`), as mesmas duas condições que a própria etapa
// já usa pra decidir o que renderizar (ver `step === 'spells'` em SetupWizard.tsx). Antes de a
// classe ser escolhida (`classKey` vazio) a lista ainda não sabe se `spells` cabe: mantém a etapa
// (Questão #1 da story — recomendação escolhida) em vez de escondê-la e fazê-la reaparecer ao
// escolher a classe, o que mudaria o layout duas vezes.
//
// Função pura, fora do SetupWizard (2300+ linhas) — a mesma lista serve à trilha, ao "Etapa X de
// N" e a `next`/`back`/`goTo`/`enter`. Consequência direta: `steps` deixa de ser constante, então
// `furthest` (US-260) passou a guardar a CHAVE da etapa, não o índice — um índice sobrevive à
// lista mudar de tamanho só por acidente.
export function visibleSteps(allSteps: readonly Step[], classKey: string, hasSpellsContent: boolean): Step[] {
  if (!classKey || hasSpellsContent) return [...allSteps]
  return allSteps.filter(s => s !== 'spells')
}
