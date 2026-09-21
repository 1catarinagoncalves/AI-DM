# US-258 — Voltar do passo Mundo recria o personagem; o botão da revisão diz "Próximo" mas grava

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (✅ — dona do passo `world` e do `charId`) · [US-26](./US-26-criacao-personagem-em-etapas.md) (✅ — dona da trilha e do rodapé Voltar/Próximo)
**Relacionada a:** [US-260](./US-260-corrigir-a-partir-da-revisao-sem-refazer-o-caminho.md) (navegação pela trilha — as duas mexem em `goTo`/`back`)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código — **não reproduzida no navegador** (o `/setup` exige login Google). O critério de teste abaixo é a reprodução.
**Implementada em:** 2026-09-21 — ver *Como ficou*.

---

## História

> **Como** jogadora que acabou de confirmar o personagem,
> **quero** que voltar uma tela e confirmar de novo nunca crie um segundo personagem,
> **para que** o meu hub não acumule personagens duplicados que eu não pedi.

---

## Contexto e motivação

### O problema observado

`handleConfirm` ([SetupWizard.tsx:927](../../../apps/web/src/components/setup/SetupWizard.tsx)) chama `api.createCharacter`, guarda `setCharId(char.id)` e avança para `world`. Não consulta `charId` antes. No passo `world` o rodapé mostra **Voltar** (`step !== 'system'`, [:2273](../../../apps/web/src/components/setup/SetupWizard.tsx)), e a trilha deixa clicar em qualquer etapa anterior (`goTo`, [:912](../../../apps/web/src/components/setup/SetupWizard.tsx)). Voltar até `review` e confirmar chama `createCharacter` outra vez.

O servidor não protege: não encontrei idempotência nem deduplicação em `apps/api/src/character` (fora de testes) e `Character.name` não tem `@@unique` em [schema.prisma](../../../apps/api/prisma/schema.prisma). **Deduzido do código; não observado.**

Segundo problema, no mesmo ponto: o botão da revisão usa o rótulo `setup.next` ("Próximo", [:2281](../../../apps/web/src/components/setup/SetupWizard.tsx)), mas a ação é irreversível — grava no banco. Só o estado de carregamento ("A criar…") entrega isso, e só depois do clique.

### Por que a solução atual não basta

Guardar só o `charId` e pular o `createCharacter` seria pior: a jogadora voltaria, mudaria a classe, confirmaria, e o personagem salvo continuaria o antigo, em silêncio. Não existe endpoint de edição de personagem (só `POST`, `GET`, `DELETE` em [character.controller.ts](../../../apps/api/src/character/character.controller.ts)).

### A proposta

Depois que o personagem é criado, o wizard trata as etapas de criação como **fechadas**: sem Voltar em `world`, trilha inerte para as etapas anteriores. E o botão da revisão diz o que faz.

---

## Escopo

### Dentro do escopo

- Com `charId !== ''`: o botão **Voltar** não renderiza em `world`, e os botões da trilha para etapas antes de `world` ficam `disabled`.
- Botão da revisão passa a "Criar personagem" (chave nova `setup.review.confirm`, nos dois locales); o texto de carregamento continua `setup.confirming`.
- Uma linha no topo de `world` dizendo que o personagem já está salvo (chave nova, nos dois locales) — explica por que não dá para voltar.
- Guarda defensiva em `handleConfirm`: se `charId` já existe, não chama a API (só avança). Nunca deve disparar com a UI acima; existe para o caso de uma rota futura reabrir `review`.

### Fora do escopo

- **Editar personagem depois de criado.** Exigiria endpoint novo e é outra story.
- **Idempotência no servidor** (chave de idempotência gerada pelo cliente). Defesa em profundidade; vale se aparecer duplicata por retry de rede — hoje não há evidência.
- **Apagar o personagem órfão ao sair.** Depende de como o hub trata personagem sem aventura ([US-30](./US-30-deletar-personagem.md) já deixa apagar).

---

## Critérios de aceite

- [x] Em `world` (com `charId` preenchido) não existe botão Voltar.
- [x] Em `world`, os botões da trilha das etapas anteriores estão `disabled`; o de `world` continua `aria-current="step"`.
- [x] O botão da revisão lê "Criar personagem" (pt-BR) / "Create character" (en-US); nenhum `setup.next` na etapa `review`.
- [x] `world` mostra que o personagem foi salvo.
- [x] `handleConfirm` com `charId` preenchido não chama `api.createCharacter` — **guarda escrita, sem teste** (ver *Como ficou*).
- [x] **Teste de regressão:** com `api` mockado por fake class nomeada, percorre o wizard até `world`, tenta voltar (botão e trilha) e afirma que `createCharacter` foi chamado **exatamente uma vez**. O teste falha no código de hoje.

---

## Como ficou (2026-09-21)

- **Regra:** [`isClosedStep(steps, target, charId)`](../../../apps/web/src/components/setup/closedSteps.ts) — puro, verdadeiro para toda etapa antes de `world` quando `charId !== ''`. Chamada por `goTo` (:915), pela trilha (`disabled`, :1262) e pelo rodapé (:2290). Etapa fora da trilha lança com o valor ofensor.
- **Rodapé:** em `world` o Voltar dá lugar a um `<span aria-hidden />` — sem ele `justify-between` empurraria "Criar aventura" para a esquerda.
- **Botão da revisão:** `setup.review.confirm` ("Criar personagem" / "Create character"); o carregamento continua `setup.confirming`.
- **Aviso em `world`:** `setup.world.saved`, uma linha com ícone de check acima do título. Só aparece no formulário — as telas de espera/erro de geração ficam fora do `Panel` e não mostram.
- **Guarda em `handleConfirm`** (:928): com `charId`, só avança. Inalcançável pela UI (nenhuma rota reabre `review`), por isso **não tem teste** — o critério lista o comportamento, mas exercitá-lo exigiria exportar `handleConfirm` ou abrir uma rota que a story proíbe. Se aparecer rota que reabre `review`, o teste nasce com ela.
- **Testes:** [`closedSteps.test.ts`](../../../apps/web/src/components/setup/closedSteps.test.ts) (a função) e [`SetupWizard.closedSteps.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.closedSteps.test.tsx) (fake class `FakeSetupApi`, que guarda cada DTO enviado). Arquivo novo em vez de crescer o `SetupWizard.test.tsx` (3489 linhas). Antes do código os três testes do wizard falharam por `Criar personagem` não existir — o botão era "Próximo" e o Voltar renderizava em `world`.
- **Testes antigos:** 35 cliques de confirmação em `SetupWizard.test.tsx` liam o botão da revisão como `/Próximo/`; passaram a `/Criar personagem/`. Só a confirmação mudou — os avanços comuns seguem `/Próximo/`.
- **Questão #1** decidida pela recomendação (fechar, sem "apagar e recriar"). **Questão #2** segue aberta: a mensagem de `world` diz só que as etapas ficam fechadas, sem prometer nada sobre o hub.

---

## Notas de implementação

- Escreva o teste antes (TDD): ele reproduz o defeito, que aqui é só hipótese.
- `SetupWizard.tsx` tem 2306 linhas (limite do repo: 500). Não cresça o arquivo: a condição de "etapas fechadas" pode ser uma função pura em módulo vizinho, chamada por `goTo` e pelo render da trilha.
- O texto novo nasce no dicionário ([US-98](./US-98-i18n-da-interface-web.md)); o gate de string literal no JSX reprova o contrário.

---

## Questões em aberto

1. **Fechar as etapas (proposta) ou deixar refazer com "apagar e recriar"?** A segunda dá mais liberdade e usa o `DELETE` que já existe, mas é destrutiva e mais cara. Recomendação: fechar.
2. **Quem sai do wizard em `world` fica com personagem sem aventura no hub.** Como o hub mostra isso? Fora do escopo aqui, mas a mensagem nova de `world` deve concordar com o que o hub faz.

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `handleConfirm` (:927), `goTo` (:912), `back` (:922), rodapé (:2273-2299)
- [character.controller.ts](../../../apps/api/src/character/character.controller.ts) — rotas de personagem (sem edição)
