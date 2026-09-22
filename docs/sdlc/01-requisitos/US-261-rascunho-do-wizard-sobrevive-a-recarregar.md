# US-261 — O rascunho do personagem sobrevive a recarregar a página e a sair do wizard

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-26](./US-26-criacao-personagem-em-etapas.md) (✅) · [US-107](./US-107-voltar-ao-hub-de-personagens.md) (✅ — **reabre** o argumento "nada se perde, o wizard só grava no `handleConfirm`")
**Relacionada a:** [US-260](./US-260-corrigir-a-partir-da-revisao-sem-refazer-o-caminho.md) · [US-258](./US-258-voltar-do-mundo-recria-o-personagem.md)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.
**Implementada em:** 2026-09-21 — ver *Como ficou*.

---

## História

> **Como** jogadora a meio de uma criação de dez etapas,
> **quero** que recarregar a página ou clicar em "Voltar aos personagens" sem querer não apague o que já preenchi,
> **para que** um clique errado não me custe a criação inteira.

---

## Contexto e motivação

### O problema observado

O wizard guarda tudo em `useState` ([SetupWizard.tsx:286-401](../../../apps/web/src/components/setup/SetupWizard.tsx), cerca de 25 estados) e não persiste nada: nenhum `localStorage`/`sessionStorage`/`beforeunload` no arquivo (grep). F5, fechar a aba, ou o link "Voltar aos personagens" (sempre visível no topo) zeram a criação.

### Por que a solução atual não basta

A [US-107](./US-107-voltar-ao-hub-de-personagens.md) recusou o diálogo de confirmação porque "nada se perde: o wizard só grava no `handleConfirm`". Vale para o **servidor**. Não vale para o tempo da jogadora: são dez etapas, com textareas de história, ideais, vínculos e fraquezas. Um diálogo de confirmação é a resposta errada (atrito em todo "sair"); o rascunho resolve a perda sem atrito.

### A proposta

O estado do wizard é gravado em `sessionStorage` a cada mudança e restaurado ao montar, com um aviso "Retomamos de onde você parou · Recomeçar". Apaga-se quando o personagem é criado.

---

## Escopo

### Dentro do escopo

- Gravação a cada mudança (sem debounce — ver *Como ficou*) de todos os campos de criação (`system`, `charData`, `subclass`, `level`, escolhas de raça/classe/origem, `attrs`, `skills`, `bg`, `step`).
- Restauração depois do carregamento do catálogo (`listSystems`), **validando cada chave contra o catálogo**: chave que não existe mais é descartada, como `handleSelectSystem` já faz ao trocar de sistema.
- Aviso de retomada com ação "Recomeçar" (limpa o rascunho e volta a `system`).
- Limpeza do rascunho no sucesso de `handleConfirm`.
- Tudo dentro de `try/catch` (`sessionStorage` pode lançar em janela privada ou com dados de site bloqueados) — sem storage, o wizard funciona como hoje.

### Fora do escopo

- **Rascunho no servidor** (cruza dispositivos). Exige endpoint e modelo novos.
- **Persistir o passo `world`** e o `charId`: depois da criação não há mais rascunho (ver [US-258](./US-258-voltar-do-mundo-recria-o-personagem.md)).
- **Diálogo de confirmação ao sair.** Continua recusado; o rascunho o torna desnecessário.

---

## Modelo de dados proposto

```json
{ "v": 1, "systemId": "…", "step": "skills", "charData": {}, "attrs": {}, "skills": [], "bg": {} }
```

| Campo | Tipo | Descrição |
|---|---|---|
| `v` | número | Versão do formato. Rascunho com `v` diferente é descartado, nunca migrado. |
| demais | — | Espelham os estados do wizard. Sem segredos; texto livre da jogadora. |

**Persistência:** `sessionStorage`, chave `aidm.wizard.draft`. Sem tabela, sem API.

---

## Critérios de aceite

- [x] Recarregar a página numa etapa intermediária restaura a mesma etapa e os mesmos valores.
- [x] Sair por "Voltar aos personagens" e voltar a `/setup` na mesma aba restaura o rascunho.
- [x] Chave de raça/classe/origem que não existe no catálogo carregado é descartada, sem quebrar o wizard.
- [x] Rascunho com `v` diferente é ignorado.
- [x] Depois de `handleConfirm` bem-sucedido, o rascunho não existe mais.
- [x] Storage indisponível (leitura ou escrita lança) não quebra a tela.
- [x] Textos do aviso nos dois locales.
- [x] **Teste de regressão:** preenche até `skills`, remonta o componente e afirma o mesmo `step`; em seguida o mesmo com um catálogo que perdeu a classe escolhida, e afirma volta a `class` sem erro.

---

## Como ficou (2026-09-21)

- **Módulo:** [`wizardDraft.ts`](../../../apps/web/src/components/setup/wizardDraft.ts) — só I/O e validação contra o catálogo; quem conhece os ~25 `useState` é o `SetupWizard`. `stringifyDraft` (dono do `v`), `writeWizardDraft`/`clearWizardDraft` (engolem qualquer exceção de storage), `loadWizardDraft` (devolve `null` para qualquer falha: sem rascunho, outra versão, sistema que sumiu, JSON quebrado) e `reconcileDraft` (pura).
- **Sem hook nem refactor dos 25 estados.** A nota de implementação previa `useWizardDraft` e consolidar os campos num objeto; não foi preciso. O wizard monta uma string JSON por render (`draftJson`) e um único efeito grava quando ela muda — sem lista de 25 dependências e sem 25 `setItem`. A restauração são quatro funções curtas de setters (`restoreDraft` + um `apply…Draft` por grupo).
- **Sem debounce** (o *Escopo* pedia). ~3 KB de JSON por tecla custam menos que o re-render que a mesma tecla já causa, e um timer **perderia a última edição** se a jogadora clicasse "Voltar aos personagens" antes de ele disparar — o cenário que a story existe para cobrir. Gravar a cada mudança é o texto da própria *Proposta*.
- **Reconciliação com o catálogo** (`reconcileDraft`): classe, subclasse, raça, origem e alinhamento ausentes do catálogo carregado caem **com as escolhas que dependiam deles** (os mesmos grupos que `handleSelectSystem` zera) e `step`/`furthest` recuam até a etapa afetada — nunca avançam. Sistema que não está mais na lista descarta o rascunho inteiro. Só `v`/`step`/`systemId` são checados na leitura; o resto é confiado (só este módulo escreve a chave, e mudar o formato sobe `DRAFT_VERSION`).
- **Achado ao ler o fluxo:** `setEquipmentChoiceAt` pode deixar buraco no array (escolher o slot 3 antes do 1); o JSON grava `null`, que o wizard leria como a opção 0 (`null !== ''`). `reconcileDraft` normaliza para `''`.
- **Quando grava:** `hydrated` (só depois da tentativa de restaurar — senão o estado vazio do mount apagaria o rascunho antes de lido), com sistema escolhido e sem `charId`. Depois de `handleConfirm` bem-sucedido `charId` sobe, o JSON vira `null` e o mesmo efeito apaga a chave. Falha em `handleConfirm` não apaga nada.
- **Aviso:** `resumedStep` guarda a etapa onde o rascunho foi retomado; o "Retomamos de onde você parou. · Recomeçar" aparece só nela (sai ao andar, sem estado de "dispensado"). `role="status"`, sem mexer no foco (a [US-269](./US-269-acessibilidade-do-wizard-alvos-erro-e-foco.md) pede isso). Chaves `setup.draft.resumed`/`setup.draft.restart` nos dois locales.
- **"Recomeçar"** remonta o wizard por `key` (`SetupWizard` virou um invólucro de `SetupWizardRun`) em vez de repetir os setters de reset; `clearWizardDraft` roda antes, então o remonte nasce sem rascunho.
- **Logout** (Questão #2): `AuthNav` chama `clearWizardDraft()` antes de `signOut`.
- **`sessionStorage`** (Questão #1), pela recomendação.
- **Testes:** [`wizardDraft.test.ts`](../../../apps/web/src/components/setup/wizardDraft.test.ts) (`reconcileDraft`, 6 casos) e [`SetupWizard.draft.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.draft.test.tsx) (fake class `FakeSetupApi` com `classes` mutável; `BlockedStorage` que lança em toda operação). O de regressão da story é o 2º do arquivo. Escritos antes do módulo: falhavam por import.
- **Efeito colateral nos testes existentes:** `sessionStorage` sobrevive entre os testes do mesmo arquivo no happy-dom, então o wizard do teste seguinte restauraria o rascunho do anterior. `vitest.setup.ts` (novo, ligado em `vitest.config.ts`) limpa `sessionStorage` a cada `beforeEach`. Um caso de `SetupWizard.furthest.test.tsx` remonta no meio do teste esperando um wizard novo; passou a limpar o storage antes.
- **Se a [US-263](./US-263-etapa-magias-so-quando-ha-o-que-mostrar.md) tornar `steps` dinâmico:** o rascunho guarda `step` como chave (validada contra `steps` na leitura) mas `furthest` como **índice**. Mudou o significado do índice → subir `DRAFT_VERSION`.
- **Não verificado no navegador:** `/setup` exige login e API; coberto em happy-dom (suíte web: 23 arquivos, 301 testes, `tsc --noEmit` limpo). O aviso não foi visto em tela estreita.

---

## Notas de implementação

- São ~25 `useState`. Extrair um hook `useWizardDraft` e, se preciso, consolidar os campos num objeto é preferível a 25 chamadas de `setItem`. É refactor grande num arquivo de 2300 linhas: fazer em passo separado, com o teste acima verde antes e depois.
- Texto livre da jogadora fica no navegador dela. `sessionStorage` morre com a aba, o que limita a exposição.

---

## Questões em aberto

1. **`sessionStorage` (dura a aba) ou `localStorage` (dura dias)?** *Decidido: `sessionStorage`.* A proposta é `sessionStorage`: cobre F5 e clique errado, e não carrega rascunho velho contra um catálogo que mudou semanas depois. `localStorage` cobre "fechei e volto amanhã", mas exige rascunho por usuário (login compartilhado no mesmo navegador) e TTL.
2. **Quem sai da conta no meio?** Limpar o rascunho no logout. *Feito em `AuthNav`.*

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — estados (:297-419), `handleSelectSystem` (:778, reset por catálogo), `handleConfirm` (:960), `restoreDraft` (:824), `draftJson` (:435)
- [wizardDraft.ts](../../../apps/web/src/components/setup/wizardDraft.ts) — formato, gravação e reconciliação com o catálogo
