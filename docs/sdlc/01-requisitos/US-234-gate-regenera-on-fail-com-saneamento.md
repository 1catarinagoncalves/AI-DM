# US-234 — Gate: parse + grafo + orçamento + saneamento, regenera-on-fail

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (o artefato de ficção a validar) · [US-233](./US-233-numeros-dos-encontros-passo-2-5e.md) (números do encontro, pro check de orçamento) · [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (gate original — esta story **adapta**, troca re-seed por regenera) · [US-29](./US-29-saneamento-de-rolagens-ficticias.md) (contrato de saneamento + o stripper a reusar)
**Relacionado:** [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (D5 gate/regenera; D1 seed morto) · [Arquitetura — §Saneamento](../../arquitetura-motor-aventuras-autorais.md) · [Backlog — MA-4](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13

---

## História

> **Como** desenvolvedora do motor,
> **quero** um gate que só deixa persistir uma aventura que faz sentido — schema válido, grafo fechado, orçamento cabendo, prosa sem número mecânico —
> **para que** aventura quebrada nunca chegue ao jogador, e a falha regenere em vez de gravar lixo.

---

## Contexto e motivação

A saída do modelo é fronteira de não-confiança: nunca persiste sem passar num gate. A [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) desenhou isso pro motor de tabela (falha ⇒ **re-seed**). Com a inversão, o `seed` morreu (ADR 012 D1) — a recuperação vira **regenerar a CHAMADA 1**. E o schema cresceu (US-232), então o grafo a fechar é maior (facções incluídas). Além disso, a geração é off-turn, então a rede `onFinish` da US-29 (que saneia a narração de turno) **não roda** nela — o contrato "número não pertence à prosa" precisa ser reimposto aqui.

---

## Escopo

### Dentro do escopo

Quatro verificações, em ordem:

1. **`parse()`** do `GeneratedAdventureSchema` crescido (US-232) — forma válida.
2. **Grafo fecha** — toda referência por `id` aponta pra algo que existe, sem órfão: `encounter.locationId`/`npcIds[]`, `challenges[].locationId`, `objective.locationId`, `location.occupants[]` → npc, `npc.factionId`/`location.factionId` → `factions[].id`.
3. **Orçamento cabe** — cada encontro (números da US-233) cabe no nível do personagem; encontro marcado como estouro (US-233) reprova.
4. **Saneamento de mecânica na prosa (contrato US-29):** reusa o stripper da US-29 sobre os campos autorados (`world.description`, `story`, `start`, `summary`, `followUps[]`, `location.boxedText`/`description`, **`challenge.situation`/`consequence`** — o mais propenso a vazar "CD 15" —, `encounter.fiction`, `objective.description`/`reward.effect`, `branchedResolution[].consequence`); remove número de rolagem vazado (não reprova — sana e segue); **valida a perícia nomeada** em `challenge.test` contra o catálogo do sistema (`config.skills` + `config.attributes`, casamento por contém) — "Sabor" não existe, reprova.

- **Falha ⇒ regenera a CHAMADA 1** (não re-seed — o seed morreu), com **teto de tentativas explícito**. Cada retry dá um mundo diferente (sem seed) — comportamento certo aqui.
- **Teto estourado ⇒ sinaliza falha** pra MA-5 (US-235), que mostra erro + "criar de novo". Falha registrada (log) — gerador que regenera sem limite trava a criação.

### Fora do escopo

- **A CHAMADA 1** (US-232) e o **PASSO 2** (US-233) — o gate os orquestra/valida, não os implementa.
- **A tela de espera / erro / retry visível ao jogador** — MA-5 (US-235); o gate só devolve sucesso/falha-após-teto.
- **Persistir + semear o ledger** a partir do artefato aprovado — MA-9 (US-239).

---

## Critérios de aceite

- [x] `parse()` falho ⇒ gate reprova (não persiste).
- [x] Referência órfã (ex. `challenges[].locationId` ou `npc.factionId` apontando pra id inexistente) ⇒ reprova; artefato com grafo fechado passa.
- [x] Encontro acima do orçamento do nível (marcado pela US-233) ⇒ reprova.
- [x] Número de rolagem/CD/dano na prosa é **removido** pelo stripper (US-29); perícia nomeada inexistente no catálogo (ex. "Sabor") ⇒ reprova.
- [x] Falha em qualquer check ⇒ **regenera a CHAMADA 1** (não re-seed), respeitando um teto de tentativas explícito.
- [x] Teto estourado ⇒ gate devolve **falha** (sinal pra MA-5), com a falha registrada; nunca entra em loop infinito.
- [x] **Eval / regressão:** fixtures — (a) artefato válido passa; (b) grafo com órfão reprova; (c) prosa com "CD 15" sai saneada; (d) `challenge.test` = "Sabor" reprova; (e) simulação de N falhas seguidas atinge o teto e devolve falha.
- [x] `pnpm typecheck` e `pnpm test` passam.

---

## Notas de implementação

- Reusar o **mesmo stripper** da US-29 (não escrever um segundo) — só aplicá-lo aos campos autorados do artefato em vez de à narração de turno. Fonte: `stripFabricatedRolls` em `packages/shared/src/narration.ts`.
- Catálogo de perícia = `SystemConfigSchema.skills` (`packages/shared/src/types/system.ts:294`, `SystemSkillSchema` key/label) — o mesmo `config.skills` que `ai.service.ts` já carrega pra `buildSkillSheet`. O gate consulta pela mesma via de acesso (system service); não duplicar a fonte.
- O gate mora em `apps/api/src/adventure-generation/adventure-gate.ts` — já existe e cobre as verificações 1–3 (parse/grafo/orçamento) herdadas da US-150, adaptadas ao schema da US-232. **Falta inteiramente a verificação 4** (saneamento + perícia) — este US adiciona um 4º estágio, não recomeça o gate.
- **Reversão da regra de retry da US-150:** o código atual de `generateWithGate` trata falha de orçamento (estágio `budget`) como erro estrutural e retorna **sem re-semear**, porque `composeEncounterRoles` era puro em `level` (US-150/US-159). Essa premissa morreu — orçamento agora é autorado pela CHAMADA 1 via LLM, não calculado por função pura. O AC desta story ("falha em qualquer check ⇒ regenera") **não abre exceção pro orçamento**: remover o early-return do estágio `budget` em `generateWithGate`, todo estágio (parse/grafo/orçamento/saneamento) re-semeia. Os testes existentes em `adventure-gate.test.ts` que fixam o comportamento antigo (`'verificação 3 (orçamento) falha IMEDIATO, sem reseed'`) precisam mudar junto.
- Teto de tentativas: valor explícito e configurável no código, não mágico — a mensagem de falha inclui quantas tentativas foram feitas.
- **Correção (US-238, 20/09/2026):** o check de `npc.factionId`/`location.factionId` → `factions[].id` (verificação 2 do escopo e AC de "referência órfã") **não existia** em `adventure-gate.ts` — o AC estava marcado ✅ sem código atrás. Entrou como `checkFactionReferences`, com teste. Não afetava produção (`resolveFactionId` do `mint-adventure.ts` descarta índice fora da faixa), mas o eval mede "toda referência por `id`".
- ai-engine/shared rodam de `dist` — buildar após editar `src`.

---

## Questões em aberto

Nenhuma pendente — o teto de tentativas é decisão de implementação (valor a fixar no PR, registrado no código).

Resolvidas antes da implementação (achadas lendo `adventure-gate.ts` e `adventure-generation.ts` atuais):

- `secret.locationId` e `acts[].encounterIds[]` no escopo (verificação 2) eram resíduo de versão anterior do schema — `secrets[]` virou `challenges[]` na US-232, e `acts[]` nunca existiu (`encounters[]` é flat). Corrigido pro grafo real.
- Orçamento (estágio 3) tinha exceção de "nunca re-semeia" herdada da US-150 (`composeEncounterRoles` puro em `level`). Não se aplica mais — orçamento é autorado pela CHAMADA 1. AC desta story não abre exceção; a exceção sai do código.
- A lista de campos autorados do escopo (verificação 4) também era resíduo de versão anterior: `secret.text` não existe (`secrets[]` virou `challenges[]` na US-232) e `npc.interactions[].narrative` saiu inteiramente do schema na US-242 (fala do NPC é sempre gerada fresca no turno, nunca pré-escrita na autoria) — NPC não carrega mais campo de prosa. `challenge` também não tem `description` (só `test`/`situation`/`consequence`). Corrigido pros campos reais; `encounter.fiction` (a narrativa que o jogador lê, US-232) entrou na lista por ser o campo mais óbvio de vazamento que a versão anterior do escopo não previa.

---

## Referências no código

- [apps/api/src/adventure-generation/adventure-gate.ts](../../../apps/api/src/adventure-generation/adventure-gate.ts) — o gate, adapta o regenera-on-fail.
- [US-29](./US-29-saneamento-de-rolagens-ficticias.md) — stripper de rolagem fictícia a reusar.
- [packages/shared/src/types/adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts) — schema crescido (US-232) que o gate valida.
- [Backlog — MA-4](./backlog-motor-de-geracao-de-aventuras.md).
