# US-145 — `sync` pinado do Lazy GM Resource Document + NOTICE gerado

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma — pode ir em paralelo com [US-143](./US-143-adr-aventura-como-dado-gerado.md) e [US-144](./US-144-schema-aventura-shared.md)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (GEN-2) · [US-47](./US-47-ingestao-srd-como-dado.md) (molde de sync pinado por SHA/tag, escrita determinística) · [scripts/srd/NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) (regime de atribuição CC-BY já em uso)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** baixar o Lazy GM Resource Document (LGMRD) e o `5e_Monster_Builder.json` por commit SHA fixo, versionados no repo, com um NOTICE de atribuição gerado a partir dos dados,
> **para que** o motor de aventuras tenha as 135 tabelas e os statblocks por papel como artefato reprodutível, sem depender de `main` mudar sob os pés do projeto.

---

## Contexto e motivação

### O problema observado

O motor de geração (GEN-4 em diante) precisa sortear premissa, locais, monumentos e complicação a partir das 135 tabelas do LGMRD (SlyFlourish.com), e precisa de statblocks por papel (Minion/Soldier/Brute) do `5e_Monster_Builder.json` para popular encontros (GEN-9). Hoje nenhum dos dois existe no repo — o pipeline de ingestão SRD (`scripts/srd/`) baixa e processa exclusivamente dados do Open5e (races, classes, spells, backgrounds), sem tocar em fontes de geração de aventura.

### Por que a solução atual não basta

`scripts/srd/sync.mjs` já resolve exatamente este problema para outra fonte — mas é escopado ao Open5e (`TAG = 'v2.1.0'`, `RAW = https://raw.githubusercontent.com/open5e/open5e-api/...`) e não tem lugar para uma fonte de repositório diferente. O LGMRD tem workflow **nightly** (o próprio backlog aponta: *"a fonte tem workflow nightly e as versões publicadas não batem entre si"*) — baixar de `main` sem pin quebraria a garantia de reprodutibilidade que o `sync.mjs` do SRD já estabeleceu, e que a eval (GEN-11) e o teste de seed (GEN-3) dependem para pinar um resultado.

### A proposta

Um segundo `sync` — em `scripts/lazygm/`, não dentro de `scripts/srd/` (fonte e licença diferentes, mesmo raciocínio que já separa `A5E_AG` do `SRD_2014` dentro do sync existente) — que baixa `LGMRD.json` e `5e_Monster_Builder.json` por **commit SHA fixo** e gera `NOTICE-lazygm.md` a partir do campo `attribution` do próprio dado, verbatim, com a atribuição tripla (SlyFlourish, autor do LGMRD, licença).

---

## Escopo

### Dentro do escopo

- **`scripts/lazygm/sync.mjs`** (arquivo novo, pasta nova) — baixa `LGMRD.json` e `5e_Monster_Builder.json` por **commit SHA** fixo (nunca `main`), grava em `scripts/lazygm/_data/` (gitignored, mesmo padrão de `scripts/srd/_data/`), no molde de `FILES`/`OUT`/`main()` de [sync.mjs](../../../scripts/srd/sync.mjs).
- **`NOTICE-lazygm.md`** gerado a partir do campo `attribution` do dado baixado — texto **verbatim**, nunca parafraseado, com a atribuição tripla. Entra no mesmo commit que o primeiro dado derivado (mesma disciplina que `NOTICE-open5e.md` já segue).
- **Sem parser.** Ao contrário do `ingest.mjs` do SRD (que produz `config` normalizado), esta story só baixa e versiona o artefato bruto — o consumo (rolagem pelas tabelas, GEN-4; statblocks por papel, GEN-9) é responsabilidade de stories seguintes que leem o JSON diretamente.
- **CC-BY-4.0** — mesma licença do Open5e, cabe no regime que [NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) já descreve; `NOTICE-lazygm.md` é um documento irmão, não uma seção dentro do existente (fonte diferente, atribuição diferente).
- **Teste de sync** — regressão simples de que o pin não é `main` (grep no SHA fixo ou constante nomeada), no molde de como `sync.mjs` do SRD documenta `TAG` como constante exportada.

### Fora do escopo

- **Qualquer parser/normalização do LGMRD** (`buildRaces`-like) — GEN-4 e GEN-9 leem o JSON baixado diretamente; esta story só garante que ele existe, versionado e pinado.
- **`5e_Monster_Builder.json` virar catálogo de monstros do SRD.** O backlog é explícito: *"não precisa ingerir monstro do SRD"* — os statblocks por papel bastam, sem bestiário nominal (ver GEN-9).
- **Os dois exemplares de referência de densidade** (`36-villageofwhitesparrow.md`, `37-thenightblade.md`) usados pela eval (GEN-11) — mesma fonte CC-BY, mas consumo de eval é escopo daquela story, não desta.
- **Re-sync automático/CI agendado.** Igual ao `sync.mjs` do SRD, roda sob demanda (`node scripts/lazygm/sync.mjs`), não em pipeline.

---

## Modelo de dados proposto

> Sem schema Zod nem migração — artefato bruto versionado, mesmo regime do SRD antes do `ingest.mjs`.

```
scripts/lazygm/
  sync.mjs
  _data/            (gitignored)
    LGMRD.json
    5e_Monster_Builder.json
    .source
  NOTICE-lazygm.md   (versionado)
```

**Persistência:** artefato em `scripts/lazygm/_data/` (gitignored, baixado sob demanda); `NOTICE-lazygm.md` versionado no repo, como `NOTICE-open5e.md`.

---

## Critérios de aceite

- [ ] `node scripts/lazygm/sync.mjs` baixa `LGMRD.json` e `5e_Monster_Builder.json` por commit SHA fixo (constante exportada, mesmo padrão de `TAG` em [sync.mjs](../../../scripts/srd/sync.mjs)) para `scripts/lazygm/_data/`.
- [ ] O download **nunca** aponta para `main`/`HEAD`/branch — só SHA fixo, verificável lendo a URL montada.
- [ ] `NOTICE-lazygm.md` existe, gerado (não escrito à mão) a partir do campo `attribution` do dado, verbatim, com a atribuição tripla (SlyFlourish, autoria do LGMRD, CC-BY-4.0).
- [ ] `scripts/lazygm/_data/` está no `.gitignore`; `NOTICE-lazygm.md` e `sync.mjs` estão versionados.
- [ ] `pnpm typecheck` passa (arquivo `.mjs` fora do typecheck do TS, mas o script não quebra o pipeline de build).
- [ ] **Eval / teste de regressão:** teste que falha se o SHA do pin for trocado por uma branch (ex.: regex no arquivo checando ausência de `/main/` ou `/HEAD/` na URL montada) — mesma disciplina que protege o `sync.mjs` do SRD de virar não-reprodutível.

---

## Notas de implementação

- **Copiar a estrutura de `FILES`/`OUT`/`main()`/guard de entrypoint** de [sync.mjs](../../../scripts/srd/sync.mjs) quase linha a linha — é o molde já testado em produção pela US-47, só troca a fonte e o formato de pin (SHA em vez de tag semver, porque o LGMRD não publica tags como o Open5e).
- **`JSON.parse(text)` logo após o fetch** — mesma guarda de "falha cedo se vier HTML de erro" que o `sync.mjs` do SRD já usa (`sync.mjs:74`).
- **Pasta separada (`scripts/lazygm/`), não subpasta de `scripts/srd/`** — fonte diferente (SlyFlourish, não Open5e), pipeline diferente (sem `ingest.mjs`/parser), evita a tentação de reusar `FILES`/`OUT` do SRD e misturar dois regimes de licença/atribuição num só `.source`.
- **`NOTICE-lazygm.md` documento irmão de `NOTICE-open5e.md`**, não seção dentro dele — os dois documentos de atribuição para fontes CC-BY distintas devem poder mudar independentemente (bump do LGMRD não deve gerar diff no NOTICE do Open5e).

---

## Questões em aberto

1. Qual é o commit SHA a pinar? O backlog não fixa um — decidir no dia da implementação, olhando o histórico do repositório do LGMRD no GitHub (SlyFlourish.com/lazy-dm-resource-document ou equivalente), documentado como comentário ao lado da constante (mesmo padrão do `TAG` do Open5e).
2. O campo `attribution` do dado tem a forma exata assumida (texto pronto para verbatim)? Confirmar a estrutura real do JSON baixado antes de escrever o gerador do NOTICE — não assumir a partir desta story.

---

## Referências no código

- [scripts/srd/sync.mjs](../../../scripts/srd/sync.mjs) — molde de pin, `FILES`, `OUT`, guard de entrypoint, `.source`.
- [scripts/srd/NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md) — regime de atribuição CC-BY já em uso; `NOTICE-lazygm.md` é o documento irmão.
- [Backlog — Motor de geração de aventuras one-shot §GEN-2](./backlog-motor-de-geracao-de-aventuras.md) — texto de origem e a nota sobre o workflow *nightly* do LGMRD.
- [US-47](./US-47-ingestao-srd-como-dado.md) — a story original que estabeleceu escrita determinística de artefato versionado, molde geral desta.
