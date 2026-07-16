# ADR 005 — Locale como dimensão (PT-BR / EN): preferência mutável + ficha por idioma

**Status:** Aceito
**Data:** 2026-07-15
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 003 — Sistemas como dado](./003-sistemas-como-dado.md) (locale é outro eixo do mesmo `config`) · [ADR 002 — Memória de sessão](./002-memoria-de-sessao.md) (a narração passada mora no `EventLog`) · [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md) (overlay de tradução) · [US-52](../sdlc/01-requisitos/US-52-traducao-automatica-do-srd.md) (tradução automática)

---

## 1. Contexto

O AI DM foi construído **assumindo PT-BR como idioma único**. A Fase 1 passa a exigir **PT-BR e EN como versões de primeira classe**, no modelo de um videogame: **o jogador escolhe o idioma antes de criar um personagem e pode trocá-lo depois; a UI e a ficha do personagem passam a falar o novo idioma, e a narração já gerada fica como estava.**

Ao mapear onde o idioma vive hoje, o acoplamento a PT está em três lugares — e um quarto já é agnóstico:

- **Guardrail de idioma** ([guardrails.ts](../../packages/ai-engine/src/guardrails.ts), `detectLanguageDrift`) **reprova** qualquer narração que não seja PT-BR (`drift = enScore > ptScore`). O eval do bake-off trata "respondeu fora do PT-BR" como falha. **EN hoje não está ausente — está proibido.**
- **Dados do `config`** (labels de atributo, perícias, features, magias) são PT via o overlay da [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md).
- **UI web** — strings PT escritas à mão.
- **Narração (prompt)** — **já é agnóstica**: [dm-system.ts](../../packages/ai-engine/src/prompts/dm-system.ts) manda *"narrate in the same language the player uses"*. O prompt espelha o idioma do jogador sem mudança.

Três observações mudam o enquadramento:

1. **EN é a língua nativa dos dados.** O dataset SRD (Open5e) é inglês. O overlay pt-BR da US-47 e o pipeline da US-52 existem **só para produzir PT** — logo, suportar EN **não adiciona** trabalho ao pipeline de dados; ele **revela** que a metade "tradução" é específica de PT, e **EN é o caso grátis** (usa o dataset cru).
2. **A ficha hoje congela por acidente de formato, não por decisão.** [Character](../../apps/api/prisma/schema.prisma) guarda `skills` como **chaves** (US-27: `string[]` de perícias proficientes) mas `features` e `spells` como **texto materializado** (`{name, description}[]`, copiado do `config` na criação em [character.service.ts](../../apps/api/src/character/character.service.ts)). Chave é re-derivável por locale; texto copiado não é. Metade da ficha já está no formato certo — a outra metade não.
3. **Nem tudo na ficha tem fonte no `config`.** `name` e `background` (`story`/`ideals`/`bonds`/`flaws`/`deity`) são autorais do jogador ou do LLM: não existe chave para re-derivá-los. E a narração passada mora no `EventLog` ([ADR 002](./002-memoria-de-sessao.md)), histórico imutável. Esses ficam na língua em que nasceram **por falta de fonte**, não por escolha.
4. **A maior parte de "suportar EN" é remover premissas de PT**, não adicionar capacidade de EN. O trabalho genuinamente novo se concentra na **i18n da UI** — o único lugar onde strings PT foram escritas à mão, sem passar por dado nem por LLM — e em **passar `features`/`spells` de texto para chave**.

Falta modelar **locale como dimensão**. A decisão precede a implementação da US-47 (ainda 🚧), porque molda o schema, o overlay e a UI.

---

## 2. Decisão

### D1 — Locale é uma **preferência mutável do jogador** (`User.locale`), estilo videogame

O idioma ativo é uma preferência no **`User`** (`locale: 'pt-BR' | 'en'`, default do browser, `'pt-BR'` como fallback). Ela:

- é **escolhida antes de criar o primeiro personagem** — vive no menu/setup, não exige personagem para existir;
- é **mutável a qualquer momento** e **aplica a tudo que tem fonte de dado**: a língua da **UI**, da **narração nova** e da **ficha do personagem** (ver D2), inclusive de personagens já criados.

### D2 — A ficha do personagem **segue o idioma ativo**; congela só o que não tem fonte

Trocar a preferência **re-rotula a ficha**, inclusive a de personagens antigos. Um personagem criado em PT, aberto com a preferência em EN, mostra "Rage" e "Lay on Hands" — não "Fúria" e "Impor as Mãos". A ficha é uma **vista do `config` no locale ativo**, não um texto guardado.

Isso exige mudar o formato de armazenamento:

- **`skills`** — já guarda **chaves** (US-27). Nada muda: a label sai do `config` na leitura.
- **`features` e `spells`** — hoje guardam `{name, description}` copiados do `config` na criação. Passam a guardar **chaves** (`string[]`, mesma forma de `skills`); `name`/`description` são resolvidos do `config` do locale ativo na leitura. **Esta é a mudança de schema real do ADR.**
- **`race`, `class`** — já são a entrada do jogador casada contra chaves canônicas (`CLASS_SYNONYMS` em [starting-inventory.ts](../../apps/api/src/character/starting-inventory.ts)); a label exibida sai do `config`.

Congela só o que **não tem chave para re-derivar**:

- **`name` e `background`** (`story`/`ideals`/`bonds`/`flaws`/`deity`) — texto autoral do jogador ou do LLM, sem correspondente no `config`. Não há o que resolver: fica como foi escrito.
- **Narração passada** (`EventLog`) — histórico imutável ([ADR 002](./002-memoria-de-sessao.md)). Re-traduzir transcrição seria reescrever o passado da mesa.

**Sem `locale` no `Character`.** Antes seria um stamp da língua de materialização; agora não haveria o que stampar — a ficha não tem língua própria, ela fala a do `User`.

Consequência aceita: **estado misto encolhe, mas não some.** Ficha e narração nova concordam; o que discorda é a narração antiga (PT no `EventLog`, sob preferência EN) e o texto autoral (um `background` escrito em PT continua PT numa ficha EN). É o limite honesto: o que veio de dado acompanha o idioma, o que veio de autor não.

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

> Nota do estado misto: a ficha acompanha o alvo (D2), então nomes de features/magias já não conflitam. O que ainda pode aparecer em PT numa narração EN é o texto autoral (o `background`, o nome próprio do personagem) que o DM cita. Isso é esperado, não é deriva de idioma — o guardrail mede a **prosa** do turno, e um punhado de nomes próprios não vira o placar (o piso de 3 marcadores já protege contra isso).

### 2.1 Faseamento

| Fase | Entregável | Depende de |
|------|-----------|-----------|
| Fundação | **Este ADR** — locale como dimensão; preferência mutável; ficha por idioma; EN nativo; guardrail parametrizado | — |
| Dados | [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md) nasce locale-aware (`locale/pt-BR.json`; `en` = base) · [US-52](../sdlc/01-requisitos/US-52-traducao-automatica-do-srd.md) traduz só locale ≠ en | ADR 005 |
| Schema | `User.locale` + migração (default `'pt-BR'`); seletor de idioma no menu/setup | ADR 005 |
| Ficha | `features`/`spells` de texto para chave + migração de dados (texto PT existente → chave, casando contra o `config`); resolução da label na leitura | Schema, Dados, [US-54](../sdlc/01-requisitos/US-54-chaves-canonicas-em-ingles.md) (ordem importa) |
| UI | i18n da UI web (extração de strings, framework, seletor) — **o grosso do trabalho novo** | Schema |
| Qualidade | `detectLanguageDrift` + bake-off parametrizados pelo idioma do turno | Dados |
| Conteúdo | Ganchos de aventura ([US-28](../sdlc/01-requisitos/US-28-aventura-inicial-baseada-na-classe.md)) em EN (autorais ou via US-52) | Dados |

As USs concretas serão abertas ao planejar o epic; este ADR fixa a **forma**.

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | Locale é preferência mutável no `User` | Modelo videogame: escolhe antes de criar personagem, troca quando quiser, aplica a tudo que tem fonte de dado |
| 2 | Ficha segue o idioma ativo | A ficha é uma vista do `config`, não um texto guardado; ler "Fúria" com o jogo em EN é bug, não histórico |
| 3 | `features`/`spells` passam de texto para chave | Chave é re-derivável por locale, texto copiado não; `skills` já faz assim (US-27) — é alinhar a ficha ao formato que ela já usa |
| 4 | `name`/`background` e `EventLog` congelam | Texto autoral e transcrição não têm chave no `config`: não há o que re-derivar, e reescrever o passado da mesa seria outra decisão |
| 5 | Sem campo de locale no `Character` | A ficha não tem língua própria — fala a do `User`; não há o que stampar |
| 6 | EN = dataset nativo (sem overlay) | O SRD é inglês; EN não precisa de tradução — é o caso grátis |
| 7 | PT-BR = overlay sobre a base EN | Inverte "tradução para PT" em "localização de um locale"; abre N idiomas sem reescrever o pipeline |
| 8 | Guardrail parametrizado pelo idioma do turno | O de hoje crava PT e reprovaria EN; a heurística já conta os dois lados |
| 9 | Narração inalterada (prompt já espelha) | [dm-system.ts](../../packages/ai-engine/src/prompts/dm-system.ts) já narra no idioma do jogador; zero trabalho |

---

## 4. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| Locale **imutável no `Character`** (trocar = novo personagem) | Nega a troca que o modelo videogame pede: obrigaria a recriar o personagem só para ler a ficha noutra língua |
| **Congelar a ficha** na língua de criação (manter `features`/`spells` como texto materializado) | É o comportamento de hoje, e é o que este ADR corrige. Deixaria "Fúria" na ficha com o jogo inteiro em EN — lido como bug, não como histórico. E o custo de evitá-lo é baixo: guardar chave em vez de texto, como `skills` já faz |
| **Re-traduzir** com LLM o conteúdo a cada troca | Desnecessário para o que vem do `config` (a chave já resolve, de graça) e caro/errado para o resto: reescreveria transcrições e o `background` do jogador com o texto do modelo |
| Locale na **Adventure** | O idioma é do jogador, não da sessão; e a UI precisa de idioma antes de existir aventura. Preferência global no `User` é o encaixe natural |
| **PT-BR como base**, EN como overlay | Contra a natureza da fonte: o dataset é EN. Faria EN pagar tradução para virar a língua que já é |
| Locale **por `System`** | Duplicaria cada sistema por idioma (`dnd5e-pt`, `dnd5e-en`); locale é eixo ortogonal ao sistema, não um sistema novo |
| **Lib de i18n na narração** | O prompt já espelha o idioma do jogador; traduzir a saída do LLM seria peso morto |

---

## 5. Consequências

**Positivas**
- **Troca de idioma é coerente** — UI, ficha e narração nova falam a mesma língua; o jogador não vê PT vazando num jogo em EN.
- **Troca continua barata** — muda uma preferência; a ficha re-resolve na leitura, sem re-materializar linha nenhuma nem chamar LLM.
- **EN sai quase de graça no lado dos dados** — é a base nativa; o overlay + a US-52 são a localização PT.
- **Narração já pronta** — o prompt espelha o idioma do jogador sem mudança.
- **Aberto a N idiomas** — `locale/{xx}.json` + o pipeline da US-52; a estrutura não presume só dois. A ficha vem junto de graça: chave + overlay novo.
- **Ficha uniforme** — `skills`, `features` e `spells` passam a ter a mesma forma (chave); some a assimetria de hoje.

**Negativas / riscos**
- **Mudança de schema + migração de dados** — `features`/`spells` deixam de guardar `{name, description}`. As linhas existentes têm texto PT que precisa casar de volta contra o `config` para virar chave; um item que não case exige decisão (descartar vs. manter texto num campo de escape). É o custo real desta decisão, e o ADR o assume.
- **Ficha depende do `config` na leitura** — se o overlay do locale não tiver a chave, a label cai no fallback EN (US-47). A ficha nunca fica vazia, mas pode ficar bilíngue enquanto a tradução não cobre tudo.
- **Texto autoral não acompanha** — `background` e nome do personagem escritos em PT continuam PT numa ficha EN. Assumido: traduzi-los seria reescrever o que o jogador escreveu.
- **i18n da UI é trabalho novo real** — extrair strings PT da UI web e montar o framework é o grosso do epic; não há atalho de dado nem de LLM.
- **Ganchos de aventura ([US-28](../sdlc/01-requisitos/US-28-aventura-inicial-baseada-na-classe.md)) são autorais em PT** — precisam de versão EN (escrita ou via US-52).
- ~~**Chaves canônicas de classe são PT**~~ — **saldada pela [US-54](../sdlc/01-requisitos/US-54-chaves-canonicas-em-ingles.md)** (2026-07-16), antes da fase "Ficha" como a ordem exigia: o rename para `paladin`/`wizard` pegou só `config`/overlay/seed, sem tocar dado de usuário. A fase "Ficha" já nasce escrevendo chave EN.
- **Migração do `User`** — `User.locale` com default `'pt-BR'` para as linhas existentes (nenhum usuário atual muda de comportamento).

---

## 6. Implementação (referência)

- `apps/api/prisma/schema.prisma` — `User.locale String @default("pt-BR")` + migração. **Nenhum campo novo no `Character`**; `features`/`spells` mudam de conteúdo (chaves, não `{name, description}`) — o tipo Json continua servindo.
- `apps/api/src/character/character.service.ts` — materializa **chaves** de feature/magia (`getClassFeatures`/`getClassSpells` passam a devolver a chave); a label sai do `config` na leitura, pelo `User.locale`.
- Migração de dados — `features`/`spells` PT existentes casados de volta contra o `config` para virar chave.
- `packages/ai-engine/src/guardrails.ts` — `detectLanguageDrift(narration, targetLocale)`; inverte o critério por alvo.
- `packages/ai-engine/src/prompts/dm-system.ts` — **sem mudança** (já espelha o idioma do jogador).
- `scripts/srd/locale/` — overlay por locale; `en` sem arquivo (base nativa). Ver [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md)/[US-52](../sdlc/01-requisitos/US-52-traducao-automatica-do-srd.md).
- `apps/web/` — i18n de strings da UI + seletor de idioma no menu/setup (lê/escreve `User.locale`).
- `apps/api/src/ai/ai.service.ts` — passa o idioma corrente (`User.locale`) ao guardrail/eval.
