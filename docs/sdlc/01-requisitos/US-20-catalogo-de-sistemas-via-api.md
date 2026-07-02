# US-20 — Catálogo de sistemas servido pela API

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma (endpoint e cliente já existem)
**Criada em:** 2026-06-30

---

## História

> **Como** jogador,
> **quero** escolher o sistema de regras a partir da lista real que o servidor conhece,
> **para que** as opções no setup nunca fiquem dessincronizadas dos sistemas que de facto existem no banco.

---

## Contexto e motivação

### O problema observado

No `SetupWizard`, o `<select>` de sistema tem as opções **escritas à mão no JSX** (`system-free`, `system-dnd5e`). Se um sistema for adicionado, renomeado ou removido no banco, a UI continua a mostrar a lista velha — e pode oferecer um `systemId` que já não existe, ou esconder um que existe.

### Por que a solução atual não basta

O endpoint `GET /campaigns/systems` **já existe** (`CampaignController.listSystems`) e o cliente `api.listSystems()` **já está escrito** em `apps/web/src/lib/api.ts` — mas o componente simplesmente não os usa. É o caso mais claro de "componente sem relação direta com a API": a API existe, o método existe, e a UI ignora ambos a favor de constantes hardcoded.

### A proposta

Ligar o `<select>` ao `api.listSystems()`: buscar os sistemas ao montar o passo de campanha e renderizar as `<option>` a partir da resposta.

---

## Escopo

### Dentro do escopo

- O passo de campanha do `SetupWizard` busca os sistemas via `api.listSystems()` ao montar.
- As `<option>` são renderizadas a partir da resposta; o default selecionado vem da lista (ex.: primeiro item) em vez de um id fixo.

### Fora do escopo

- CRUD de sistemas pela UI (criar/editar sistema é admin/seed, não setup).
- Upload de livro de regras (US-12).
- Descrições ricas / metadados de cada sistema além do que `listSystems` já devolve.

---

## Modelo de dados proposto

> Nenhum dado novo. A resposta de `GET /campaigns/systems` já existe:

```json
[
  { "id": "system-free", "name": "Free", "sourceType": "FREE" },
  { "id": "system-dnd5e", "name": "D&D 5e SRD", "sourceType": "SRD" }
]
```

**Persistência:** nenhuma — leitura sobre a tabela `System`.

---

## Critérios de aceite

- [ ] O `<select>` de sistema é populado a partir de `api.listSystems()`, não de `<option>` hardcoded.
- [ ] Adicionar/remover um `System` no banco (via seed) reflete na lista do setup sem tocar no código do componente.
- [ ] O `systemId` enviado em `createCampaign` é sempre um id presente na lista devolvida pela API.
- [ ] Há um estado de carregamento/erro mínimo: se a busca falhar, o jogador vê uma mensagem em vez de uma lista vazia silenciosa.
- [ ] **Eval / teste de regressão:** com dois sistemas no banco, o setup renderiza exatamente duas opções com os `id`/`name` vindos da API.

---

## Notas de implementação

- Diff pequeno: `useEffect` no passo `campaign` que chama `api.listSystems()` e guarda num `useState`; mapear para `<option>`.
- Definir o default de `campData.systemId` a partir do primeiro item carregado, não da string fixa `'system-free'`.
- `api.listSystems()` já tipa o retorno (`{ id, name, sourceType }[]`) — reusar.

---

## Questões em aberto

1. Mostrar a descrição longa (ex.: "narração livre, sem sistema oficial") que hoje está no JSX — vem da API ou fica como mapa de rótulos no front? `listSystems` só devolve `name`/`sourceType` hoje.

---

## Referências no código

- `apps/web/src/components/setup/SetupWizard.tsx` — `<select>` com `<option>` hardcoded e default `'system-free'`.
- `apps/web/src/lib/api.ts` — `api.listSystems()` (já existe, não usado).
- `apps/api/src/campaign/campaign.controller.ts` — `GET systems` → `listSystems`.
- `apps/api/prisma/schema.prisma` — modelo `System`.
