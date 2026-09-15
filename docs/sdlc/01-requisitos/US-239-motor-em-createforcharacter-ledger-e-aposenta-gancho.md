# US-239 — Motor entra em createForCharacter, ledger do artefato, aposenta gancho fixo

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (CHAMADA 1) · [US-234](./US-234-gate-regenera-on-fail-com-saneamento.md) (gate — só persiste o que passa) · [US-151](./US-151-semear-ledger-segredos-gerados.md) (semear o ledger a partir do artefato)
**Relacionado:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (sai a validação hook≠classe) · [US-155](./US-155-aposentar-quest-fixa-por-classe.md) (aposenta a quest fixa) · [US-217](./US-217-aventura-pronta-sem-motor-de-geracao.md) (gancho de classe sobrevive como "Aventura pronta") · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) · [Backlog — MA-9](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13

---

## História

> **Como** jogador que cria um personagem e escolhe "Criar minha história",
> **quero** que a criação gere de fato uma aventura autoral e a semeie no mundo do jogo —
> **para que** eu entre numa aventura tecida pelo motor, não no gancho fixo derivado da minha classe.

---

## Contexto e motivação

Hoje `createForCharacter` resolve um **gancho fixo por classe** (`resolveInitialHook(config, class)`) e valida que o hook bate com a classe (US-153). Com o motor, a aventura deixa de ser derivada da classe (US-153) — `createForCharacter` passa a **chamar o motor** (US-232→233→234). O artefato aprovado precisa alimentar o **ledger** `WorldEntity[]` (US-151): segredos com `revelado:false`, NPCs com `revelado:true`. E a quest fixa (`primaryQuestTitle`/`primaryQuestDescription`) se aposenta (US-155). O gancho de classe **não some**: vira porta de entrada (`openingNarration` = seed do gancho leve) e o caminho "Aventura pronta" (US-217).

---

## Escopo

### Dentro do escopo

- **`createForCharacter` chama o motor** (US-232→US-233→US-234) no ramo "Criar minha história", em vez de `resolveInitialHook(config, class)`.
- **Sai a validação que rejeita hook ≠ classe** (US-153) — a aventura não é mais derivada da classe.
- **Semear o ledger** `WorldEntity[]` a partir do artefato congelado (US-151): segredos `revelado:false`, NPCs `revelado:true`, locais conforme US-151.
- **Aposentar `primaryQuestTitle`/`primaryQuestDescription`** dos ganchos (US-155) — a quest primária vem do `objective` do artefato, não do gancho fixo.
- **Gancho de classe sobrevive** só como: (a) `openingNarration` = seed do gancho leve na abertura; (b) caminho "Aventura pronta" (US-217, sem motor).

### Fora do escopo

- **A geração e o gate** (US-232/234) — esta story os **chama**, não os implementa.
- **A orquestração assíncrona + telas** (US-235/MA-5) — o gatilho/estado de espera; esta story é o ponto de entrada no serviço.
- **O roteamento do toggle pronta×criar** (US-236/MA-6) — esta story implementa o ramo "criar"; o ramo "pronta" é US-217.
- **O eval** (US-238/MA-8).

---

## Critérios de aceite

- [ ] `createForCharacter`, no ramo "Criar minha história", chama o motor (US-232→233→234) e persiste o artefato aprovado em `Adventure.generatedAdventure`.
- [ ] A validação que rejeitava hook ≠ classe (US-153) foi removida; criar personagem de qualquer classe gera aventura não derivada da classe.
- [ ] O ledger `WorldEntity[]` é semeado a partir do artefato: segredos `revelado:false`, NPCs `revelado:true` (US-151); `recordEntity`/`mergeEntities` seguem intactos.
- [ ] `primaryQuestTitle`/`primaryQuestDescription` do gancho fixo não são mais a fonte da quest primária (US-155); a meta vem de `objective`.
- [ ] O gancho de classe ainda serve o `openingNarration` (gancho leve) e o caminho "Aventura pronta" (US-217) continua funcionando sem motor.
- [ ] **Eval / regressão:** teste cobrindo (a) criação no ramo "criar" persiste artefato e semeia ledger com os `revelado` corretos; (b) classe qualquer não é mais rejeitada por hook≠classe; (c) "Aventura pronta" continua no gancho fixo.
- [ ] `pnpm typecheck` e `pnpm test` passam.

---

## Notas de implementação

- `createForCharacter` vive em [apps/api/src/adventure/adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — é onde a chamada de autoria entra.
- O ledger deriva do artefato **congelado** (US-151) — não reconstrói forma; `Adventure.entities` (`WorldEntity[]`) não muda de forma (ADR 012 D2).
- A ordem real (assíncrona) de disparo é MA-5 (US-235); esta story é o ponto de entrada no serviço que aquele job chama — coordenar a fronteira com a US-235 no PR.
- Confirmar por grep os consumidores de `primaryQuestTitle`/`primaryQuestDescription` antes de aposentar (US-155), pra não deixar leitor órfão.

---

## Questões em aberto

Nenhuma bloqueante — a fronteira com a orquestração assíncrona (US-235) é coordenação de PR, não decisão em aberto.

---

## Referências no código

- [apps/api/src/adventure/adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`, ponto de entrada do motor.
- [US-151](./US-151-semear-ledger-segredos-gerados.md) — semear o ledger a partir do artefato.
- [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md)/[US-155](./US-155-aposentar-quest-fixa-por-classe.md) — o que sai.
- [US-217](./US-217-aventura-pronta-sem-motor-de-geracao.md) — gancho de classe como "Aventura pronta".
- [Backlog — MA-9](./backlog-motor-de-geracao-de-aventuras.md).
