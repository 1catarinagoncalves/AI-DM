# US-125 — Adventures & Advancement, conexão e memento da origem no prompt do Mestre

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`, benefício `type === 'adventures_and_advancement'`) · [US-124](./US-124-exibir-beneficios-narrativos-origem.md) (`Character.origin.connection`/`.memento` — a linha que o jogador ESCOLHEU nas tabelas d10 de `connection_and_memento`, não o catálogo cru) · [US-41](./US-41-features-traits-de-classe.md) (precedente: `featuresSection`, mesmo tratamento "awareness apenas") · [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) (camada 2)
**Relacionado:** [US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md) (já materializa um item genérico "Memento" no inventário, mas só o NOME — o texto de verdade, o que aquele memento É, não chega ao mestre por lá; esta story fecha essa lacuna)
**Criada em:** 2026-08-09
**Atualizada em:** 2026-08-14 — reescrita: escopo restrito a `adventures_and_advancement` + conexão + memento; `language`/`equipment` saem (ver §Fora do escopo), e a fonte de conexão/memento deixa de ser o catálogo cru (as 20 opções da tabela d10) e passa a ser o texto que o jogador escolheu.

---

## História

> **Como** jogador,
> **quero** que o mestre conheça o gancho de aventura típico da minha origem, e a conexão/memento que ESCOLHI na criação (US-124) —,
> **para que** ele narre coisas coerentes com quem meu personagem é (o Acólito promovido a inquisidor depois de resolver um problema, o símbolo sagrado deixado pelo mentor no leito de morte), em vez de tratar a origem como um dado que só existe na ficha.

---

## Escopo desta story

**Só isto:** três pedaços de texto por personagem chegam ao prompt do mestre, numa seção nova `## Origin narrative`, awareness apenas (nunca listado verbatim na narração):

1. **`adventures_and_advancement`** — prosa fixa da origem (catálogo, `config.backgrounds`), sem escolha do jogador. Ex.: Acolyte ganha "pode ser promovido dentro da hierarquia da sua ordem depois de resolver problemas...".
2. **Conexão** — a linha que o jogador ESCOLHEU (`Character.origin.connection`, US-124), não a tabela d10 inteira.
3. **Memento** — a linha que o jogador ESCOLHEU (`Character.origin.memento`, US-124), não a tabela d10 inteira. (O nome genérico "Memento" já existe como item de inventário desde a US-128 — esta story leva o TEXTO daquele item ao mestre, os dois não se confundem.)

Nada além disso. `language`/`equipment`/demais tipos de `benefits[]` não fazem parte desta US (ver §Fora do escopo).

---

## Por que não injetar `benefits[].description` cru para conexão/memento

`config.backgrounds[key].benefits[].description` do tipo `connection_and_memento` é **a tabela d10 inteira** — 10 opções de conexão + 10 de memento, texto que o jogador viu na criação só pra ESCOLHER uma linha de cada (US-124, `<select>`). Injetar esse texto cru no prompt despejaria as 20 opções não escolhidas no mestre, que não teria como saber qual delas é a real — pior que não injetar nada, porque parece dado autoritativo e não é.

O texto certo já existe, resolvido, em `Character.origin.connection`/`Character.origin.memento` — grava a linha exata que o jogador escolheu (`normalizeOrigin`, [character.service.ts:92](../../../apps/api/src/character/character.service.ts:92)). Esta story lê esses dois campos direto do personagem, sem tocar no catálogo — resolução mais simples que a de `adventures_and_advancement` (que não tem escolha, então o catálogo já É o texto certo).

---

## Dentro do escopo

- **`OriginNarrative`** (novo tipo, `packages/ai-engine/src/prompts/dm-system.ts`): `{ adventuresAndAdvancement?: string; connection?: string; memento?: string }`. Os três opcionais — qualquer combinação pode faltar (origem sem esse benefício no catálogo, ou personagem sem conexão/memento escolhido).
- **`resolveAdventuresAndAdvancement(backgrounds, originKey)`** (função pura, `packages/ai-engine`, ao lado de `resolveKnownSpell`): encontra a origem por `key` em `config.backgrounds`, devolve o `description` do benefício `type === 'adventures_and_advancement'`. Sem entrada → `undefined`, nunca lança.
- **Conexão e memento não passam por função de resolução nenhuma** — já chegam resolvidos em `character.origin?.connection`/`character.origin?.memento` (US-124/US-128), `ai.service.ts` só repassa os dois campos direto.
- **`buildDmSystemPrompt`** ganha parâmetro opcional `originNarrative?: OriginNarrative`; renderiza `## Origin narrative`, uma linha por campo presente (`- Adventures & Advancement: ...`, `- Connection: ...`, `- Memento: ...`), texto de instrução "awareness apenas" igual ao de `featuresSection`. Todos os três ausentes → seção some, mesmo padrão de `featuresSection`/`spellsSection`.
- **`apps/api/src/ai/ai.service.ts`**: monta `originNarrative` a partir de `resolveAdventuresAndAdvancement(config?.backgrounds, character.origin?.key)` + `character.origin?.connection` + `character.origin?.memento`, no bloco onde `characterTools`/`features`/`knownSpells` já são resolvidos ([ai.service.ts:335-347](../../../apps/api/src/ai/ai.service.ts:335)), repassa a `buildDmSystemPrompt`.
- **Camada do prompt:** constante por personagem (só muda se origem/escolhas mudarem, hoje impossível pós-criação) — camada 2, mesmo lugar de `features`/`spells` (ADR 007), dentro do `system` cacheável.
- **Teste do builder** (`dm-system.test.ts`): seção aparece com 1, 2 ou 3 campos presentes; some com os três ausentes; cada campo renderiza na própria linha, sem misturar texto de um campo no outro.
- **Teste de resolução** (`ai.service.test.ts` ou unitário de `resolveAdventuresAndAdvancement`): origem com benefício presente → texto correto; origem sem o tipo, ou `origin.key` ausente → `undefined`, sem lançar. `connection`/`memento` ausentes no personagem → campo correspondente `undefined` no `OriginNarrative` final.

## Fora do escopo

- **`language`/`equipment`/`ability_score`/`skill_proficiency`/`tool_proficiency`/`feature`** — nenhum desses tipos faz parte desta story. `equipment` já chega ao mestre como item de inventário (US-128); os demais têm seus próprios caminhos (`sheetSection`/`featuresSection`) por outras stories.
- **As 20 opções não escolhidas da tabela d10** — nunca vão ao prompt, nem resumidas. Só a linha escolhida.
- **Registrar QUAL gancho foi narrado** (idempotência) — mesmo tratamento que `features`/`spells` hoje: sem rastro de uso, o mestre decide a cada turno.
- **Editar conexão/memento depois da criação** — não têm tela de edição (US-124 §Fora do escopo); esta story só lê o que já existe.

---

## Modelo de dados proposto

Nenhuma mudança de schema. `Character.origin.connection`/`.memento` já existem (`normalizeOrigin`, US-124). Só um tipo novo do lado do prompt:

```ts
// packages/ai-engine/src/prompts/dm-system.ts
export interface OriginNarrative {
  adventuresAndAdvancement?: string
  connection?: string
  memento?: string
}

export function resolveAdventuresAndAdvancement(
  backgrounds: SystemBackground[] | undefined,
  originKey: string | undefined,
): string | undefined {
  const entry = backgrounds?.find((b) => b.key === originKey)
  return entry?.benefits.find((b) => b.type === 'adventures_and_advancement')?.description
}
```

---

## Critérios de aceite

- [x] `resolveAdventuresAndAdvancement` devolve o `description` do benefício `adventures_and_advancement` da origem de `origin.key`; origem ausente/sem esse tipo → `undefined`, sem lançar.
- [x] `buildDmSystemPrompt` com `originNarrative` renderiza `## Origin narrative` só com os campos presentes, uma linha cada, texto "awareness apenas" (oferece/narra, nunca lista verbatim).
- [x] `originNarrative` ausente ou com os três campos `undefined` → seção não aparece (nem cabeçalho vazio).
- [x] `ai.service.ts` monta `originNarrative` a partir de `config?.backgrounds` + `character.origin` (`key`/`connection`/`memento`) e repassa a `buildDmSystemPrompt`.
- [x] O texto de `connection`/`memento` no prompt é a linha ESCOLHIDA (`character.origin.connection`/`.memento`), nunca a tabela d10 do catálogo.
- [x] Personagem sem origem, ou sem conexão/memento escolhido → prompt idêntico ao de hoje nos campos ausentes, sem regressão em `dm-system.test.ts`/`ai.service.test.ts`.

---

## Notas de implementação

- **Mesmo molde de `featuresSection`, adaptado.** Copiar a forma (filter Boolean → join `\n` → template com cabeçalho de instrução); a diferença é que aqui os "itens" são 3 campos fixos nomeados, não uma lista de tamanho variável.
- **`resolveAdventuresAndAdvancement` mora em `packages/ai-engine`**, perto de `resolveKnownSpell` — único ponto desta story que precisa olhar o catálogo; `connection`/`memento` são leitura direta de campo, sem função própria.
- **Ordem no prompt final:** ao lado de `featuresSection`/`spellsSection`, sem dependência entre elas.

---

## Referências no código

- [packages/ai-engine/src/prompts/dm-system.ts:198](../../../packages/ai-engine/src/prompts/dm-system.ts:198) — `buildDmSystemPrompt`.
- [packages/ai-engine/src/prompts/dm-system.ts:275](../../../packages/ai-engine/src/prompts/dm-system.ts:275) — `featureLines`/`featuresSection`, molde direto.
- [packages/ai-engine/src/prompts/dm-system.ts:99](../../../packages/ai-engine/src/prompts/dm-system.ts:99) — `resolveKnownSpell`, precedente de função pura de resolução por chave no mesmo arquivo.
- [apps/api/src/ai/ai.service.ts:335-347](../../../apps/api/src/ai/ai.service.ts:335) — bloco onde `characterTools`/`features`/`knownSpells` são resolvidos e passados a `buildDmSystemPrompt`; `originNarrative` entra ao lado.
- [apps/api/src/character/character.service.ts:92](../../../apps/api/src/character/character.service.ts:92) — `normalizeOrigin`, fonte de `origin.connection`/`origin.memento`.
- [packages/shared/src/types/system.ts:107-122](../../../packages/shared/src/types/system.ts:107) — `SystemBackgroundSchema`/`SystemBackgroundBenefitSchema` (US-121), fonte de `adventures_and_advancement`.
- [docs/adr/007-camadas-do-prompt-por-volatilidade.md](../../adr/007-camadas-do-prompt-por-volatilidade.md) — critério de camada.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-124](./US-124-exibir-beneficios-narrativos-origem.md) — dependências diretas (catálogo e escolha do jogador).
- [US-128](./US-128-memento-e-equipamento-da-origem-como-itens-do-inventario.md) — item genérico "Memento" no inventário (nome só); esta story leva o texto.
