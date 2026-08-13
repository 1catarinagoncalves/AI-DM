# US-133 — Catálogo de idiomas do sistema (`config.languages`)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) (pipeline `sync`+`ingest`, artefato por locale) · [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (dois artefatos, um por locale)
**Relacionado:** [US-129](./US-129-escolha-idioma-beneficio-language-background.md) (consumidor bloqueado — é a story-base que ela pede em sua *Questão em aberto 1*; esta story fecha exatamente essa lacuna) · [US-130](./US-130-culture-engineering-catalogo-pericias.md) (mesmo formato: fechar lacuna de catálogo que bloqueia mecanização de um benefício de background) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (`SystemCatalogEntrySchema`, contrato `key`/`label` que esta story estende, mesmo precedente de `SystemSkillSchema.ability`) · [US-134](./US-134-catalogo-de-ferramentas-do-sistema.md) (catálogo irmão, mesma investigação, mesmo dia — fecha a lacuna equivalente para `tool_proficiency`)
**Criada em:** 2026-08-13

---

## História

> **Como** desenvolvedora,
> **quero** derivar um catálogo de **idiomas** do documento `open5e/core` (mesmo documento que já fornece `Skill.json`) pelo pipeline `sync`+`ingest` da US-47,
> **para que** `SystemConfig` tenha uma lista de idiomas contra a qual a US-129 possa validar a escolha do benefício `language` do background — hoje essa lista não existe em lugar nenhum do projeto.

---

## Contexto e motivação

### O problema observado

A US-129 (criada 2026-08-12) ficou registrada como `🗂️ Backlog — bloqueada`, com a dependência explícita: *"uma story ainda não escrita que crie `config.languages` — não existe hoje, nem como US nem como campo"*. A *Questão em aberto 1* dela pergunta: *"De onde vem `config.languages`? [...] Precisa de investigação própria antes de virar story-base: existe no dataset Open5e? Em que arquivo?"* — essa investigação nunca tinha sido feita.

### Investigação (13/08/2026)

Consultei `open5e/open5e-api` na tag já pinada (`v2.1.0`, mesma da US-47) via `gh api repos/open5e/open5e-api/contents/data/v2/open5e/core?ref=v2.1.0`. `Language.json` **existe**, no mesmo diretório `open5e/core` que já fornece `Skill.json` ([sync.mjs:20](../../../scripts/srd/sync.mjs:20), const `CORE`, já sincronizado por [US-27](./US-27-pericias-do-personagem.md)) — não é preciso pinar tag nova nem abrir licença nova.

**18 entradas**, `{pk, fields: {name, desc, document, is_exotic, is_secret, script_language}}`:

| Campo | Observado |
|---|---|
| `name` | Abyssal, Celestial, Common, Deep Speech, Draconic, Druidic, Dwarvish, Elvish, Giant, Gnomish, Goblin, Halfling, Infernal, Orc, Primordial, Sylvan, Thieves' Cant, Undercommon |
| `is_secret: true` | **2** — `Druidic`, `Thieves' Cant` (línguas restritas, concedidas por classe/feature própria, não pelo "um idioma à escolha" genérico) |
| `is_exotic` | 8 `true` / 10 `false` — separa "comum" de "exótico" (RAW 2024), não usado por nenhuma mecânica do projeto hoje |
| `script_language` | roteiro escrito associado (`dwarvish`, `elvish`…) ou `null` — não usado por nenhuma mecânica do projeto hoje |

### Por que a solução atual não basta

Sem catálogo, a US-129 não tem contra o que validar `origin.languageChoice` nem opções para o `<select>` da etapa `background` — ela mesma registra isso como bloqueio, não decisão de escopo.

### A proposta

Mesmo movimento da US-130 (que fechou `Culture`/`Engineering` para `config.skills`): estender `sync.mjs`/`ingest.mjs` para baixar e derivar `Language.json`, e adicionar `languages` ao `SystemConfig` — catálogo cru, sem aplicar a nenhum personagem. **Esta story entrega o catálogo, não a escolha na criação** (isso é a US-129, que passa a estar desbloqueada).

---

## Escopo

### Dentro do escopo

- **`sync.mjs`**: um arquivo novo, `${CORE}/Language.json` ([sync.mjs:20,40](../../../scripts/srd/sync.mjs:20) — mesma constante `CORE` que já baixa `Skill.json`, mesmo `TAG` pinado, sem licença nova a documentar em `NOTICE-open5e.md`).
- **`ingest.mjs`**: nova `buildLanguages(overlay, languagesRaw, resolve)` — mesmo padrão flat de [`buildRaces`](../../../scripts/srd/ingest.mjs:234) (`key` = `pk` normalizado, `label` resolvido via overlay/EN), mais o campo `secret` (`fields.is_secret`, cru, sem tradução).
- **`SystemLanguageSchema`** novo (`packages/shared/src/types/system.ts`), perto de `SystemSkillSchema` — mesmo contrato `key`/`label` de `SystemCatalogEntrySchema`, estendido com `secret: z.boolean()` pelo mesmo motivo que `SystemSkillSchema` estende com `ability`: um consumidor (US-129) precisa do campo extra para não oferecer `Druidic`/`Thieves' Cant` como "idioma à escolha" genérico.
- **`SystemConfigSchema`** ganha `languages?: z.array(SystemLanguageSchema)` — opcional, mesmo tratamento de `skills`/`races`/`classes` (config legado sem o campo continua válido).
- **`languages` entra em `MT_DOMAINS`** ([ingest.mjs:55](../../../scripts/srd/ingest.mjs:55)): os 18 `desc` são frases curtas ("Typical speakers are Humans."), mesmo perfil de `skills`/`races` — rascunho MT + overlay curado.
- **Teste em `ingest.test.mjs`** cobrindo `buildLanguages` com fixture sintética.

### Fora do escopo

- **Aplicar o catálogo a um personagem** (`grant.kind: 'language'`, `CreateCharacterSchema.origin.languageChoice`, `<select>` na etapa `background`, exibição na ficha) — é inteiramente a [US-129](./US-129-escolha-idioma-beneficio-language-background.md), que esta story desbloqueia.
- **Idioma racial** (ex.: Elfo falar Élfico por raça, não por background) — mesma exclusão que a US-129 já registra; fora do escopo dos dois lados.
- **Filtrar `is_secret` do catálogo** — o catálogo é cru e completo (18 entradas), como `skills`/`races` já são; **quem decide se `Druidic`/`Thieves' Cant` entram no pool de escolha é o consumidor** (US-129), usando o campo `secret` que esta story expõe. Omitir do catálogo seria decisão de mecânica de jogo, não de dado.
- **`script_language`/`is_exotic`** — presentes no dataset, sem consumidor hoje; não entram no `SystemLanguageSchema` (YAGNI — nenhuma story, incluindo a US-129, usa esses campos).

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/system.ts — perto de SystemSkillSchema
export const SystemLanguageSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  // US-129: idioma restrito (Druidic, Thieves' Cant) — não deve entrar no pool de
  // "um idioma à escolha" genérico de background; concedido só por classe/feature própria.
  secret: z.boolean(),
})
```

No `SystemConfigSchema`:

```ts
languages: z.array(SystemLanguageSchema).optional(),
```

| Campo | Tipo | Descrição |
|---|---|---|
| `languages[].key` | string | Chave canônica, `pk` normalizado (`deep-speech` → `deep_speech`) |
| `languages[].label` | string | Nome exibível (`"Common"`) |
| `languages[].secret` | boolean | `true` para `Druidic`/`Thieves' Cant` — sinaliza ao consumidor para excluir do pool de escolha livre |

**Persistência:** mesmo artefato `scripts/srd/srd-5e.config.<locale>.json` da US-47/US-99 — sem coluna nova no Prisma.

---

## Critérios de aceite

- [ ] `sync.mjs` baixa `Language.json` de `${CORE}` (mesmo diretório de `Skill.json`), no `TAG` já pinado — sem tag nova, sem entrada nova em `NOTICE-open5e.md`.
- [ ] `ingest.mjs` deriva `languages`: 18 entradas, cada uma com `key`, `label`, `secret`.
- [ ] `secret: true` em exatamente 2 entradas (`druidic`, `thieves_cant`, ou chave equivalente normalizada) — as outras 16, `secret: false`.
- [ ] `SystemConfigSchema` valida `languages` opcional; config sem o campo continua válido (compatibilidade com artefato anterior a esta story).
- [ ] `languages` entra em `MT_DOMAINS`; `pnpm srd:ingest` produz `pt-BR` com `label` traduzido e marcado `_mt: true` onde não houver overlay curado.
- [ ] `pnpm srd:ingest --strict` passa sem chave `languages` no relatório de fallback EN pendente (18 nomes curados manualmente em `locale/pt-BR.json`, mesmo padrão de `races`/`classes`/`backgrounds`).
- [ ] Os dois artefatos seguem passando em `SystemConfigSchema.parse()` e byte-a-byte idênticos entre duas rodadas (idempotência).
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildLanguages` com fixture sintética contendo pelo menos uma entrada `is_secret: true` e uma `false`, confirmando que o campo sobrevive ao ingest sem normalização de valor (só de chave).

---

## Notas de implementação

- **`buildRaces`** ([ingest.mjs:234](../../../scripts/srd/ingest.mjs:234)) é o precedente mais próximo: catálogo flat, sem parser de texto, `key`/`label` só. `buildLanguages` segue o mesmo corpo, mais a linha que copia `fields.is_secret` para `secret`.
- **Normalização de `key`**: mesma regra de `buildSkills` ([ingest.mjs:215](../../../scripts/srd/ingest.mjs:215)) — `pk` já vem em kebab-case (`deep-speech`), trocar `-` por `_` para casar o padrão de chave do resto do config (`sleight_of_hand`, não `sleight-of-hand`).
- **Depois desta story, a US-129 deixa de estar bloqueada** — `**Depende de**` e `**Status**` dela devem ser atualizados para referenciar esta story quando ela for implementada.

---

## Questões em aberto

Nenhuma pendente do lado do catálogo. A US-129 mantém as próprias questões (2 e 3, sobre idioma racial e sobre reabsorção da story) — não são resolvidas por esta.

---

## Referências no código

- [scripts/srd/sync.mjs:20,40](../../../scripts/srd/sync.mjs:20) — const `CORE`, `FILES` (par `[url, nome]` de `Skill.json`, modelo direto para `Language.json`).
- [scripts/srd/ingest.mjs:55](../../../scripts/srd/ingest.mjs:55) — `MT_DOMAINS`.
- [scripts/srd/ingest.mjs:211-227](../../../scripts/srd/ingest.mjs:211) — `buildSkills` (precedente de normalização de `key` com `-`→`_`).
- [scripts/srd/ingest.mjs:234-240](../../../scripts/srd/ingest.mjs:234) — `buildRaces` (precedente direto: catálogo flat `key`/`label`, sem parser).
- [packages/shared/src/types/system.ts:18-22](../../../packages/shared/src/types/system.ts:18) — `SystemSkillSchema` (precedente de `key`/`label` + campo-âncora extra, mesmo padrão que `secret` segue aqui).
- [packages/shared/src/types/system.ts:118-140](../../../packages/shared/src/types/system.ts:118) — `SystemConfigSchema`, onde `languages` entra ao lado de `skills`/`races`/`classes`.
- [US-129](./US-129-escolha-idioma-beneficio-language-background.md) — consumidor bloqueado, motivo direto desta story.
- [US-130](./US-130-culture-engineering-catalogo-pericias.md) — mesmo formato de story (fechar lacuna de catálogo antes da story de mecânica rodar).
