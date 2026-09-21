# US-260 — Corrigir um erro a partir da revisão sem refazer o caminho até ela

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-26](./US-26-criacao-personagem-em-etapas.md) (✅ — **reabre** a regra "etapa à frente da atual não é clicável")
**Relacionada a:** [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md) (📋 — redesenha a trilha em chips; **coordenar**, ver Questões) · [US-208](./US-208-revisao-em-forma-de-ficha.md) (📋 — redesenha a revisão e deixa "Editar a partir da revisão" fora do escopo, com o argumento de que "a trilha permite") · [US-258](./US-258-voltar-do-mundo-recria-o-personagem.md) (fecha as etapas depois de criar)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.
**Implementada em:** 2026-09-21 — ver *Como ficou*.

---

## História

> **Como** jogadora que percebeu na revisão que a classe estava errada,
> **quero** corrigir a classe e voltar direto à revisão,
> **para que** um erro na etapa 2 não me custe atravessar de novo as etapas 3 a 8.

---

## Contexto e motivação

### O problema observado

`goTo` só navega para trás ([SetupWizard.tsx:912](../../../apps/web/src/components/setup/SetupWizard.tsx)), e o estado da trilha é `i < idx ? 'concluída' : 'pendente'` ([:1249](../../../apps/web/src/components/setup/SetupWizard.tsx)) — relativo à etapa **atual**, não à mais distante já alcançada. Da revisão, voltar à `class` marca `review` como `pendente` e `disabled`. O caminho de volta é "Próximo" repetido.

### Por que a solução atual não basta

A US-208 tirou o "Editar a partir da revisão" do escopo porque "corrigir continua a ser voltar à etapa, que a trilha permite". A premissa vale para ir; não vale para voltar. O custo cresce com a classe: um Guerreiro tem 4 selects de kit e um Bardo escolhe ferramentas, e tudo passa de novo por `canAdvance`.

### A proposta

A trilha lembra a **etapa mais distante já alcançada**. Etapas até ela ficam clicáveis. Ir para uma etapa à frente da atual só vale se todas as etapas do meio ainda passam em `canAdvance` (a edição pode ter invalidado alguma); senão o salto para na primeira inválida. Um atalho "Voltar à revisão" no rodapé aparece quando a revisão já foi alcançada.

---

## Escopo

### Dentro do escopo

- Estado `furthest` (índice da etapa mais distante alcançada) e regra de clique da trilha derivada dele.
- Salto que respeita `canAdvance` das etapas intermediárias, parando na primeira inválida.
- Botão "Voltar à revisão" no rodapé quando `furthest >= índice de review` e a etapa atual é anterior.
- Reset de `furthest` ao trocar de sistema (as etapas seguintes deixam de valer).

### Fora do escopo

- **Botão "Editar" por linha da revisão.** A revisão está para ser redesenhada na [US-208](./US-208-revisao-em-forma-de-ficha.md); pôr o botão agora é retrabalho. Registrar o critério lá.
- **Visual dos chips** — é da [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md).

---

## Critérios de aceite

- [x] Da revisão, clicar em `class` na trilha, e depois em `review`, volta à revisão em um clique **se** as etapas do meio ainda são válidas.
- [x] Se a troca de classe invalida uma etapa do meio (ex.: `skills` exige as perícias da nova classe), o salto para nessa etapa.
- [x] A trilha nunca deixa alcançar por clique uma etapa que nunca foi alcançada em ordem.
- [x] "Voltar à revisão" só aparece depois de a revisão ter sido alcançada.
- [x] Trocar de sistema zera `furthest`.
- [x] **Teste de regressão:** percorre até `review`, volta a `class`, muda a classe, aciona "Voltar à revisão" e afirma que o wizard para em `skills` (perícias da classe anterior já não valem).

---

## Como ficou (2026-09-21)

- **Regra:** [`resolveJump(steps, from, to, furthest, canAdvance)`](../../../apps/web/src/components/setup/stepJump.ts) — pura. Para trás devolve `to` sem consultar `canAdvance`; para a frente, `from` se `to` passa de `furthest`, senão a primeira etapa de `[from, to)` que reprova em `canAdvance`, senão `to`. **A etapa de partida entra na conta** (é a que se está deixando): com ela inválida o wizard não sai do lugar. Etapa fora da trilha lança com o valor ofensor.
- **Estado:** `furthest` é um índice (`SetupWizard.tsx:292`); `enter` (:883) sobe-o em `next`. `goTo` (:875) e a trilha (:1228, `i <= furthest`) leem dele. `back` não mexe.
- **Com a [US-258](./US-258-voltar-do-mundo-recria-o-personagem.md):** `goTo` devolve cedo quando `isClosedStep` — etapa fechada (personagem já gravado) nunca é destino, nem para trás nem para a frente; a trilha soma o mesmo `disabled`. Com `canAdvance` da [US-259](./US-259-proximo-desabilitado-diz-o-que-falta.md) (`missingFor`), quando o salto para numa etapa inválida a linha "Falta: …" já diz o que corrigir ali.
- **Teto em `review`:** `furthest` nunca passa de `review`. `world` só se alcança por `handleConfirm` (grava o personagem); com `world` no alcance, um clique na trilha o pularia. Fora do enunciado da story — nasceu de ler o fluxo até o fim.
- **Atalho:** "Voltar à revisão" (`setup.backToReview`, nos dois locales) à esquerda do "Próximo", quando `furthest >= review` e a etapa atual é anterior. Chama `goTo('review')` — a mesma regra da trilha.
- **Trocar de sistema:** `handleSelectSystem` põe `furthest` em `class` (a etapa para onde vai), que é o "zerado" do fluxo.
- **Testes:** [`stepJump.test.ts`](../../../apps/web/src/components/setup/stepJump.test.ts) (a função) e [`SetupWizard.furthest.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.furthest.test.tsx) (fake class `FakeSetupApi`, sistema com duas classes e uma perícia). Antes do código, 4 dos 6 testes do wizard falharam (sem atalho, revisão não alcançável pela trilha); os outros 2 são guardas do comportamento que já valia e não podem quebrar.
- **Teste antigo:** um caso de `SetupWizard.test.tsx` clicava `/Voltar/` cinco vezes a partir da revisão; depois da primeira volta "Voltar à revisão" também casa a regex. Passou a `/^Voltar$/`.
- **Questão #1** decidida pela recomendação (esta primeiro): a regra nasce no `SetupWizard` atual e a US-204 herda. **Questão #2** segue para a US-208 (registrado lá).
- **Não verificado no navegador:** o `/setup` exige login e API; o comportamento está coberto em jsdom. O layout do rodapé com três botões em tela estreita (`flex-wrap`) não foi visto.

---

## Notas de implementação

- `steps`, `goTo`, `next`, `back` operam por índice ([SetupWizard.tsx:44-45](../../../apps/web/src/components/setup/SetupWizard.tsx)); `furthest` cabe no mesmo modelo, sem estrutura nova.
- A regra de salto é uma função pura de `(from, to, canAdvance)`. Fica fora do componente (limite de 500 linhas).
- Se a [US-263](./US-263-etapa-magias-so-quando-ha-o-que-mostrar.md) entrar antes, `steps` deixa de ser constante e `furthest` guarda a **chave** da etapa, não o índice.

---

## Questões em aberto

1. **Esta story ou a US-204 primeiro?** A US-204 (esqueleto, sem dependências) já repete "só se navega para trás". Se ela entrar antes, esta story vira um ajuste de regra por cima dos chips; se entrar depois, a regra nasce no `SetupWizard` atual e a US-204 herda. Recomendação: esta primeiro (é lógica, não layout).
2. **Editar campo a campo da revisão** continua valendo depois desta story? Decidir na US-208.

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `goTo` (:912), trilha (:1243-1265)
- [SetupWizard.test.tsx](../../../apps/web/src/components/setup/SetupWizard.test.tsx) — usa a trilha para voltar (ex.: "navegação ida-e-volta preserva o preenchimento", :278)
