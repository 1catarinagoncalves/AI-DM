# US-259 — "Próximo" desabilitado diz o que falta; a etapa Identidade deixa de prometer que é opcional

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-26](./US-26-criacao-personagem-em-etapas.md) (✅ — dona de `canAdvance`) · [US-210](./US-210-identidade-como-etapa-propria.md) (✅ — dona da etapa `identity`)
**Relacionada a:** [US-268](./US-268-atribuir-bonus-de-origem-e-raca-com-controle-explicito.md) (o beco sem saída mais provável: o +1 de atributo) · [US-269](./US-269-acessibilidade-do-wizard-alvos-erro-e-foco.md)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.
**Implementada em:** 2026-09-21 — ver *Como ficou*.

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

- [x] Para cada etapa com bloqueio, existe um caso em que a linha "Falta: …" lista exatamente as pendências reais e some quando o último item é preenchido.
- [x] `canAdvance(s)` e `missingFor(s)` não podem divergir: `canAdvance` é derivada (não duplica as condições).
- [x] `identity`: nome, gênero e alinhamento aparecem marcados como obrigatórios; a copy não contradiz a validação.
- [x] O botão "Próximo" tem `aria-describedby` apontando para a linha de ajuda quando desabilitado.
- [x] Textos novos existem em pt-BR e en-US.
- [x] **Teste de regressão:** na etapa `identity`, só com o nome preenchido, o "Próximo" está desabilitado **e** a tela lista "gênero" e "alinhamento" como faltantes.

---

## Como ficou (2026-09-21)

- **Regra:** [`missingFor(step, inputs)`](../../../apps/web/src/components/setup/missingFor.ts) devolve as chaves `setup.missing.*` do que falta; uma função por etapa (4–20 linhas), lista vazia = pode avançar. Recebe `AdvanceInputs` — valores crus (contagens e chaves), montados uma vez no componente ([SetupWizard.tsx:841](../../../apps/web/src/components/setup/SetupWizard.tsx)). Os catálogos derivados continuam no componente; só a *condição* mudou de casa.
- **`canAdvance`** ([:862](../../../apps/web/src/components/setup/SetupWizard.tsx)) virou `missingFor(s, advanceInputs).length === 0` — sem condição própria. `next()` e o `disabled` do botão leem a mesma lista. Os comentários de US do antigo `canAdvance` (US-123, 131, 132, 210–214, 220, 221, 226, 229…) foram **movidos** para `missingFor.ts`, ao lado da condição que explicam.
- **Linha de ajuda:** `<p id="setup-missing">` dentro do rodapé, acima de Voltar/Próximo ([:2245](../../../apps/web/src/components/setup/SetupWizard.tsx)): "Falta: gênero, alinhamento." / "Still needed: …". Frase inteira com `{items}`, itens em minúsculas. O rodapé ganhou `flex-wrap` e a linha `w-full` para ocupar a primeira linha sem mexer no `justify-between` dos botões. `aria-describedby` do "Próximo" só existe enquanto há pendência ([:2273](../../../apps/web/src/components/setup/SetupWizard.tsx)).
- **Etapa `identity`:** `setup.identity.subtitulo` agora diz "Nome, gênero e alinhamento são obrigatórios. Aparência e personalidade são opcionais…" (pt-BR e en-US). `FieldLabel` ganhou `required`: asterisco por CSS (`::after`), **fora do texto do rótulo** — o nome acessível não muda e os ~50 `getByLabelText(Alinhamento)` dos testes antigos seguem valendo. Os três campos também levam o atributo `required`.
- **Pendências sem parâmetro:** só a chave, sem contagem ("perícias da classe", não "faltam 2"). Contagem exigiria `missingFor` devolver `{key, vars}`; não foi preciso para o critério.
- **Etapa `system`:** tem `missingFor` (a `canAdvance(system)` continua derivada), mas o rodapé não renderiza nela — escolher o sistema já avança.
- **Testes:** [`missingFor.test.ts`](../../../apps/web/src/components/setup/missingFor.test.ts) cobre **cada** etapa com bloqueio (lista exata + item que some ao resolver). [`SetupWizard.missing.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.missing.test.tsx) cobre pela tela `identity` (regressão do critério, aria-describedby, obrigatoriedade, copy), `class` e `attributes` — as demais etapas ficam só no nível da função. Arquivo novo em vez de crescer o `SetupWizard.test.tsx` (3489 linhas). Suíte do web: 19 arquivos, 275 testes verdes; `tsc --noEmit` e `pnpm dead` limpos. **Não rodei os testes falhando antes do código** — o teste de `missingFor` foi escrito antes do módulo, mas o primeiro run foi já com o módulo pronto.
- **Questão #1 segue aberta no visual:** decidida por texto sempre visível, mas **não vi renderizado** — `/setup` exige login e não autentiquei. Falta olhar o `flex-wrap` do rodapé em 320px (Voltar + Próximo na mesma linha?) e o asterisco dos rótulos.

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

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `advanceInputs`/`canAdvance` (:841-864), rodapé (:2238-2285), etapa `identity` (:1951)
- [missingFor.ts](../../../apps/web/src/components/setup/missingFor.ts) — a regra por etapa
- [dm.tsx](../../../apps/web/src/components/ui/dm.tsx) — `dmButtonClass` (:42, `disabled:pointer-events-none`)
- [pt-BR.ts](../../../apps/web/src/messages/pt-BR.ts) — `setup.identity.subtitulo` (:240)
