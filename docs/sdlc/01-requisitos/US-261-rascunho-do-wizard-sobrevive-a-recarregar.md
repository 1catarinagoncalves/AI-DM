# US-261 — O rascunho do personagem sobrevive a recarregar a página e a sair do wizard

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-26](./US-26-criacao-personagem-em-etapas.md) (✅) · [US-107](./US-107-voltar-ao-hub-de-personagens.md) (✅ — **reabre** o argumento "nada se perde, o wizard só grava no `handleConfirm`")
**Relacionada a:** [US-260](./US-260-corrigir-a-partir-da-revisao-sem-refazer-o-caminho.md) · [US-258](./US-258-voltar-do-mundo-recria-o-personagem.md)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.

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

- Gravação com debounce de todos os campos de criação (`system`, `charData`, `subclass`, `level`, escolhas de raça/classe/origem, `attrs`, `skills`, `bg`, `step`).
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

- [ ] Recarregar a página numa etapa intermediária restaura a mesma etapa e os mesmos valores.
- [ ] Sair por "Voltar aos personagens" e voltar a `/setup` na mesma aba restaura o rascunho.
- [ ] Chave de raça/classe/origem que não existe no catálogo carregado é descartada, sem quebrar o wizard.
- [ ] Rascunho com `v` diferente é ignorado.
- [ ] Depois de `handleConfirm` bem-sucedido, o rascunho não existe mais.
- [ ] Storage indisponível (leitura ou escrita lança) não quebra a tela.
- [ ] Textos do aviso nos dois locales.
- [ ] **Teste de regressão:** preenche até `skills`, remonta o componente e afirma o mesmo `step`; em seguida o mesmo com um catálogo que perdeu a classe escolhida, e afirma volta a `class` sem erro.

---

## Notas de implementação

- São ~25 `useState`. Extrair um hook `useWizardDraft` e, se preciso, consolidar os campos num objeto é preferível a 25 chamadas de `setItem`. É refactor grande num arquivo de 2300 linhas: fazer em passo separado, com o teste acima verde antes e depois.
- Texto livre da jogadora fica no navegador dela. `sessionStorage` morre com a aba, o que limita a exposição.

---

## Questões em aberto

1. **`sessionStorage` (dura a aba) ou `localStorage` (dura dias)?** A proposta é `sessionStorage`: cobre F5 e clique errado, e não carrega rascunho velho contra um catálogo que mudou semanas depois. `localStorage` cobre "fechei e volto amanhã", mas exige rascunho por usuário (login compartilhado no mesmo navegador) e TTL.
2. **Quem sai da conta no meio?** Limpar o rascunho no logout.

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — estados (:286-401), `handleSelectSystem` (:740, reset por catálogo), `handleConfirm` (:927)
