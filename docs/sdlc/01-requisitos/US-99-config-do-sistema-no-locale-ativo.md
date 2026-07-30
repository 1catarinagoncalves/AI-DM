# US-99 — O `config` do sistema é servido no locale ativo (EN cru ou overlay pt-BR)

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-97](./US-97-seletor-de-idioma-pt-br-en.md) (é de `User.locale` que sai o idioma a servir) · [US-47](./US-47-ingestao-srd-como-dado.md) ✅ (o pipeline `sync`+`ingest` e o overlay `locale/pt-BR.json` já existem — falta o **consumidor** por locale)
**Relacionada a:** [US-98](./US-98-i18n-da-interface-web.md) (a outra metade do texto do wizard; as duas juntas é que fazem o onboarding EN fechar) · [ADR 005](../../adr/005-locale-como-dimensao.md) (D3: **EN é a base nativa, pt-BR é overlay**) · [ADR 003](../../adr/003-sistemas-como-dado.md) / [ADR 004](../../adr/004-origem-do-dado-de-sistema.md) (o `config` como dado e a origem dele) · [US-52](./US-52-traducao-automatica-do-srd.md) (produz overlay para locales ≠ `en-US`)
**Criada em:** 2026-07-30

---

## História

> **Como** jogador com o idioma em inglês,
> **quero** que atributos, perícias, classes e magias apareçam em inglês no wizard e na ficha,
> **para que** eu escolha "Athletics" e "Strength" — e não tenha de adivinhar o que é "Atletismo" e "Força" no meio de uma interface inglesa.

---

## Contexto e motivação

### O problema observado

O idioma dos **dados de sistema** está congelado em português no banco, um passo antes de qualquer decisão de runtime:

1. O `ingest` deriva 4 campos (`attributes`, `skills`, `classFeatures`, `classSpells`) **já com o overlay pt-BR aplicado** e grava **um único artefato** ([`ingest.mjs:4`](../../../scripts/srd/ingest.mjs) e `:169-170`).
2. O `seed` lê esse artefato e o grava em `System.config` ([`seed.ts:393`](../../../apps/api/prisma/seed.ts) e `:423`).
3. `GET /systems` devolve a linha inteira, `config` incluído ([`system.service.ts`](../../../apps/api/src/system/system.service.ts) — um `findMany`, sem projeção nem parâmetro).

Resultado: o wizard mostra "Força" e "Atletismo" a **qualquer** jogador, e a ficha herda o mesmo texto na criação do personagem. Não existe caminho pelo qual o idioma escolhido influencie isso.

**A ironia é a mesma da [US-97](./US-97-seletor-de-idioma-pt-br-en.md): o inglês é a base e foi jogado fora.** O dataset Open5e é inglês; o overlay `locale/pt-BR.json` é o que traduz. Servir EN não exige traduzir nada — exige **não aplicar** o overlay. O trabalho é deixar de achatar os dois numa saída só.

### Por que a solução atual não basta

O overlay é aplicado em **build time** (durante o `ingest`), e não em leitura. Quando a requisição chega, o pt-BR já é o único dado que existe: não há base EN guardada em lugar nenhum para voltar atrás. Qualquer solução passa por mudar **onde** o merge acontece ou **quantos** artefatos o pipeline emite.

E há uma segunda lacuna, do lado do transporte: **`GET /systems` é público** — é o único controller do app sem `@UseGuards(AuthGuard)` (compare com [`adventure.controller.ts:15`](../../../apps/api/src/adventure/adventure.controller.ts) e [`ai.controller.ts:22`](../../../apps/api/src/ai/ai.controller.ts)). Sem token, o servidor não tem de quem derivar o `User.locale`.

### A proposta

Guardar a **base EN** e a localização pt-BR como coisas separadas, e resolver qual servir pelo `User.locale` no momento da leitura.

---

## Escopo

### Dentro do escopo

- **Pipeline emite por locale:** o `ingest` passa a gravar o artefato **base EN** (sem overlay) e o artefato **pt-BR** (com overlay), em vez de só o segundo.
- **Persistência por locale:** `System.config` passa a guardar a base EN; a localização pt-BR vive ao lado (ver *Modelo de dados proposto*) — sem duplicar a linha do `System` (o [ADR 005](../../adr/005-locale-como-dimensao.md) rejeita locale por `System`).
- **Resolução na leitura:** `GET /systems` devolve o `config` no locale do usuário, com **fallback para a base EN** quando a chave não existir na localização.
- **Autenticação do endpoint:** `GET /systems` passa a exigir o token, como os demais — é de lá que sai o locale, e o cliente não manda locale ([US-61](./US-61-login-do-jogador.md)).
- Testes: o mesmo `System` lido nos dois locales devolve `'Strength'` e `'Força'`; chave ausente no overlay cai no EN sem quebrar.

### Fora do escopo

- **Ficha do personagem** — `features`/`spells` são copiados como texto na criação e continuam congelados até a [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) (fase "Ficha" do [ADR 005](../../adr/005-locale-como-dimensao.md)). **Esta story conserta o wizard e o catálogo, não a ficha já materializada** — mas note que, depois dela, um personagem **criado** em inglês já nasce com feature e magia em inglês; o que a US-100 resolve é a troca de idioma depois da criação.
- **Strings da interface** — [US-98](./US-98-i18n-da-interface-web.md).
- **Tradução de conteúdo novo** ([US-52](./US-52-traducao-automatica-do-srd.md)) e os fallbacks EN pendentes do overlay: aqui eles deixam de ser dívida invisível e passam a ser o comportamento correto do locale `en-US`.
- **Ganchos de aventura, kits iniciais, point-buy e proficiência** — campos de produto que vivem no `seed`, não no artefato do SRD. Os ganchos têm story própria ([US-101](./US-101-ganchos-de-aventura-em-ingles.md)), que **usa o transporte montado aqui**: `initialAdventures` faz parte do `SystemConfig` e viaja no `configLocales` sem campo novo. Os demais ficam em PT.

---

## Modelo de dados proposto

```prisma
model System {
  // ...campos atuais; `config` passa a ser a BASE EN
  configLocales Json @default("{}") // US-99: { "pt-BR": SystemConfig } — localizações sobre a base
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `System.config` | `Json` | Base nativa **EN**, direto do dataset, sem overlay. |
| `System.configLocales` | `Json` (default `{}`) | Mapa `locale → SystemConfig` localizado. `en-US` nunca tem entrada (é a base). |

**Leitura:** `configLocales[user.locale] ?? config`.

**Persistência:** duas colunas na tabela `System`, populadas pelo `seed` a partir dos dois artefatos. Trade-off assumido: **o JSON localizado é duplicado por idioma** (a base e o pt-BR carregam as mesmas descrições de feature/magia). Com 2 idiomas é barato e dispensa código de merge em runtime; a alternativa — guardar só a base + o overlay e mesclar na leitura — economiza espaço ao preço de um merge novo em TypeScript (a lógica de merge existe hoje só no `ingest`, em `.mjs`). Ver *Questões em aberto* #1.

---

## Critérios de aceite

- [ ] O `ingest` emite dois artefatos: a base EN (sem overlay) e o pt-BR (com overlay). Rodar duas vezes seguidas produz bytes idênticos (idempotência, como hoje).
- [ ] `System.config` guarda a base EN; a localização pt-BR vive em `configLocales`.
- [ ] Com `locale = 'en-US'`, `GET /systems` devolve `'Strength'`, `'Athletics'` e os nomes de feature/magia do dataset cru.
- [ ] Com `locale = 'pt-BR'`, devolve exatamente o que devolve hoje — `'Força'`, `'Atletismo'` — sem regressão para os usuários atuais.
- [ ] Chave presente na base e ausente na localização cai no texto EN, sem erro e sem campo vazio.
- [ ] `GET /systems` exige token; o cliente não envia locale em parâmetro nenhum.
- [ ] Personagem criado com `locale = 'en-US'` materializa feature/magia com o texto EN (dentro do formato de hoje — a mudança para chave é a fase "Ficha", fora daqui).
- [ ] **Eval / teste de regressão:** ler o mesmo `System` nos dois locales e afirmar o par `'Strength'` / `'Força'` no mesmo campo — falha se o overlay voltar a ser achatado num artefato só ou se a resolução ignorar o locale.

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- A função `resolve()` do [`ingest.mjs`](../../../scripts/srd/ingest.mjs) já recebe o valor do overlay e cai no valor do dataset quando ele falta: **gerar a base EN é chamá-la com o overlay vazio**, não escrever um segundo caminho de código.
- Os relatórios de `fallbacks` e `orphans` do ingest mudam de significado no locale `en-US` (todo mundo "cai no fallback", por definição). Não emitir aviso de tradução faltante para a base.
- O `seed` lê o artefato por `fs` de propósito — não trocar por `import` de JSON: o comentário em [`seed.ts`](../../../apps/api/prisma/seed.ts) explica que o `import` arrastaria o arquivo para o programa do `tsc` e quebraria o `nest start`. O segundo artefato entra pelo mesmo caminho.
- `SystemService.findAll()` é um `findMany` puro hoje; a resolução por locale é o primeiro pedaço de lógica dele — cabe em poucas linhas, com o locale vindo do `@CurrentUser()`.
- Ordem com as irmãs: [US-97](./US-97-seletor-de-idioma-pt-br-en.md) primeiro (é dela que vem o locale); esta e a [US-98](./US-98-i18n-da-interface-web.md) são independentes entre si e podem correr em paralelo.

---

## Questões em aberto

1. **Dois artefatos completos ou base + overlay com merge na leitura?** O modelo acima escolhe artefatos completos (sem merge em runtime, JSON duplicado por idioma). Se o `config` crescer — `classSpells` é o campo pesado —, o merge na leitura passa a compensar.
2. **`GET /systems` autenticado quebra alguma tela pública?** Hoje o middleware do front já manda quem não tem sessão para `/login`, então o wizard nunca chama sem token — mas convém confirmar que nenhuma landing ou health check depende do endpoint aberto.
3. **Personagem criado antes desta story** continua com `features`/`spells` em PT. Vale um aviso ao jogador que trocou para EN, ou espera-se a fase "Ficha" em silêncio?

---

## Referências no código

- [`scripts/srd/ingest.mjs:4`](../../../scripts/srd/ingest.mjs) — comenta os 4 campos derivados; `:169-170` grava o artefato único que esta story desdobra.
- [`scripts/srd/locale/pt-BR.json`](../../../scripts/srd/locale/pt-BR.json) — o overlay que deixa de ser aplicado à base.
- [`apps/api/prisma/seed.ts:393`](../../../apps/api/prisma/seed.ts) — lê o artefato por `fs`; `:423` grava em `System.config`.
- [`apps/api/src/system/system.service.ts`](../../../apps/api/src/system/system.service.ts) — `findMany` sem locale; é aqui que a resolução entra.
- [`apps/api/src/system/system.controller.ts`](../../../apps/api/src/system/system.controller.ts) — o único controller sem `@UseGuards(AuthGuard)`.
- [`apps/api/src/character/character.service.ts`](../../../apps/api/src/character/character.service.ts) — copia feature/magia do `config` na criação: é por aqui que o locale chega à ficha nova.
