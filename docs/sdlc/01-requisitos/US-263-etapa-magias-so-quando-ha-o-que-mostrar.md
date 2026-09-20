# US-263 — A etapa Magias só aparece quando há o que mostrar

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-213](./US-213-etapa-magias-e-escolha-de-truque-do-alto-elfo.md) (✅ — dona da etapa `spells`) · [US-42](./US-42-magias-conhecidas.md) (✅ — `getClassSpells`)
**Relacionada a:** [US-260](./US-260-corrigir-a-partir-da-revisao-sem-refazer-o-caminho.md) (`furthest` deve guardar chave, não índice, se `steps` deixar de ser constante)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.

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

- [ ] Com uma classe sem magias, a trilha não lista "Magias", "Etapa X de N" conta N-1 e "Próximo" em `skills` leva a `identity`.
- [ ] Com classe com magias, ou Alto-elfo com truques, a etapa aparece como hoje.
- [ ] Trocar a classe (ou a raça) depois, voltando pela trilha, ajusta a lista sem quebrar o índice atual.
- [ ] **Teste de regressão:** classe sem magias percorre o wizard sem nunca renderizar `setup.spells.titulo`; o teste falha no código de hoje.

---

## Notas de implementação

- Antes de a classe ser escolhida (etapa `system`), a lista ainda não sabe se `spells` cabe: mostrar como hoje e remover a etapa ao escolher a classe, ou esconder até `class`. Ver Questões.
- Os testes existentes que assumem a etapa fixa (ex.: :1225, :3423) precisam de atualização — é o custo real da story.
- Mesma função pura de "etapas visíveis" serve à US-260.

---

## Questões em aberto

1. **A trilha encolhe quando a classe é escolhida (10 → 9) ou nasce já sem `spells` até saber?** Recomendação: mostrar 10 até `class` e encolher depois; o salto é pequeno e evita o layout mudar duas vezes.

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `steps` (:44-45), etapa `spells` (:1961-1985)
