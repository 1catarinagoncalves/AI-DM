# US-57 — Warm-up do servidor na entrada do jogo (esconder o cold start do free tier)

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (2026-07-19)
**Depende de:** [ADR 006 — Deploy a custo zero](../../adr/006-deploy-custo-zero.md) (D2/D3: free tier suspende; D6: aquecer na entrada) · [US-18](./US-18-historico-servido-pela-api.md) (o `getTurns` que é reusado como aquecimento)
**Criada em:** 2026-07-19

---

## História

> **Como** jogador que volta a uma aventura já começada,
> **quero** que o servidor acorde **enquanto a mesa carrega**, com o tempo de espera à vista,
> **para que** a lentidão do cold start apareça na abertura — e não como um "travamento" no primeiro turno do Mestre.

---

## Contexto e motivação

### O problema observado

No deploy a custo zero ([ADR 006](../../adr/006-deploy-custo-zero.md)), o processo do api (Render) suspende após ~15 min ocioso e a compute do Postgres (Neon) autossuspende. A **primeira** requisição depois de um vale de tráfego paga dezenas de segundos para acordar os dois.

O pior lugar para essa espera cair é o **primeiro turno do Mestre**: ali ela **soma** com a latência normal do LLM (2–5s) e chega ao streaming SSE. O jogador digita a ação, carrega Enter e fica encarando uma bolha vazia por 40–60s — lê como o jogo travado, não como "o servidor está a acordar".

### Por que a solução atual não basta

Nada aquecia o servidor de propósito. No fluxo via setup o cold start já era pago cedo (o `listSystems`/`createCharacter` acordavam o stack antes do jogo). Mas o **jogador que volta com sessão salva** cai direto em `/play/[adventureId]` sem passar pelo setup: a **primeira** chamada da sessão é o `getTurns` do mount do `GameView` — e, se o jogador começar a digitar antes de ela resolver, o cold start reaparece no turno.

### A proposta

Aquecer o servidor **na entrada da mesa** reusando a chamada que o cliente já faz ao montar (`getTurns`), travar o input até ela resolver e mostrar um contador de segundos. A espera passa a ser um estado explícito da abertura ("O Mestre está a despertar… 8s"), não uma surpresa no meio do jogo.

---

## Escopo

### Dentro do escopo

- **Reusar `getTurns` como aquecimento.** É a primeira chamada do mount do `GameView` e **toca o Postgres** (carrega o histórico) — logo acorda o processo do api (Render) **e** a compute do Neon numa tacada. Sem endpoint novo.
- **Gate do input durante o aquecimento.** Textarea e botão desabilitados enquanto `getTurns` não resolve (ou falha); placeholder muda para "O Mestre está a despertar…". `sendMessage` também recusa envio nesse estado (defesa contra Enter).
- **Contador de segundos à vista.** Uma faixa `role="status"` com o tempo decorrido, que **só aparece depois de 1s** — servidor já quente resolve em ms e a faixa nem pisca.
- **Destravar em qualquer desfecho.** `.finally()` libera o input tanto no sucesso quanto na falha do `getTurns` (falha cai no cache local do histórico, como já era).

### Fora do escopo

- **Endpoint `/health` dedicado.** Um ping que só responde `ok` acordaria o processo mas **não** o Neon (não toca o banco) — a 1ª query ainda pagaria o cold start do DB. O `getTurns` já toca o banco, então serve melhor e é de graça. Descartado por acréscimo sem ganho.
- **Re-sleep por ociosidade *dentro* da mesa.** Se o jogador abrir a mesa e ficar >15 min parado sem enviar nada, o servidor volta a dormir e a mensagem seguinte paga cold start de novo. Não coberto — ver questão em aberto.
- **Aquecimento antecipado no setup/home.** O fluxo via setup já aquece por efeito colateral das chamadas de criação; adiantar um ping no home seria otimização para um caso que já está coberto. Não entra.
- **Manter o servidor sempre quente** (ping periódico via cron externo) — queima horas do free tier; contra o objetivo de custo zero (ADR 006).

---

## Critérios de aceite

- [x] Ao montar o `GameView`, o input (textarea + botão) fica **desabilitado** até o `getTurns` do mount resolver ou falhar.
- [x] `sendMessage` **recusa** envio enquanto o aquecimento não terminou (mesmo via Enter).
- [x] Enquanto aquece, aparece uma faixa `role="status"`/`aria-live="polite"` com o **número de segundos** decorridos, **apenas** se a espera passar de 1s.
- [x] Servidor quente (`getTurns` resolve em <1s): a faixa **não aparece** e o input libera sem flash perceptível.
- [x] O input **destrava** tanto no sucesso quanto na falha do `getTurns` (a falha mantém o histórico do cache local).
- [x] **Regressão:** os testes do `GameView` continuam verdes — o gate não quebra a troca de abas nem o carregamento de histórico. (`apps/web` · `GameView.test.tsx`, 11 testes)

---

## Notas de implementação

- **Tudo no cliente, zero backend.** A mudança é só no `GameView`; nenhum endpoint, nenhuma migração, nenhuma env var nova.
- **Estado:** `warming` (inicia `true`) e `warmSecs`. O efeito de mount seta `warming` no início e limpa no `.finally()` do `getTurns`. Um segundo efeito roda um `setInterval` de 1s **só** enquanto `warming`, e para no cleanup.
- **Anti-flash:** a faixa é condicionada a `warming && warmSecs >= 1`. Como o primeiro tick do intervalo é a 1s, um servidor quente (resolve em ms) nunca chega a `warmSecs === 1` e a faixa não renderiza.
- **Por que o `getTurns` e não outra chamada:** ele é o primeiro fetch do mount **e** toca o banco. Aquecer o processo sem tocar o Neon deixaria metade do cold start para o turno. Ver "Fora do escopo".

---

## Questões em aberto

1. **Re-sleep dentro da mesa (>15 min ocioso):** vale re-armar o aquecimento quando a aba volta ao foco (`visibilitychange`) ou quando o jogador começa a digitar depois de um intervalo longo? Custo baixo, fecha o último buraco sem ping periódico. Adiado até haver sinal de que incomoda na prática.
2. **Texto do indicador com o tempo esperado:** mostrar só os segundos decorridos ou também uma estimativa ("~até 60s no primeiro acesso")? A estimativa gerencia expectativa, mas erra quando o servidor está quente. Mantido só o contador por ora.

---

## Referências no código

- `apps/web/src/components/game/GameView.tsx` — estado `warming`/`warmSecs`; efeito de mount que reusa `getTurns` como aquecimento (`.finally` destrava); efeito do contador de segundos; gate no `sendMessage`, no textarea e no botão; faixa `role="status"` com o tempo.
- `apps/web/src/lib/api.ts` — `getTurns` (reusado como está, sem mudança) — a chamada que toca o banco e acorda Render + Neon.
- `docs/adr/006-deploy-custo-zero.md` — D6 (aquecer na entrada) e o risco de cold start em cascata que esta US mitiga.
