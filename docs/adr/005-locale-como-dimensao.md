# ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + conteúdo congelado

**Status:** Aceito
**Data:** 2026-07-15
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 003 — Sistemas como dado](./003-sistemas-como-dado.md) (locale é outro eixo do mesmo `config`) · [ADR 002 — Memória de sessão](./002-memoria-de-sessao.md) (a narração passada mora no `EventLog`) · [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md) (overlay de tradução) · [US-52](../sdlc/01-requisitos/US-52-traducao-automatica-do-srd.md) (tradução automática)

---

## 1. Contexto

O AI DM foi construído **assumindo PT-BR como idioma único**. A Fase 1 passa a exigir **PT-BR e EN como versões de primeira classe**, no modelo de um videogame: **o jogador escolhe o idioma antes de criar um personagem e pode trocá-lo depois; o texto já produzido noutro idioma fica como estava.**

Ao mapear onde o idioma vive hoje, o acoplamento a PT está em três lugares — e um quarto já é agnóstico:

- **Guardrail de idioma** ([guardrails.ts](../../packages/ai-engine/src/guardrails.ts), `detectLanguageDrift`) **reprova** qualquer narração que não seja PT-BR (`drift = enScore > ptScore`). O eval do bake-off trata "respondeu fora do PT-BR" como falha. **EN hoje não está ausente — está proibido.**
- **Dados do `config`** (labels de atributo, perícias, features, magias) são PT via o overlay da [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md).
- **UI web** — strings PT escritas à mão.
- **Narração (prompt)** — **já é agnóstica**: [dm-system.ts](../../packages/ai-engine/src/prompts/dm-system.ts) manda *"narrate in the same language the player uses"*. O prompt espelha o idioma do jogador sem mudança.

Três observações mudam o enquadramento:

1. **EN é a língua nativa dos dados.** O dataset SRD (Open5e) é inglês. O overlay pt-BR da US-47 e o pipeline da US-52 existem **só para produzir PT** — logo, suportar EN **não adiciona** trabalho ao pipeline de dados; ele **revela** que a metade "tradução" é específica de PT, e **EN é o caso grátis** (usa o dataset cru).
2. **O conteúdo do personagem já é congelado por construção.** [Character](../../apps/api/prisma/schema.prisma) guarda `features`, `spells`, `skills`, `background` como **`Json` materializado na criação** — texto copiado, não re-derivado do `config` a cada leitura. E a narração passada mora no `EventLog` ([ADR 002](./002-memoria-de-sessao.md)). Ou seja, "o texto já produzido fica como estava" **não precisa de mecanismo novo — já é o comportamento**.
3. **A maior parte de "suportar EN" é remover premissas de PT**, não adicionar capacidade de EN. O trabalho genuinamente novo se concentra na **i18n da UI** — o único lugar onde strings PT foram escritas à mão, sem passar por dado nem por LLM.

Falta modelar **locale como dimensão**. A decisão precede a implementação da US-47 (ainda 🚧), porque molda o schema, o overlay e a UI.

---

## 2. Decisão

### D1 — Locale é uma **preferência mutável do jogador** (`User.locale`), estilo videogame

O idioma ativo é uma preferência no **`User`** (`locale: 'pt-BR' | 'en'`, default do browser, `'pt-BR'` como fallback). Ela:

- é **escolhida antes de criar o primeiro personagem** — vive no menu/setup, não exige personagem para existir;
- é **mutável a qualquer momento** e **aplica dali para frente**: define a língua da **UI**, da **narração nova** e do idioma em que um **novo personagem é materializado**.

Trocar o idioma **não re-traduz nada** do que já existe (ver D2). É só a agulha que aponta a língua do conteúdo **futuro**.

### D2 — Conteúdo já produzido **congela na língua em que nasceu** (automático, sem campo novo)

O texto materializado fica como estava, para sempre — e isso **já acontece por construção**, não é feature a construir:

- **Ficha do personagem:** `features`/`spells`/`skills`/`background` são copiados para o `Character` (Json) na criação, no idioma ativo naquele momento. Não são re-derivados do `config` — então trocar a preferência do usuário **não os toca**.
- **Narração passada:** turnos já gerados vivem no `EventLog`; são histórico imutável.

Consequência aceita: **estado misto é possível e OK.** Um personagem criado em PT ("Fúria", "Impor as Mãos" na ficha) jogado depois com a preferência em EN terá **ficha PT + narração EN nova**. O modelo videogame permite isso de propósito — o que foi produzido antes não muda.

**Sem `locale` no `Character` para congelar** — o Json materializado já É o congelamento. Um `Character.locale` (stamp da língua de materialização) é **opcional**, adicionado só se algo passar a exibi-lo ou filtrar por ele (YAGNI até lá). O `Character` sabe implicitamente a sua língua: é a que está no seu próprio texto.

### D3 — EN é a base nativa; PT-BR é um overlay de localização

O `config` de dados por locale resolve assim:

- **`locale = en` → o dataset cru.** Nenhum overlay, nenhuma tradução, nenhuma US-52.
- **`locale = pt-BR` → dataset + overlay `locale/pt-BR.json`** (US-47), com fallback EN e `--strict`.

O overlay da US-47 deixa de ser "a tradução para o idioma único" e passa a ser **a localização de _um_ locale sobre uma base EN**. Estrutura `locale/{xx}.json` (um por idioma não-nativo; `en` não tem arquivo). O pipeline da US-52 roda **só para locales ≠ en**.

### D4 — Guardrail e eval parametrizados pelo idioma **do turno**

`detectLanguageDrift` deixa de cravar PT. Recebe o **idioma-alvo do turno** — a preferência ativa (`User.locale`), que o prompt já espelha do input do jogador — e acusa deriva **para longe dele**:

- alvo `pt-BR` → deriva quando EN supera PT (comportamento de hoje);
- alvo `en` → deriva quando PT supera EN (lógica espelhada).

A heurística (marcadores PT + diacríticos vs. marcadores EN) já conta os dois lados — falta escolher o "certo" pelo alvo. O bake-off e os guardrails de produção recebem o idioma corrente.

> Nota do estado misto: numa ficha PT jogada em EN, nomes próprios congelados ("Fúria") podem aparecer numa narração EN. Isso é esperado (D2), não deriva de idioma — o guardrail mede a **prosa** do turno, e um punhado de nomes próprios não vira o placar (o piso de 3 marcadores já protege contra isso).

### 2.1 Faseamento

| Fase | Entregável | Depende de |
|------|-----------|-----------|
| Fundação | **Este ADR** — locale como dimensão; preferência mutável; conteúdo congelado; EN nativo; guardrail parametrizado | — |
| Dados | [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md) nasce locale-aware (`locale/pt-BR.json`; `en` = base) · [US-52](../sdlc/01-requisitos/US-52-traducao-automatica-do-srd.md) traduz só locale ≠ en | ADR 005 |
| Schema | `User.locale` + migração (default `'pt-BR'`); seletor de idioma no menu/setup | ADR 005 |
| UI | i18n da UI web (extração de strings, framework, seletor) — **o grosso do trabalho novo** | Schema |
| Qualidade | `detectLanguageDrift` + bake-off parametrizados pelo idioma do turno | Dados |
| Conteúdo | Ganchos de aventura ([US-28](../sdlc/01-requisitos/US-28-aventura-inicial-baseada-na-classe.md)) em EN (autorais ou via US-52) | Dados |

As USs concretas serão abertas ao planejar o epic; este ADR fixa a **forma**.

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | Locale é preferência mutável no `User` | Modelo videogame: escolhe antes de criar personagem, troca quando quiser, aplica ao conteúdo futuro |
| 2 | Conteúdo já produzido não é re-traduzido | O texto materializado (ficha Json, `EventLog`) já é congelado por construção; retraduzir seria trabalho contra o dado |
| 3 | Sem campo de locale no `Character` (para congelar) | O Json materializado já É o congelamento; um stamp é opcional, YAGNI até algo consumi-lo |
| 4 | Estado misto (ficha PT + narração EN) é aceito | É a consequência natural de "texto antigo fica como estava"; o modelo videogame o permite de propósito |
| 5 | EN = dataset nativo (sem overlay) | O SRD é inglês; EN não precisa de tradução — é o caso grátis |
| 6 | PT-BR = overlay sobre a base EN | Inverte "tradução para PT" em "localização de um locale"; abre N idiomas sem reescrever o pipeline |
| 7 | Guardrail parametrizado pelo idioma do turno | O de hoje crava PT e reprovaria EN; a heurística já conta os dois lados |
| 8 | Narração inalterada (prompt já espelha) | [dm-system.ts](../../packages/ai-engine/src/prompts/dm-system.ts) já narra no idioma do jogador; zero trabalho |

---

## 4. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| Locale **imutável no `Character`** (trocar = novo personagem) | Nega a troca que o modelo videogame pede. O congelamento do conteúdo **não exige** amarrar a preferência ao personagem — o materialize já congela; basta a preferência ser mutável no `User` |
| **Re-traduzir** o conteúdo ao trocar de idioma | Re-materializar fichas e reescrever transcrições a cada troca — caro, e o jogador nem pediu (aceitou o congelamento) |
| Locale na **Adventure** | O idioma é do jogador, não da sessão; e a UI precisa de idioma antes de existir aventura. Preferência global no `User` é o encaixe natural |
| **PT-BR como base**, EN como overlay | Contra a natureza da fonte: o dataset é EN. Faria EN pagar tradução para virar a língua que já é |
| Locale **por `System`** | Duplicaria cada sistema por idioma (`dnd5e-pt`, `dnd5e-en`); locale é eixo ortogonal ao sistema, não um sistema novo |
| **Lib de i18n na narração** | O prompt já espelha o idioma do jogador; traduzir a saída do LLM seria peso morto |

---

## 5. Consequências

**Positivas**
- **Troca de idioma é barata** — muda uma preferência; o conteúdo passado fica por construção, sem migração nem re-tradução.
- **EN sai quase de graça no lado dos dados** — é a base nativa; o overlay + a US-52 são a localização PT.
- **Narração já pronta** — o prompt espelha o idioma do jogador sem mudança.
- **Congelamento sem código** — a ficha materializada (Json) e o `EventLog` já são imutáveis; "texto antigo fica como estava" é o comportamento atual, não uma feature nova.
- **Aberto a N idiomas** — `locale/{xx}.json` + o pipeline da US-52; a estrutura não presume só dois.

**Negativas / riscos**
- **Estado misto** — ficha PT + narração EN (ou vice-versa) após uma troca. Aceito pelo modelo, mas a UI deve exibir a ficha na língua em que ela está (o texto materializado), não forçar a preferência atual sobre um texto que não a tem.
- **Nomes próprios congelados na narração** — o DM narra em EN citando "Fúria" (PT) da ficha. Esperado; o guardrail não deve puni-lo (mede a prosa, com piso de marcadores).
- **i18n da UI é trabalho novo real** — extrair strings PT da UI web e montar o framework é o grosso do epic; não há atalho de dado nem de LLM.
- **Ganchos de aventura ([US-28](../sdlc/01-requisitos/US-28-aventura-inicial-baseada-na-classe.md)) são autorais em PT** — precisam de versão EN (escrita ou via US-52).
- **Migração** — `User.locale` com default `'pt-BR'` para as linhas existentes (nenhum usuário atual muda de comportamento).

---

## 6. Implementação (referência)

- `apps/api/prisma/schema.prisma` — `User.locale String @default("pt-BR")` + migração. **Nenhum campo novo no `Character`** (o Json materializado já congela; um stamp é opcional/futuro).
- `packages/ai-engine/src/guardrails.ts` — `detectLanguageDrift(narration, targetLocale)`; inverte o critério por alvo.
- `packages/ai-engine/src/prompts/dm-system.ts` — **sem mudança** (já espelha o idioma do jogador).
- `scripts/srd/locale/` — overlay por locale; `en` sem arquivo (base nativa). Ver [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md)/[US-52](../sdlc/01-requisitos/US-52-traducao-automatica-do-srd.md).
- `apps/web/` — i18n de strings da UI + seletor de idioma no menu/setup (lê/escreve `User.locale`).
- `apps/api/src/ai/ai.service.ts` — passa o idioma corrente (`User.locale`) ao guardrail/eval.
