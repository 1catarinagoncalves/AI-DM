# US-262 — Distribuição recomendada de atributos por classe (o primeiro atalho do wizard)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-207](./US-207-atributos-e-pericias-com-orcamento-visivel.md) (✅ — dona do orçamento visível de point-buy) · [US-203](./US-203-prosa-de-catalogo-classe-e-raca.md) (✅ — `config.classes[].primary`)
**Relacionada a:** [US-259](./US-259-proximo-desabilitado-diz-o-que-falta.md) · [US-268](./US-268-atribuir-bonus-de-origem-e-raca-com-controle-explicito.md)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.
**Implementada em:** 2026-09-22 — ver *Como ficou*.

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

- [x] Para cada uma das 13 classes do SRD, o botão gera valores que respeitam `min`/`max` de cada atributo, gastam o orçamento inteiro e põem todos os `primary` da classe entre os maiores valores.
- [x] Clicar habilita o "Próximo" (`remaining === 0`) sem outra ação, exceto quando há escolha de +1 de origem/raça que o botão não pôde resolver (nesse caso a pendência aparece via [US-259](./US-259-proximo-desabilitado-diz-o-que-falta.md)).
- [x] O botão não aparece sem `pointBuy.budget` nem sem `primary`.
- [x] Depois de clicar, cada "+"/"−" continua funcionando; o botão pode ser clicado de novo e volta à recomendação.
- [x] Rótulo nos dois locales.
- [x] **Teste de regressão:** tabela `classe → distribuição esperada` para as 13 classes com o orçamento de 27 (o teste falha se uma classe fica com pontos sobrando).

---

## Como ficou (2026-09-22)

- **Função pura:** [`recommendedAttributes(classEntry, attributes, budget)`](../../../apps/web/src/components/setup/recommendedAttributes.ts) — programação dinâmica de soma exata, não busca exaustiva ingênua (a nota de implementação original previa ~262 mil combinações por não contar com a faixa real do seed, min 10/max 18, US-262 §Notas — ainda menor com DP: `atributos × orçamento × 9 valores`). Cada atributo ganha um peso de prioridade (`primary` da classe ≫ Constituição ≫ resto); a DP maximiza peso total sujeito a gastar o orçamento **exatamente**, com backtrack pra reconstruir os 6 valores.
- **`POINT_COST` saiu de `SetupWizard.tsx`** para este módulo novo — única fonte agora, reusada pelos dois lados (custo do point-buy manual e da recomendação).
- **Botão:** `setup.attributes` — ao lado do `CounterBadge` de saldo, só quando `budget !== undefined && classPrimary.length > 0` (AC3). `applyRecommended()` chama `setAttrs(recommendedAttributes(...))` e, se a origem (`abilityGrant?.kind === 'ability'`) ou a raça (`raceGrant?.choice`) exigem escolher onde vai o +1 livre, pré-marca `abilityChoice`/`raceAbilityChoice` num atributo `classPrimary` elegível (que não seja o já-fixo). Sem candidato elegível, a escolha não é tocada — a etapa segue bloqueada como hoje (AC2, comportamento existente da US-123/US-212).
- **Testes:** [`recommendedAttributes.test.ts`](../../../apps/web/src/components/setup/recommendedAttributes.test.ts) — as 13 classes do SRD (`config.classes[].primary` real) com orçamento 27 na faixa do seed (min 10/max 18/default 10), mais orçamento 0 e classe sem `primary`. [`SetupWizard.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.test.tsx) — botão preenche e libera "Próximo", ausente sem `primary`, clique repetido volta à recomendação, e resolve o +1 livre de origem.
- **Não verificado no navegador:** `/setup` exige login (Google OAuth) e API rodando — mesma limitação já registrada na US-260. Comportamento coberto em jsdom (167 testes de `SetupWizard.test.tsx` + `i18n.test.tsx` + `recommendedAttributes.test.ts`, todos verdes) e `pnpm typecheck`/`pnpm dead` limpos.

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
