# US-142 — Traços mecânicos de subespécie (raça-base + subespécie combinados)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-140](./US-140-catalogo-subracas-srd-5-1.md) (**obrigatória e anterior**: é ela que emite as 4 chaves de subespécie em `config.races` — esta story dá mecânica a elas e reverte a *Questão em aberto #1* que ela havia resolvido) · [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md) (fonte `srd-2014`, sem reabrir)
**Relacionado:** [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (divergência mecânica 5.1×5.2 em `SpeciesTrait.json`, antecipada e não resolvida ainda) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (mesma nota) · [US-135](./US-135-feature-de-origem-na-criacao-e-ficha.md) (padrão `SystemClassFeatureSchema` reusado por `backgroundFeatures`, mesmo que esta story propõe para raça)

**Criada em:** 2026-08-15

---

## História

> **Como** jogador que escolhe uma raça com subespécie (elfo, anão, halfling, gnomo),
> **quero** que a ficha traga os traços mecânicos da variante escolhida — os da raça-base combinados com os da subespécie — e que a raça "pura" pare de ser oferecida como opção quando existe subespécie,
> **para que** a identidade selecionada seja mecanicamente completa, não só um rótulo, e não exista mais uma opção incompleta ao lado da opção completa.

---

## Contexto e motivação

### O problema observado

A US-140 emitiu as 13 entradas de `config.races` (9 raízes + 4 subespécies) e resolveu explicitamente a *Questão em aberto #1* como "raiz e subespécie ficam como opções independentes, ambas selecionáveis" — decisão tomada olhando só o catálogo (rótulo), sem mecânica nenhuma envolvida ainda. Ao revisar o resultado renderizado no wizard, a decisão de produto mudou: quando o SRD já documenta a variante (Alto-elfo), a raiz pura (Elfo) ao lado dela deixou de fazer sentido como escolha própria — o jogador que quer "só elfo" está, na prática, recebendo os mesmos traços de qualquer Alto-elfo que não puxa o truque de mago e o +1 Inteligência, só que sem a granularidade que o dataset oferece de graça.

### Por que a solução atual não basta

`config.races` é hoje `{key, label, parentKey?}` — puro rótulo. US-138 e US-140 excluíram traço mecânico do escopo explicitamente (*"Traços mecânicos de raça... story própria, se algum dia retomada"*, US-138 §Fora do escopo; *"Esta story é identidade catalogável, não mecânica"*, US-140 §Fora do escopo). Sem traço, não há como a raiz "ser mecanicamente menos completa" que a subespécie — as duas são só um nome. Esta story é o retomar que as duas anteriores previram, e é o que torna a reversão do #1 uma decisão com peso mecânico, não só estético.

### A proposta

Ingerir `SpeciesTrait.json` do `srd-2014` (já pinado, mesma fonte da US-138/140) e materializar `config.raceFeatures[key]` — traços da raiz sozinha para raça sem subespécie; traços da raiz **combinados** com os da subespécie para a chave da subespécie. Raiz que tem subespécie deixa de ser uma opção selecionável no catálogo — só a(s) subespécie(s) aparece(m), cada uma já carregando o pacote completo de traços herdados + próprios.

---

## Escopo

### Dentro do escopo

- **`sync.mjs`**: nova entrada em `FILES` — `[${SRD_2014}/SpeciesTrait.json, 'SpeciesTrait.2014.json']`, mesmo documento `srd-2014` de `Species.json` (linha 54), sem tag nova, sem entrada nova em `NOTICE-open5e.md` (mesma licença já coberta). Sem esta linha, `pnpm srd:sync` não traz a fonte e `buildRaceFeatures` não roda pra quem clonar do zero (mesmo padrão exigido pela US-138, §Referências).
- **`buildRaceFeatures`** (novo, `scripts/srd/ingest.mjs`, ao lado de `buildRaces`): deriva de `SpeciesTrait.json` (`srd-2014`) um traço por `{key, name, description, source}` — mesma forma de `SystemClassFeatureSchema`, sem tipo novo (padrão já usado por `backgroundFeatures`, `system.ts:169-173`). Para raça-raiz **sem** subespécie: `raceFeatures[rootKey]` = traços próprios da raiz. Para raça-raiz **com** subespécie: `raceFeatures[subspeciesKey]` = traços da raiz + traços próprios da subespécie; a raiz em si não recebe entrada própria em `raceFeatures` (deixa de ser chave jogável — ver próximo item).
- **`config.raceFeatures`**: `z.record(z.string(), z.array(SystemClassFeatureSchema)).optional()` em `SystemConfigSchema` — mesmo padrão de `classFeatures`/`backgroundFeatures`.
- **Raiz-com-subespécie sai do conjunto de chaves jogáveis**: `Character.race` deixa de aceitar a chave da raiz quando ela tem subespécie no catálogo (reverte a *Questão em aberto #1* da US-140). Raiz-sem-subespécie continua exatamente como está hoje. Mecanismo: `validateCatalogKey` (`character.service.ts:29,134-142`) hoje valida `dto.race` contra `config.races` inteiro (13 chaves, raiz+subespécie juntas) — passa a validar contra `Object.keys(config.raceFeatures)` quando o campo existir (é, por definição do escopo, exatamente o conjunto jogável); config legado sem `raceFeatures` cai no `config.races` cheio de hoje, sem mudança de comportamento.
- **`character.service.ts`**: `getRaceFeatures(config, character.race)`, somado ao array de features na criação — mesmo pipeline de `getClassFeatures`/`getBackgroundFeatures` (`character.service.ts:46`).
- **`SetupWizard.tsx`**: `select#char-race` para de renderizar a raiz como `<option>` solta quando ela tem subespécie — vira só `<optgroup label={root.label}>` com a(s) subespécie(s) dentro, sem opção fora do grupo (decisão de 2026-08-15, *Questão em aberto #1*). Raiz sem subespécie continua opção solta normal, sem grupo:

  ```jsx
  {raceCatalog.filter(r => !r.parentKey).map(root => {
    const subspecies = raceCatalog.filter(r => r.parentKey === root.key)
    if (subspecies.length === 0) {
      return <option key={root.key} value={root.key}>{root.label}</option>
    }
    return (
      <optgroup key={root.key} label={root.label}>
        {subspecies.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </optgroup>
    )
  })}
  ```
- **Teste em `ingest.test.mjs`**: `buildRaceFeatures` com fixture cobrindo raiz com subespécie (traço combinado, sem duplicata) e raiz sem (só os próprios).
- **Teste em `SetupWizard.test.tsx`**: raiz-com-subespécie não aparece mais como opção solta selecionável.

### Fora do escopo

- **Tradução pt-BR dos textos de traço.** `raceFeatures` nasce em EN puro nesta story — decisão de 2026-08-15, ver *Questão em aberto #3*. `SpeciesTrait.json` do 5.1 tem 93 registros (ADR 009 §8), volume grande demais pra decidir a estratégia de tradução às cegas; a decisão fica pra quando o traço for trazido pra ficha (story futura), com o caso de uso real na frente.
- **Motor de regra que consome o traço** (Darkvision alterando iluminação, Ability Score Increase mexendo em atributo, resistência mecânica). Esta story só emite/exibe o traço, mesmo corte que `classFeatures`/`backgroundFeatures` já fazem hoje: nome + descrição vão para o prompt do mestre oferecer narrativamente, não há motor de regra automatizado.
- **Migração de fichas existentes.** Ninguém tem `race` igual a uma raiz-com-subespécie hoje (chaves novas da US-140, ainda não commitadas em nenhuma ficha) — não há ficha para invalidar.
- **Traço de classe/subclasse** — mecanismo já existe (`classFeatures`), não tocado aqui.
- **US-141 (subclasse)** — desenho de dado `Record<classKey, …>` diferente, história irmã, não mexida por esta story.

---

## Modelo de dados proposto

```ts
// packages/shared/src/types/system.ts
// Reusa SystemClassFeatureSchema — mesma forma {key,name,description,source} que
// backgroundFeatures já usa (US-135), sem tipo novo.
raceFeatures: z.record(z.string(), z.array(SystemClassFeatureSchema)).optional(),
```

| Campo | Antes (US-140) | Depois |
|---|---|---|
| `config.races` | 13 entradas, `{key,label,parentKey?}`, sem mecânica | inalterado na forma — só passa a ter par mecânico em `raceFeatures` para as chaves jogáveis |
| `config.raceFeatures` | não existe | novo — `Record<raceKey, SystemClassFeature[]>`, só para chaves jogáveis (raiz-sem-subespécie + subespécies) |

Exemplo:

```jsonc
{
  "races": [
    { "key": "elf", "label": "Elfo" },
    { "key": "high-elf", "label": "Alto-elfo", "parentKey": "elf" }
  ],
  "raceFeatures": {
    // "elf" SEM entrada — raiz com subespécie não é mais chave jogável.
    // Concatenação simples (2026-08-15): as duas entradas de Ability Score Increase
    // SOMAM, uma não substitui a outra — mesma `key`, `source` diferente.
    "high-elf": [
      { "key": "ability-score-increase", "name": "Aumento de Valor de Habilidade", "description": "+2 Destreza", "source": "elf" },
      { "key": "darkvision", "name": "Visão no Escuro", "description": "…", "source": "elf" },
      { "key": "fey-ancestry", "name": "Ascendência Feérica", "description": "…", "source": "elf" },
      { "key": "ability-score-increase", "name": "Aumento de Valor de Habilidade", "description": "+1 Inteligência", "source": "high-elf" },
      { "key": "cantrip", "name": "Truque de Mago", "description": "…", "source": "high-elf" }
    ]
  }
}
```

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` — sem migração de schema em `Character` (continua `race: String`, `features: String[]`, já materializado na criação pelo mesmo pipeline de `classFeatures`).

---

## Critérios de aceite

- [x] `buildRaceFeatures` deriva `config.raceFeatures` a partir de `SpeciesTrait.json` (`srd-2014`) para toda chave jogável (raiz sem subespécie OU subespécie).
- [x] Subespécie combina traços da raiz + traços próprios por **concatenação simples** — inclusive `Ability Score Increase`: o bônus da raiz e o da subespécie SOMAM como dois traços separados, um não substitui o outro (decisão de produto, 2026-08-15).
- [x] Raiz que tem subespécie não tem entrada própria em `config.raceFeatures` e deixa de validar como `Character.race` (mesma validação de catálogo da US-105, agora restrita às chaves jogáveis).
- [x] Raiz sem subespécie continua validando normalmente, com `raceFeatures[key]` só com os próprios traços.
- [x] `select#char-race` no wizard não oferece mais a raiz como opção solta quando ela tem subespécie — vira só `<optgroup label>` da raiz com a(s) subespécie(s) dentro, sem `<option>` fora do grupo.
- [x] Personagem novo com raça-subespécie ganha os traços combinados em `Character.features` na criação, mesmo pipeline de `getClassFeatures`/`getBackgroundFeatures`.
- [x] `SystemConfigSchema` valida `raceFeatures` como opcional — config legado (pré-US-142) sem o campo continua válido.
- [x] Ambos os artefatos (`en-US`, `pt-BR`) trazem `raceFeatures` para as 4 subespécies + 5 raízes sem subespécie (`dragonborn`, `half-elf`, `half-orc`, `human`, `tiefling`) — conteúdo em EN puro nos dois locales, sem overlay pt-BR (decisão *Questão em aberto #3*).
- [x] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildRaceFeatures` com fixture sintética (raiz+subespécie combinando certo, raiz sem subespécie sem quebrar); `SetupWizard.test.tsx` cobre a ausência da opção solta para raiz-com-subespécie.

---

## Notas de implementação

- **Reusar `SystemClassFeatureSchema`, não inventar tipo novo** — mesmo padrão que `backgroundFeatures` já estabeleceu (`system.ts:169-173`: *"Reusa SystemClassFeatureSchema — mesma forma {key,name,description,source}, sem tipo novo"*).
- **`getRaceFeatures(config, character.race)` espelha `getClassFeatures`/`getBackgroundFeatures`** — mesmo arquivo, `character.service.ts:46`: `const features = [...getClassFeatures(config, charClass), ...getBackgroundFeatures(config, originKey)]` vira `[...getClassFeatures(...), ...getBackgroundFeatures(...), ...getRaceFeatures(...)]`.
- **`validateCatalogKey` passa a receber `Object.keys(config.raceFeatures) ?? config.races`** no lugar de `config.races` puro, na chamada de `race` (`character.service.ts:29`) — `raceFeatures` ausente (config legado) preserva o comportamento de hoje (valida contra o catálogo cheio); presente, restringe às chaves jogáveis sem precisar de um segundo filtro por `parentKey` espalhado pelo service.
- **Merge é concatenação simples — decisão de produto, 2026-08-15.** Traço da raiz + traço da subespécie somam sem dedupe, mesmo quando os dois têm `Ability Score Increase` (ex.: +2 Destreza do Elfo e +1 Inteligência do Alto-elfo aparecem como dois traços separados em `raceFeatures['high-elf']`, um não substitui o outro). `buildRaceFeatures` não precisa checar overlap por `key` — só concatena raiz-primeiro depois subespécie.
- **`SpeciesTrait.json` não está no repo** (`_data/` é gitignored, baixado por `pnpm srd:sync`) — rode o sync antes de inspecionar a forma real do dataset; não assuma a partir desta story.
- **Raiz-com-subespécie some da `<option>` solta, sobra só o `<optgroup>`** (decisão de 2026-08-15, *Questão em aberto #1*) — ganho de graça: resolve também a duplicação visual "Elfo" solto + "Elfo" repetido no heading do grupo, que era a crítica original ao resultado do US-140. Ver snippet em §Escopo.
- **Sem overlay pt-BR nesta story** (decisão de 2026-08-15, *Questão em aberto #3*) — `raceFeatures` grava `name`/`description` em EN puro, os dois artefatos de locale incluídos. Não crie `scripts/srd/locale/pt-BR.json` para traço nesta story; a estratégia de tradução (curadoria manual, fallback, `MT_DOMAINS` da US-52) é decisão de quando o traço for trazido pra ficha.

---

## Questões em aberto

1. ~~**Forma de renderização da raiz-com-subespécie no wizard.**~~ — **Resolvida em 2026-08-15.** Tira a `<option>` solta da raiz; fica só o `<optgroup label={root.label}>` envolvendo a(s) subespécie(s) — sem nenhuma opção fora do grupo. `<optgroup>` já é nativamente não-clicável (heading em negrito, sem valor de `<select>`), então isso resolve as duas coisas de graça: raiz para de ser chave jogável (US-142) e some a duplicação visual "Elfo" solto + "Elfo" de novo no grupo (queixa da crítica ao US-140). Raiz sem subespécie não muda — continua `<option>` solta, sem grupo. Ver §Notas de implementação.
2. ~~**Merge de traço com overlap raiz/subespécie** — concatenação simples ou override por `key` de traço quando os dois níveis mecânicos colidem (ex.: `Ability Score Increase`)?~~ — **Resolvida em 2026-08-15.** Concatenação simples: traços somam, inclusive `Ability Score Increase` (bônus da raiz + bônus da subespécie, sem substituição). Ver §Notas de implementação.
3. ~~**Tradução das 93 descrições de traço** — curadoria manual, fallback EN, ou entrada no `MT_DOMAINS` da US-52?~~ — **Resolvida em 2026-08-15.** Não traduz agora: `raceFeatures` nasce em EN puro nesta story. Decisão de tradução (curadoria manual, `MT_DOMAINS`, ou outra) fica pra quando o traço for trazido pra ficha do personagem (story futura) — só aí dá pra saber o que realmente precisa de overlay pt-BR.

---

## Referências no código

- [scripts/srd/sync.mjs:46-63](../../../scripts/srd/sync.mjs:46) — `FILES`, onde `SpeciesTrait.json` entra ao lado de `Species.2014.json` (linha 54).
- [scripts/srd/ingest.mjs:214-237](../../../scripts/srd/ingest.mjs:214) — `buildRaces`, ponto de extensão para `buildRaceFeatures` (mesmo arquivo, mesma fonte `species2014`).
- [packages/shared/src/types/system.ts:169-173](../../../packages/shared/src/types/system.ts:169) — `backgroundFeatures`, padrão de reuso de `SystemClassFeatureSchema` a copiar para `raceFeatures`.
- [packages/shared/src/types/system.ts:185](../../../packages/shared/src/types/system.ts:185) — `classFeatures`, mesmo padrão.
- [apps/api/src/character/character.service.ts:46](../../../apps/api/src/character/character.service.ts:46) — `getClassFeatures`/`getBackgroundFeatures`, onde `getRaceFeatures` entra na criação do personagem.
- [apps/web/src/components/setup/SetupWizard.tsx:615-639](../../../apps/web/src/components/setup/SetupWizard.tsx:615) — `select#char-race`, remove a opção solta da raiz-com-subespécie.
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md §Negativas](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) — 93 traços no 5.1 vs 51 no 5.2, divergência mecânica antecipada desde a decisão de fonte.
- [US-140](./US-140-catalogo-subracas-srd-5-1.md) — *Questão em aberto #1* revertida por esta story: raiz-com-subespécie deixa de ser opção independente.
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — nota original sobre a dívida mecânica represada (*"quando a story de traços chegar, um catálogo misto vira duas mecânicas incompatíveis"*).
