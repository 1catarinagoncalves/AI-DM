# US-167 — Motor consome o `challenge` escolhido pelo jogador na geração real

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-165](./US-165-tela-escolhe-nivel-de-desafio.md) (`CreateAdventureDto.challenge` chega ao backend — sem ela não há valor real pra esta story ler) · [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (`generateAdventure`/`AdventureProfile`, os dois pontos que esta story muda)
**Relacionado:** [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (`composeEncounterRoles(level, challenge)` já parametrizada, ✅ — esta story só passa o segundo argumento que falta) · [US-166](./US-166-motor-gera-multiplos-encontros.md) (N encontros — cada chamada de `composeEncounterRoles` no loop passa o mesmo `challenge`, sem reabrir aquela story)
**Criada em:** 2026-08-18 — *Fora do escopo* da US-165 (*"Consumir `challenge` na geração real — nenhum orquestrador (US-164) ou `createForCharacter` lê esse campo do DTO ainda; esta story só garante que o valor chega ao backend, não que ele é usado"*) e Questão em aberto #2 da US-161 (*"Quando o orquestrador (US-164) ganha `challenge` como parâmetro real — story própria, não estimada aqui"*).

---

## História

> **Como** jogador que escolheu Modo desafio na tela de mundo (US-165),
> **quero** que a aventura gerada para o meu personagem use de fato o orçamento de combate que eu selecionei,
> **para que** um personagem de nível 1–3 — onde o Modo aventura zera o encontro (US-159/US-160) — receba combate garantido, em vez de a escolha da tela ser ignorada silenciosamente pelo motor.

---

## Contexto e motivação

### O problema observado

Hoje `AdventureService.generateAdventure` chama `composeEncounterRoles(profile.level)`
([adventure.service.ts:156](../../../apps/api/src/adventure/adventure.service.ts)) — **sem
segundo argumento**. `composeEncounterRoles(level, challenge)` já aceita `challenge` desde a
US-161 (✅ implementada), com `'adventure'` como default quando omitido — então a chamada de
hoje sempre empacota contra `encounterDeadlyThreshold`, nunca contra `singleMonsterCrCap`,
não importa o que o jogador escolher na tela da US-165. Confirmado por grep: nenhum arquivo em
`apps/api/src/adventure` menciona `challenge` — nem `AdventureProfile`, nem
`CreateAdventureDto` (mesmo após a US-165 landar), nem a chamada ao composer.

### Por que a solução atual não basta

A US-165 entrega o campo até o DTO (`CreateAdventureDto.challenge`) e para aí, deliberadamente
— ela mesma documenta isso como *Fora do escopo*. `createForCharacter`
([adventure.service.ts:208](../../../apps/api/src/adventure/adventure.service.ts)) recebe o
`dto` inteiro mas `buildAdventureProfile` só lê `character.*` e `config`, nunca `dto` — não
existe hoje NENHUM caminho entre o valor que o jogador clicou e o argumento que
`composeEncounterRoles` recebe. Sem esta story, a tela da US-165 é decoração: todo jogador,
independente da escolha, joga em Modo aventura.

### A proposta

Fechar os dois elos que faltam, sem tocar `composeEncounterRoles`/`buildEncounterNpcs`
(US-161/US-152, já corretas):

1. `AdventureProfile` (US-148) ganha `challenge: 'adventure' | 'challenge'` — montado em
   `buildAdventureProfile(character, config, challenge)`, terceiro parâmetro vindo de
   `dto.challenge ?? 'adventure'` (mesmo default da US-161, resolvido em `createForCharacter`,
   não dentro de `buildAdventureProfile`, pra função continuar sem saber de HTTP/DTO).
2. `generateAdventure` passa `profile.challenge` para `composeEncounterRoles(profile.level,
   profile.challenge)` — a única linha que muda dentro do orquestrador.

Nenhuma fórmula nova, nenhum catálogo novo: os dois orçamentos e a chave `'adventure' |
'challenge'` já existem (US-161); esta story só é o fio que liga tela → DTO → profile → composer.

---

## Escopo

### Dentro do escopo

- `AdventureProfile` ([adventure.service.ts:26-32](../../../apps/api/src/adventure/adventure.service.ts))
  ganha o campo `challenge: 'adventure' | 'challenge'`.
- `buildAdventureProfile` ganha um terceiro parâmetro `challenge: 'adventure' | 'challenge'` e
  o escreve no profile — sem ler `dto` diretamente (mantém a função pura de `character`/`config`
  + o valor já resolvido).
- `createForCharacter` resolve `dto.challenge ?? 'adventure'` e repassa a
  `buildAdventureProfile` — mesmo ponto onde `origin`/`background` já são lidos do `character`
  antes de montar o profile.
- `generateAdventure` ([adventure.service.ts:156](../../../apps/api/src/adventure/adventure.service.ts))
  passa a chamar `composeEncounterRoles(profile.level, profile.challenge)`.
- Testes de regressão: `challenge: 'challenge'` produz `encounters[0].npcIds` não vazio em
  nível 1–3 (hoje vazio, US-159/US-160); `challenge` omitido no DTO mantém o comportamento
  atual byte a byte (mesmo `GeneratedAdventure` que o teste de `createForCharacter` já espera).

### Fora do escopo

- **Validar `challenge` no DTO/Zod schema do controller** — a US-165 já cobre isso
  (`CreateAdventureSchema` em `adventure.controller.ts` ganha `challenge` junto do campo no
  DTO); esta story só consome o valor já validado.
- **Distribuir `challenge` por encontro na US-166** (ex.: primeiro encontro mais fácil, último
  mais difícil) — US-166 já resolveu chamar `composeEncounterRoles` N vezes com os MESMOS
  argumentos por chamada; `profile.challenge` entra ali sem mudança de contrato, variar por
  encontro é escopo novo, não pedido aqui.
- **Persistir `challenge` em `Character`** — decidido pela US-161 (Questão em aberto #1): é
  por aventura gerada, não por personagem. Esta story não reabre essa decisão.
- **Mudar o default `'adventure'`** — mesmo valor que a US-161 já fixou; nenhum chamador
  existente (testes, outros callers de `generateAdventure`) pode quebrar.

---

## Modelo de dados proposto

Sem schema de banco novo. Dois tipos existentes ganham um campo:

```ts
export interface AdventureProfile {
  level: number
  classKey: string
  background: CharacterBackground
  origin: OriginNarrative
  hookSeed: string
  challenge: 'adventure' | 'challenge' // US-167: default 'adventure', resolvido em createForCharacter
}
```

`buildAdventureProfile` ganha o parâmetro correspondente; `CreateAdventureDto` não muda aqui —
já ganhou `challenge?: 'adventure' | 'challenge'` na US-165.

---

## Critérios de aceite

- [ ] `AdventureProfile` tem o campo `challenge: 'adventure' | 'challenge'`.
- [ ] `createForCharacter` com `dto.challenge` ausente monta profile com `challenge:
      'adventure'` — nenhuma mudança de comportamento pros callers de hoje.
- [ ] `createForCharacter` com `dto.challenge === 'challenge'` monta profile com `challenge:
      'challenge'`.
- [ ] `generateAdventure` chama `composeEncounterRoles(profile.level, profile.challenge)` —
      não mais `composeEncounterRoles(profile.level)` sozinho.
- [ ] Fixture de nível 1–3 com `challenge: 'challenge'`: `encounters[0].npcIds` não vazio
      (hoje vazio nesse nível, independente da escolha do jogador).
- [ ] Fixture com `challenge` omitido: mesmo `GeneratedAdventure` que os testes atuais de
      `createForCharacter`/`generateAdventure` já esperam — sem regressão.
- [ ] `pnpm typecheck` e `pnpm test` (api) passam.
- [ ] **Eval / teste de regressão:** teste de `adventure.service.test.ts` cobrindo os dois
      valores de `challenge` fim a fim (`createForCharacter` → `generateAdventure` →
      `composeEncounterRoles`), não só o composer isolado (já coberto pela US-161).

---

## Notas de implementação

- **Só dois arquivos tocam:** [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts)
  (`AdventureProfile`, `buildAdventureProfile`, `createForCharacter`, `generateAdventure`) e o
  teste correspondente. `monster-roles.ts` (US-161/US-152) não muda — já aceita o parâmetro.
- **`generateGatedAdventure`** ([adventure.service.ts:195](../../../apps/api/src/adventure/adventure.service.ts))
  não precisa de mudança de assinatura — já recebe `profile` inteiro e repassa pra
  `generateAdventure`; `challenge` viaja de graça dentro do `profile`.
- **US-166 não precisa saber disto:** quando implementada, o loop de N encontros chama
  `composeEncounterRoles(profile.level, profile.challenge)` do mesmo jeito, sem parâmetro
  extra — a generalização já foi pensada pra `level`/`challenge` juntos, não só `level`.

---

## Questões em aberto

Nenhuma — o valor, o default e a chave canônica (`'adventure' | 'challenge'`) já foram
resolvidos pela US-161; esta story só liga os pontos que já existem.

---

## Referências no código

- [`apps/api/src/adventure/adventure.service.ts:15-20`](../../../apps/api/src/adventure/adventure.service.ts) — `CreateAdventureDto`, ganha `challenge` na US-165 (não nesta story).
- [`apps/api/src/adventure/adventure.service.ts:26-32`](../../../apps/api/src/adventure/adventure.service.ts) — `AdventureProfile`, ganha o campo nesta story.
- [`apps/api/src/adventure/adventure.service.ts:96-116`](../../../apps/api/src/adventure/adventure.service.ts) — `buildAdventureProfile`, ganha o terceiro parâmetro.
- [`apps/api/src/adventure/adventure.service.ts:156`](../../../apps/api/src/adventure/adventure.service.ts) — a chamada a `composeEncounterRoles` que esta story corrige.
- [`apps/api/src/adventure/adventure.service.ts:208`](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`, resolve o default e repassa.
- [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) — `composeEncounterRoles(level, challenge)`, a função que esta story finalmente alimenta com o segundo argumento.
- [US-165](./US-165-tela-escolhe-nivel-de-desafio.md) — origem do campo no DTO; *Fora do escopo* dela é o *Dentro do escopo* desta story.
- [US-166](./US-166-motor-gera-multiplos-encontros.md) — consumidor futuro de `profile.challenge` no loop de N encontros, sem mudança de contrato.
