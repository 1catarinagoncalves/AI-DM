# US-262 — Distribuição recomendada de atributos por classe (o primeiro atalho do wizard)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-207](./US-207-atributos-e-pericias-com-orcamento-visivel.md) (✅ — dona do orçamento visível de point-buy) · [US-203](./US-203-prosa-de-catalogo-classe-e-raca.md) (✅ — `config.classes[].primary`)
**Relacionada a:** [US-259](./US-259-proximo-desabilitado-diz-o-que-falta.md) · [US-268](./US-268-atribuir-bonus-de-origem-e-raca-com-controle-explicito.md)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.

---

## História

> **Como** jogadora nova em D&D, que escolheu uma classe mas não sabe o que é point-buy,
> **quero** um botão que distribua os 27 pontos de um jeito que funcione para a minha classe,
> **para que** eu comece a jogar em vez de decifrar uma tabela de custos não linear.

---

## Contexto e motivação

### O problema observado

O produto é um mestre narrativo, mas a criação pede que a jogadora resolva regra de D&D: seis atributos, orçamento fixo e custo não linear (13→14 e 14→15 custam 2, [SetupWizard.tsx:57](../../../apps/web/src/components/setup/SetupWizard.tsx)). Os atributos começam em `a.default` e o "+" apaga em silêncio quando o custo não cabe no orçamento. O único atalho de toda a criação é o "Aleatório" da etapa `world`.

O dado para recomendar já existe: `config.classes[].primary` (atributos principais, [system.ts:52](../../../packages/shared/src/types/system.ts)) alimenta o selo "Principal" da etapa.

### A proposta

Na etapa `attributes`, um botão "Distribuição recomendada" preenche os seis valores para a classe escolhida, gastando o orçamento por inteiro. A jogadora ajusta a partir dali.

---

## Escopo

### Dentro do escopo

- Função pura `recommendedAttributes(classEntry, attributes, budget)` que devolve o mapa `attr → valor`, priorizando `primary`, depois Constituição, e gastando **exatamente** o orçamento (a etapa exige `remaining === 0`).
- Botão na etapa `attributes`, só quando há `pointBuy.budget` (sistema sem point-buy, ex.: Free, tem campos numéricos livres e não recebe o botão).
- Para classe sem `primary` no catálogo (config legado), o botão não aparece.
- Se a origem ou a raça exigem escolher onde vai o +1, o botão também os pré-preenche em um atributo `primary` elegível — senão a etapa continua bloqueada depois de clicar.

### Fora do escopo

- **"Montar personagem para mim"** (etapas `skills`, kit, origem, identidade). Depende de dado de recomendação por classe que **não existe** no catálogo (quais perícias, qual kit). É uma story própria, depois de medir o uso deste botão.
- **Explicar o point-buy em texto** (o custo por incremento). Melhora, mas é outra decisão de copy.

---

## Critérios de aceite

- [ ] Para cada uma das 13 classes do SRD, o botão gera valores que respeitam `min`/`max` de cada atributo, gastam o orçamento inteiro e põem todos os `primary` da classe entre os maiores valores.
- [ ] Clicar habilita o "Próximo" (`remaining === 0`) sem outra ação, exceto quando há escolha de +1 de origem/raça que o botão não pôde resolver (nesse caso a pendência aparece via [US-259](./US-259-proximo-desabilitado-diz-o-que-falta.md)).
- [ ] O botão não aparece sem `pointBuy.budget` nem sem `primary`.
- [ ] Depois de clicar, cada "+"/"−" continua funcionando; o botão pode ser clicado de novo e volta à recomendação.
- [ ] Rótulo nos dois locales.
- [ ] **Teste de regressão:** tabela `classe → distribuição esperada` para as 13 classes com o orçamento de 27 (o teste falha se uma classe fica com pontos sobrando).

---

## Notas de implementação

- Custo por valor: `POINT_COST` (8→0 … 15→9). Alcançar o orçamento **exato** não sai de um guloso puro — 6 atributos × 8 valores dá ~262 mil combinações, uma busca exaustiva pequena é aceitável e determinística.
- O orçamento vem de `config.pointBuy.budget`, não é 27 fixo.
- A função vai para módulo fora do `SetupWizard.tsx` (limite de 500 linhas) e ganha teste próprio.

---

## Questões em aberto

1. **Qual distribuição é "recomendada"?** A proposta é `primary` alto + Constituição intermediária. Confirmar com quem joga: para um mestre narrativo, talvez valha priorizar o que o mestre testa mais.

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `POINT_COST` (:57), etapa `attributes` (:1597-1687)
- [system.ts](../../../packages/shared/src/types/system.ts) — `primary` (:52), `pointBuy` (:290)
