# US-239 — Motor entra em createForCharacter, ledger do artefato, gancho fixo vira alternativa opcional

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Concluída
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (CHAMADA 1) · [US-234](./US-234-gate-regenera-on-fail-com-saneamento.md) (gate — só persiste o que passa) · [US-151](./US-151-semear-ledger-segredos-gerados.md) (semear o ledger a partir do artefato) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (remove a validação hook==classe) · [US-217](./US-217-aventura-pronta-sem-motor-de-geracao.md) (gancho de classe vira o ramo `dto.preset`)
**Relacionado:** [US-155](./US-155-aposentar-quest-fixa-por-classe.md) (aposenta a quest fixa como fonte no ramo gerado) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) · [Backlog — MA-9](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13
**Concluída em:** 2026-09-15

---

## História

> **Como** jogador que cria um personagem e escolhe "Criar minha história",
> **quero** que a criação gere de fato uma aventura autoral e a semeie no mundo do jogo —
> **para que** eu entre numa aventura tecida pelo motor, não no gancho fixo derivado da minha classe.

---

## Contexto e motivação

`resolveInitialHook(config, class)` deixou de ser o caminho automático da criação (US-153 já removeu a validação hook==classe) e o toggle "Aventura pronta" × "Criar minha história" (US-216/US-217) já roteia entre os dois ramos. O que faltava amarrar era o ramo "criar": `createForCharacter` passa a **chamar o motor** (US-232→233→234) em vez de simplesmente herdar o gancho fixo. O artefato aprovado alimenta o **ledger** `WorldEntity[]` (US-151): segredos com `revelado:false`, NPCs com `revelado:true`. A quest primária do ramo gerado vem de `objective`, não mais de `primaryQuestTitle`/`primaryQuestDescription` (US-155). O gancho de classe **não é aposentado** — continua servindo (a) o `openingNarration` (seed leve) no ramo gerado e (b) o ramo `dto.preset` inteiro ("Aventura pronta", US-217), intacto.

---

## Escopo

### Dentro do escopo

- **`createForCharacter` chama o motor** (US-232→US-233→US-234) no ramo "Criar minha história", em vez de herdar o gancho fixo.
- **Semear o ledger** `WorldEntity[]` a partir do artefato congelado (US-151): segredos `revelado:false`, NPCs `revelado:true`, locais conforme US-151.
- **Aposentar `primaryQuestTitle`/`primaryQuestDescription`** como fonte da quest primária **no ramo gerado** (US-155) — a meta vem do `objective` do artefato. Os dois campos continuam existindo e sendo lidos no ramo `dto.preset` (abaixo).
- **Gancho de classe deixa de ser automático, vira alternativa explícita**: (a) `openingNarration` = seed leve na abertura do ramo gerado; (b) ramo `dto.preset` inteiro ("Aventura pronta", US-217) — não é código novo desta story, é precondição já entregue por US-217/US-216, só confirmada aqui como o "outro lado" do toggle que esta story não pode quebrar.

### Precondições já entregues por outras stories (não é trabalho desta)

- **Validação hook≠classe removida** (US-153) — já não existe no código antes desta story começar.
- **Toggle "pronta"×"criar" e o ramo `dto.preset`** (US-216/US-217) — já roteiam para o gancho fixo quando o jogador escolhe "Aventura pronta".

### Fora do escopo

- **A geração e o gate** (US-232/234) — esta story os **chama**, não os implementa.
- **A orquestração assíncrona + telas** (US-235/MA-5) — o gatilho/estado de espera; esta story é o ponto de entrada no serviço.
- **O eval** (US-238/MA-8).

---

## Critérios de aceite

- [x] `createForCharacter`, no ramo "Criar minha história", chama o motor (US-232→233→234) e persiste o artefato aprovado em `Adventure.generatedAdventure`.
- [x] A validação que rejeitava hook ≠ classe (US-153) foi removida; criar personagem de qualquer classe gera aventura não derivada da classe.
- [x] O ledger `WorldEntity[]` é semeado a partir do artefato: segredos `revelado:false`, NPCs `revelado:true` (US-151); `recordEntity`/`mergeEntities` seguem intactos.
- [x] `primaryQuestTitle`/`primaryQuestDescription` do gancho fixo não são mais a fonte da quest primária no ramo gerado (US-155); a meta vem de `objective`.
- [x] O gancho de classe ainda serve o `openingNarration` (gancho leve) e o ramo `dto.preset` ("Aventura pronta", US-217) continua funcionando sem motor — [adventure.service.ts:416](../../../apps/api/src/adventure/adventure.service.ts).
- [x] **Eval / regressão:** `describe('ramo "Aventura pronta" (dto.preset)')` em [adventure.service.test.ts:299](../../../apps/api/src/adventure/adventure.service.test.ts) cobre (a) criação no ramo "criar" persiste artefato e semeia ledger com os `revelado` corretos; (b) classe qualquer não é mais rejeitada por hook≠classe; (c) "Aventura pronta" continua no gancho fixo, sem chamar `generateAdventureAuthoring`.
- [x] `pnpm typecheck` e `pnpm test` passam (verificado 2026-09-15).

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
