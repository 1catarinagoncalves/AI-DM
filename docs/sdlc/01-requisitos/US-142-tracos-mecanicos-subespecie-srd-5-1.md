# US-142 — Traços mecânicos de subespécie (raça-base + subespécie combinados)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada
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

- **`buildRaceFeatures`** (novo, `scripts/srd/ingest.mjs`, ao lado de `buildRaces`): deriva de `SpeciesTrait.json` (`srd-2014`) um traço por `{key, name, description, source}` — mesma forma de `SystemClassFeatureSchema`, sem tipo novo (padrão já usado por `backgroundFeatures`, `system.ts:169-173`). Para raça-raiz **sem** subespécie: `raceFeatures[rootKey]` = traços próprios da raiz. Para raça-raiz **com** subespécie: `raceFeatures[subspeciesKey]` = traços da raiz + traços próprios da subespécie; a raiz em si não recebe entrada própria em `raceFeatures` (deixa de ser chave jogável — ver próximo item).
- **`config.raceFeatures`**: `z.record(z.string(), z.array(SystemClassFeatureSchema)).optional()` em `SystemConfigSchema` — mesmo padrão de `classFeatures`/`backgroundFeatures`.
- **Raiz-com-subespécie sai do conjunto de chaves jogáveis**: `Character.race` deixa de aceitar a chave da raiz quando ela tem subespécie no catálogo (reverte a *Questão em aberto #1* da US-140). Raiz-sem-subespécie continua exatamente como está hoje.
- **`character.service.ts`**: `getRaceFeatures(config, character.race)`, somado ao array de features na criação — mesmo pipeline de `getClassFeatures`/`getBackgroundFeatures` (`character.service.ts:46`).
- **`SetupWizard.tsx`**: `select#char-race` para de renderizar a raiz como `<option>` solta quando ela tem subespécie — só a(s) subespécie(s) aparece(m) (forma exata — optgroup, lista direta, ou raiz como cabeçalho não-selecionável — é *Questão em aberto #1* desta story, ver abaixo). Raiz sem subespécie continua opção solta normal, sem grupo.
- **Teste em `ingest.test.mjs`**: `buildRaceFeatures` com fixture cobrindo raiz com subespécie (traço combinado, sem duplicata) e raiz sem (só os próprios).
- **Teste em `SetupWizard.test.tsx`**: raiz-com-subespécie não aparece mais como opção solta selecionável.

### Fora do escopo

- **Tradução pt-BR dos textos de traço.** `SpeciesTrait.json` do 5.1 tem 93 registros (ADR 009 §8) — volume grande demais para curadoria manual como as 13 labels de `races` (US-105/140). Fica como *Questão em aberto*, não decidida aqui.
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
    "high-elf": [
      { "key": "darkvision", "name": "Visão no Escuro", "description": "…", "source": "elf" },
      { "key": "fey-ancestry", "name": "Ascendência Feérica", "description": "…", "source": "elf" },
      { "key": "cantrip", "name": "Truque de Mago", "description": "…", "source": "high-elf" }
    ]
  }
}
```

**Persistência:** mesmo artefato `srd-5e.config.<locale>.json` — sem migração de schema em `Character` (continua `race: String`, `features: String[]`, já materializado na criação pelo mesmo pipeline de `classFeatures`).

---

## Critérios de aceite

- [ ] `buildRaceFeatures` deriva `config.raceFeatures` a partir de `SpeciesTrait.json` (`srd-2014`) para toda chave jogável (raiz sem subespécie OU subespécie).
- [ ] Subespécie combina traços da raiz + traços próprios, sem duplicar um traço que as duas fontes compartilhem (checar overlap real no dataset antes de assumir concatenação simples — *Questão em aberto #2*).
- [ ] Raiz que tem subespécie não tem entrada própria em `config.raceFeatures` e deixa de validar como `Character.race` (mesma validação de catálogo da US-105, agora restrita às chaves jogáveis).
- [ ] Raiz sem subespécie continua validando normalmente, com `raceFeatures[key]` só com os próprios traços.
- [ ] `select#char-race` no wizard não oferece mais a raiz como opção solta quando ela tem subespécie.
- [ ] Personagem novo com raça-subespécie ganha os traços combinados em `Character.features` na criação, mesmo pipeline de `getClassFeatures`/`getBackgroundFeatures`.
- [ ] `SystemConfigSchema` valida `raceFeatures` como opcional — config legado (pré-US-142) sem o campo continua válido.
- [ ] Ambos os artefatos (`en-US`, `pt-BR`) trazem `raceFeatures` para as 4 subespécies + 5 raízes sem subespécie (`dragonborn`, `half-elf`, `half-orc`, `human`, `tiefling`).
- [ ] **Eval / teste de regressão:** `ingest.test.mjs` cobre `buildRaceFeatures` com fixture sintética (raiz+subespécie combinando certo, raiz sem subespécie sem quebrar); `SetupWizard.test.tsx` cobre a ausência da opção solta para raiz-com-subespécie.

---

## Notas de implementação

- **Reusar `SystemClassFeatureSchema`, não inventar tipo novo** — mesmo padrão que `backgroundFeatures` já estabeleceu (`system.ts:169-173`: *"Reusa SystemClassFeatureSchema — mesma forma {key,name,description,source}, sem tipo novo"*).
- **`getRaceFeatures(config, character.race)` espelha `getClassFeatures`/`getBackgroundFeatures`** — mesmo arquivo, `character.service.ts:46`: `const features = [...getClassFeatures(config, charClass), ...getBackgroundFeatures(config, originKey)]` vira `[...getClassFeatures(...), ...getBackgroundFeatures(...), ...getRaceFeatures(...)]`.
- **Confira o overlap real raiz/subespécie no dataset antes de escrever o merge.** O ADR 009 §8 já registrou que `Ability Score Increase` diverge entre 5.1 e 5.2 por espécie — não está confirmado se, **dentro do 5.1**, a raiz e a subespécie têm entradas de `Ability Score Increase` sobrepostas (ex.: Elfo dá +2 Destreza; Alto-elfo pode reafirmar o mesmo traço com o campo mecânico diferente) ou se são sempre complementares. Isso decide se o merge é concatenação simples ou precisa de override por `key` de traço.
- **`SpeciesTrait.json` não está no repo** (`_data/` é gitignored, baixado por `pnpm srd:sync`) — rode o sync antes de inspecionar a forma real do dataset; não assuma a partir desta story.
- **Volume de tradução é grande** (93 traços no 5.1, ADR 009 §8) — não tente curar manual como as 13 labels de `races`; decida fallback (EN puro, ou marcação `_mt` como outros domínios do `MT_DOMAINS`, US-52) antes de implementar o overlay pt-BR.

---

## Questões em aberto

1. **Forma de renderização da raiz-com-subespécie no wizard.** Sem a opção solta, o que aparece? Um `<optgroup>` cujo `label` é a raiz mas sem nenhuma `<option>` fora dele (equivalente a hoje, só removendo a opção solta) é a leitura mais direta desta story — mas precisa confirmar se o `<optgroup label>` sozinho (sem opção-raiz ao lado) já resolve a queixa de duplicação visual do US-140, ou se essa é uma segunda decisão de UI que ainda falta tomar.
2. **Merge de traço com overlap raiz/subespécie** — concatenação simples ou override por `key` de traço quando os dois níveis mecânicos colidem (ex.: `Ability Score Increase`)? Depende da inspeção real do dataset (ver Notas).
3. **Tradução das 93 descrições de traço** — curadoria manual, fallback EN, ou entrada no `MT_DOMAINS` da US-52? Volume descarta o padrão usado pelas 13 labels de `races`.

---

## Referências no código

- [scripts/srd/ingest.mjs:214-237](../../../scripts/srd/ingest.mjs:214) — `buildRaces`, ponto de extensão para `buildRaceFeatures` (mesmo arquivo, mesma fonte `species2014`).
- [packages/shared/src/types/system.ts:169-173](../../../packages/shared/src/types/system.ts:169) — `backgroundFeatures`, padrão de reuso de `SystemClassFeatureSchema` a copiar para `raceFeatures`.
- [packages/shared/src/types/system.ts:185](../../../packages/shared/src/types/system.ts:185) — `classFeatures`, mesmo padrão.
- [apps/api/src/character/character.service.ts:46](../../../apps/api/src/character/character.service.ts:46) — `getClassFeatures`/`getBackgroundFeatures`, onde `getRaceFeatures` entra na criação do personagem.
- [apps/web/src/components/setup/SetupWizard.tsx:615-639](../../../apps/web/src/components/setup/SetupWizard.tsx:615) — `select#char-race`, remove a opção solta da raiz-com-subespécie.
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md §Negativas](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) — 93 traços no 5.1 vs 51 no 5.2, divergência mecânica antecipada desde a decisão de fonte.
- [US-140](./US-140-catalogo-subracas-srd-5-1.md) — *Questão em aberto #1* revertida por esta story: raiz-com-subespécie deixa de ser opção independente.
- [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — nota original sobre a dívida mecânica represada (*"quando a story de traços chegar, um catálogo misto vira duas mecânicas incompatíveis"*).
