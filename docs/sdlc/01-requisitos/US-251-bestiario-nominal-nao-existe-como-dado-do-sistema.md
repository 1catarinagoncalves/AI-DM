# US-251 — Bestiário nominal do SRD não existe como dado do sistema

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma
**Relacionado:** [US-47](./US-47-ingestao-srd-como-dado.md) (`scripts/srd/sync.mjs`/`ingest.mjs`, o pipeline cujo padrão esta story reusa) · [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (união vs. fonte única entre SRD 5.1/5.2 — precedente pra decisão equivalente sobre criaturas) · [US-145](./US-145-sync-lgmrd-notice.md) (`5e_Monster_Builder.json`, bestiário **por papel**, não nominal — convive, não é substituído) · [US-152](./US-152-statblocks-papel-orcamento.md) (`MONSTER_ROLE_CR`, os três papéis que esta story vai casar com nome real, story própria: [US-252](./US-252-papel-do-encontro-vira-monstro-nominal-nao-rotulo-generico.md)) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) (origem do dado de sistema — Open5e, mesma proveniência)
**Criada em:** 2026-09-17 — a jogadora trouxe `dndgenerate.md`/[open5e.com/monsters](https://open5e.com/monsters) pedindo que os encontros do motor usem monstro nominal do SRD, não só papel genérico (Minion/Soldier/Brute); esta story é o passo 1 (o dado), separado da story que consome (US-252/US-253).

---

## História

> **Como** desenvolvedora do motor,
> **quero** o bestiário nominal do SRD (nome, CR, tipo, tamanho) disponível como dado do sistema, no mesmo padrão dos outros catálogos (raças, classes, itens),
> **para que** o motor de aventura possa escolher um monstro NOMEADO por CR/tipo em vez de só um rótulo abstrato de papel de combate.

---

## Contexto e motivação

### O problema observado

O repo tem hoje dois bestiários, nenhum nominal:
- `5e_Monster_Builder.json` ([US-145](./US-145-sync-lgmrd-notice.md)) — três **papéis** de statblock (Minion CR 1/8, Soldier CR 1/2, Brute CR 2), sem nome de criatura nenhum; é o que `MONSTER_ROLE_CR` ([monster-roles.ts](../../../apps/api/src/adventure-generation/monster-roles.ts)) usa hoje.
- O pipeline SRD ([`scripts/srd/sync.mjs`](../../../scripts/srd/sync.mjs)) baixa raças, classes, spells, itens, backgrounds, idiomas — **nenhuma criatura**. Confirmado por inspeção do `FILES` do sync: não existe entrada de bestiário.

Resultado: quando o motor precisa de um "Soldier CR 1/2" pra um encontro, o único dado que existe é o PAPEL — nunca um monstro real (nem SRD nem A5E) com esse CR, nome e tipo (`goblin`, `humanoid`, `undead`...) pra a ficção narrar de forma concreta.

### Por que a solução atual não basta

`5e_Monster_Builder.json` foi escolhido deliberadamente na US-152 porque resolvia o orçamento SEM ingerir bestiário nominal ("Ingerir bestiário nominal do SRD... desproporcional ao que o motor precisa"). Essa decisão continua certa pro **orçamento** (não reaberta aqui) — mas deixa nenhum caminho pra NOMEAR o monstro, que é uma pergunta diferente (ver US-252/US-253).

### A proposta

Confirmado por inspeção direta em 17/09/2026 (`v2.1.0`, o mesmo tag já pinado pelo `sync.mjs`): o Open5e-API tem `Creature.json` — **não** `Monster.json` (404) — inspecionado nos dois SRD, mas só o 5.1 é importado (ver *Decisão* abaixo):

| Documento | URL (tag `v2.1.0`) | Status | Criaturas |
|---|---|---|---|
| SRD 5.2 | `.../wizards-of-the-coast/srd-2024/Creature.json` | 200 | 331 (fora do escopo desta story) |
| SRD 5.1 | `.../wizards-of-the-coast/srd-2014/Creature.json` | 200 | 325 — **única fonte importada** |

**Decisão (17/09/2026, a pedido da mantenedora):** fonte única SRD 5.1, mesmo padrão já fixado pelo [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) pra raças/classes. Sem união com o 5.2 — a *Questão em aberto* #1 que cogitava união está fechada por instrução direta, não por análise de cobertura de CR.

Cada entrada já vem estruturada — `name`, `challenge_rating` (string numérica, ex. `"0.125"`, `"2.000"`, direto compatível com `MONSTER_ROLE_CR`), `type` (14 categorias: `humanoid`, `undead`, `beast`, `dragon`, `fiend`...), `size`, `alignment`, `hit_points`, `armor_class`, `languages`, entre outros. Reusar o mesmo pipeline `sync.mjs`/`ingest.mjs` (US-47) — baixar no tag já pinado, gravar artefato derivado, atualizar `NOTICE-open5e.md` — sem inventar mecanismo novo.

---

## Escopo

### Dentro do escopo

- `sync.mjs` ganha `Creature.json` na lista `FILES`, só do documento `srd-2014` (SRD 5.1 — fonte única, ver *Decisão* acima), mesmo `TAG` já pinado (`v2.1.0`) — sem tag nova, sem licença nova (mesma CC-BY-4.0/SRD já coberta, só entrada nova em `NOTICE-open5e.md`).
- `ingest.mjs` ganha um `buildBestiary()` (molde de `buildBackgrounds()`/`buildClassProficiencies()`) que projeta só os campos que o motor precisa **nesta fase** — `name`, `cr` (convertido de string pra fração/decimal), `type`, `size` — descartando ability scores/ataques/perícias (statblock completo não é usado até existir combate por turno, mesmo corte que a US-152 já fez pro `5e_Monster_Builder.json`).
- **Sem locale** — nome da criatura fica em inglês no dado (mesmo padrão de `ability-modifiers.srd-2024.json`, "atravessa locale sem tradução"); tradução/adaptação pro idioma-alvo fica a cargo de quem consome (prompt), não deste artefato — mesmo mecanismo que `questSeed` já usa ([ai.service.ts:210](../../../apps/api/src/ai/ai.service.ts), "TRADUZA/ADAPTE... NUNCA copie a palavra em inglês crua").
- Artefato derivado novo, committed: `scripts/srd/bestiary-5e.json` (nome análogo a `srd-5e.config.<locale>.json`, sem sufixo de locale pelo motivo acima).
- `NOTICE-open5e.md` ganha entrada descrevendo `Creature.json` como fonte nova.
- Teste de regressão (molde `ingest.test.mjs`): artefato final tem N criaturas, CR cobre pelo menos os três valores que `MONSTER_ROLE_CR` usa (1/8, 1/2, 2), nenhum campo de statblock de combate (`hit_points`/`armor_class`/ataques) vaza pro artefato final.

### Fora do escopo

- **União com o SRD 5.2** — decidida contra (ver *Decisão*, 17/09/2026); as 331 criaturas do 5.2, incluindo as que não têm par no 5.1, ficam fora do artefato.
- **Escolher qual criatura usar por CR/papel/tema** — story própria: [US-252](./US-252-papel-do-encontro-vira-monstro-nominal-nao-rotulo-generico.md).
- **Passar o nome pro prompt de autoria** — story própria: [US-253](./US-253-autoria-recebe-nome-do-monstro-nominal-como-parametro.md).
- **Ataques/CD/dano/HP do monstro** — statblock completo de combate; sem consumidor até existir combate por turno (mesmo corte da US-152).
- **Tradução/overlay pt-BR do nome da criatura** — decisão deliberada nesta story (delegar ao prompt de autoria, não a um catálogo traduzido); reabrir só se o padrão de `questSeed` (US-241) se mostrar insuficiente em produção.
- **Ilustração/imagem da criatura** (`illustration` no dado bruto) — sem consumidor, não projetado no artefato derivado.

---

## Modelo de dados proposto

```json
// scripts/srd/bestiary-5e.json (NOVO, sem locale)
[
  { "name": "Goblin Minion", "cr": 0.125, "type": "humanoid", "size": "small" },
  { "name": "Kobold Warrior", "cr": 0.125, "type": "humanoid", "size": "small" },
  { "name": "Orc", "cr": 0.5, "type": "humanoid", "size": "medium" },
  { "name": "Ogre", "cr": 2, "type": "giant", "size": "large" }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | Nome próprio da criatura, em inglês (fonte). |
| `cr` | number | Challenge Rating convertido de string pra fração/decimal (`"0.125"` → `0.125`), mesma unidade de `MONSTER_ROLE_CR`. |
| `type` | string | Uma das 14 categorias do SRD (`humanoid`, `undead`, `beast`, ...) — filtro temático pra US-252. |
| `size` | string | `tiny`/`small`/`medium`/`large`/`huge`/`gargantuan`. |

**Persistência:** artefato estático committed em `scripts/srd/bestiary-5e.json`, gerado por `ingest.mjs`, lido em runtime pelo motor (mesmo padrão de `srd-5e.config.<locale>.json`) — sem tabela de banco nova.

---

## Critérios de aceite

- [x] `sync.mjs` baixa `Creature.json` de `srd-2014` (SRD 5.1) no tag `v2.1.0` já pinado — `srd-2024` (5.2) não é baixado por esta story.
- [x] `ingest.mjs` produz `bestiary-5e.json` com `name`/`cr`/`type`/`size` por criatura, sem ability scores/ataques/HP/CA.
- [x] `cr` no artefato final é número (fração/decimal), não a string bruta do Open5e (`"0.125"`).
- [x] Artefato cobre pelo menos uma criatura em cada um dos três CR que `MONSTER_ROLE_CR` usa (1/8, 1/2, 2).
- [x] `NOTICE-open5e.md` documenta `Creature.json` como fonte nova (mesmo padrão das entradas anteriores).
- [x] `pnpm typecheck` e testes do módulo (`ingest.test.mjs`) passam.
- [x] **Eval / teste de regressão:** rodar `ingest.mjs` contra um fixture reduzido de `Creature.json` (2-3 entradas, CR conhecido) e comparar o artefato produzido byte-a-byte com o esperado — mesmo padrão de teste que `ingest.test.mjs` já usa pros outros catálogos.

---

## Notas de implementação

- **Reusar `sync.mjs`/`ingest.mjs` tal como estão** — só acrescentar `Creature.json` à lista `FILES` e um `buildBestiary()` novo em `ingest.mjs` (molde de `buildBackgrounds()`, [ingest.mjs:971](../../../scripts/srd/ingest.mjs)); nenhum mecanismo de download/normalização novo.
- **`challenge_rating` vem como string decimal** (`"0.125"`, `"2.000"`) — `Number(str)` direto converte certo pros três valores que importam (`0.125`, `0.5`, `2`); não precisa de parser de fração (`"1/8"`).
- **`environments` do dado bruto veio vazio** na amostra inspecionada (17/09/2026, SRD 5.2) — não confiar nele como filtro temático pronto; `type` (14 categorias, sempre presente) é o filtro que sobrevive à inspeção, ver US-252.
- Fixture pequeno pro teste de regressão evita comitar 331+325 criaturas só pra testar o `ingest.mjs` — mesmo padrão que `ingest.test.mjs` já usa pros outros catálogos.

---

## Questões em aberto

Nenhuma — questão #1 (arquivo à parte vs. dentro de `srd-5e.config.<locale>.json`) fechada em 17/09/2026, a pedido da mantenedora: **arquivo à parte** (`scripts/srd/bestiary-5e.json`, ver *Modelo de dados proposto*). Juntar duplicaria as 325 criaturas nos dois locales (en-US/pt-BR) sem motivo — o bestiário não tem texto pra traduzir — e acoplaria o motor de aventura (único consumidor) ao catálogo de personagem inteiro (~8000 linhas de raças/classes/spells) só pra ler nome/CR/tipo.

---

## Referências no código

- [`scripts/srd/sync.mjs`](../../../scripts/srd/sync.mjs) — `FILES`, ganha `Creature.json` de `srd-2014` (SRD 5.1).
- [`scripts/srd/ingest.mjs`](../../../scripts/srd/ingest.mjs) — `buildBackgrounds()` (linha 971) como molde de `buildBestiary()`; `main()` (linha 1343) como ponto de encaixe.
- [`scripts/srd/NOTICE-open5e.md`](../../../scripts/srd/NOTICE-open5e.md) — atribuição/licença, ganha parágrafo novo.
- [`docs/adr/009-uniao-dos-srd-5-1-e-5-2.md`](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) — precedente da decisão em aberto #1.
- [`apps/api/src/adventure-generation/monster-roles.ts`](../../../apps/api/src/adventure-generation/monster-roles.ts) — `MONSTER_ROLE_CR`, a unidade de CR que `bestiary-5e.json.cr` precisa casar.
- [US-145](./US-145-sync-lgmrd-notice.md) — `5e_Monster_Builder.json`, bestiário por PAPEL que convive, não é substituído por este.
