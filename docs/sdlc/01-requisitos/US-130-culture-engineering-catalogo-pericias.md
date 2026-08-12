# US-130 — `Culture`/`Engineering` no catálogo de perícias (`config.skills`)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`) · [US-123](./US-123-integracao-mecanica-background-pointbuy-proficiency.md) (mecaniza `skill_proficiency`, relata `Culture`/`Engineering` como órfãs e as exclui do `grant`)
**Relacionado:** [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) §3.3 (precedente do segundo publisher `a5e-ag` via CC-BY) · [US-51](./US-51-kits-iniciais-do-srd.md) (`DEFAULT_KIT`, precedente de literal hardcoded fora do dataset)
**Criada em:** 2026-08-12

---

## História

> **Como** jogador que escolhe um background com `Culture` ou `Engineering` (Noble, Sage, Charlatan, Entertainer, Trader),
> **quero** que essas perícias sejam mecanizadas como as outras 18,
> **para que** meu background mecanize por completo, sem perícia que só existe em texto.

---

## Contexto e motivação

### O problema observado

A US-123 mede que `Culture`/`Engineering` aparecem em 6 dos 21 backgrounds do `a5e-ag`. Sem entrada em `config.skills`, ficam de fora do `grant` estruturado: Noble perde a mecanização de `Culture` (fixa — o background nunca fica 100% mecanizado), e Sage/Charlatan/Entertainer/Trader perdem essas duas opções do pool de escolha.

### Por que a solução atual não basta

`buildSkills` ([ingest.mjs:197-205](../../../scripts/srd/ingest.mjs:197)) deriva `config.skills` só do doc `core` do `Skill.json` — as 18 perícias padrão do 5e. Inspecionando o dataset pinado (`scripts/srd/_data/Skill.json`, 08/2026): **as 18 entradas são todas `document: "core"`; não existe nenhuma entrada `a5e-ag_*`.** O filtro defensivo em `buildSkills` (`!String(s.pk).startsWith('a5e-ag_')`) nunca dispara — não porque não seja necessário, mas porque o Open5e nunca modelou as perícias do A5E como recurso `Skill`. `Culture`/`Engineering` só existem como texto solto dentro de `BackgroundBenefit.desc` (ex.: `"History, and either Arcana, Culture, Engineering, or Religion."`, Sage) — **sem nenhuma associação de habilidade governante** em lugar nenhum do dataset licenciado (nem `Skill.json`, nem o texto do benefício).

Isso muda o problema: não é só "adicionar 2 linhas ao catálogo" — é decidir de onde vem o dado que falta (a `ability` governante), porque o dataset pinado do Open5e (fonte única, ADR 004 decisão 2) não tem essa informação.

### A proposta

Adicionar `Culture`/`Engineering` a `config.skills` como **literal hardcoded no ingest**, mesmo precedente do `DEFAULT_KIT` ([ingest.mjs:130-139](../../../scripts/srd/ingest.mjs:130) — dado que não vem do dataset, documentado inline com comentário explicando a origem). Isso fecha a Questão em aberto 1 da US-123 e permite ao Noble mecanizar por completo.

---

## Escopo

### Dentro do escopo

- **`config.skills` (en-US e pt-BR) ganha 2 entradas** (`culture`, `engineering`), no mesmo formato `{ ability, key, label }` das outras 18 — total passa de 18 para 20.
- **Ingest:** literal hardcoded em `ingest.mjs`, mesmo padrão do `DEFAULT_KIT` — comentário inline explicando que a `ability` governante não vem do `Skill.json` (dataset não modela A5E como recurso `Skill`) e citando a fonte consultada para a `ability` (ver Questão em aberto 1 — **não hardcodar sem confirmar a fonte**).
- **Overlay pt-BR** (`scripts/srd/locale/pt-BR.json:11`) ganha label PT pras duas chaves novas.
- **US-123 — Noble mecaniza por completo:** com `culture` existindo no catálogo, o `grant.kind === 'skills'` do Noble passa a incluir `Culture` em `fixed` (hoje excluída como órfã); Sage/Charlatan/Entertainer/Trader recuperam as opções cortadas do `chooseFrom`.
- **Relatório de órfãos do ingest** não lista mais `Culture`/`Engineering` (parser de `skill_proficiency` da US-123 resolve as duas contra o catálogo agora completo).
- **Etapa `skills` do wizard:** `Culture`/`Engineering` aparecem como opções normais de escolha quando não vierem de um `grant` de background.
- **Testes:** `ingest.test.mjs` cobre as 2 entradas novas em `config.skills`; teste de regressão do Noble (US-123) passa a esperar `Culture` em `fixed`, não mais excluída.
- **Depois da implementação: atualizar o [ADR 004](../../adr/004-origem-do-dado-de-sistema.md)** com uma nota nova (§3.4, mesmo estilo da §3.3) registrando que a `ability` de `Culture`/`Engineering` veio de fora do Open5e (a5e.tools/rules/skills) — é dado que a fonte única pinada (decisão 2) não tem, então o ADR precisa refletir a exceção, não só o código.

### Fora do escopo

- Qualquer outra perícia do A5E além dessas 2 — medido na US-123, são as únicas ausentes do catálogo (21 backgrounds, 08/2026).
- Outras mecânicas do A5E (feats, `tool_proficiency`, `language`) — fora do escopo da US-122/US-123, não reaberto aqui.
- Fluxo de "troque por outra perícia" em colisão — questão em aberto separada da US-123, não resolvida por esta story.

---

## Modelo de dados proposto

Extensão de `config.skills` (mesmo shape das 18 existentes, [srd-5e.config.en-US.json:2673](../../../scripts/srd/srd-5e.config.en-US.json:2673)):

```json
{ "ability": "intelligence", "key": "culture", "label": "Culture" },
{ "ability": "intelligence", "key": "engineering", "label": "Engineering" }
```

`ability` confirmada contra a referência oficial das regras do Level Up (a5e.tools/rules/skills, espelho do SRD do A5E): **Intelligence** pras duas — "the most commonly used ability score is Intelligence" tanto pra Culture quanto pra Engineering. **Ressalva de RAW:** o A5E documenta perícia↔habilidade como não-fixo ("Any skill can be used with any ability check, although some pairings are more common than others") — `intelligence` aqui é a habilidade *mais comum*, não a única jogável, mesma leniência que o 5e padrão já dá em mesa (Percepção normalmente é Sabedoria, mas um DM pode pedir Inteligência pra notar um padrão num texto). `config.skills` já assume 1 `ability` fixa por perícia pras outras 18 (mesma simplificação, não é caso novo) — não muda o schema.

**Persistência:** nenhuma nova — `config.skills` já é campo existente do `SystemConfig` (JSON), só ganha 2 entradas.

---

## Critérios de aceite

- [ ] `config.skills` (en-US e pt-BR) tem 20 entradas, incluindo `culture` e `engineering`, ambas com `ability: "intelligence"` (confirmado em a5e.tools/rules/skills).
- [ ] `pt-BR.json` (overlay) tem label PT pras duas chaves novas.
- [ ] Relatório de órfãos do ingest não lista mais `Culture`/`Engineering` pra nenhum dos 6 backgrounds afetados.
- [ ] Noble (US-123): `grant.kind === 'skills'` tem `Culture` em `fixed`, ao lado de `History` — background 100% mecanizado.
- [ ] Sage/Charlatan/Entertainer/Trader: `Culture`/`Engineering` aparecem em `chooseFrom` onde o texto original menciona.
- [ ] Etapa `skills` do wizard lista `Culture`/`Engineering` como opções normais (fora de grant de background).
- [ ] **Eval / teste de regressão:** `character.service.test.ts` (US-123) — personagem com background Noble mecaniza `History` + `Culture` fixas, sem exclusão; `ingest.test.mjs` cobre as 2 entradas novas de `config.skills`.
- [ ] **Depois de mergear:** ADR 004 ganha §3.4 registrando a fonte não-Open5e da `ability` (a5e.tools/rules/skills), mesmo padrão de prosa da §3.3.

---

## Notas de implementação

- Reusar exatamente o padrão do `DEFAULT_KIT` ([ingest.mjs:130-139](../../../scripts/srd/ingest.mjs:130)): literal EN, comentário no código citando por que não vem do dataset e de onde veio o valor usado — citar a5e.tools/rules/skills no comentário, mesmo estilo de referência que o resto do ingest já cita ADR/US.
- `buildSkills` ([ingest.mjs:198](../../../scripts/srd/ingest.mjs:198)) passa a concatenar o resultado do `Skill.json` (18, doc `core`) com o literal hardcoded (2) — o filtro `a5e-ag_` existente pode ficar (é defensivo e nunca dispara hoje) ou sair, já que deixa de haver ambiguidade sobre a origem das 2 novas chaves (elas não vêm de `pk` prefixado, vêm do literal).

---

## Questões em aberto

1. **O `config.skills` fixa 1 `ability` por perícia; o A5E documenta perícia↔habilidade como não-fixo.** Esta story usa a habilidade "mais comum" (RAW), consistente com a simplificação que as outras 18 perícias já carregam. Se o jogo algum dia expuser "escolher habilidade pra rolagem de perícia" (fora do escopo hoje), o schema atual não suporta — não é bloqueio, é nota pra quando/se aparecer.

---

## Referências no código

- [scripts/srd/ingest.mjs:197-205](../../../scripts/srd/ingest.mjs:197) — `buildSkills`, filtro `a5e-ag_` que nunca dispara hoje.
- [scripts/srd/ingest.mjs:130-139](../../../scripts/srd/ingest.mjs:130) — `DEFAULT_KIT`, precedente de literal hardcoded fora do dataset.
- `scripts/srd/_data/Skill.json` — confirmado por inspeção: 18 entradas, todas `document: "core"`, nenhuma `a5e-ag_*`.
- `scripts/srd/_data/BackgroundBenefit.json` — texto de `skill_proficiency` sem associação de `ability`.
- [scripts/srd/srd-5e.config.en-US.json:2673](../../../scripts/srd/srd-5e.config.en-US.json:2673) / [scripts/srd/locale/pt-BR.json:11](../../../scripts/srd/locale/pt-BR.json:11) — `config.skills` e overlay pt-BR, a estender.
- [docs/adr/004-origem-do-dado-de-sistema.md](../../adr/004-origem-do-dado-de-sistema.md) §3.3 — precedente do segundo publisher.
- [US-123](./US-123-integracao-mecanica-background-pointbuy-proficiency.md) — órfãos hoje excluídos, critério de aceite do Noble a atualizar quando esta story fechar.
