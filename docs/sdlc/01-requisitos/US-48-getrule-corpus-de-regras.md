# US-48 — Tool `getRule` e corpus de regras consultável pelo mestre

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) (o mesmo pipeline de ingestão gera o corpus) · [US-21](./US-21-sistemas-como-dado.md) (sistema como dado; corpus por sistema)
**Relacionado:** [US-42](./US-42-magias-conhecidas.md) (magias que o mestre consulta) · [US-29](./US-29-saneamento-de-rolagens-ficticias.md)/[US-38](./US-38-rolagens-ancoradas-na-ficha.md) (dados são do `rollDice`, não do `getRule`) · [US-49](./US-49-eval-fidelidade-de-regra.md) (eval)
**Criada em:** 2026-07-11

---

## História

> **Como** jogador,
> **quero** que o mestre **consulte a regra real do SRD** quando precisa (efeito de uma condição, alcance/área de uma magia, uma ação de combate),
> **para que** ele narre coerente com as regras em vez de inventar efeito — cumprindo a promessa que o próprio system prompt já faz.

---

## Contexto e motivação

### O problema observado

O system prompt **já manda** o mestre consultar regras: *"NEVER invent rules, modifiers, or stats. Use `getRule` to look them up when unsure."* ([dm-system.ts](../../../packages/ai-engine/src/prompts/dm-system.ts), seção Rules). Mas a **tool `getRule` não existe** — está comentada em [`tools/index.ts`](../../../packages/ai-engine/src/tools/index.ts) como "Future tool". O mestre é instruído a usar algo que não pode chamar; na dúvida, ele inventa.

### Por que a solução atual não basta

O `config` da [US-21](./US-21-sistemas-como-dado.md)/[US-47](./US-47-ingestao-srd-como-dado.md) cobre a **mecânica estruturada** (perícias, features, kits) — dado carregado a cada criação de personagem. Mas o **long-tail textual** (a descrição do que "Enfeitiçado" faz, a área de "Bola de Fogo", como funciona "Agarrar") não cabe ali: é grande, lido raramente, e inflar o `config` com ele contraria o ADR 003 (config é lido inteiro, sempre). Falta um **store de regras separado**, consultado **lazy** por uma tool.

### A proposta

1. **Corpus de regras por sistema** — `{ chave: texto curto }` (condição → efeito, magia → descrição, ação → regra), gerado pelo **mesmo `ingest` da [US-47](./US-47-ingestao-srd-como-dado.md)** (destino separado do `config`), carregado só quando a tool roda.
2. **Tool `getRule`** — recebe uma consulta, resolve por nome normalizado no corpus do sistema ativo, devolve 1–3 trechos curtos. Determinística, server-side, como `rollDice`.

---

## Escopo

### Dentro do escopo

- **Corpus** `srd-5e.rules.json` (ou tabela leve por sistema), gerado pelo `ingest` da [US-47](./US-47-ingestao-srd-como-dado.md) a partir do **SRD 5.2 (2024) via Open5e**: `ConditionDescription`, `Rule`/`RuleSet` (combate/ações) e `Spell` — **todos 2024**, mesma fonte e mesma edição. Chave normalizada + categoria.
  - A US-47 (rev. 2026-07-14) trocou a fonte para Open5e, que tem as 339 magias 2024 nativas. **O stopgap de puxar magias do SRD 5.1 (`2014/`) não existe mais** — o corpus é 5.2 puro, sem mistura de edição.
  - **O corpus é 100% Open5e (CC-BY-4.0).** A US-47 é CC-BY puro; a fonte OGL (`5e-bits/5e-database`) aparece só na [US-51](./US-51-kits-iniciais-do-srd.md), e **só** para `startingKits` — kit não é regra consultável. Nada de material OGL entra no `srd-5e.rules.json`; se algum dia entrar, o corpus herda a OGL junto.
  - Aqui, ao contrário do `config`, o alvo **é** o texto de record longo: `getRule` devolve regra, não resumo de prompt. Traduzir o corpus para PT é decisão à parte (ver Questões em aberto).
- **Tool `getRule`** em `packages/ai-engine/src/tools/get-rule.ts`, registrada em `tools/index.ts` (descomentar) e exposta no loop de tools do agente.
  - Input: `{ query: string, category?: 'condition' | 'spell' | 'combat' | 'class' }`.
  - Resolução: normaliza `query` → match por nome (exato + fuzzy) no corpus do **sistema ativo** → devolve 1–3 trechos **curtos** (não o capítulo inteiro).
  - Determinística, sem LLM, server-side.
- **Corpus por sistema:** `Free` não tem corpus → `getRule` devolve vazio graciosamente (o prompt do Free já narra sem regra).
- Lazy: o corpus **não** entra no `config` nem no prompt; só é lido quando `getRule` é chamada.

### Fora do escopo

- **Embeddings / busca semântica.** MVP é match por nome normalizado. Só sobe para retrieval vetorial se a [US-49](./US-49-eval-fidelidade-de-regra.md) provar que o match por nome falha no long-tail (YAGNI — mesma disciplina do ADR 003).
- **Resolução mecânica** (dano, cura, duração aplicada ao estado) — continua no `rollDice`/tools de estado. `getRule` só **informa o texto**, nunca altera ficha nem rola dado.
- **RAG de livro upado** (`ragIndexId` já é coluna do `System`) — sistema diferente, Fase 3.
- **Ingestão do dataset** — é a [US-47](./US-47-ingestao-srd-como-dado.md); aqui só consumimos o corpus que ela gera.
- **Magias como "conhecidas pelo personagem"** — é a [US-42](./US-42-magias-conhecidas.md); `getRule` é consulta de regra, não a lista de magias do personagem.

---

## Modelo de dados proposto

Corpus separado do `config`, por sistema:

```ts
interface RuleEntry {
  key: string        // normalizado: "condicao:enfeiticado", "magia:bola-de-fogo"
  category: 'condition' | 'spell' | 'combat' | 'class'
  label: string      // "Enfeitiçado"
  text: string       // trecho curto do SRD (efeito, não o capítulo inteiro)
}
// srd-5e.rules.json: RuleEntry[]  (gerado pelo ingest da US-47)
```

Assinatura da tool:

```ts
getRule({ query: "enfeitiçado", category?: "condition" })
  → RuleEntry[]  // 1–3 mais relevantes, ou [] se nada casar / sistema sem corpus
```

**Persistência:** artefato versionado (`srd-5e.rules.json`) carregado sob demanda pela tool, chaveado pelo sistema ativo. **Não** vai para o Prisma nem para o `System.config` (evita carregar em toda criação de personagem — ADR 003).

---

## Critérios de aceite

- [ ] A tool `getRule` existe, está registrada em `tools/index.ts` e é exposta ao agente no loop de tools.
- [ ] `getRule({ query, category? })` resolve por nome normalizado (exato + fuzzy) no corpus do **sistema ativo** e devolve 1–3 trechos curtos.
- [ ] O corpus é gerado pelo **`ingest` da [US-47](./US-47-ingestao-srd-como-dado.md)** (mesmo pipeline), não por um segundo caminho paralelo.
- [ ] `getRule` é **determinística e read-only:** não rola dado, não altera ficha, não chama LLM.
- [ ] Sistema sem corpus (`Free`) → `getRule` devolve `[]` sem erro; o mestre segue narrando.
- [ ] O corpus **não** é injetado no prompt nem no `config` — só lido quando a tool é chamada (verificável: prompt de criação de personagem não cresce com o corpus).
- [ ] **Eval / regressão:** num turno onde o jogador usa "Bola de Fogo", o agente chama `getRule("bola de fogo")` e narra alcance/área coerentes com o SRD, **sem** escrever número de dano na prosa (o dano continua saindo do `rollDice`). Cenário em `evals/` (ver [US-49](./US-49-eval-fidelidade-de-regra.md)).

---

## Notas de implementação

- **Espelhar `rollDice`:** `getRule` segue o mesmo formato de tool determinística server-side de [`roll-dice.ts`](../../../packages/ai-engine/src/tools/roll-dice.ts) — entrada validada, resultado estruturado, sem efeito colateral de estado.
- **Trecho curto, não capítulo:** o corpus guarda o efeito enxuto. Devolver o texto inteiro do SRD estoura contexto e é o anti-padrão que motivou separar isto do `config`.
- **Normalização de chave:** minúsculas, sem acento, prefixo de categoria (`condicao:`, `magia:`). Fuzzy simples (distância de edição) resolve "bola de fogo" vs "Bola de Fogo"; sem embeddings.
- **Não duplicar dado estruturado:** o que já está no `config` (perícia, feature) o mestre lê do prompt — `getRule` é para o **texto de referência** que não cabe no config.
- **Prompt:** a instrução `getRule` já existe em `dm-system.ts` (só a tool faltava). Ao registrar a tool, conferir que a instrução casa com a assinatura real (categorias, quando chamar).

---

## Questões em aberto

1. **Match por nome vs. embeddings:** começar por nome+fuzzy (barato, determinístico). Só migrar para busca vetorial se a [US-49](./US-49-eval-fidelidade-de-regra.md) mostrar consultas legítimas que não casam por nome (ex.: "quanto tempo dura estar caído" → "Caído/Prone"). Decisão adiada até haver evidência.
2. **Onde mora o corpus:** artefato `.json` no pacote `ai-engine` (carregado em memória) vs. tabela `SystemRule` no Prisma (consultável por query). Sugestão: **artefato em memória** no MVP (corpus é pequeno, lido inteiro na inicialização do agente); tabela só se o corpus crescer além do razoável ou precisar de query por sistema em runtime.
3. **Idioma do trecho — reaberta (2026-07-14).** A resposta antiga ("devolve PT pelo merge da US-47") **não se sustenta**: o overlay pt-BR da US-47 cobre só nomes e descrições curtas do `config` (18 perícias, features e magias de nível 1). O corpus do `getRule` é o **texto de record inteiro** — centenas de condições, ações e as 339 magias. Nenhuma fonte traz isso em PT, e o overlay não escala para esse volume à mão. Opções: (a) corpus em EN e o mestre traduz na narração (o LLM já narra em PT — o trecho é insumo, não saída); (b) traduzir o corpus por LLM uma vez, no `ingest`, e versionar o resultado; (c) só os nomes/chaves em PT, corpo em EN. Sugestão: **(a)** no MVP — o trecho alimenta o raciocínio do mestre, não vai literal para a tela; medir na [US-49](./US-49-eval-fidelidade-de-regra.md) se regra em EN degrada a narração em PT antes de pagar por (b).

---

## Referências no código

- `packages/ai-engine/src/tools/index.ts` — `getRuleTool` comentada como "Future tool" (linha a descomentar).
- `packages/ai-engine/src/tools/roll-dice.ts` — molde de tool determinística server-side.
- `packages/ai-engine/src/prompts/dm-system.ts` — instrução "Use `getRule` to look them up" já presente (seção Rules).
- `apps/api/prisma/schema.prisma` — `System.ragIndexId` (RAG de upload, caminho distinto deste corpus).
- `scripts/srd/ingest.ts` — gera `srd-5e.rules.json` além do `config` (ver [US-47](./US-47-ingestao-srd-como-dado.md)).
