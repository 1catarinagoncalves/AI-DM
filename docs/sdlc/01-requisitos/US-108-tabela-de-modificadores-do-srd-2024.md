# US-108 — Tabela de modificadores do SRD 2024 como fonte da regra

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) (pipeline `sync`/`ingest` do Open5e — é ele que ganha um arquivo novo)
**Relacionado:** [US-32](./US-32-modificadores-de-atributo.md) (a fórmula que existe hoje e a referência que ela cita) · [US-27](./US-27-pericias-do-personagem.md) (perícias somam o mesmo modificador) · US-48 (o mesmo `Rule.json` é a matéria-prima do corpus) · [ADR 009](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (fonte SRD, licença CC-BY)
**Criada em:** 2026-08-06

---

## História

> **Como** mantenedora do sistema de regras,
> **quero** que a tabela de modificadores de habilidade venha do **texto do SRD 2024**, importada pelo mesmo pipeline que traz o resto do dado de sistema,
> **para que** a regra que o jogo aplica tenha procedência verificável e não possa divergir em silêncio da tabela oficial.

---

## Contexto e motivação

### O problema observado

A regra do modificador é uma linha em [`ability.ts`](../../../packages/shared/src/ability.ts) (`abilityModifier`, L5): `Math.floor((score - 10) / 2)`. O único documento normativo por trás dela é [`modificadores-atributos.md`](./modificadores-atributos.md), citado pela [US-32](./US-32-modificadores-de-atributo.md) como *"Referência completa (roll20 / SRD 5e)"*. Esse arquivo **não é o SRD**: é raspagem de blog e vídeo, com metade das citações apontando para `translate.google.com`, e a tabela para em **20-21**.

Três consequências concretas:

1. **A faixa oficial não é conhecida pelo código.** O SRD 2024 diz que a pontuação vai de **1 a 30** (20 é o teto do aventureiro; 21–30 é monstro). Hoje `abilityModifier(0)` devolve `-5` e `abilityModifier(99)` devolve `44` — sem reclamar, sem teste.
2. **A referência que a equipe consulta está incompleta e sem procedência.** Quem for implementar bônus de monstro, item que estoura 20, ou explicar a regra, não tem a tabela cheia nem a fonte.
3. **Nada acusa divergência.** Se alguém "otimizar" `floor` para `round`, os 6 casos de fronteira do teste atual (`1, 8, 10, 11, 15, 20`) continuam passando em vários deles — não há oráculo contra a tabela inteira.

### Por que a solução atual não basta

O pipeline da [US-47](./US-47-ingestao-srd-como-dado.md) já baixa 8 arquivos do Open5e (`srd-2024`, tag `v2.1.0`) e já usa o `AbilityDescription.json` para derivar as 6 chaves de atributo. Mas **o texto normativo da regra não está entre os arquivos baixados**: ele vive em `Rule.json`, que o [`sync.mjs`](../../../scripts/srd/sync.mjs) não lista. Verificado no tag `v2.1.0` em 06/08/2026 — `Rule.json` tem 56 regras, entre elas:

- `srd-2024_the-six-abilities_ability-scores` — o que cada faixa de pontuação significa (1 · 2–9 · 10–11 · 12–19 · 20 · 21–29 · 30);
- `srd-2024_the-six-abilities_ability-modifiers` — a tabela **1 → 30** completa, mais o *callout* **"Round Down"**, que é a justificativa oficial do `floor`.

### A proposta

Trazer `Rule.json` para o `sync`, extrair no `ingest` a tabela de modificadores como **artefato versionado**, e usá-la como **oráculo do teste** e como **texto da referência** — mantendo a fórmula de uma linha como o caminho de execução.

**A tabela não vira lookup de runtime.** A fórmula `floor((score - 10) / 2)` reproduz as 16 faixas exatamente, de 1 a 30 — trocar uma linha por uma busca em 16 faixas é mais código para o mesmo resultado, e engordar o `config` com ela contraria o [ADR 003](../../adr/003-sistemas-como-dado.md) (o `config` é lido inteiro, sempre). O ganho da importação é **procedência e detecção de divergência**, não cálculo.

---

## Escopo

### Dentro do escopo

- **`Rule.json` no `sync`** — uma linha em `FILES` no [`sync.mjs`](../../../scripts/srd/sync.mjs), mesmo `TAG` (`v2.1.0`), mesma origem `srd-2024`, mesma licença CC-BY-4.0.
- **Extração no `ingest`** — as duas regras da ruleset `srd-2024_the-six-abilities` viram um artefato derivado **versionado no repo**: as 16 faixas `{ scoreMin, scoreMax, modifier }` mais a procedência (tag, `pk` de origem, licença). Falha alto se a ruleset ou o `pk` sumirem num bump de tag.
- **Teste como oráculo** — `ability.test.ts` varre **1..30** comparando `abilityModifier(score)` com a faixa correspondente do artefato. Uma divergência (fórmula mexida, tabela mudada no bump) reprova.
- **Domínio de `abilityModifier`** — pontuação fora de 1–30 vira exceção com o valor ofensor e a faixa esperada (padrão do `AGENTS.md`). Hoje o silêncio é o defeito.
- **[`modificadores-atributos.md`](./modificadores-atributos.md) reescrito a partir do SRD** — tabela até 30, texto das duas regras, procedência e licença. Sai a raspagem de blog/vídeo/Google Translate. O link da [US-32](./US-32-modificadores-de-atributo.md) continua válido.
- **Atribuição** — [`NOTICE-open5e.md`](../../../scripts/srd/NOTICE-open5e.md) passa a listar o derivado novo, como já faz com os dois `srd-5e.config.<locale>.json`.

### Fora do escopo

- **Corpus e tool `getRule`** (US-48) — estas duas regras são candidatas óbvias ao corpus, mas o artefato do corpus e a tool são daquela story. Aqui o `Rule.json` só passa a ser baixado; quem o consumir inteiro é a US-48.
- **As outras 54 regras do `Rule.json`** — bônus de proficiência, D20 Tests, tabela de CD, condições. Mesmo arquivo, outra story.
- **Frase de sabor das 6 habilidades** (`AbilityDescription.desc`: *"Physical might"*, *"Health and stamina"*) — hoje o [`ingest.mjs`](../../../scripts/srd/ingest.mjs) descarta esse campo e usa só `describes`. Levá-la ao `config`/ficha é story própria.
- **Pontuação acima de 20 na ficha** — não existe na Fase 1 (sem ASI, sem level-up; o point-buy do `ingest` fecha em 10–18). A tabela cobre até 30 porque **monstro** chega lá, não porque a ficha chega.
- **Tradução PT do texto de regra** — segue a disciplina da [US-52](./US-52-traducao-automatica-do-srd.md); a tabela é numérica e não precisa de overlay, o texto das regras precisa e fica para a decisão do corpus.
- **Mudar `formatModifier`** — o SRD escreve `+0`, a interface escreve `0`. É decisão de produto da [US-32](./US-32-modificadores-de-atributo.md), não regra do SRD.

---

## Modelo de dados proposto

Artefato derivado, versionado no repo (o `scripts/srd/_data/` é gitignored — sem o derivado commitado, o teste não roda em CI):

```json
{
  "source": {
    "document": "srd-2024",
    "tag": "v2.1.0",
    "rules": ["srd-2024_the-six-abilities_ability-modifiers", "srd-2024_the-six-abilities_ability-scores"],
    "license": "CC-BY-4.0"
  },
  "range": { "min": 1, "max": 30 },
  "rows": [
    { "scoreMin": 1, "scoreMax": 1, "modifier": -5 },
    { "scoreMin": 2, "scoreMax": 3, "modifier": -4 },
    { "scoreMin": 30, "scoreMax": 30, "modifier": 10 }
  ]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `source` | objeto | Procedência: documento, tag do Open5e, `pk` das regras de origem, licença. É o que torna o bump auditável no diff. |
| `range` | objeto | Faixa válida de pontuação segundo o SRD (1–30). Alimenta o domínio de `abilityModifier`. |
| `rows` | lista | As 16 faixas da tabela oficial. `scoreMin`/`scoreMax` iguais quando a faixa é de um valor só (1, 30). |

**Persistência:** arquivo no repo, gerado pelo `ingest` e revisado no diff a cada bump de tag. Não vai para o banco nem para o `System.config`: nenhum caminho de runtime lê a tabela.

---

## Critérios de aceite

- [x] O `sync` baixa `Rule.json` do mesmo `TAG` e do mesmo documento `srd-2024` dos outros arquivos.
- [x] O `ingest` gera o artefato da tabela com as **16 faixas** e o bloco `source` (documento, tag, `pk`s, licença).
- [x] O `ingest` **falha com mensagem explícita** se a ruleset `srd-2024_the-six-abilities` ou um dos dois `pk` não existir no dado baixado — bump de tag que remova a regra não passa em silêncio.
- [x] `abilityModifier` lança para pontuação fora de 1–30, com o valor ofensor e a faixa esperada na mensagem.
- [x] [`modificadores-atributos.md`](./modificadores-atributos.md) cobre a tabela até 30, cita SRD 2024 / Open5e / CC-BY, e não contém mais link de tradutor automático nem de vídeo como fonte de regra.
- [x] [`NOTICE-open5e.md`](../../../scripts/srd/NOTICE-open5e.md) lista o artefato novo entre os derivados.
- [x] **Eval / teste de regressão:** o teste varre `1..30`, compara `abilityModifier` com a faixa do artefato e reprova em duas situações provadas no PR — (a) fórmula trocada por `Math.round` (falha em todo ímpar negativo, ex.: `9 → 0` em vez de `-1`); (b) uma linha do artefato adulterada. Mais um caso por limite: `abilityModifier(0)` e `abilityModifier(31)` lançam.

---

## Notas de implementação

- **Os sinais do texto do Open5e não são ASCII.** A tabela vem com **U+2212 MINUS SIGN** (`−5`, não `-5`) e as faixas com **U+2013 EN DASH** (`2–3`, não `2-3`). `Number('−5')` devolve `NaN`. Normalizar os dois antes de parsear — é a armadilha que come a primeira tentativa.
- O `desc` das regras é markdown com a tabela embutida (`|Score|Modifier|`), não campos estruturados: o parser lê as linhas da tabela do `desc`, e por isso a checagem de `pk` ausente precisa ser dura.
- `Rule.json` no `v2.1.0` tem 56 regras — arquivo pequeno, sem custo relevante no `sync`.
- O *callout* **"Round Down"** do SRD (*arredonde para baixo mesmo quando a fração for meio ou mais*) é a justificativa oficial do `Math.floor`: vale como comentário do PORQUÊ em [`ability.ts`](../../../packages/shared/src/ability.ts), com o `pk` da regra.
- A regra `_ability-scores` (o que cada faixa **significa**: 20 = teto do aventureiro, 30 = teto absoluto) é o que fundamenta a faixa 1–30 do domínio — vale importar junto, mesmo que só o `range` seja consumido por código.
- Os `min`/`max` do `config` (10–18) são **decisão de produto** (point-buy, `ATTR_RANGE` no [`ingest.mjs`](../../../scripts/srd/ingest.mjs)), não a faixa do SRD. As duas coexistem: o Zod da ficha valida 10–18 na criação, `abilityModifier` valida 1–30 no cálculo.
- Não criar helper novo de faixa: `abilityModifier` continua sendo a função única, ganha só a guarda no topo.

---

## Questões em aberto

1. ✅ **Fora de 1–30: lançar ou clampar?** **Lançou** (06/08/2026). A ficha já é validada pelo min/max do config (Zod, na criação), então valor fora da faixa é defeito de código, não entrada de usuário — e o clamp devolveria um número plausível para um estado impossível. Os 3 chamadores foram conferidos antes: `roll.ts` já guarda `score != null`; `GameView.tsx` e `dm-system.ts` leem atributo da ficha validada. Clampar só se aparecer origem legítima de valor fora da faixa (ficha de monstro importada, por exemplo).
2. ✅ **Onde mora o artefato?** Em **`scripts/srd/`**, junto dos outros derivados e do `NOTICE` (06/08/2026). Decidiu o `tsconfig` do `packages/shared`: ele compila em `CommonJS`, onde `import.meta.url` é erro de typecheck, e importar JSON de fora do pacote arrastaria o `rootDir` do `tsc`. O teste lê o arquivo com `readFileSync` a partir do `process.cwd()` — mesmo idioma do drift guard da [US-36](./US-36-eval-de-qualidade-da-narracao.md).
3. **Traduzir o texto das duas regras para pt-BR agora ou junto da US-48?** Segue aberta, e sem urgência: o artefato gerado é só a tabela (numérica, atravessa locale sem tradução). A prosa das duas regras só é consumida por gente, na referência em PT.

---

## Referências no código

- `packages/shared/src/ability.ts` — `abilityModifier`, a fórmula que esta story ancora e onde entrou a guarda de faixa (1–30) com o *callout* "Round Down" como comentário do PORQUÊ.
- `packages/shared/src/ability.test.ts` — os 6 casos de fronteira escritos à mão continuam; a varredura 1..30 contra o artefato entrou por cima, com guarda de vacuidade (16 faixas, faixa 1–30).
- `scripts/srd/ability-modifiers.mjs` — `parseAbilityModifiers`: lê as duas regras do `Rule.json`, normaliza a tipografia (U+2212, U+2013) e cobra a cobertura da faixa. Módulo próprio porque o `ingest.mjs` já passa de 500 linhas e aqui não há overlay nem locale.
- `scripts/srd/ability-modifiers.srd-2024.json` — o artefato versionado (16 faixas + procedência). Gerado por `pnpm srd:ingest`, revisado no diff a cada bump de tag.
- `scripts/srd/sync.mjs` — `FILES` ganhou `Rule.json`, e `main()` ganhou guard de entrypoint (o `ingest` importa `TAG` daqui; sem o guard o import baixaria o dataset inteiro).
- `scripts/srd/ingest.mjs` — `buildAttributes` e `ATTR_RANGE` (o point-buy 10–18, que **não** é a faixa do SRD); a gravação do artefato entra no `main`.
- `scripts/srd/ingest.test.mjs` — os 5 testes do parser (é este arquivo que o CI roda em `pnpm srd:ingest:test`).
- `scripts/srd/NOTICE-open5e.md` — atribuição CC-BY dos derivados.
- `docs/sdlc/01-requisitos/modificadores-atributos.md` — a referência, reescrita a partir do SRD 2024.
