// US-258: `handleConfirm` grava o personagem e não há endpoint de edição (só POST/GET/DELETE),
// então depois do `charId` as etapas de criação são definitivas — voltar até `review` e
// confirmar de novo criava um SEGUNDO personagem. Função pura, fora do SetupWizard (2300+
// linhas), chamada por `goTo`, pela trilha e pelo rodapé.
export function isClosedStep(steps: readonly string[], target: string, charId: string): boolean {
  const targetIndex = steps.indexOf(target)
  if (targetIndex === -1) throw new Error(`etapa "${target}" fora da trilha: ${steps.join(', ')}`)
  return charId !== '' && targetIndex < steps.indexOf('world')
}
