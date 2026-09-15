# US-235 — Gatilho assíncrono + tela de espera + erro/retry

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-234](./US-234-gate-regenera-on-fail-com-saneamento.md) (o gate devolve sucesso ou falha-após-teto) · [US-197](./US-197-tela-de-espera-com-carrossel-na-criacao-da-aventura.md) (tela de espera / carrossel de worldbuilding) · [US-60](./US-60-web-em-producao-vercel.md) (o proxy SSE corta em 60s — por que síncrono não serve)
**Relacionado:** [US-216](./US-216-escolher-aventura-pronta-ou-criar-propria-historia.md)/[US-217](./US-217-aventura-pronta-sem-motor-de-geracao.md) (a "Aventura pronta" que NÃO é o fallback) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) · [Arquitetura — §Gatilho e falha](../../arquitetura-motor-aventuras-autorais.md) · [Backlog — MA-5](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13
**Concluída em:** 2026-09-15

---

## História

> **Como** jogador que escolheu "Criar minha história",
> **quero** ver uma tela de espera enquanto o mundo é tecido, e uma tela de erro com "criar de novo" se falhar —
> **para que** eu nunca fique olhando um load travado nem seja jogado numa aventura pronta que eu não pedi.

---

## Contexto e motivação

A autoria leva ~95s (call único de pro) e o proxy SSE corta em **60s** ([US-60](./US-60-web-em-producao-vercel.md)) — rodar no caminho síncrono da criação daria timeout. Então a geração roda em **background**, e o jogador vê a tela de espera (US-197) enquanto cozinha. Se o gate (US-234) esgotar as tentativas, a decisão da mantenedora (2026-09-09) é **erro + retry da autoria, NUNCA cair pra "Aventura pronta"** — quem escolheu criar fica no caminho autoral.

---

## Escopo

### Dentro do escopo

- **Gatilho assíncrono:** ao clicar "Criar aventura" (caminho "Criar minha história"), a geração (US-232→233→234) roda em **background**, fora do caminho síncrono da criação.
- **Tela de espera** (US-197): carrossel de worldbuilding durante o cook, enquadrada como criação, não barra de load.
- **Dois estados terminais:**
  - **Sucesso** → entra no jogo com a aventura gerada.
  - **Falha** (teto do gate estourado, US-234) → **tela de erro + botão "Criar aventura de novo"** (retry da autoria, mesmos parâmetros; sem seed, o retry dá um mundo diferente).
- **Nunca** desvia pra "Aventura pronta" (gancho de classe, US-217) — desviar trairia a escolha do jogador.

### Fora do escopo

- **O gate e a regeneração interna** (US-234) — MA-5 consome o resultado (sucesso/falha), não regenera.
- **`createForCharacter` chamar o motor + semear ledger** — MA-9 (US-239); esta story é a orquestração assíncrona + os estados de tela.
- **O caminho "Aventura pronta"** em si — US-217 (existe, esta story só garante que a falha **não** cai nele).
- **Roteamento pronta×criar** (o toggle) — MA-6 (US-236).

---

## Critérios de aceite

- [x] Clicar "Criar aventura" no caminho autoral dispara a geração em **background**; a criação não bloqueia esperando ~95s nem estoura o teto SSE de 60s.
- [x] Durante o cook, o jogador vê a **tela de espera** (US-197).
- [x] Sucesso do gate → o jogador entra no jogo com a aventura gerada.
- [x] Falha (teto do gate estourado) → **tela de erro** com ação "Criar aventura de novo" que redispara a autoria com os mesmos parâmetros.
- [x] Em falha, o app **nunca** roteia pra "Aventura pronta".
- [x] **Eval / teste:** teste de integração cobrindo os dois estados terminais (sucesso entra no jogo; falha mostra erro+retry e não cai na pronta).
- [x] `pnpm typecheck` e `pnpm test` (api + web) passam (verificado 2026-09-15).

---

## Notas de implementação

- Padrão de background: o Game Server (NestJS) já usa SSE pro turno; a geração off-turn é um job à parte, não um stream de 95s. O estado (gerando / pronto / falhou) é consultável pela tela de espera.
- A "Aventura pronta" (US-217) e o motor são caminhos irmãos escolhidos no toggle (US-236); a falha do motor **não** é um gatilho pra trocar de caminho.
- Não confundir com o fallback de modelo: a **escada de prosa** (US-232) já absorve indisponibilidade de modelo por dentro; o erro de tela é só quando o **gate** esgota tentativas de conteúdo válido.

---

## Decisões técnicas (achados resolvidos antes da implementação)

Levantados lendo o código atual (`createForCharacter` 100% síncrono, sem job/estado
intermediário) — resolvidos sozinho, sem infra nova além de 1 migração pequena:

- **Onde vive o estado "gerando":** `AdventureStatus` ganha `GENERATING`/`FAILED` (hoje só
  `ACTIVE/COMPLETED/ARCHIVED`, [schema.prisma:144](../../../apps/api/prisma/schema.prisma)).
  `Adventure` + `AdventureParticipant` + `CharacterState` passam a ser criados **na hora do
  clique**, síncrono (tudo que os alimenta — `order`, `maxHp`, `fullInventory`, fechar a
  `ACTIVE` anterior — já é calculado ANTES do call de IA no código atual, só move pra cima).
  `title` fica com placeholder (`Aventura de {character.name}`) até o sucesso trocar pelo
  `generated.summary` — evita mexer na coluna. Novo campo `generationError String?` guarda o
  motivo em caso de `FAILED`. O `id` da `Adventure` criada na hora vira o identificador que a
  tela de espera consulta — não precisa tabela de job separada.
- **Execução em background:** sem fila no repo (sem BullMQ/Redis) e Render Free é instância
  única ([US-59](./US-59-api-em-producao-render.md)) — promise solta (sem `await`) no controller,
  que responde assim que a linha `GENERATING` existe. Se o dyno reiniciar no meio dos ~95s, o
  job morre em silêncio (`GENERATING` preso). Aceito para fase 1 (mesmo raciocínio do doc de
  arquitetura, [§Artefatos do motor velho](../../arquitetura-motor-aventuras-autorais.md):
  pré-lançamento, sem usuário real a proteger) — mitigado só do lado cliente: o polling da
  tela de espera tem teto (~120s, folga sobre os ~95s esperados) e cai em erro+retry sozinho
  se estourar, sem depender do servidor emitir `FAILED`.
- **Endpoint novo:** `GET characters/:characterId/adventures/:adventureId/status` — reusa o
  guard `assertOwner` que `getTurns` já usa; devolve `{ status, error? }`.
- **Parâmetros do retry:** o client já guarda `tone/setting/areaType/challenge` no estado do
  `SetupWizard` ([SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx)) —
  "criar de novo" reenvia o mesmo DTO num novo `POST`, sem o servidor persistir nada extra. A
  linha `FAILED` anterior fica de registro (mesmo modelo de `ARCHIVED`/`COMPLETED`
  acumulando histórico), não é apagada nem reaproveitada.
- **Fora do fluxo assíncrono:** o ramo `dto.preset` (US-217, "Aventura pronta") continua 100%
  síncrono — não passa pelo motor nem pelo gate, não tem os ~95s que motivam a US-60.

## Questões em aberto

Nenhuma — o comportamento de falha (erro + retry, nunca pronta) é decisão fechada da mantenedora (2026-09-09).

---

## Notas de implementação (pós-implementação)

- **Backend:** `createForCharacter` (ramo gerado) cria `Adventure`/`AdventureParticipant`/
  `CharacterState` síncronos (status `GENERATING`, título placeholder locale-aware) e dispara
  `runAdventureGeneration` sem `await` (promise solta). O job nunca lança: falha do gate ou
  exceção inesperada escrevem `FAILED` + `generationError` (best-effort — se até essa gravação
  falhar, o teto do polling do cliente cobre). Sucesso escreve `ACTIVE` + o artefato + ledger +
  quest + narração numa transação (`finalizeGeneratedAdventure`).
- **Endpoint de status:** `GET characters/:characterId/adventures/:adventureId/status` →
  `{ status, error? }`; `error` nunca chega à UI (texto interno/não localizado) — só decide
  qual tela renderizar.
- **Frontend:** `createWorldAdventure` (SetupWizard) passa a checar `status` da resposta —
  `GENERATING` entra em `pollAdventureStatus` (intervalo 3s, teto 120s). `ACTIVE` navega;
  `FAILED` ou timeout do teto viram `generationError`, que troca o formulário/tela de espera
  pela nova `AdventureErrorScreen` (retry chama `createWorldAdventure` de novo, mesmos
  parâmetros já vivos no estado do wizard). O ramo `preset` (Aventura pronta) nunca teve
  `GENERATING` — continua navegando direto, sem polling.

## Referências no código

- [US-197](./US-197-tela-de-espera-com-carrossel-na-criacao-da-aventura.md) — tela de espera consumida aqui.
- [apps/api/src/adventure/adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`/`runAdventureGeneration`/`finalizeGeneratedAdventure`/`getGenerationStatus`.
- [apps/api/src/adventure/adventure.controller.ts](../../../apps/api/src/adventure/adventure.controller.ts) — `GET :adventureId/status`.
- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `createWorldAdventure`/`pollAdventureStatus`.
- [apps/web/src/components/setup/AdventureErrorScreen.tsx](../../../apps/web/src/components/setup/AdventureErrorScreen.tsx) — tela de erro + retry.
- [Arquitetura — §Gatilho e falha](../../arquitetura-motor-aventuras-autorais.md).
- [Backlog — MA-5](./backlog-motor-de-geracao-de-aventuras.md).
