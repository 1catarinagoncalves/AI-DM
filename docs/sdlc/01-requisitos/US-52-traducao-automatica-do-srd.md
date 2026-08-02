# US-52 — Tradução automática (EN→pt-BR) do conteúdo novo do SRD

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player (habilitador de manutenção; sem urgência de release)
**Status:** ✅ Implementada
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) (pipeline `sync`+`ingest`, overlay curado `pt-BR.json`, regra de merge + fallback EN) · [US-17](./US-17-comparacao-modelos-eval.md) (encanamento do Gemini como juiz — `model.ts`)
**Relacionado:** [US-48](./US-48-getrule-corpus-de-regras.md) (o corpus do `getRule` é o próximo cliente do mesmo mecanismo, em volume muito maior) · [ADR 005](../../adr/005-locale-como-dimensao.md) (locale como dimensão — **EN é a base nativa**; este pipeline só serve locales ≠ en)
**Criada em:** 2026-07-14

---

## História

> **Como** desenvolvedora,
> **quero** que o `ingest` traduza automaticamente para pt-BR o conteúdo do SRD que **ainda não tem tradução curada**, gerando um rascunho revisável,
> **para que** um bump do dataset que traga feature ou magia nova não exija tradução manual do zero nem deixe texto em inglês escapar para produção.

---

## Contexto e motivação

### Por que existe, e por que é separada da US-47

A [US-47](./US-47-ingestao-srd-como-dado.md) deriva o `config` do Open5e e aplica o **overlay pt-BR curado**, semeado do `seed.ts`. No **primeiro `ingest`, isso basta**: todo o conteúdo que o MVP consome já está traduzido (as ~73 entradas de hoje). A US-47 fecha sem tradução automática nenhuma.

A lacuna aparece **depois**: quando um bump do dataset (`v2.1.0 → v2.2.0`, ou a extensão para nível > 1) traz uma feature ou magia que o overlay curado não cobre. Hoje, pela regra de merge da US-47, ela cai no **fallback EN** — e o `--strict` barra o build até alguém traduzir à mão. Isso funciona, mas repõe exatamente o trabalho manual que a US-47 queria eliminar.

> **Locale-aware ([ADR 005](../../adr/005-locale-como-dimensao.md)).** Este pipeline traduz **só locales cujo overlay não é a base nativa** — ou seja, `pt-BR` e futuros idiomas. **`en` nunca passa por aqui**: é a língua do dataset, não precisa de tradução. Quanto mais idiomas o produto ganhar, mais este mecanismo rende; o EN é o único que sai de graça.

Esta story automatiza esse preenchimento. Ficou separada porque:

- **Payoff diferido:** só rende no segundo bump; a US-47 entrega valor sem ela.
- **Superfície de decisão própria:** qual gate de revisão, como *validar* que a tradução de máquina está correta — perguntas que não pertencem a "de onde vem o dado".
- **Dependência de LLM:** a US-47 fica CC-BY puro e sem LLM no pipeline; esta story é que introduz a chamada de modelo no build.

### O mecanismo

Chave sem PT no overlay curado → o `ingest` chama **`gemini-3.1-flash-lite` via API do Google**, traduz, e **escreve o rascunho de volta no `pt-BR.json` marcado `"_mt": true`**:

```jsonc
"mago_arcane-recovery": { "name": "Recuperação Arcana", "description": "…", "_mt": true }
```

> Chave canônica nossa (`mago_arcane-recovery`), não a do Open5e — o overlay da [US-47](./US-47-ingestao-srd-como-dado.md) é indexado assim; o rascunho `_mt` grava na mesma forma.

Encanamento **já existe**: [model.ts](../../../packages/ai-engine/src/model.ts) monta `createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY })`, e `gemini-3.1-flash-lite` já é o default do `judgeModel` (US-17). Zero dependência nova (`@ai-sdk/google` instalado), mesma `GEMINI_API_KEY`, free tier.

Três propriedades inegociáveis:

- **Não é runtime.** Traduz no build, uma vez; nunca no caminho de criação de personagem. Sem custo por request, sem indeterminismo no jogo.
- **É idempotente.** Uma vez escrito no arquivo, não re-traduz na próxima rodada (senão o artefato mudaria a cada run e quebraria o critério byte-a-byte da US-47). O modelo só roda para chave **ainda sem PT nenhum**.
- **É revisável.** O rascunho `_mt` entra no **diff do PR** do bump. Humano lê, corrige, tira a marca → vira overlay curado (camada 1 da US-47).

---

## Validação da tradução (o coração desta story)

"Traduzir por LLM" é fácil; **garantir que a tradução está certa** é o trabalho real. Três níveis, do mecânico ao humano — e uma fronteira honesta sobre o que *não* dá para automatizar.

### O que NÃO valida tradução

⚠️ **`SystemConfigSchema.parse()` valida forma, não correção.** Ele só checa que `description` é string não-vazia. `"Impor as Mãos"` e `"Batata frita"` passam os dois. **`--strict` também não valida correção** — ele só garante que nada ficou *sem* PT; uma tradução confiantemente errada passa o `--strict` e vai a produção se ninguém pegar. Não confundir "tem PT" com "o PT está certo".

### Nível 1 — Glossário (mecânico, determinístico)

D&D-pt tem termos consagrados: Rage=Fúria, Sneak Attack=Ataque Furtivo, Lay on Hands=Impor as Mãos. Já estão no overlay curado. O `ingest`:

- **Passa o overlay atual como glossário** no prompt de tradução — o modelo é instruído a usar o termo canônico onde ele existe.
- **Checa mecanicamente** a saída: se o original EN contém um termo com tradução canônica conhecida e o rascunho PT não a usa, **sinaliza** (não bloqueia — flag no relatório). Pega o erro previsível ("Rage"→"Raiva" em vez de "Fúria") sem LLM, barato, no build.

Cobre só termo que já está no glossário. Não valida frase livre — para isso, nível 2.

### Nível 2 — Revisão humana do diff (o gate real)

O `_mt: true` faz o rascunho aparecer no PR. Humano lê, corrige, tira a marca. **É aqui que a validação de verdade acontece.** Viável porque o **volume é minúsculo**: só conteúdo *novo* de um bump precisa de revisão — tipicamente um punhado de entradas, frases de uma linha. Revisar rascunho é minutos; traduzir do zero, não.

### Nível 3 — LLM-juiz / back-translation (fora do escopo, registrado)

Dá para o `ingest` traduzir PT→EN de volta e comparar, ou pedir a um segundo modelo uma nota de fidelidade (a infra do juiz do bake-off serve). **Exagero para este volume** — a revisão humana do nível 2 é mais confiável e mais barata para um punhado de strings. Só passa a valer se o cliente for o **corpus do `getRule`** ([US-48](./US-48-getrule-corpus-de-regras.md)): centenas de regras, 339 magias, texto longo — aí revisão humana não escala e o juiz automático ganha sentido. Decisão da US-48, não desta.

### A fronteira honesta

**Não existe validação automática barata que substitua o julgamento humano na correção de tradução, neste volume.** A automação *estreita* o que o humano olha (glossário pega o erro mecânico), mas o gate final é humano. O desenho torna a tradução errada **visível e barata de corrigir** — ele não a *impede*.

---

## Escopo

### Dentro do escopo

- Estender `scripts/srd/ingest.mjs`: chave sem PT curado → tradução via `gemini-3.1-flash-lite`, rascunho `_mt: true` gravado no `pt-BR.json`.
- **Glossário no prompt** (overlay atual como vocabulário fixo) + **checagem mecânica de termo canônico** (nível 1), com flag no relatório.
- **Idempotência preservada:** só traduz chave sem PT; artefato segue byte-a-byte estável entre rodadas.
- **Flag `--no-mt`** para rodar o ingest sem chamar o modelo (ex.: build offline, CI sem a key).
- **Sem `GEMINI_API_KEY`:** a tradução é pulada com aviso, a chave cai no fallback EN da US-47, `--strict` decide se isso falha o build. O ingest **não quebra** por falta da key.

### Fora do escopo

- **LLM-juiz / back-translation** (nível 3) — registrado acima; vira relevante só no volume da [US-48](./US-48-getrule-corpus-de-regras.md).
- **Traduzir o corpus do `getRule`** — outro cliente, outro volume, outra story ([US-48](./US-48-getrule-corpus-de-regras.md)).
- **Idiomas além de pt-BR** — YAGNI; um overlay por idioma quando houver um segundo.
- **Retraduzir conteúdo já curado** — a camada 1 é intocável; o modelo só preenche lacuna.

---

## Critérios de aceite

- [x] Uma chave nova sem PT curado é traduzida por `gemini-3.1-flash-lite` no `ingest` e gravada em `pt-BR.json` com `"_mt": true`; aparece no diff do PR.
- [x] **Idempotente:** rodar o `ingest` de novo **não re-traduz** a chave já escrita; o artefato segue byte-a-byte idêntico (não regride o critério da US-47).
- [x] **Glossário aplicado:** o prompt recebe o overlay atual; a saída que ignora um termo canônico conhecido é **sinalizada** no relatório (checagem mecânica, sem LLM).
- [x] **Revisão destrava a marca:** ao editar/aprovar, remover `_mt` promove a entrada a curada; o `ingest` deixa de tratá-la como rascunho.
- [x] **`--no-mt` e ausência de `GEMINI_API_KEY`** não quebram o `ingest` — a tradução é pulada, cai no fallback EN da US-47, com aviso.
- [x] **A fronteira está documentada:** o critério deixa claro que `--strict`/schema **não** validam correção — o gate de correção é glossário + humano.
- [x] **Decisão de gate registrada:** rascunho `_mt` pode shipar (dívida rastreável) **ou** bloqueia merge — decidir e registrar (ver Questões em aberto).

---

## Questões em aberto (resolvidas)

1. **Rascunho `_mt` pode shipar, ou bloqueia merge?** Deixar chegar a produção (tradução de máquina > EN cru) e revisar quando der, ou barrar merge até um humano tirar toda marca `_mt`? Sugestão: **pode shipar** — é PT decente, e a marca `_mt` no arquivo é dívida rastreável (dá para listar com um grep); o `--strict` já garante que não sobra chave só-EN. Bloquear merge por revisão de tradução trava bump por motivo cosmético.
   > **Decidido: pode shipar.** O rascunho conta como traduzido para o `--strict` — é o comportamento natural do `resolve()`, não um caso especial. A dívida não fica só no grep: **toda rodada do `ingest` imprime o total de entradas `_mt` pendentes** no relatório, para não virar tradução de máquina esquecida em produção.
2. **Modelo fixo ou trocável?** `gemini-3.1-flash-lite` é o default (grátis, já no projeto). Vale expor um env `TRANSLATE_MODEL` (espelhando o `JUDGE_MODEL` do `model.ts`) para testar um Gemini Pro se o flash-lite decepcionar? Como roda no build, um modelo mais forte custa latência, não dinheiro. Sugestão: **começar fixo**, extrair o env só quando/se a qualidade pedir.
   > **Decidido: fixo.** `translateModel()` em `model.ts` devolve `gemini-3.1-flash-lite` direto. Env var sem cliente é config para um valor que nunca muda; extrair `TRANSLATE_MODEL` é uma linha lá quando a qualidade pedir.

---

## Decisões de implementação

- **A chamada de LLM vive no `ai-engine`, não em `scripts/`.** `ai` e `@ai-sdk/google` não resolvem a partir da raiz do repo (o `node_modules` da raiz não os tem) — mesma restrição que empurrou a geração de narração para `narration-gen.ts` na [US-36](./US-36-eval-de-qualidade-da-narracao.md). O `ingest.mjs` importa `translateSrdToPtBr` do `dist/` do pacote, como já importava o `SystemConfigSchema` do `dist/` do `shared`. Consequência: `srd:ingest` agora builda `@ai-dm/ai-engine...` (que arrasta o `shared`) e roda sob `dotenv -e .env` — a `GEMINI_API_KEY` mora no `.env` da raiz.
- **Só `features` e `spells` são traduzidos.** `attributes` e `skills` guardam **string crua** no overlay (`"strength": "Força"`), sem lugar para a marca `_mt` — e são os 6 atributos e as 18 perícias fixos do 5e, não conteúdo que um bump traga. Se um dia trouxer, cai no fallback EN e o `--strict` grita, como hoje.
- **O overlay é regravado no formato em que é editado à mão** (`formatOverlay`, uma entrada por linha, ordem de inserção preservada), **não** com o `stableStringify` dos artefatos. Aquele ordena chave e quebra objeto em várias linhas: usá-lo aqui reescreveria as ~90 linhas do arquivo a cada rodada e afogaria o rascunho num diff gigante. **O gate desta story é a revisão do diff — diff pequeno é o produto.** Round-trip verificado byte-a-byte em [ingest.test.mjs](../../../scripts/srd/ingest.test.mjs).
- **O glossário nasce no `resolve()`.** É o único ponto do pipeline onde o nome EN do dataset e o nome PT do overlay se encontram — o overlay sozinho só guarda o PT, indexado por chave canônica. Rascunho `_mt` **não** entra no glossário: ele é o que se quer validar, não a régua.
- **Falha de tradução não quebra o build.** Sem `GEMINI_API_KEY`, com `--no-mt`, ou com a chamada falhando (quota, rede), o `ingest` avisa e segue: a chave fica no fallback EN da US-47 e é o `--strict` que decide se aquilo barra o build. Tradução é conveniência, não pré-requisito.
- **A saída do modelo é filtrada antes de virar arquivo** (`pickRequested`): chave que não estava no lote, chave repetida e campo vazio são descartados. O retorno aqui é gravado no repo, não numa resposta descartável — chave inventada seria lixo versionado.

---

## Referências no código

- [scripts/srd/ingest.mjs](../../../scripts/srd/ingest.mjs) — pipeline da US-47, estendido aqui com `draftMissing`, `flagMissingGlossaryTerms`, `formatOverlay` e a flag `--no-mt`.
- [scripts/srd/ingest.test.mjs](../../../scripts/srd/ingest.test.mjs) — round-trip do overlay e checagem de glossário (`pnpm srd:ingest:test`).
- [scripts/srd/locale/pt-BR.json](../../../scripts/srd/locale/pt-BR.json) — overlay curado (US-47) + rascunhos `_mt` (esta story).
- [packages/ai-engine/src/translate-srd.ts](../../../packages/ai-engine/src/translate-srd.ts) — prompt com glossário, lotes de 10 e o filtro `pickRequested`.
- [packages/ai-engine/src/model.ts](../../../packages/ai-engine/src/model.ts) — `translateModel()`, sobre o mesmo `createGoogleGenerativeAI` do `judgeModel` (US-17).
