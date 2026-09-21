# US-259 — "Próximo" desabilitado diz o que falta; a etapa Identidade deixa de prometer que é opcional

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-26](./US-26-criacao-personagem-em-etapas.md) (✅ — dona de `canAdvance`) · [US-210](./US-210-identidade-como-etapa-propria.md) (✅ — dona da etapa `identity`)
**Relacionada a:** [US-268](./US-268-atribuir-bonus-de-origem-e-raca-com-controle-explicito.md) (o beco sem saída mais provável: o +1 de atributo) · [US-269](./US-269-acessibilidade-do-wizard-alvos-erro-e-foco.md)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.

---

## História

> **Como** jogadora numa etapa em que o "Próximo" não deixa avançar,
> **quero** ver o que falta,
> **para que** eu não fique clicando num botão apagado sem saber o motivo.

---

## Contexto e motivação

### O problema observado

`canAdvance` ([SetupWizard.tsx:836](../../../apps/web/src/components/setup/SetupWizard.tsx)) bloqueia o avanço por até cinco condições numa mesma etapa (`class`: classe, subclasse, ferramenta, N slots de kit) e só alimenta `disabled` no botão. O `dmButtonClass` aplica `disabled:pointer-events-none disabled:opacity-45` ([dm.tsx:42](../../../apps/web/src/components/ui/dm.tsx)): nem tooltip nativo chega ao botão. Nada na tela diz o que falta.

Caso concreto de erro de copy: a etapa `identity` diz "Nada aqui é obrigatório além do nome" ([pt-BR.ts:240](../../../apps/web/src/messages/pt-BR.ts)), mas `canAdvance('identity')` exige nome, gênero **e** alinhamento ([:892](../../../apps/web/src/components/setup/SetupWizard.tsx)). Quem preenche só o nome fica parada.

### A proposta

Uma lista do que falta, calculada pela mesma regra que decide `disabled`, mostrada junto do botão. `canAdvance` passa a ser derivada dela (vazia = pode avançar), então as duas não divergem. A copy de `identity` passa a dizer a verdade.

---

## Escopo

### Dentro do escopo

- Função pura `missingFor(step, state)` que devolve as chaves de mensagem do que falta; `canAdvance(s)` vira `missingFor(s).length === 0`.
- Linha de ajuda acima do rodapé quando `missingFor` não é vazia: "Falta: …" (chave por pendência, nos dois locales), ligada ao botão por `aria-describedby`.
- Correção da copy de `setup.identity.subtitulo` (pt-BR e en-US) e marcação de obrigatório nos três campos (`FieldLabel`).
- Cobre todas as etapas com bloqueio hoje: `system`, `class`, `race`, `attributes`, `skills`, `spells`, `identity`, `background`.

### Fora do escopo

- **Rolar até o campo pendente ao clicar no botão desabilitado.** Botão `disabled` não recebe clique; exigiria trocar por `aria-disabled`. Vale só se a lista de pendências não bastar.
- **Validação por campo em tempo real (borda vermelha ao sair do campo).** Padrão diferente, mais barulho.

---

## Critérios de aceite

- [ ] Para cada etapa com bloqueio, existe um caso em que a linha "Falta: …" lista exatamente as pendências reais e some quando o último item é preenchido.
- [ ] `canAdvance(s)` e `missingFor(s)` não podem divergir: `canAdvance` é derivada (não duplica as condições).
- [ ] `identity`: nome, gênero e alinhamento aparecem marcados como obrigatórios; a copy não contradiz a validação.
- [ ] O botão "Próximo" tem `aria-describedby` apontando para a linha de ajuda quando desabilitado.
- [ ] Textos novos existem em pt-BR e en-US.
- [ ] **Teste de regressão:** na etapa `identity`, só com o nome preenchido, o "Próximo" está desabilitado **e** a tela lista "gênero" e "alinhamento" como faltantes.

---

## Notas de implementação

- `SetupWizard.tsx` já passa de 2300 linhas. `missingFor` vai para módulo novo em `components/setup/` (função de 4–20 linhas por etapa), não para o componente.
- `missingFor` lê o mesmo estado que `canAdvance` lê hoje — não crie um segundo cálculo de "orçamento restante" ou de "grant de origem".
- Tradução automática do SRD não entra aqui: as chaves de pendência são texto fixo da UI.

---

## Questões em aberto

1. **A lista fica acima do botão ou vira `title` + texto?** Como `pointer-events-none` mata o `title`, a proposta é texto sempre visível. Confirmar no visual (não verifiquei renderizado).

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `canAdvance` (:836-910), rodapé (:2273-2299), etapa `identity` (:1990)
- [dm.tsx](../../../apps/web/src/components/ui/dm.tsx) — `dmButtonClass` (:42, `disabled:pointer-events-none`)
- [pt-BR.ts](../../../apps/web/src/messages/pt-BR.ts) — `setup.identity.subtitulo` (:240)
