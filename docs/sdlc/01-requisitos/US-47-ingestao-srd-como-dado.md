# US-47 — Ingestão do SRD 5e (2024) como dado do sistema

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-21](./US-21-sistemas-como-dado.md) (`System.config` + Zod em `packages/shared`) · [US-27](./US-27-pericias-do-personagem.md) (perícias no config) · [US-41](./US-41-features-traits-de-classe.md) (features de classe no config)
**Relacionado:** [US-48](./US-48-getrule-corpus-de-regras.md) (o mesmo pipeline alimenta o corpus do `getRule`) · [US-42](./US-42-magias-conhecidas.md) (magias — fonte de spells é ressalva desta story) · [ADR 003](../../adr/003-sistemas-como-dado.md)
**Criada em:** 2026-07-11

---

## História

> **Como** desenvolvedora,
> **quero** popular o `config` do sistema D&D 5e a partir de um **dataset SRD estruturado**, por um script re-executável,
> **para que** perícias, features, kits e demais dados venham prontos de uma fonte versionada — sem digitar conteúdo à mão nem re-fazer o trabalho a cada revisão do SRD.

---

## Contexto e motivação

### O problema observado

A estrutura de "sistema como dado" já existe ([US-21](./US-21-sistemas-como-dado.md)): `System.config` guarda `attributes`, `skills`, `classFeatures`, `startingKits`. Mas **os dados de D&D estão sendo semeados à mão** no `seed.ts` — a tabela de features de nível 1 da [US-41](./US-41-features-traits-de-classe.md) foi transcrita manualmente do SRD, classe por classe. Isso não escala: cada perícia, kit, feature ou magia nova é digitação; uma revisão do SRD é retrabalho total.

### Por que a solução atual não basta

O `config` é o destino certo (o código já o consome sem mudança — ADR 003), mas **a origem é manual**. Falta uma **fonte estruturada** e um **adaptador** que a mapeie para o schema Zod existente (`SystemConfigSchema`). Sem isso, "integrar um sistema = inserir dado" continua verdadeiro só no papel; na prática, inserir o dado é trabalho de digitação.

### A proposta

Um pipeline em dois passos sobre o dataset open-source [`5e-bits/5e-database`](https://github.com/5e-bits/5e-database) (o mesmo que alimenta dnd5eapi.co), que traz o SRD como JSON com schemas estritos e **inclui traduções `pt-BR`** — direto ao ponto para um mestre que narra em português:

1. **`sync`** — traz o dataset, **pinado a uma release** (reprodutível), não a `main`.
2. **`ingest`** — mapeia o dataset para `SystemConfig` (validado por `SystemConfigSchema.parse()`) e faz upsert do `System` D&D 5e. Idempotente: re-rodar regenera tudo.

Zero código de app novo — o pipeline só substitui a **origem** do dado que o `seed.ts` já injeta.

---

## Escopo

### Dentro do escopo

- `scripts/srd/sync.ts` — obtém `5e-bits/5e-database` pinado a uma **release fixa** (submodule ou tarball de tag; nunca `main`).
- `scripts/srd/ingest.ts` — mapeia o dataset → `SystemConfig`, valida com `SystemConfigSchema.parse()`, faz upsert do `System` `system-dnd5e`.
- **Cobertura desta story (dados 2024/`2024/en` + `2024/pt-BR`):** `skills`, `classFeatures` (nível 1), `startingKits` (de Equipment/Classes), `attributes` (Ability-Scores), `proficiency`.
- **Idioma:** merge `pt-BR` sobre `en` — PT quando existe (parcial no upstream), EN como fallback por campo.
- **Idempotência:** re-rodar `ingest` produz o mesmo `System.config` (upsert, não append).
- **Falha cedo:** `SystemConfigSchema.parse()` no fim do mapeamento — se o dataset mudar de forma, o ingest quebra com erro claro, não grava config inválido.
- **Licença:** incluir no repo o aviso de licença do dataset (**OGL 1.0a** — ver Questões em aberto §2), com a Section 15 e o texto da OGL, ao lado do material derivado.
- **Fallback humano:** o PDF SRD 5.2.1 CC versionado em `docs/rules/srd/_source/` como **referência de conferência** e fonte de patch para lacunas (ver ressalva de spells) — não é o pipeline.

### Fora do escopo

- **`getRule` + corpus de regras textuais** (magias, condições, ações como texto consultável em runtime) — [US-48](./US-48-getrule-corpus-de-regras.md), alimentado pelo **mesmo** `ingest` mas destino separado (não entra no `config`, que é carregado a cada criação de personagem).
- **Magias no `config`** — spells não são feature nem perícia; pertencem ao corpus do `getRule` ([US-48](./US-48-getrule-corpus-de-regras.md)) e à [US-42](./US-42-magias-conhecidas.md). Além disso, **o dataset ainda não tem spells na pasta 2024** (ver ressalva).
- **Features de nível > 1, subclasses, progressão** — Fase 1 é nível 1 (mesma fronteira da [US-41](./US-41-features-traits-de-classe.md)).
- **Upload de sistema pela UI** (Fase 3) — este pipeline é para o sistema SRD embutido; `sourceType: UPLOAD` é outro caminho.
- **Monstros, itens mágicos, feats** como dado consumido — só entram quando houver consumidor. YAGNI até lá.

---

## Ressalva de dados (decide a fronteira com a US-42)

Verificado no dataset (release atual, jul/2026):

- A pasta **`src/2024/en`** cobre: Classes, Subclasses, Species, Backgrounds, Feats, **Features**, Levels, **Conditions**, Equipment, Monsters, **Skills**, Proficiencies, Ability-Scores, Damage-Types, Weapon-Mastery — e tem par **`pt-BR`**.
- **Não há `Spells.json` em `2024/`.** Magias só existem em **`src/2014/`** (SRD 5.1 / OGL).

Consequência: as **magias** consumidas pela [US-42](./US-42-magias-conhecidas.md) e pelo corpus da [US-48](./US-48-getrule-corpus-de-regras.md) vêm de **`2014/` (5.1)** como stopgap, até o upstream publicar spells 2024 ou o diff ser patchado à mão (poucas magias mudaram). Esta story **não** ingere spells; só registra a dependência.

---

## Modelo de dados proposto

Sem schema novo. O pipeline escreve no `System.config` já definido (`SystemConfigSchema`, [system.ts](../../../packages/shared/src/types/system.ts)). Forma do mapeamento:

```
5e-bits/5e-database (release pinada)
  ├─ 2024/pt-BR + 2024/en  (merge PT sobre EN)
  │    ├─ Skills.json        → config.skills[]        { key, label, ability }
  │    ├─ Features.json      → config.classFeatures{} { name, description } (nível 1)
  │    ├─ Classes/Equipment  → config.startingKits{}  { name, qty }
  │    └─ Ability-Scores     → config.attributes[]    { key, label, min, max, default }
  └─ SystemConfigSchema.parse()  → upsert System(system-dnd5e).config
```

**Persistência:** `System.config` (Prisma, `Json`), como hoje. O que muda é a **origem** (dataset mapeado, não `seed.ts` manual). O `seed.ts` passa a chamar o resultado do `ingest` (ou consumi-lo de um artefato `srd-5e.config.json` versionado).

---

## Critérios de aceite

- [ ] `scripts/srd/sync.ts` obtém `5e-bits/5e-database` **pinado a uma release** (a versão fica registrada no repo; `main` não é usado).
- [ ] `scripts/srd/ingest.ts` mapeia o dataset 2024 (`pt-BR` sobre `en`) para `SystemConfig` e faz **upsert** do `System` `system-dnd5e`.
- [ ] O `config` gerado passa em `SystemConfigSchema.parse()`; um dataset de forma inesperada faz o ingest **falhar com erro claro**, sem gravar config inválido.
- [ ] Rodar o `ingest` duas vezes produz o **mesmo** `config` (idempotente).
- [ ] As `skills`, `classFeatures` (nível 1) e `startingKits` do D&D 5e passam a vir do dataset — a tabela manual de features da [US-41](./US-41-features-traits-de-classe.md) é substituída pela derivada, **sem regressão** (paladino continua com Sentido Divino + Impor as Mãos).
- [ ] Campos com `pt-BR` saem em português; sem tradução, cai em `en` (verificável numa feature que só exista em EN).
- [ ] O aviso de **licença** do dataset (OGL 1.0a, Section 15 + texto OGL) está versionado junto ao material derivado.
- [ ] **Eval / regressão:** após o `ingest`, criar um paladino traz as features de nível 1 corretas no prompt e as 18 perícias no config — os mesmos asserts da [US-41](./US-41-features-traits-de-classe.md)/[US-27](./US-27-pericias-do-personagem.md) passam com o dado derivado.

---

## Notas de implementação

- **Pin, não `main`:** submodule numa tag ou download de tarball de release; gravar a versão (ex.: `v5.10.0`) no repo. Reprodutibilidade > frescor.
- **Mapper é o único trabalho manual:** um arquivo por seção (campo do dataset → chave do `SystemConfig`). Depois de escrito, revisão só quando o dataset muda de forma (o `parse()` avisa).
- **Chave de classe canônica:** `classFeatures` e `startingKits` compartilham a normalização de nome de classe já usada em `starting-inventory.ts`. Mapear a chave do dataset para essa mesma forma; classe sem match cai em `default`.
- **Merge PT/EN:** por campo, não por arquivo — o `pt-BR` do upstream é parcial. Preferir PT quando presente e não-vazio; senão EN.
- **Não inflar o `config`:** só o que já tem consumidor (skills/features/kits/attributes). Descrições longas de magias/condições vão para o corpus da [US-48](./US-48-getrule-corpus-de-regras.md), não aqui.
- **`seed.ts`:** passa a consumir o artefato do `ingest` em vez da tabela hardcoded; o comportamento observável não muda (mesma [US-41](./US-41-features-traits-de-classe.md)), só a fonte.

---

## Questões em aberto

1. **Submodule vs. artefato versionado:** guardar `srd-5e.config.json` gerado no repo (build determinístico, sem rede no `seed`) ou rodar `ingest` sob demanda a partir do submodule? Sugestão: **versionar o artefato** gerado — o `seed` não depende de rede, e o diff do artefato mostra o impacto de cada bump de release.
2. **Licença do dataset:** o `5e-bits/5e-database` declara o material sob **OGL 1.0a** (não CC-BY-4.0), inclusive na pasta `2024/`. O PDF do produto é o SRD 5.2.1 **CC**. Decidir: (a) aceitar OGL 1.0a para o dado derivado (permissivo; exige incluir a OGL + Section 15), ou (b) usar a **estrutura** do dataset mas o **texto de record** do PDF CC onde o rótulo importar. Isso muda o arquivo de atribuição, **não** o pipeline. Confirmar com a licença antes de shippar.
3. **Spells (stopgap):** ingerir spells de `2014/` (5.1) já nesta story como um bloco à parte, ou deixar 100% para a [US-42](./US-42-magias-conhecidas.md)/[US-48](./US-48-getrule-corpus-de-regras.md)? Sugestão: deixar para a US-48 (o consumidor de spells é o `getRule`, não o `config`).

---

## Referências no código

- `packages/shared/src/types/system.ts` — `SystemConfigSchema` (destino do mapeamento; forma fixa).
- `apps/api/prisma/seed.ts` — kit/perícias/features por sistema hoje **manuais**; passam a vir do `ingest`.
- `apps/api/src/character/starting-inventory.ts` — normalização de chave de classe a reusar no mapper.
- `apps/api/prisma/schema.prisma` — `System.config` (`Json`), sem alteração.
- `docs/adr/003-sistemas-como-dado.md` — decisão D1 que esta story torna escalável (dado deixa de ser digitado).
- `docs/rules/srd/_source/` — PDF SRD 5.2.1 CC (referência de conferência / patch de lacuna).
