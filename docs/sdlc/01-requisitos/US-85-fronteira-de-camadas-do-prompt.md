# US-85 — A fronteira entre as camadas do prompt ganha um guard que falha fechado

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:**
- [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) — define a regra de fronteira que este guard cobra. **Escrever o ADR primeiro**: guard sem regra escrita vira regra derivada do teste.
- [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md) — cria o registro de nomes que o guard usa como referência. Sem ele, o guard não tem contra o que comparar. As duas cabem num PR só; ver *Notas de implementação*.

**Nasceu de:** a constatação, ao escrever a US-84, de que aquele acoplamento não é um descuido pontual: é o efeito colateral previsível de [US-55](./US-55-prompt-caching-do-dm.md) + [US-56](./US-56-estado-do-turno-na-mensagem.md).
**Relacionada a:** [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md) (mesma família: contrato de prompt sem lugar canônico), [US-73](./US-73-reconciliador-de-cena-em-background.md) (se o reconciliador virar mais um produtor de contexto, a fronteira precisa já estar escrita).

**Criada em:** 2026-07-27

---

## História

> **Como** mantenedor do DM Agent,
> **quero** que um bloco novo na camada 3 **derrube o teste** enquanto não estiver no registro compartilhado,
> **para que** a regra de fronteira do [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) seja cobrada pela máquina e não pela memória de quem revisa o PR.

---

## Contexto e motivação

### O problema observado

A [US-55](./US-55-prompt-caching-do-dm.md) reordenou o system prompt em três camadas por volatilidade. A [US-56](./US-56-estado-do-turno-na-mensagem.md) tirou a camada 3 do system e a prefixou à última mensagem. Ganho real de custo, decisão certa.

O efeito colateral: o que antes era **texto vizinho no mesmo template** virou **duas funções produzindo duas mensagens diferentes** — `buildDmSystemPrompt` (camadas 1+2, cacheada, invariante por aventura) e `buildTurnStateBlock` (camada 3, recomputada todo turno). E a camada 2 continua **citando a camada 3 pelo nome**, em prosa (`dm-system.ts:314`, `:349`, `:359`). Otimização de custo comprou distância; distância é onde string duplicada dessincroniza — foi exatamente o que a [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md) foi criada para desfazer, nos 4 nomes que existem hoje.

Esta story é sobre o **quinto**.

### Por que a solução atual não basta

O que **já está testado** (não refazer): `dm-system.test.ts:126-139` prova que nenhum campo volátil (HP, condições, cena, quests, inventário, resumo) vaza para as camadas 1+2. É a metade "nada volátil sobe" da regra 3 do [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md), e tem guard.

O que **não** está: nada nota um **bloco novo** na camada 3. Adicionar `## Clima atual` ao `buildTurnStateBlock` e citá-lo em prosa no system com um literal fresco passa por `pnpm test`, `pnpm typecheck` e `pnpm eval` sem um vermelho — e nasce dessincronizável no mesmo dia.

A diferença é de **formato**, não de cobertura: o guard existente é uma lista de proibições nomeadas uma a uma (`not.toMatch(/- HP:/)`, `not.toMatch(/envenenado/)`). Contra coisa que ainda não tem nome, ele falha **aberto**. E a [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md) conserta os 4 acoplamentos existentes sem impedir o quinto — desduplicar não é o mesmo que fechar a porta.

### A proposta

Trocar o guard que falha aberto por um que falha fechado: todo cabeçalho emitido na camada 3 tem de estar no registro compartilhado; bloco novo não registrado derruba o teste, com mensagem dizendo onde registrá-lo.

---

## Escopo

### Dentro do escopo

- **Guard fail-closed:** todo cabeçalho `## ` produzido por `buildTurnStateBlock` com todas as seções preenchidas está no registro da [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md). Bloco novo sem entrada no registro = vermelho, com mensagem dizendo o que fazer.
- Ponteiro de uma linha nos dois comentários de `dm-system.ts` (`:175`, `:375`) para o [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) — o comentário explica o *porquê* local, o ADR guarda a regra. **Sem apagar o que os comentários já dizem** (`AGENTS.md` → *Padrões de código*).

### Fora do escopo

- **Escrever a regra.** É o [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md), artefato separado e pré-requisito. Esta story só a cobra.
- **Desduplicar os 4 nomes atuais.** É a [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md). Esta story consome o registro que ela cria.
- **Mudar a divisão de camadas.** O desenho da US-55/US-56 está certo e é o que se quer proteger; nenhuma linha de prompt muda de camada aqui.
- **Guard do lado inverso** (texto estável que vaza para a camada 3 e é re-enviado todo turno). É desperdício de custo, não bug de correção, e não tem hoje um sinal barato de medir. Ver *Questões em aberto* #1.
- **Estender o registro a outros produtores de contexto** (a abertura, o reconciliador da [US-73](./US-73-reconciliador-de-cena-em-background.md)). Só entram quando existirem de fato — abstrair antes de haver terceiro caller é inventar problema.

---

## Critérios de aceite

- [ ] `dm-system.ts:175` e `:375` apontam para o [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) sem perder o que já explicam (os comentários **não** são substituídos — ver `AGENTS.md` → *Padrões de código*).
- [ ] **Teste de regressão (falha fechado):** um bloco `## ` novo em `buildTurnStateBlock`, sem entrada no registro, derruba `pnpm test`. A mensagem de erro nomeia o cabeçalho órfão e diz onde registrá-lo.
- [ ] O guard passa hoje, sem mudar nenhuma linha de prompt.
- [ ] `pnpm test` e `pnpm eval` verdes.

---

## Notas de implementação

- **Ordem: [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) → [US-84](./US-84-nomes-de-bloco-do-turn-state-compartilhados.md) → esta.** O ADR é doc puro e não bloqueia nada; escrito depois, ele sairia descrevendo o mecanismo escolhido (*"use o registro"*) em vez do invariante (*"a camada 2 não nomeia a camada 3 por literal"*), que é o que sobrevive à troca de mecanismo.
- **Pode virar um PR só com a US-84.** São a mesma superfície: ela cria o registro, esta o torna obrigatório. Ficam separadas porque entregam valores diferentes — a US-84 conserta o acoplamento que **existe**, esta impede o **próximo** — e porque a US-84 sozinha já vale a pena se esta for adiada.
- **O guard é de conjunto, não de lista:** extraia os cabeçalhos do bloco renderizado (`/^## (.+)$/m`) e compare com os valores do registro. Uma asserção por nome conhecido volta a falhar aberto — é o formato que esta story existe para substituir.
- **Preencher TUDO no fixture do guard.** `sceneSection` e `entitiesSection` são `''` quando vazios (`dm-system.ts:414`, `:429`); com fixture pela metade o guard só vê metade dos cabeçalhos e passa por engano.
- **Mensagem de erro no padrão do repo:** incluir o valor ofensor e o formato esperado, como o `REVIEWED_CRAFT_HASH` faz em `rubric-drift.test.ts:26`.

---

## Questões em aberto

1. **Vale guard para o lado inverso?** Texto estável que cai na camada 3 é re-enviado a cada turno — custo silencioso, o oposto exato do que a US-55/US-56 compraram. Não há hoje um teste barato para "isto devia estar na camada 2": o único sinal honesto é o tamanho do bloco por turno. Medir com o `DM_CACHE_SPIKE` da [US-55](./US-55-prompt-caching-do-dm.md) antes de inventar asserção.
2. **O registro vira a única forma de nomear bloco?** O guard prova que todo bloco emitido está registrado. Não prova que a prosa da camada 2 usa o registro em vez de um literal novo — para isso seria preciso ler o fonte como texto, e ler fonte em teste é frágil. Aceitar a lacuna (o ADR cobre por convenção) ou fechá-la é decisão desta story; a recomendação é aceitar até haver um caso real.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — `:175-178` e `:375-378`: os dois comentários onde a regra da fronteira vive hoje. `:414`, `:429`: as seções condicionais que o fixture do guard precisa preencher.
- `packages/ai-engine/src/prompts/dm-system.test.ts` — `:126-139`: o guard que **já existe** para o vazamento de campo volátil; o novo é o simétrico dele para blocos.
- `packages/ai-engine/src/rubric-drift.test.ts` — `:26`: o formato de mensagem de erro acionável a copiar.
- [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) — a regra que este guard cobra; a *regra 2* (fronteira) e a *regra 3* (nada volátil sobe, nada estável desce) são o que o teste protege.
