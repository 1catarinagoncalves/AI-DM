# US-161 — Jogador escolhe o nível de desafio do encontro

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-159](./US-159-orcamento-de-encontro-lgmrd.md) (`encounterDeadlyThreshold`/`singleMonsterCrCap`, os dois orçamentos que esta story expõe como opção) · [US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) (fixa `encounterDeadlyThreshold` como orçamento único do composer — esta story não desfaz isso, só adiciona uma segunda opção)
**Relacionado:** [US-152](./US-152-statblocks-papel-orcamento.md) (`composeEncounterRoles`, função que ganha o parâmetro) · [US-148](./US-148-perfil-personagem-entrada-motor.md) (`AdventureProfile`, monta por chamada de geração — veículo natural pra preferência por-aventura) · [US-165](./US-165-tela-escolhe-nivel-de-desafio.md) (tela que expõe `challenge` ao jogador — resolve a Questão em aberto #2 desta story) · [US-156](./US-156-catalogos-registro-dto-validacao.md)/[US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (precedente: jogador escolhe `setting`/`tone`/`areaType` via catálogo+DTO+tela, com fallback Aleatório) · [US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md)/[US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md) (dials irmãos, mesma pergunta em aberto sobre onde a preferência mora)
**Criada em:** 2026-08-17

---

## História

> **Como** jogador,
> **quero** escolher se aceito risco maior de combate na aventura gerada pro meu personagem,
> **para que** um personagem de nível 1–3 — onde o orçamento do modo aventura do LGMRD zera o encontro ([US-160](./US-160-composer-encontro-usa-limiar-de-soma.md)) — ainda possa enfrentar combate se eu topar o risco, em vez de ficar preso a uma única resposta fixa.

---

## Contexto e motivação

### O problema observado

[US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) corrigiu `composeEncounterRoles` para empacotar contra `encounterDeadlyThreshold`, o orçamento do modo aventura do LGMRD — mecanicamente correto, mas com uma consequência aceita, não escondida: nível 1–3 sempre devolve array vazio, porque o limiar nasce `0` nesses níveis. A US-160 (*Questões em aberto* #1) deixou em aberto se isso é aceitável pra todo jogador, sempre, sem alternativa.

### Por que a solução atual não basta

O composer hoje só sabe orçar por um caminho (`encounterDeadlyThreshold`). Não existe segundo orçamento acessível ao chamador, e nenhum campo em `Character` ou em `AdventureProfile` ([US-148](./US-148-perfil-personagem-entrada-motor.md)) carrega preferência de risco — a escolha "modo aventura sempre" está hardcoded na função, não é parâmetro.

### A proposta

Reusar, não inventar: `singleMonsterCrCap` é o orçamento antigo (pré-US-160), já implementado, já testado, sempre maior que `encounterDeadlyThreshold` — empacotar contra ele dá composição não vazia em todo nível, incluindo 1–3, ao custo de aproximar o teto que o próprio LGMRD chama de potencialmente letal. Expor os dois orçamentos já existentes em `lazy-encounter-benchmark.ts` como as duas opções de um dial binário de desafio, escolhido pelo jogador: **modo aventura** (default, comportamento da US-160, pode zerar em nível baixo) e **modo desafio** (`singleMonsterCrCap`, sempre não vazio). Nenhuma fórmula nova, nenhuma calibração nova ([US-159](./US-159-orcamento-de-encontro-lgmrd.md) permanece intacta) — só parametrizar qual dos dois orçamentos já existentes `composeEncounterRoles` usa.

---

## Escopo

### Dentro do escopo

- `composeEncounterRoles(level, challenge)` ganha segundo parâmetro — `challenge: 'adventure' | 'challenge'`, chave canônica EN (tradução direta de "modo aventura"/"modo desafio", mesmo padrão da [US-54](./US-54-chaves-canonicas-em-ingles.md)): `'adventure'` usa `encounterDeadlyThreshold` (comportamento da US-160, **default** se o parâmetro for omitido — nenhum chamador existente quebra); `'challenge'` usa `singleMonsterCrCap` (comportamento pré-US-160).
- Testes de regressão para os dois caminhos, nos mesmos níveis já cobertos pela US-160 (1, 4, 5, 8) — nível 1–3 em "modo desafio" deixa de devolver array vazio.
- Comentário do arquivo atualizado: por que os dois orçamentos convivem agora como opções, em vez de um substituir o outro.
- `singleMonsterCrCap` volta a ser importado no caminho de produção de `monster-roles.ts` (a US-160 previa migrar esse import só pro teste; esta story reverte essa previsão porque passa a haver um segundo consumidor de produção).

### Fora do escopo

- **Onde a preferência mora** — decidido: por aventura gerada, não campo persistido em `Character` (ver *Questões em aberto* #1). Wiring (DTO/tela/`config` de `buildAdventureProfile`, US-148) fica fora do escopo desta story.
- **Tela/DTO/i18n pra capturar a escolha do jogador** — decidido: precisa de tela já na fase 1, mas story própria: [US-165](./US-165-tela-escolhe-nivel-de-desafio.md). US-156 (catálogo+DTO) e US-157 (tela) são o precedente de forma, não reusados automaticamente aqui porque o dado é por-encontro, não por-mundo.
- **Wiring de `composeEncounterRoles` num encontro real** — segue de fora como já estava em US-152/US-160; nenhum caller liga isso ainda.
- **Terceira opção ou dial contínuo** — o LGMRD só dá dois orçamentos hardcoded no repo hoje ([US-159](./US-159-orcamento-de-encontro-lgmrd.md)); inventar um terceiro reabriria aquela story, fora do escopo aqui.

---

## Modelo de dados proposto

Nenhum schema de banco novo nesta story — só a assinatura de `composeEncounterRoles` ganha um parâmetro: `challenge?: 'adventure' | 'challenge'`, união de string literal definida junto de `monster-roles.ts`, sem tabela nova.

---

## Critérios de aceite

- [x] `composeEncounterRoles(level, 'adventure')` devolve o mesmo resultado que `composeEncounterRoles(level)` devolvia pós-US-160 (`encounterDeadlyThreshold`).
- [x] `composeEncounterRoles(level, 'challenge')` devolve o mesmo resultado que a implementação pré-US-160 devolvia (`singleMonsterCrCap`).
- [x] Nível 1, 2 e 3 com `'challenge'` (modo desafio): array não vazio.
- [x] `'adventure'` (modo aventura) é o valor default quando `challenge` é omitido — nenhum chamador existente quebra.
- [x] `pnpm typecheck` e testes do módulo passam.
- [x] **Eval / teste de regressão:** as fixtures já usadas pela US-160 (nível 1, 4, 5, 8), duplicadas para os dois valores de `challenge`.

---

## Notas de implementação

- **Arquivo principal:** [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles` ganha parâmetro; o loop guloso não duplica, só a linha do `budget` passa a escolher a fonte.
- **Precedente de wiring pra escolha do jogador:** US-156 (catálogo+DTO+validação) e US-157 (tela, depois da revisão) resolveram o mesmo tipo de problema pra `setting`/`tone`/`areaType`, com fallback Aleatório quando o campo vem omitido. Mesma forma serve de referência pra tela deste dial ([US-165](./US-165-tela-escolhe-nivel-de-desafio.md)) — não reusada automaticamente aqui, escopo desta story fica no composer.
- **Por que dois orçamentos, não um terceiro:** `singleMonsterCrCap` nunca foi removido do repo pela US-160, só deixou de ser o orçamento do loop guloso — reaproveitar a função existente evita qualquer alteração em `lazy-encounter-benchmark.ts`.

---

## Questões em aberto

1. ~~A preferência é escolhida uma vez (perfil do personagem, US-148) ou por aventura gerada?~~ **Resolvido: por aventura gerada.** Personagem pode querer jogar "modo aventura" numa aventura e "modo desafio" noutra — não persiste em `Character`, mesmo padrão de `setting`/`tone`/`areaType` (US-156/US-157).
2. ~~Precisa de tela (como a US-157) já na fase 1, ou um default silencioso ("modo aventura") basta, com "modo desafio" acessível só via API/teste por enquanto?~~ **Resolvido: precisa de tela, já na fase 1.** Story própria — [US-165](./US-165-tela-escolhe-nivel-de-desafio.md) — não bloqueia esta story, que só entrega a função parametrizada.
3. ~~Nome dos dois valores do `challenge`~~ **Resolvido: `'adventure'` / `'challenge'`** — tradução direta de "modo aventura"/"modo desafio", mesmo padrão de chave canônica EN do repo ([US-54](./US-54-chaves-canonicas-em-ingles.md)).

---

## Referências no código

- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `composeEncounterRoles`, a função que ganha o parâmetro.
- [`apps/api/src/adventure-generation/lazy-encounter-benchmark.ts`](../../../apps/api/src/adventure-generation/lazy-encounter-benchmark.ts) — `encounterDeadlyThreshold`/`singleMonsterCrCap`, os dois orçamentos já existentes que viram as duas opções do dial.
- [US-160](./US-160-composer-encontro-usa-limiar-de-soma.md) — corrigiu o default pra `encounterDeadlyThreshold`; esta story não desfaz isso, só adiciona a segunda opção.
- [US-165](./US-165-tela-escolhe-nivel-de-desafio.md) — tela que expõe `challenge` ao jogador, story própria que consome a função parametrizada aqui.
- [US-156](./US-156-catalogos-registro-dto-validacao.md)/[US-157](./US-157-tela-de-mundo-depois-da-revisao.md) — precedente de campo escolhido pelo jogador com fallback default/Aleatório.
- [US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md)/[US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md) — dials irmãos, mesma pergunta em aberto sobre onde a preferência do jogador mora.
