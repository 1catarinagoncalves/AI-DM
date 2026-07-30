# US-100 — A ficha do personagem acompanha o idioma ativo (features e magias por chave)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-97](./US-97-seletor-de-idioma-pt-br-en.md) (é de `User.locale` que sai o idioma) · [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (**obrigatória e anterior**: a ficha resolve a label a partir do `config` do locale — sem `config` por locale não há de onde resolver) · [US-54](./US-54-chaves-canonicas-em-ingles.md) ✅ (as chaves de classe já são EN — o ADR 005 exigia essa ordem)
**Relacionada a:** [US-41](./US-41-features-traits-de-classe.md) e [US-42](./US-42-magias-conhecidas.md) (foram elas que materializaram feature/magia como texto) · [US-27](./US-27-pericias-do-personagem.md) (as perícias **já** fazem certo — é o modelo a copiar) · [ADR 005](../../adr/005-locale-como-dimensao.md) (D2 e fase "Ficha") · [ADR 002](../../adr/002-memoria-de-sessao.md) (o `EventLog` congela por decisão, não entra aqui)
**Criada em:** 2026-07-30

---

## História

> **Como** jogador que trocou o idioma para inglês,
> **quero** que a ficha do meu personagem mostre "Rage" e "Lay on Hands",
> **para que** eu leia a ficha na mesma língua da narração — em vez de "Fúria" e "Impor as Mãos" no meio de um jogo em inglês.

---

## Contexto e motivação

### O problema observado

Metade da ficha já acompanha o idioma e a outra metade não — e a diferença é o **formato de armazenamento**, não uma decisão de produto.

**As perícias fazem certo.** `Character.skills` guarda **chaves** (US-27) e a label é resolvida na leitura, a partir do `config`: `buildSkillSheet(config.skills, ...)` em [`play/[adventureId]/page.tsx:38-40`](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx). Assim que a [US-99](./US-99-config-do-sistema-no-locale-ativo.md) servir o `config` em inglês, **as perícias saem em inglês sozinhas** — sem tocar em nenhuma ficha.

**As features e magias fazem errado.** São copiadas como **texto** na criação: `getClassFeatures(config, dto.class)` e `getClassSpells(config, dto.class)` devolvem os objetos do `config` e o serviço grava o resultado inteiro em `Character.features`/`Character.spells` ([`character.service.ts:26-43`](../../../apps/api/src/character/character.service.ts)). O que ficou gravado foi o texto do idioma vigente na hora da criação, e nada o re-deriva depois.

**A chave existe e é jogada fora.** O `ingest` conhece a chave de cada feature (`${classe}_${slug}`, ex.: `paladin_lay-on-hands`) e de cada magia (o slug do dataset), usa-a para casar o overlay e para ordenar — e então **remove** o campo antes de gravar o artefato: `.map(({ _slug, ...e }) => e)` ([`ingest.mjs:130-135`](../../../scripts/srd/ingest.mjs) e `:150-155`). O schema compartilhado confirma o buraco: `SystemClassFeatureSchema` é `{name, description}` e `SystemSpellSchema` é `{name, level?, description?}` — **nenhum dos dois tem chave** ([`system.ts:27`](../../../packages/shared/src/types/system.ts) e `:36`). A única chave que sobrevive no `config` é a da **classe**, não a da feature.

### Por que a solução atual não basta

Sem chave, não há como perguntar "como se chama esta feature em inglês?": o que a ficha guarda é a resposta em português, não a pergunta. Nem [US-97](./US-97-seletor-de-idioma-pt-br-en.md) nem [US-99](./US-99-config-do-sistema-no-locale-ativo.md) consertam isso — a primeira troca o idioma da narração, a segunda o do catálogo; nenhuma das duas alcança o texto já copiado para dentro da ficha.

Depois da US-99, o problema **encolhe mas não some**, e é bom ser preciso sobre o que sobra:

| Situação | Depois da US-99 | Depois desta story |
|---|---|---|
| Personagem **criado** com `locale = 'en-US'` | ✅ nasce com feature/magia em inglês (a criação copia do `config` EN) | igual |
| Personagem criado em PT, jogador **troca** para EN | ❌ ficha continua "Fúria" para sempre | ✅ passa a "Rage" |
| Personagem criado em EN, jogador **troca** para PT | ❌ ficha continua "Rage" | ✅ passa a "Fúria" |

Ou seja: **esta story é sobre a troca**, que é justamente o que o ADR 005 (D1) promete — preferência mutável a qualquer momento. Sem ela, "trocar de idioma" tem uma exceção silenciosa e permanente no meio da tela do jogo.

### A proposta

Guardar na ficha a **chave** da feature e da magia, como `skills` já faz, e resolver nome/descrição a partir do `config` do locale ativo no momento da leitura.

---

## Escopo

### Dentro do escopo

- **Chave no schema do `config`:** `SystemClassFeature` e `SystemSpell` ganham `key` — o campo que o `ingest` já calcula e descarta.
- **Ingest para de descartar a chave** (o `_slug` deixa de ser temporário e vira campo do artefato, nos dois domínios).
- **`Character.features` e `Character.spells` passam a guardar `string[]`** (chaves), mesma forma de `skills`.
- **Resolução na leitura**, espelhando `buildSkillSheet`: um resolvedor em `packages/shared` que recebe as chaves + o `config` do locale ativo e devolve `{name, description, level?}`, usado pelos **dois** consumidores — a ficha da web e o prompt do Mestre ([`ai.service.ts:316-319`](../../../apps/api/src/ai/ai.service.ts)).
- **Migração de dados:** as fichas existentes têm texto PT; casá-lo de volta contra o `config` pt-BR para virar chave. Item que não casar precisa de decisão explícita (ver *Questões em aberto* #1) — nunca descarte silencioso.
- **`getSpell` continua funcionando:** a tool procura a magia pelo **nome** que aparece na lista do prompt ([`ai.service.ts:591-598`](../../../apps/api/src/ai/ai.service.ts)). Com a resolução por locale, a lista e a busca precisam usar a mesma língua — a busca passa a resolver pela chave e comparar contra o nome do locale corrente.
- Testes: ficha lida nos dois locales devolve o par `'Rage'`/`'Fúria'` para a mesma chave; regressão da migração com uma ficha PT legada; `getSpell` acerta nos dois idiomas.

### Fora do escopo

- **`race` e `class`.** Achado desta análise: o [ADR 005](../../adr/005-locale-como-dimensao.md) afirmava que "já são a entrada do jogador casada contra chaves canônicas" — **errado, corrigido no próprio ADR em 30/07/2026** (D2). O `CLASS_SYNONYMS` casa o texto em tempo de leitura, mas o código **grava o texto cru do jogador** (`race: dto.race`, `class: dto.class` em [`character.service.ts:37-38`](../../../apps/api/src/character/character.service.ts)) e a tela exibe esse texto ([`play/[adventureId]/page.tsx:47-48`](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx)). Um personagem criado como "paladino" continua "paladino" numa ficha inglesa. Consertar exige gravar a chave canônica além do texto — story própria (ver *Questões em aberto* #2).
- **`name` e `background`** — texto autoral do jogador; congelam por decisão do ADR 005 (D2), não por pendência.
- **`EventLog`** — histórico imutável ([ADR 002](../../adr/002-memoria-de-sessao.md)). Re-traduzir transcrição seria reescrever o passado da mesa.
- **Inventário** (`CharacterState.inventory`) — itens ganhos em jogo são texto do Mestre, sem chave no `config`. Kits iniciais têm origem no `config` e poderiam seguir o mesmo caminho; fica fora até alguém pedir.
- **Tradução de conteúdo faltante** — [US-52](./US-52-traducao-automatica-do-srd.md). Chave sem tradução no overlay cai no texto EN, comportamento herdado da [US-47](./US-47-ingestao-srd-como-dado.md).

---

## Modelo de dados proposto

```jsonc
// Character.features / Character.spells — antes
[{ "name": "Fúria", "description": "Você entra em fúria…" }]
// depois
["barbarian_rage"]
```

| Campo | Antes | Depois |
|---|---|---|
| `Character.features` | `{name, description}[]` | `string[]` — chaves de feature |
| `Character.spells` | `{name, level?, description?}[]` | `string[]` — chaves de magia |
| `SystemClassFeature` | `{name, description}` | `{key, name, description}` |
| `SystemSpell` | `{name, level?, description?}` | `{key, name, level?, description?}` |

**Persistência:** as colunas seguem `Json` — muda o **conteúdo**, não o tipo, então não há migração de schema; há **migração de dados** (o passo caro desta story). Nenhum campo novo no `Character`: a ficha continua sem locale próprio, porque fala o do `User` (ADR 005, decisão 5).

---

## Critérios de aceite

- [ ] `SystemClassFeature` e `SystemSpell` têm `key`, e o artefato do `ingest` a preserva nos dois domínios.
- [ ] Personagem novo grava **chaves** em `features`/`spells`; nenhum `{name, description}` é escrito na criação.
- [ ] A mesma ficha, lida com `locale = 'pt-BR'` e com `locale = 'en-US'`, mostra `'Fúria'` e `'Rage'` — sem tocar no banco entre as duas leituras.
- [ ] Trocar o idioma com o jogo aberto atualiza os nomes de feature/magia na ficha; `name`, `background` e o histórico de narração **não** mudam.
- [ ] Fichas existentes migram: o texto PT vira chave, e nenhuma ficha perde feature ou magia em silêncio.
- [ ] O prompt do Mestre recebe os nomes no locale ativo, e `getSpell` encontra a magia pelo nome que a lista mostra — nos dois idiomas.
- [ ] Chave sem tradução no overlay do locale exibe o texto EN em vez de campo vazio.
- [ ] **Eval / teste de regressão:** ficha com uma feature e uma magia lida nos dois locales, afirmando os dois pares de nomes; e uma ficha PT legada passada pela migração, afirmando que virou chave e resolve de volta para o mesmo texto PT. Falha se o texto voltar a ser materializado ou se a migração perder itens.

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- **Copie o caminho das perícias, não invente outro.** `buildSkillSheet` (chaves + `config` → linhas prontas para a tela) é o padrão que esta story estende para feature/magia; o resolvedor vive em `packages/shared` porque tem **dois** consumidores (web e prompt), e duas cópias divergem.
- **A migração casa por nome contra o `config` pt-BR**, que é exatamente o texto que foi copiado na criação — a taxa de acerto deve ser alta. Normalize antes de comparar (o `normalize()` do [`starting-inventory.ts`](../../../apps/api/src/character/starting-inventory.ts) já existe para isso).
- **Rode a migração como script conferível antes de escrever**: contar quantos itens casam e quantos não, por classe, antes de aplicar. É a decisão da *Questão em aberto* #1 que depende desse número.
- `getClassFeatures`/`getClassSpells` mantêm a assinatura e o match tolerante por `CLASS_SYNONYMS`; muda só o que devolvem (chaves em vez dos objetos).
- Lembre do `dist`: mexeu em `packages/shared` ou `packages/ai-engine`, rebuild antes de testar pela API.

---

## Questões em aberto

1. **Item que não casa na migração** — descartar, ou manter o texto num campo de escape (a ficha ficaria com uma entrada que nunca acompanha o idioma)? O ADR 005 levanta a pergunta e não a responde. A contagem prévia (quantos itens não casam, em quantas fichas) deve decidir: se for um punhado, escape manual; se for sistemático, é sinal de que o `config` mudou desde a criação e o caso merece tratamento próprio.
2. **`race`/`class` guardam texto cru** (o ADR 005 dizia o contrário; corrigido em 30/07/2026). Corrigir aqui (ampliando o escopo) ou abrir story separada? Recomendação: story separada, porque envolve o que fazer com raça digitada livremente ("meio-elfo do norte") que não casa com chave nenhuma — problema diferente do de feature/magia, que sempre vêm do `config`.
3. **Kits iniciais no inventário** seguem o mesmo defeito das features (texto copiado do `config`), mas misturados com itens ganhos em jogo, que não têm chave. Vale separar as duas origens no inventário, ou é complexidade a mais para pouco ganho?

---

## Referências no código

- [`apps/api/src/character/character.service.ts:26-43`](../../../apps/api/src/character/character.service.ts) — materializa feature/magia como texto na criação; `:37-38` grava `race`/`class` crus.
- [`apps/api/src/character/starting-inventory.ts:71`](../../../apps/api/src/character/starting-inventory.ts) e `:88` — `getClassFeatures` / `getClassSpells`, que passam a devolver chaves.
- [`packages/shared/src/types/system.ts:27`](../../../packages/shared/src/types/system.ts) e `:36` — os dois schemas sem chave.
- [`scripts/srd/ingest.mjs:130`](../../../scripts/srd/ingest.mjs) e `:150` — onde a chave (`_slug`) é calculada e depois removida do artefato.
- [`apps/web/src/app/play/[adventureId]/page.tsx:38`](../../../apps/web/src/app/play/%5BadventureId%5D/page.tsx) — `buildSkillSheet`: o padrão de resolução na leitura que esta story copia.
- [`apps/api/src/ai/ai.service.ts:316-319`](../../../apps/api/src/ai/ai.service.ts) — segundo consumidor da ficha (o prompt); `:591-598` — a tool `getSpell`, que busca por nome.
