# US-18 — Histórico de turnos servido pela API

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma (o `EventLog` já persiste os turnos)
**Criada em:** 2026-06-30

---

## História

> **Como** jogador,
> **quero** que o histórico da minha aventura seja carregado do servidor quando eu abro a tela de jogo,
> **para que** eu não perca a conversa ao trocar de navegador, limpar o cache ou voltar noutro dispositivo.

---

## Contexto e motivação

### O problema observado

O histórico de mensagens do chat vive **só no `localStorage` do navegador** (`GameView.tsx`, funções `loadHistory`/`saveHistory`). Se o jogador abre a aventura noutro browser, numa aba anónima, ou depois de limpar dados do site, a tela aparece vazia — como se a aventura nunca tivesse acontecido — mesmo que o servidor tenha o registo completo.

### Por que a solução atual não basta

O componente `GameView` é o único dono do histórico, e a fonte dele é o `localStorage` — não há nenhuma API que o componente consulte para reconstruir a conversa. Isso quebra o princípio de arquitetura "cada componente da interface tem relação direta com uma API": aqui o componente fala com o armazenamento local, não com o servidor.

O dado, porém, **já existe no banco**: o `EventLog` grava cada turno como `ACTION` (ação do jogador) e `NARRATION` (resposta do mestre), e usa a flag `summarized` para saber o que já foi condensado no `memorySummary`. Falta apenas **expor esse histórico para leitura**.

### A proposta

Adicionar um endpoint de leitura que devolve os turnos de uma aventura a partir do `EventLog`, e fazer o `GameView` carregar dele ao montar — substituindo o `localStorage` como fonte de verdade.

---

## Escopo

### Dentro do escopo

- Endpoint `GET` que devolve os turnos de uma aventura em ordem cronológica, derivado do `EventLog` (`ACTION` + `NARRATION`).
- `GameView` carrega o histórico desse endpoint ao montar, em vez de `loadHistory` do `localStorage`.
- Método correspondente em `apps/web/src/lib/api.ts`.

### Fora do escopo

- Paginação / scroll infinito do histórico — uma aventura de MVP cabe numa resposta só. Pode virar story futura se as aventuras crescerem.
- Edição ou exclusão de turnos.
- Histórico cross-aventura / linha do tempo da campanha (isso é US-06).
- Migração do `localStorage` existente: ao ligar o endpoint, ele passa a ser a fonte; o cache local pode ser descartado ou mantido só como otimização offline.

---

## Modelo de dados proposto

> Nenhum dado novo. Reaproveita o `EventLog` existente.

Forma da resposta do endpoint (derivada de `EventLog`):

```json
[
  { "role": "user", "content": "Abro a porta da taverna." },
  { "role": "dm", "content": "A porta range. Lá dentro, três figuras..." }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `role` | `"user" \| "dm"` | Mapeado de `EventType.ACTION` → `user` e `EventType.NARRATION` → `dm`. |
| `content` | string | Texto do turno, extraído do `payload` do evento. |

**Persistência:** nenhuma nova — leitura sobre `EventLog` (`@@index([adventureId, characterId, type, summarized])` já cobre a query).

---

## Critérios de aceite

- [ ] Existe um endpoint `GET` que devolve os turnos de uma aventura em ordem cronológica, mapeando `ACTION → user` e `NARRATION → dm`.
- [ ] O `GameView` carrega o histórico desse endpoint ao montar, em vez de ler do `localStorage`.
- [ ] Abrir a mesma aventura num navegador diferente (sem `localStorage`) mostra a conversa completa.
- [ ] O endpoint inclui também os turnos já marcados como `summarized` (o histórico visível ao jogador não some quando o resumo é condensado).
- [ ] **Eval / teste de regressão:** dada uma aventura com N turnos no `EventLog`, o endpoint devolve exatamente N mensagens na ordem correta, com os papéis corretos.

---

## Notas de implementação

- A query é um `findMany` em `EventLog` filtrando `adventureId` e `type in [ACTION, NARRATION]`, ordenado por `createdAt`.
- Endpoint natural: `GET /adventures/:id/turns` no `CampaignController` (onde as aventuras já vivem) ou um novo controller de aventura.
- Confirmar como o texto do turno está guardado no `payload` do `EventLog` (string direta vs objeto) antes de mapear — ver onde `ai.service.ts` grava os eventos.
- No `GameView`, trocar o `useEffect` que chama `loadHistory` por uma chamada à API; manter `saveHistory` no `localStorage` é opcional (cache), não obrigatório.

---

## Questões em aberto

1. Manter o `localStorage` como cache otimista (evita flash de tela vazia enquanto carrega) ou remover de vez?
2. O endpoint deve filtrar por `characterId` além de `adventureId`? Em single-player é 1:1, mas a coluna existe no índice.

---

## Referências no código

- `apps/web/src/components/game/GameView.tsx` — `loadHistory`/`saveHistory`, `useEffect` de carga inicial.
- `apps/web/src/lib/api.ts` — onde entra o novo método de leitura.
- `apps/api/src/ai/ai.service.ts` — onde os turnos são gravados no `EventLog`.
- `apps/api/prisma/schema.prisma` — `EventLog`, enum `EventType`, índice existente.
