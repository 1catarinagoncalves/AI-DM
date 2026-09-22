# US-263 — A etapa Magias só aparece quando há o que mostrar

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-213](./US-213-etapa-magias-e-escolha-de-truque-do-alto-elfo.md) (✅ — dona da etapa `spells`) · [US-42](./US-42-magias-conhecidas.md) (✅ — `getClassSpells`)
**Relacionada a:** [US-260](./US-260-corrigir-a-partir-da-revisao-sem-refazer-o-caminho.md) (`furthest` deve guardar chave, não índice, se `steps` deixar de ser constante)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.
**Implementada em:** 2026-09-22 — ver *Como ficou*.

---

## História

> **Como** jogadora que escolheu uma classe sem magias,
> **quero** que a criação não me leve a uma etapa "Magias" que só diz que não tenho magias,
> **para que** a trilha e o "Próximo" não me façam gastar um passo em nada.

---

## Contexto e motivação

### O problema observado

`steps` é um array constante de 10 etapas ([SetupWizard.tsx:44-45](../../../apps/web/src/components/setup/SetupWizard.tsx)). Para uma classe sem magias, `spells` renderiza só "Este personagem não tem magias." (`setup.spells.empty`, [:1982](../../../apps/web/src/components/setup/SetupWizard.tsx)), com "Próximo" habilitado. O contador "Etapa X de 10" e a trilha contam a etapa mesmo assim. O teste do wizard trata "Magias" como "sempre presente" na trilha ([SetupWizard.test.tsx:1225](../../../apps/web/src/components/setup/SetupWizard.test.tsx)).

A [US-213](./US-213-etapa-magias-e-escolha-de-truque-do-alto-elfo.md) criou a etapa por causa da escolha de truque do Alto-elfo. Não encontrei nela uma decisão de mostrar a etapa vazia (grep) — parece consequência, não escolha.

### A proposta

`steps` vira derivado: `spells` só entra quando `previewSpells.length > 0` ou quando é Alto-elfo com truques de mago disponíveis (as duas condições que a etapa já usa para ter conteúdo).

---

## Escopo

### Dentro do escopo

- Etapas visíveis calculadas a partir de classe e raça; `next`, `back`, `goTo`, a trilha e o rótulo "Etapa X de N" usam a lista derivada.
- `setup.spells.empty` deixa de ser alcançável (remover a chave e o ramo se nada mais a usa).

### Fora do escopo

- **Fundir `spells` com outra etapa** (ex.: `class`). Muda a arquitetura de informação; só se a etapa continuar fina depois desta.

---

## Critérios de aceite

- [x] Com uma classe sem magias, a trilha não lista "Magias", "Etapa X de N" conta N-1 e "Próximo" em `skills` leva a `identity`.
- [x] Com classe com magias, ou Alto-elfo com truques, a etapa aparece como hoje.
- [x] Trocar a classe (ou a raça) depois, voltando pela trilha, ajusta a lista sem quebrar o índice atual.
- [x] **Teste de regressão:** classe sem magias percorre o wizard sem nunca renderizar `setup.spells.titulo`; o teste falha no código de hoje.

---

## Como ficou (2026-09-22)

- **Regra:** [`visibleSteps(allSteps, classKey, hasSpellsContent)`](../../../apps/web/src/components/setup/visibleSteps.ts) — pura, fora do `SetupWizard`. `hasSpellsContent` é a MESMA condição que o bloco `step === 'spells'` já usava pra decidir o que renderizar (`previewSpells.length > 0 || (Alto-elfo com truques de mago disponíveis)`), então a etapa nunca aparece vazia por construção — o ramo `setup.spells.empty` virou inalcançável e saiu (chave removida dos dois locales).
- **Questão #1 decidida pela recomendação:** sem `classKey` (antes de `class`), `visibleSteps` mantém `spells` na lista — só encolhe depois de a classe ser escolhida, uma vez, em vez de aparecer/sumir duas vezes.
- **`furthest` virou CHAVE, não índice** (a mudança que a nota da US-260 antecipava): `steps` deixou de ser constante, e um índice não sobrevive à lista mudar de tamanho quando a classe troca de "sem magia" para "com magia" (ou vice-versa) depois de a jogadora já ter avançado. `SetupWizard.tsx` deriva `furthestIndex` a cada render (`steps.includes(furthest) ? steps.indexOf(furthest) : steps.indexOf(step)` — proteção extra pra quando a chave lembrada saiu da lista) e usa esse índice na trilha, no atalho "Voltar à revisão" e em `goTo`/`resolveJump` (que continua recebendo número — só o ponto de conversão mudou).
- **Rascunho (`wizardDraft.ts`):** `WizardDraft.furthest` mudou de `number` pra `Step`; `DRAFT_VERSION` subiu de 1 para 2 (formato mudou, rascunho velho é descartado, nunca migrado — mesma regra que já valia pra outras mudanças de forma).
- **`setup.spells.empty` removido** dos dois locales (pt-BR/en-US) — a condição que o mostrava (nem magia própria, nem truque do Alto-elfo) agora impede a etapa de existir, então o parágrafo nunca renderizava.
- **Testes:** [`visibleSteps.test.ts`](../../../apps/web/src/components/setup/visibleSteps.test.ts) (a função, 3 casos incluindo a Questão #1) e ajustes em `SetupWizard.test.tsx`/`SetupWizard.closedSteps.test.tsx`/`SetupWizard.draft.test.tsx`/`wizardDraft.test.ts` — testes que assumiam `spells` sempre presente na trilha, ou que contavam um clique "Próximo" a mais entre `skills` e `identity`, foram para o número certo de etapas. Um caso novo em `SetupWizard.test.tsx` (describe US-213) cobre a AC3: troca de classe sem-magia → com-magia depois de alcançar a revisão, provando que `spells` reaparece no meio da trilha e "Voltar à revisão" continua funcionando (a chave `furthest` sobrevive à lista mudar de tamanho).
- **Não verificado no navegador:** mesma limitação da US-260 — `/setup` exige login e API; comportamento coberto em jsdom (236 testes, `SetupWizard.tsx`/`wizardDraft.ts`/`visibleSteps.ts` passam em `typecheck` e `knip` sem achados).

---

## Notas de implementação

- Antes de a classe ser escolhida (etapa `system`), a lista ainda não sabe se `spells` cabe: mostrar como hoje e remover a etapa ao escolher a classe, ou esconder até `class`. Ver Questões.
- Os testes existentes que assumem a etapa fixa (ex.: :1225, :3423) precisam de atualização — é o custo real da story.
- Mesma função pura de "etapas visíveis" serve à US-260.

---

## Questões em aberto

1. **A trilha encolhe quando a classe é escolhida (10 → 9) ou nasce já sem `spells` até saber?** Decidida pela recomendação (mostrar 10 até `class` e encolher depois) — ver *Como ficou*.

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `ALL_STEPS`/`steps` derivado, `furthestIndex`, `goTo`/`enter`, etapa `spells`
- [visibleSteps.ts](../../../apps/web/src/components/setup/visibleSteps.ts) — a regra pura
- [wizardDraft.ts](../../../apps/web/src/components/setup/wizardDraft.ts) — `WizardDraft.furthest: Step`, `DRAFT_VERSION` 2
