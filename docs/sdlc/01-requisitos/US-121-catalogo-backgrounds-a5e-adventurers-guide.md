# US-121 — Catálogo de backgrounds do A5E Adventurer's Guide (Open5e)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) (pipeline `sync`+`ingest`, artefato por locale) · [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (dois artefatos, um por locale) · [US-52](./US-52-traducao-automatica-do-srd.md) (`MT_DOMAINS`, rascunho `_mt` + `--strict`)
**Relacionado:** [US-39](./US-39-identidade-narrativa-background-ideais.md) (`Character.background` texto livre — deixou o catálogo "fora do escopo, extensão futura"; esta story é essa extensão) · [US-51](./US-51-kits-iniciais-do-srd.md) (precedente de domínio derivado de dois arquivos do dataset, com parser próprio) · [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) (licença única) · [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (precedente de documento irmão dual-licenciado, entrando pela via CC-BY)
**Gera ADR:** não. Nota no [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) §3 — é o primeiro dado do config que não vem de `wizards-of-the-coast/srd-2014`/`srd-2024`, e a regra de licença única precisa cobrir explicitamente por quê o `a5e-ag` (EN Publishing) entra sem abrir exceção.
**Criada em:** 2026-08-08

---

## História

> **Como** desenvolvedora,
> **quero** derivar um catálogo de **backgrounds** do documento `a5e-ag` (Level Up: Advanced 5th Edition — *Adventurer's Guide*, EN Publishing) no Open5e, pelo mesmo pipeline `sync`+`ingest` da US-47,
> **para que** o `SystemConfig` tenha uma lista rica de backgrounds versionada e traduzível — hoje o único documento já pinado (`srd-2024`, SRD 5.2 da WotC) expõe **4** backgrounds, contra os **21** do `a5e-ag`.

---

## Contexto e motivação

### O problema observado

A [US-39](./US-39-identidade-narrativa-background-ideais.md) deixou explícito, na seção "Fora do escopo": *"Catálogo de backgrounds/ideais por SRD como dado (`System.config`) — por ora texto livre; catalogar é extensão futura"*. Hoje `Character.background.story` é prosa livre digitada na criação, semeada por um default por classe — não existe lista de onde escolher.

Medido em 08/08/2026 contra o dataset do Open5e (`open5e/open5e-api`, tag `v2.1.0`, o mesmo já pinado pela US-47):

| Documento | Modelo | Entradas |
|---|---|---|
| `wizards-of-the-coast/srd-2024` (SRD 5.2, já em uso) | `Background` | **4** (Acolyte, Criminal, Sage, Soldier) |
| `en-publishing/a5e-ag` (Adventurer's Guide) | `Background` | **21** |

O SRD 5.2 da WotC só liberou 4 backgrounds como conteúdo aberto — o PHB 2024 tem mais, mas o resto não é CC-BY. Um catálogo de 4 opções não sustenta uma etapa de criação de personagem; o `a5e-ag` cobre o mesmo papel de "background genérico de fantasia" (Acolyte, Criminal, Sage… os nomes se repetem) com 5× mais variedade.

### Por que a solução atual não basta

Texto livre (US-39) resolve narrativa, mas não dá **opções**: o jogador escreve do zero ou aceita o default da classe, sem nada entre os dois. Um catálogo com nome + benefícios estruturados é o que falta para uma etapa de criação (`race-class` → `background` → ...) oferecer escolha real, no mesmo espírito de `races`/`classes` (US-105).

### A proposta

Estender `sync.mjs`/`ingest.mjs` para baixar e derivar `Background` + `BackgroundBenefit` do documento `a5e-ag`, e adicionar `backgrounds` ao `SystemConfig` (dois locales, como todo campo derivado desde a US-99). **Esta story entrega o catálogo, não a escolha na criação** — ver §Fora do escopo.

---

## Escopo

### Dentro do escopo

- **`sync.mjs`**: dois arquivos novos, de `en-publishing/a5e-ag/` (mesmo `TAG = 'v2.1.0'` já pinado):
  `Background.json` (21 entradas: `{pk, fields: {name, desc, document}}`, `desc` vem **vazio** no dataset — medido nas 21) e `BackgroundBenefit.json` (144 entradas: `{pk, fields: {parent, name, desc, type}}`, `parent` referencia o `pk` do `Background`).
- **`ingest.mjs`**: nova `buildBackgrounds(data.backgrounds, data.backgroundBenefits)` — agrupa benefícios por `parent`, mesmo padrão de junção de dois arquivos que `buildStartingKits`/`ClassFeature`+`ClassFeatureItem` já usam (US-51).
- **`SystemConfigSchema`** (`packages/shared/src/types/system.ts`) ganha `backgrounds` opcional — ver §Modelo de dados.
- **`backgrounds` entra no `MT_DOMAINS`** (`ingest.mjs:52`, hoje `['features', 'spells']`): os `benefit.desc` são prosa (uma entrada chega a parágrafo, ver `adventures_and_advancement`), não vocabulário fixo curto como `attributes`/`skills`/`kitItems` — mesmo tratamento de `classFeatures`/`classSpells`, rascunho `_mt: true` + revisão humana depois.
- **`NOTICE-open5e.md`** ganha atribuição do `a5e-ag`: publisher **EN Publishing**, licença **dual CC-BY-4.0 / OGL 1.0a**, usado pela via **CC-BY-4.0** — mesmo padrão que o ADR 009 já aplica ao `srd-2014` (dual-licenciado, entra pela via CC). Nenhuma marca **"Advanced 5th Edition"**, **"A5E"** ou do publisher entra no produto (mesma regra de marca do ADR 004 §6, agora valendo para um segundo publisher).
- **Ambos os artefatos** (`srd-5e.config.en-US.json`, `srd-5e.config.pt-BR.json`) trazem os 21 backgrounds; en-US com o texto cru do dataset, pt-BR com o rascunho MT (ou overlay curado, se alguém revisar antes do merge).
- **Teste em `ingest.test.mjs`** cobrindo `buildBackgrounds` com dado sintético (nunca o dataset real no teste, mesmo padrão dos outros builders).

### Fora do escopo

- **Escolha de background pelo jogador na criação** (wiring com o fluxo `race-class`/`attributes`/`skills`/`review`) — o catálogo fica pronto para consumo, a etapa de UI/fluxo é story separada (mesmo corte que a US-51 fez para "escolha de kit pelo jogador"). **Decisão tomada em 08/08/2026:** quando essa escolha existir, ela vive num campo **distinto** — `Character.origin` — e **não** pré-preenche nem substitui `Character.background` (US-39, prosa livre de história/ideais/vínculos/fraquezas). Catálogo mecânico e identidade narrativa convivem como duas coisas separadas, não uma dado da outra.
- **Aplicar mecanicamente os benefícios** (`ability_score`, `skill_proficiency`, `tool_proficiency`, `language` como proficiência/atributo de fato no personagem) — o catálogo guarda os benefícios como **texto**, não como efeito mecânico. Aplicar exigiria integração com `pointBuy`/`proficiency` que esta story não abre.
- **Os 4 backgrounds do `srd-2024` nativo** (Acolyte, Criminal, Sage, Soldier) **não entram** — decisão tomada em 08/08/2026. Duas fontes de `Background` colidiriam em nome (`Acolyte`, `Soldier`… nomes iguais, benefícios e chaves diferentes: `srd-2024_acolyte` vs `a5e-ag_acolyte`) sem ganho — o `a5e-ag` já cobre o mesmo papel com 5× mais opções. Se algum dia fizerem falta especificamente os 4 do SRD (ex. paridade estrita com o PHB 2024), é story própria — não uma união automática como a ADR 009 fez com espécie.
- **Tipos de benefício sem equivalente no 5e vanilla** (`adventures_and_advancement`, `connection_and_memento`, próprios do A5E) — entram no catálogo como texto de referência; a exibição na UI é a [US-124](./US-124-exibir-beneficios-narrativos-origem.md).
- **Outros documentos do A5E** (`a5e-cc` *Character Codex*, se existir no dataset) — só `a5e-ag`, escopo fechado nesta story.

---

## Modelo de dados proposto

```ts
export const SystemBackgroundBenefitSchema = z.object({
  type: z.string().min(1),        // 'ability_score' | 'skill_proficiency' | 'tool_proficiency'
                                   // | 'language' | 'equipment' | 'feature'
                                   // | 'connection_and_memento' | 'adventures_and_advancement'
                                   // (8 valores observados no a5e-ag; string livre, não enum —
                                   // mesmo raciocínio do `source` em SystemClassFeatureSchema)
  name: z.string().min(1),        // "Ability Score Increases", "Skill Proficiencies"…
  description: z.string().min(1),
})

export const SystemBackgroundSchema = z.object({
  key: z.string().min(1),         // "a5e-ag_acolyte" — pk cru do dataset, mesmo padrão de
                                   // classFeatures/classSpells (US-106)
  name: z.string().min(1),        // "Acolyte"
  benefits: z.array(SystemBackgroundBenefitSchema),
  source: z.string().min(1),      // "a5e-ag" — reaproveita o campo `source` já usado em
                                   // SystemClassFeatureSchema ('srd' | 'authored'), valor novo
})
```

No `SystemConfigSchema`:

```ts
backgrounds: z.array(SystemBackgroundSchema).optional(),
```

| Campo | Tipo | Descrição |
|---|---|---|
| `backgrounds[].key` | string | Chave canônica, `a5e-ag_<slug>` |
| `backgrounds[].name` | string | Nome exibível (`Acolyte`) |
| `backgrounds[].benefits` | array | Lista de benefícios (a `Background` em si não tem `desc` — vem vazio nas 21 entradas medidas) |
| `benefits[].type` | string | Categoria do benefício, valor cru do dataset |
| `benefits[].name` | string | Rótulo do benefício (`"Skill Proficiencies"`) |
| `benefits[].description` | string | Texto do benefício |

**Persistência:** mesmo artefato `scripts/srd/srd-5e.config.<locale>.json` da US-47/US-99 — sem coluna nova no Prisma, `System.config` já é `Json`.

---

## Critérios de aceite

- [ ] `sync.mjs` baixa `Background.json` e `BackgroundBenefit.json` de `en-publishing/a5e-ag/`, no `TAG` já pinado (`v2.1.0`) — sem tag nova, sem dependência nova.
- [ ] `ingest.mjs` deriva `backgrounds`: 21 entradas, cada uma com `key`, `name`, `benefits` (144 benefícios distribuídos), `source: 'a5e-ag'`.
- [ ] `Background` sem nenhum `BackgroundBenefit` correspondente ainda aparece no catálogo, com `benefits: []` (não falha o ingest).
- [ ] `BackgroundBenefit` com `parent` que não bate em nenhum `Background` **falha o ingest alto** (mesmo tratamento de referência quebrada do `CLASS_MAP`/`buildStartingKits`).
- [ ] `SystemConfigSchema` valida `backgrounds` opcional; config sem o campo continua válido (compatibilidade com artefato anterior a esta story).
- [ ] `backgrounds` entra em `MT_DOMAINS`; `pnpm srd:ingest` (sem `--no-mt`) produz `pt-BR` com `benefits[].description` traduzido e marcado `_mt: true` onde não houver overlay curado.
- [ ] `pnpm srd:ingest --strict` passa sem chave `backgrounds` no relatório de fallback EN pendente (ou o relatório é aceito conscientemente, como os demais domínios permitem hoje).
- [ ] `NOTICE-open5e.md` traz a atribuição do `a5e-ag` (EN Publishing, dual CC-BY-4.0/OGL 1.0a, via CC-BY) — nenhum texto OGL entra no repo.
- [ ] Nota registrada no [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) §3, explicando por que um segundo publisher entra sob a mesma regra de licença única.
- [ ] Os dois artefatos seguem passando em `SystemConfigSchema.parse()` e byte-a-byte idênticos entre duas rodadas (idempotência), mesmo critério da US-51.
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildBackgrounds` com fixture sintética — background sem benefit, benefit com `parent` órfão, e um caso com `type: 'ability_score'` para garantir que o campo `type` cru sobrevive sem normalização.

---

## Notas de implementação

- O join `Background` + `BackgroundBenefit` por `parent → pk` é estruturalmente igual ao de `ClassFeature`/`ClassFeatureItem` que a US-47 já ingere — reaproveitar o mesmo estilo de `Map`, não inventar mecanismo novo.
- `Background.desc` vem **vazio** nas 21 entradas (medido diretamente no dataset em 08/08/2026) — não esperar um resumo pronto; toda a prosa está nos `BackgroundBenefit`.
- `benefit.type` tem 8 valores observados: `ability_score`, `skill_proficiency`, `tool_proficiency`, `language`, `equipment`, `feature`, `connection_and_memento`, `adventures_and_advancement`. Fica string livre (não `z.enum`) — o precedente é o comentário de `SystemClassFeatureSchema` sobre `source`: taxonomia fechada cedo demais quebra no primeiro valor novo de um bump.
- `key` do background **não** precisa de mapa explícito tipo `CLASS_MAP`: diferente de classe (12 entradas fixas, cada uma alimentando `startingKits`/`classFeatures`/`classSpells` pela mesma chave), background não tem consumidor cruzado ainda — o `pk` cru (`a5e-ag_acolyte`) já serve de chave canônica, como `races`/`classes` fazem hoje.

---

## Questões em aberto

Nenhuma pendente — a única questão aberta (exibição de `adventures_and_advancement`/`connection_and_memento`) foi resolvida pela [US-124](./US-124-exibir-beneficios-narrativos-origem.md).

---

## Referências no código

- [scripts/srd/sync.mjs](../../../scripts/srd/sync.mjs) — `FILES`, par `SRD`/`SRD_2014` como modelo para a nova constante `A5E_AG`.
- [scripts/srd/ingest.mjs](../../../scripts/srd/ingest.mjs) — `MT_DOMAINS` (linha 52), `buildStartingKits` (precedente de junção de dois arquivos, US-51), `buildConfig`.
- [scripts/srd/NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) — atribuição, a estender com o `a5e-ag`.
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemConfigSchema`, `SystemClassFeatureSchema` (padrão de `key`/`source` a seguir).
- [docs/adr/004-origem-do-dado-de-sistema.md](../../adr/004-origem-do-dado-de-sistema.md) §2/§3.2 — regra de licença única.
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) — precedente de documento dual-licenciado entrando pela via CC-BY.
- [US-39](./US-39-identidade-narrativa-background-ideais.md) — "Fora do escopo: catálogo de backgrounds… extensão futura" (o gap que esta story fecha).
- [US-51](./US-51-kits-iniciais-do-srd.md) — precedente completo de domínio derivado com parser próprio e MT_DOMAINS exclusion pattern.
