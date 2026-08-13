# US-125 — Benefícios não-mecanizados da origem conhecidos pelo mestre

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`, `benefits[].{type,name,description}`) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (`Character.origin.key` — é a origem escolhida que decide o que injetar) · [US-41](./US-41-features-traits-de-classe.md) (precedente direto: `ClassFeature`/`featuresSection`, mesmo tratamento "awareness apenas" aplicado aqui) · [ADR 007](../../adr/007-camadas-do-prompt-por-volatilidade.md) (camada 2 — dado constante por personagem)
**Relacionado:** [US-39](./US-39-identidade-narrativa-background-ideais.md)/[US-40](./US-40-divindade-do-personagem.md) (`backgroundSection` — a origem ganha seção PRÓPRIA, não entra dentro dessa) · [US-123](./US-123-integracao-mecanica-background-pointbuy.md)/[US-131](./US-131-integracao-mecanica-background-proficiency.md) (mecanizam `ability_score`/`skill_proficiency` — esses dois tipos ficam de FORA desta story, ver §Fora do escopo) · [US-124](./US-124-exibir-beneficios-narrativos-origem.md) (exibe `adventures_and_advancement`/`connection_and_memento` na criação — esses dois também ficam de fora daqui) · [US-135](./US-135-feature-de-origem-na-criacao-e-ficha.md) (materializa `feature` em `Character.features`/`FeaturesPanel`, mesmo mecanismo de `US-41` — esse tipo também fica de fora daqui, ver §Fora do escopo; **sem depender de ordem**: esta story já nasce excluindo `feature`, independente de qual das duas for implementada primeiro)
**Criada em:** 2026-08-09

---

## História

> **Como** jogador,
> **quero** que o mestre conheça os benefícios da **origem** que escolhi na criação (US-122) — um idioma, um item, uma proficiência com ferramenta —,
> **para que** ele ofereça e narre ganchos coerentes com quem meu personagem é (um Acólito que fala Celestial, um Marinheiro com um instrumento de navegação), em vez de tratar a origem como um dado que só existe na ficha, invisível pra ele.

---

## Contexto e motivação

### O problema observado

A US-122 fechou a escolha de origem (`Character.origin.key`) e a US-121 trouxe os 21 backgrounds do `a5e-ag`, cada um com uma lista de `benefits[]` (`type`, `name`, `description`). Mas nenhum dos dois leva esse dado ao **mestre**: `buildDmSystemPrompt` ([dm-system.ts:333](../../../packages/ai-engine/src/prompts/dm-system.ts:333)) só recebe `background` (US-39, prosa livre de identidade), `features` (US-41, classe) e `spells` (US-42, classe) — a origem escolhida não aparece em lugar nenhum do prompt. Um jogador que escolhe o Acolyte (que fala um idioma extra e carrega um símbolo sagrado) cria um personagem cujo mestre não sabe de nenhum dos dois — a escolha feita na criação não pesa em nada na narração.

### Por que a solução atual não basta

`featuresSection`/`spellsSection` já resolvem exatamente este problema para classe — lista dirigida por dados, awareness apenas, "você CONHECE mas nunca resolve mecânica aqui". A origem tem a mesma natureza para a maioria dos seus benefícios (`feature`, `tool_proficiency`, `language`, `equipment` são "o que o personagem tem/sabe", não algo que a IA rola ou resolve). Sem esta story, esse padrão já existente simplesmente não é aplicado ao dado que a US-121/US-122 introduziram.

### Por que nem todo `benefits[]` entra aqui

Dos 8 tipos observados no dataset (US-121/US-123/US-131), nem todos servem a este prompt:

- **`ability_score`/`skill_proficiency`** — a US-123/US-131 os mecanizam: viram bônus em `baseAttributes` e entradas em `Character.skills`. Depois de mecanizados, eles já aparecem para o mestre pelo caminho que já existe (`sheetSection`, atributos/perícias com número) — injetar o texto cru de novo ("+1 to Wisdom...") seria duplicar informação que o mestre já vê como número.
- **`adventures_and_advancement`/`connection_and_memento`** — a US-124 decidiu que ficam **só na tela de criação**, texto longo (parágrafo) ou tabela Markdown d10 (até ~2100 caracteres, US-124 §medição), pensados para o JOGADOR ler e se inspirar ao escrever `background.bonds`/`story` à mão — não para o mestre carregar como contexto de toda narração. Repetir esse texto no system prompt (camada 2, cacheada mas sempre presente) infla o prompt com prosa que não muda por turno e cujo Markdown cru (`|d10|...|`) não foi pensado pra virar instrução de IA.
- **`feature`** — a [US-135](./US-135-feature-de-origem-na-criacao-e-ficha.md) materializa esse tipo em `Character.features` (mesma chave/resolução das features de classe, US-41/US-100) e ele chega ao mestre pela seção `## Class features` já existente (`featuresSection`), junto das features de classe — injetar de novo aqui duplicaria a mesma informação numa segunda seção, com um texto de instrução ligeiramente diferente. Fica de fora **desde a criação desta story**, não como ajuste posterior — não importa se a US-135 é implementada antes ou depois desta.

Sobram exatamente os 3 tipos que nenhuma outra story mecaniza, materializa em `Character` ou exibe em detalhe: `tool_proficiency`, `language`, `equipment` — texto curto, mesma forma de `ClassFeature` (`name` + `description`).

### A proposta

Resolver, a partir de `character.origin.key`, a entrada correspondente em `config.backgrounds` (mesmo `find` por chave que outras resoluções de catálogo já fazem) e passar os `benefits[]` cujos `type` **não** estão na lista mecanizada/exibida-em-detalhe para `buildDmSystemPrompt`, numa seção nova `## Origin benefits`, no mesmo molde de `featuresSection` — nome + descrição, awareness apenas, nunca listado verbatim na narração.

---

## Escopo

### Dentro do escopo

- **`OriginBenefit`** (novo tipo, `packages/ai-engine/src/prompts/dm-system.ts`, mesma forma estrutural de `ClassFeature`): `{ name: string; description: string }`.
- **`resolveOriginBenefits(backgrounds, originKey)`** (nova função pura, `packages/ai-engine` ou reaproveitada em `apps/api` — mesmo padrão de resolução por chave de `catalogLabel`): dado `config.backgrounds` (US-121) e `character.origin?.key` (US-122), encontra a entrada por `key` e devolve `benefits.filter(b => !EXCLUDED_TYPES.includes(b.type))`. `originKey` ausente, ou chave sem entrada no catálogo (config sem `backgrounds`, ou sistema legado) → array vazio.
- **`EXCLUDED_TYPES`** = `['ability_score', 'skill_proficiency', 'feature', 'adventures_and_advancement', 'connection_and_memento']` — constante nomeada com comentário do PORQUÊ de cada exclusão (mecanizado / materializado em `Character.features` / exibido em detalhe na criação), não um número mágico solto.
- **`buildDmSystemPrompt`** ganha parâmetro opcional `originBenefits?: OriginBenefit[]`; renderiza `## Origin benefits`, mesmo texto de instrução de `featuresSection` adaptado ("what the character HAS/KNOWS from their origin"), lista `- ${name}: ${description}`. Vazio/ausente → seção inteira some, mesmo padrão de `featuresSection`/`spellsSection`.
- **`apps/api/src/ai/ai.service.ts`**: resolve `originBenefits` a partir de `config?.backgrounds` + `character.origin?.key` (campo que a US-122 introduz), no mesmo bloco onde `features`/`knownSpells` já são resolvidos ([ai.service.ts:318-319](../../../apps/api/src/ai/ai.service.ts:318)), e passa para `buildDmSystemPrompt` junto de `features`/`spells`.
- **Camada do prompt:** `originBenefits` é constante por personagem (só muda se a origem for trocada, o que hoje nem é possível pós-criação, US-122 §Fora do escopo) — camada 2, mesmo lugar de `features`/`spells` (ADR 007), dentro do `system` cacheável.
- **Teste do builder** (`dm-system.test.ts`, mesmo `describe` block style de `featuresSection`): seção aparece com benefícios presentes, some com array vazio/ausente, nunca lista os tipos de `EXCLUDED_TYPES` mesmo se algum vier no array por engano (defesa na função de resolução, não só documentação).
- **Teste de resolução** (`ai.service.test.ts` ou teste unitário da função pura, conforme onde ela morar): origem com os 3 tipos restantes → todos aparecem; origem inexistente/chave vazia → array vazio, sem lançar.

### Fora do escopo

- **`ability_score`/`skill_proficiency` no prompt** — cobertos pelo `sheetSection` depois que a US-123/US-131 os mecanizarem; texto cru duplicaria o número já visível (ver §Por que nem todo `benefits[]` entra aqui).
- **`feature` no prompt** — coberto pela `## Class features` já existente, depois que a [US-135](./US-135-feature-de-origem-na-criacao-e-ficha.md) materializar em `Character.features`; texto cru aqui duplicaria a mesma feature numa segunda seção (ver §Por que nem todo `benefits[]` entra aqui). Excluído desde já, sem depender de qual das duas stories entra primeiro.
- **`adventures_and_advancement`/`connection_and_memento` no prompt** — ficam só na tela de criação (US-124); textos longos/Markdown não pensados para instrução de IA. Se algum dia fizer sentido narrativamente (ex. o mestre puxar o memento escolhido numa cena), é extensão separada — precisaria decidir COMO resumir/estruturar antes de injetar, não só colar o texto cru.
- **Registrar QUAL benefício foi oferecido/narrado** (idempotência de "já usei esse gancho") — mesmo tratamento que `classFeatures`/`spells` já têm hoje: sem rastro de uso, o mestre decide a cada turno se o momento pede.
- **Traduzir a seção para outro locale além do que `benefits[].description` já traz** — `config.backgrounds` já é resolvido por locale (`configForLocale`, US-121 `MT_DOMAINS`); esta story só consome o texto que já vem no locale ativo, não adiciona tradução nova.
- **Personagem sem `origin.key`** (sistema sem catálogo de backgrounds, ou — antes da correção de obrigatoriedade da US-122 — alguém que não escolheu) — seção não aparece, sem placeholder, mesmo padrão de `featuresSection` vazio.

---

## Modelo de dados proposto

Nenhuma mudança de schema/Prisma. Dado 100% derivado do que `config.backgrounds` (US-121) e `Character.origin.key` (US-122) já persistem.

```ts
// packages/ai-engine/src/prompts/dm-system.ts
export interface OriginBenefit {
  name: string
  description: string
}

const EXCLUDED_BENEFIT_TYPES = [
  'ability_score',        // US-123: vira baseAttributes, já visível em sheetSection
  'skill_proficiency',    // US-131: vira Character.skills, já visível em sheetSection
  'feature',               // US-135: vira Character.features, já visível em featuresSection
  'adventures_and_advancement', // US-124: só na tela de criação, prosa longa
  'connection_and_memento',     // US-124: só na tela de criação, tabela Markdown d10
]
```

---

## Critérios de aceite

- [ ] `resolveOriginBenefits` devolve só os `benefits[]` cujo `type` não está em `EXCLUDED_BENEFIT_TYPES`, para a origem correspondente a `origin.key`.
- [ ] `origin.key` ausente, vazio, ou sem entrada em `config.backgrounds` → array vazio, sem lançar exceção.
- [ ] `buildDmSystemPrompt` com `originBenefits` não vazio renderiza `## Origin benefits` com uma linha `- name: description` por benefício, mesmo texto de instrução "awareness apenas" (oferece/narra, nunca lista verbatim) que `featuresSection` já usa.
- [ ] `originBenefits` ausente ou vazio → seção `## Origin benefits` não aparece no prompt (nem cabeçalho vazio).
- [ ] `ai.service.ts` resolve `originBenefits` a partir de `character.origin?.key` + `config?.backgrounds`, no mesmo bloco de `features`/`knownSpells`, e repassa para `buildDmSystemPrompt`.
- [ ] Personagem sem origem escolhida (ou sistema sem `config.backgrounds`) → prompt idêntico ao de hoje, nenhuma seção nova, sem regressão em `dm-system.test.ts`/`ai.service.test.ts` existentes.
- [ ] **Eval / teste de regressão:** `dm-system.test.ts` cobre origem com os 3 tipos restantes (`tool_proficiency`/`language`/`equipment`; seção aparece, `EXCLUDED_BENEFIT_TYPES` — incluindo `feature` — nunca aparece mesmo se presente no array de entrada) e origem ausente (seção some). `ai.service.test.ts` cobre resolução por `origin.key` válido/inválido/ausente.

---

## Notas de implementação

- **Mesmo molde de `featuresSection`, não um sistema novo.** Copiar a forma (`.map` → filter Boolean → join `\n` → template com cabeçalho de instrução), só trocando o texto de contexto ("o que a origem deu ao personagem" em vez de "o que a classe ensinou"). Evita reinventar o padrão de "lista read-only dirigida por dados" que `featuresSection`/`spellsSection` já validaram.
- **`resolveOriginBenefits` pode morar em `packages/ai-engine`** (perto de `resolveKnownSpell`, mesmo pacote que já expõe função pura de resolução para a tool `getSpell`) — evita duplicar a lógica de filtro em `apps/api` e mantém `ai.service.ts` fino (só monta os parâmetros e chama).
- **Ordem das seções no prompt final:** entra ao lado de `featuresSection`/`spellsSection`, antes ou depois tanto faz (nenhuma dependência entre elas) — manter perto delas na função por afinidade de conteúdo (todas são "o que o personagem tem/sabe", camada 2).
- **`EXCLUDED_BENEFIT_TYPES` como array simples, não Set** — 5 itens, comparação com `.includes` é suficiente e mais legível que `Set.has` para uma lista tão pequena que só muda se a US-123/US-124/US-131/US-135 mudarem de escopo.

---

## Referências no código

- [packages/ai-engine/src/prompts/dm-system.ts:253-271](../../../packages/ai-engine/src/prompts/dm-system.ts:253) — `featureLines`/`featuresSection`, molde direto a copiar para `originBenefits`.
- [packages/ai-engine/src/prompts/dm-system.ts:92-100](../../../packages/ai-engine/src/prompts/dm-system.ts:92) — `resolveKnownSpell`, precedente de função pura de resolução por nome/chave no mesmo arquivo.
- [apps/api/src/ai/ai.service.ts:315-347](../../../apps/api/src/ai/ai.service.ts:315) — bloco onde `features`/`knownSpells` são resolvidos e passados a `buildDmSystemPrompt`; `originBenefits` entra ao lado.
- [packages/shared/src/types/system.ts:64-82](../../../packages/shared/src/types/system.ts:64) — `SystemBackgroundSchema`/`SystemBackgroundBenefitSchema` (US-121), fonte do dado.
- [docs/adr/007-camadas-do-prompt-por-volatilidade.md](../../adr/007-camadas-do-prompt-por-volatilidade.md) — critério de camada (constante por personagem → camada 2).
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-122](./US-122-escolha-background-catalogo-na-criacao.md) — dependências diretas (catálogo e chave escolhida).
- [US-123](./US-123-integracao-mecanica-background-pointbuy.md) / [US-124](./US-124-exibir-beneficios-narrativos-origem.md) / [US-131](./US-131-integracao-mecanica-background-proficiency.md) / [US-135](./US-135-feature-de-origem-na-criacao-e-ficha.md) — decidem o destino dos 5 tipos que ESTA story exclui.
