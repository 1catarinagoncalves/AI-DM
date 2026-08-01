# US-104 — O cache de prompt vira número

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-103](./US-103-proveniencia-do-endpoint-no-turno.md) — **recomendada e anterior, não obrigatória**. O hit-rate se mede sem ela; um hit-rate *ruim* não se explica sem ela (foi rota errada ou desenho errado?).
**Nasceu de:** [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) §3 — *"o número medido neste repo não está registrado aqui… quem rodar o spike registra o antes/depois neste ADR"* — e da *Questão em aberto* #1 da [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md).
**Relacionada a:** [US-55](./US-55-prompt-caching-do-dm.md) e [US-56](./US-56-estado-do-turno-na-mensagem.md) (o trabalho cujo retorno esta story mede), [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) (o desenho), [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) (a rota que torna o desenho possível)
**Criada em:** 2026-08-01

---

## História

> **Como** quem decide onde a narração roda e quanto ela custa,
> **quero** o hit-rate de cache real deste repo medido e escrito nas ADRs,
> **para que** a decisão de pagar mais caro por token não-cacheado pare de se apoiar num número que ninguém verificou.

---

## Contexto e motivação

### O problema observado

Duas stories ([US-55](./US-55-prompt-caching-do-dm.md), [US-56](./US-56-estado-do-turno-na-mensagem.md)) reorganizaram o prompt inteiro para criar um prefixo cacheável. Uma ADR ([007](../../adr/007-camadas-do-prompt-por-volatilidade.md)) transformou isso em contrato de arquitetura. Outra ADR ([008](../../adr/008-pin-de-roteamento-no-openrouter.md)) pinou a rota do OpenRouter para que o cache pudesse existir.

**Nenhuma das quatro tem um número medido neste repo.** A ADR 007 §3 diz isso com todas as letras e delega a quem rodar o spike. A ADR 008 §3 justifica pagar `$0.140/M` de input (contra `$0.090/M` do Baidu) com uma conta que assume **85% de hit-rate** — número escolhido para ilustrar, não observado.

### Por que não dá para reaproveitar medição antiga

Qualquer leitura anterior a 01/08/2026 está contaminada pelo roteamento. Antes do pin, o OpenRouter escolhia entre os 22 endpoints e fixava a escolha por conversa (sticky routing — ADR 008 §1). Como só **1 dos 22** tem cache implícito, uma sessão inteira podia rodar com hit-rate zero e outra com hit-rate alto, sem nada no log distinguindo as duas. Média sobre isso não mede desenho de prompt: mede sorte.

### O número que decide

O pin só se paga acima de um hit-rate mínimo, e o mínimo é calculável. Com `I` tokens de input e `O` de output por turno, o first-party da DeepSeek (`$0.140` in, `$0.280` out, `$0.0028` cache read) sai mais barato que o Baidu (`$0.090` in, `$0.179` out, sem cache implícito) quando:

```
h > (0.050 + 0.101 × O/I) / 0.1372
```

Para os valores plausíveis deste repo: **≈ 45%** de hit-rate com 8k de input e 900 de saída; **≈ 55%** se a saída subir para 2000 tokens (o raciocínio é gerado e cobrado mesmo com `exclude: true`). Abaixo disso, o pin está custando dinheiro em vez de economizar, e a alternativa Baidu volta à mesa.

Esta story existe para colocar `h` nessa fórmula.

---

## Escopo

### Dentro do escopo

- Rodar o `DM_CACHE_SPIKE` sobre uma sessão real longa o suficiente para o prefixo estabilizar.
- Extrair, por turno: `prompt_tokens`, `cached_tokens`, `completion_tokens` (e `reasoning_tokens`, se vier), `cache_discount`.
- Calcular o hit-rate real, o custo medido por turno e o contrafactual Baidu com os **mesmos** contadores.
- Registrar o resultado em [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) §3 e [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) §3, e fechar a Q1 da ADR 008.
- Resolver a flag `DM_CACHE_SPIKE`: o comentário `ponytail:` ao lado dela manda removê-la quando esta pergunta fechar. Remover, ou promover a métrica permanente — decisão explícita, não omissão.

### Fora do escopo

- Otimizar o hit-rate. Se o número for ruim, esta story **relata**; consertar é a próxima, com o diagnóstico em mãos.
- Trocar de provedor ou de modelo. A fórmula acima diz quando reabrir a discussão; reabrir é outra story.
- Medir latência ou TTFT. Família diferente, e a API de endpoints do OpenRouter devolveu esses campos nulos em 01/08/2026.
- Mexer no desenho das camadas do prompt. A [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) é premissa aqui, não objeto.

---

## Critérios de aceite

- [ ] Uma sessão de **no mínimo 10 turnos** rodada com `DM_CACHE_SPIKE` ligado, com os contadores por turno preservados (arquivo ou colagem no corpo da story — não só o print que já rolou).
- [ ] O hit-rate é reportado **por turno**, não só como média. O turno 1 é sempre miss (é a escrita do cache); média que esconde isso é média enganosa.
- [ ] O custo medido por turno aparece ao lado do contrafactual Baidu, calculado com os mesmos contadores de token.
- [ ] O resultado é comparado ao limiar (≈45–55% conforme a razão saída/entrada) e a story afirma explicitamente: **o pin se paga** ou **o pin não se paga**.
- [ ] [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) §3 e [ADR 008](../../adr/008-pin-de-roteamento-no-openrouter.md) §3 atualizadas com o número. A Q1 da ADR 008 sai de *Questões em aberto*.
- [ ] A flag `DM_CACHE_SPIKE` foi removida **ou** promovida, e a escolha está justificada em uma linha no código.
- [ ] Se o hit-rate ficar abaixo do limiar, a story registra a hipótese principal (rota errada, prefixo instável, prompt abaixo do mínimo de cache do provedor) sem tentar consertar — e abre a story seguinte.

---

## Notas de implementação

- **Onde.** [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts), bloco atrás de `DM_CACHE_SPIKE` no `onFinish`. Ele já despeja `providerMetadata` e `response.body`; o comentário ao lado explica por que os contadores vivem no corpo bruto e não no `usage` normalizado (o pin `@ai-sdk/openai-compatible@0.2.16` não normaliza `cached_tokens`).
- **A sessão precisa ser longa.** O prefixo cacheável é `system` + `history`; ele cresce a cada turno e só compensa depois de alguns. Sessão de 3 turnos mede a escrita do cache, não a leitura.
- **O primeiro turno custa mais, não menos.** Escrita de cache é cobrada em vários provedores. Não é anomalia — é o preço de entrada, e a média tem de mostrá-lo separado.
- **Prefixo estável é premissa, não garantia.** Se algum campo volátil tiver subido para a camada 1 ou 2 desde a [US-85](./US-85-fronteira-de-camadas-do-prompt.md), o hit-rate cai por defeito de prompt e não de rota. O guard da US-85 cobre parte disso; um hit-rate baixo com rota confirmada aponta para cá.
- **Não confundir com contagem de tokens do modelo.** Comparar custo entre provedores de modelos diferentes exige cuidado com tokenizer; entre endpoints do **mesmo** slug, não — é o mesmo tokenizer, e por isso o contrafactual Baidu é honesto.

---

## Questões em aberto

1. **Uma sessão basta?** Uma sessão longa mede o mecanismo. Se o objetivo virar custo mensal, precisa de amostra de sessões reais com comprimentos diferentes — outra story, e provavelmente outra ferramenta.
2. **Promover a métrica ou apagar a flag?** Depende do número. Hit-rate estável e alto: apagar, o desenho está provado. Hit-rate variável: promover, porque a variação é o sinal.
3. **O contrafactual deveria incluir o `gpt-5.6-luna`?** Ele apareceu como candidato em 01/08/2026 (registrado em ADR 008 §5) e tem `structured_outputs`, que o first-party não tem. Mas comparar custo entre modelos diferentes esbarra em tokenizer diferente e, principalmente, em qualidade — que é bake-off ([US-17](./US-17-comparacao-modelos-eval.md) / [US-36](./US-36-eval-de-qualidade-da-narracao.md)), não planilha. Fora do escopo aqui de propósito.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — o bloco `DM_CACHE_SPIKE` no `onFinish` e o `ponytail:` que manda resolvê-la.
- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — `buildDmSystemPrompt` (camadas 1+2) e `buildTurnStateBlock` (camada 3): o prefixo cujo cache está sendo medido.
- [`packages/ai-engine/src/model.ts`](../../../packages/ai-engine/src/model.ts) — o bloco `provider` de `NARRATION_PROVIDER_OPTIONS`: a rota sem a qual esta medição não significa nada.
