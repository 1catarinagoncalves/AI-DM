# US-235 — Gatilho assíncrono + tela de espera + erro/retry

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Proposta
**Depende de:** [US-234](./US-234-gate-regenera-on-fail-com-saneamento.md) (o gate devolve sucesso ou falha-após-teto) · [US-197](./US-197-tela-de-espera-com-carrossel-na-criacao-da-aventura.md) (tela de espera / carrossel de worldbuilding) · [US-60](./US-60-web-em-producao-vercel.md) (o proxy SSE corta em 60s — por que síncrono não serve)
**Relacionado:** [US-216](./US-216-escolher-aventura-pronta-ou-criar-propria-historia.md)/[US-217](./US-217-aventura-pronta-sem-motor-de-geracao.md) (a "Aventura pronta" que NÃO é o fallback) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) · [Arquitetura — §Gatilho e falha](../../arquitetura-motor-aventuras-autorais.md) · [Backlog — MA-5](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13

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

- [ ] Clicar "Criar aventura" no caminho autoral dispara a geração em **background**; a criação não bloqueia esperando ~95s nem estoura o teto SSE de 60s.
- [ ] Durante o cook, o jogador vê a **tela de espera** (US-197).
- [ ] Sucesso do gate → o jogador entra no jogo com a aventura gerada.
- [ ] Falha (teto do gate estourado) → **tela de erro** com ação "Criar aventura de novo" que redispara a autoria com os mesmos parâmetros.
- [ ] Em falha, o app **nunca** roteia pra "Aventura pronta".
- [ ] **Eval / teste:** teste de integração cobrindo os dois estados terminais (sucesso entra no jogo; falha mostra erro+retry e não cai na pronta).

---

## Notas de implementação

- Padrão de background: o Game Server (NestJS) já usa SSE pro turno; a geração off-turn é um job à parte, não um stream de 95s. O estado (gerando / pronto / falhou) é consultável pela tela de espera.
- A "Aventura pronta" (US-217) e o motor são caminhos irmãos escolhidos no toggle (US-236); a falha do motor **não** é um gatilho pra trocar de caminho.
- Não confundir com o fallback de modelo: a **escada de prosa** (US-232) já absorve indisponibilidade de modelo por dentro; o erro de tela é só quando o **gate** esgota tentativas de conteúdo válido.

---

## Questões em aberto

Nenhuma — o comportamento de falha (erro + retry, nunca pronta) é decisão fechada da mantenedora (2026-09-09).

---

## Referências no código

- [US-197](./US-197-tela-de-espera-com-carrossel-na-criacao-da-aventura.md) — tela de espera consumida aqui.
- [apps/api/src/adventure/adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — onde a criação dispara o job (o wiring do motor em si é MA-9).
- [Arquitetura — §Gatilho e falha](../../arquitetura-motor-aventuras-autorais.md).
- [Backlog — MA-5](./backlog-motor-de-geracao-de-aventuras.md).
