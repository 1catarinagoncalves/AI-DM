# US-102 — Tela nova nasce traduzida

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-98](./US-98-i18n-da-interface-web.md) — **obrigatória e anterior, já satisfeita** (a US-98 está implementada; medição de 04/08/2026 na *Questão em aberto* #1 confirma corpus a zero). O bloqueio existia porque, enquanto o dicionário não existisse, o gate nasceria com 126 achados legítimos, e gate que nasce vermelho vira `continue-on-error` em duas semanas (foi a lição do `docs:links`, que só apertou de `--only-md` para gate completo quando a [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) zerou a baseline).
**Nasceu de:** *Questões em aberto* #1 da [US-98](./US-98-i18n-da-interface-web.md) — *"vale um gate mecânico contra string literal no JSX, para a próxima tela nascer traduzida?"*.
**Relacionada a:** [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md) e [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) (mesma família: gate mecânico barato sobre uma convenção que a revisão humana não segura), [US-89](./US-89-gate-de-codigo-morto-com-knip.md) (o outro gate que roda sobre código, não sobre doc), [US-80](./US-80-ci-typecheck-testes-e-evals.md) (é lá que o gate ganha dentes), [US-99](./US-99-config-do-sistema-no-locale-ativo.md) e [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md) (o texto que **não** vem do front e por isso o gate não vê).
**Criada em:** 2026-07-31

---

## História

> **Como** dev (ou agente) que vai escrever a próxima tela deste front,
> **quero** que o CI reprove texto visível escrito direto no JSX,
> **para que** a tela nasça passando pelo dicionário — em vez de reabrir a US-98 a cada duas semanas.

---

## Contexto e motivação

### O problema observado

A [US-98](./US-98-i18n-da-interface-web.md) extrai as strings de 7 arquivos e liga o dicionário ao `User.locale`. Nada impede que a tela seguinte volte a escrever o texto no JSX: não há lint no projeto (`AGENTS.md` → *Padrões de código*), o `typecheck` não vê diferença entre `<p>Criar personagem</p>` e `<p>{t('home.criar')}</p>`, e a revisão humana já demonstrou não pegar esta classe de defeito — o front acumulou 126 nós de texto literal ao longo de toda a Fase 1 sem que nenhuma revisão os registrasse como dívida, e foi preciso um grep dedicado (baseline da US-98) para descobri-los.

O modo de falha não é a tela sair errada; é ela sair **certa em português**. Ninguém nota, porque quem escreve e quem revisa leem português. O defeito só aparece na sessão de um jogador anglófono, meses depois — exatamente o cenário que a US-98 existe para consertar.

### Por que a solução atual não basta

`pnpm typecheck` e `pnpm test` são cegos a isto por construção: literal no JSX é código válido e os testes de tela **afirmam sobre o texto renderizado** ([`SetupWizard.test.tsx`](../../../apps/web/src/components/setup/SetupWizard.test.tsx), [`HomeHero.test.tsx`](../../../apps/web/src/components/HomeHero.test.tsx)) — passariam iguais com a string no dicionário ou no JSX. O `knip` ([US-89](./US-89-gate-de-codigo-morto-com-knip.md)) procura o oposto: código sem consumidor. Uma chave de dicionário nova **tem** consumidor; uma string literal nova não é código morto. Nenhum gate existente pode acender aqui.

### Baseline medida (31/07/2026)

Corpus: `apps/web/src/**/*.tsx`, **15 arquivos**, `.test.tsx` excluído. Método: parse com `ts.createSourceFile(..., ScriptKind.TSX)` e classificação por tipo de nó — não regex. Deduplicado por `arquivo:linha:texto`.

| Classe de nó | Ocorrências | É defeito? |
|---|---|---|
| `JsxText` contendo letra | **87** | sim |
| Atributo visível literal (`title`, `placeholder`, `aria-label`, `alt`, `label`) | **16** | sim |
| Literal em `{…}` — prosa | **23** | sim |
| `JsxText` só pontuação (`·` `—` `.` `,` `/` `(` `)`) | 15 | **não** — separador visual |
| Literal em `{…}` — classe Tailwind (`'flex flex-col gap-2'`) | 48 | **não** |
| Literal em `{…}` — token curto (`'primary'`, `'tab'`, `'pt-BR'`, `'ArrowRight'`, `'features'`) | 46 | **não** |

**Cobrado: 126. Ruído se a regra for ingênua: 109 (46%).** Distribuição por arquivo, na mesma ordem da baseline da US-98: [`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) (48 `JsxText` + 7 atributos), [`GameView.tsx`](../../../apps/web/src/components/game/GameView.tsx) (25 + 5), [`HomeHero.tsx`](../../../apps/web/src/components/HomeHero.tsx) (21 + 3), e o resto pulverizado. Os ~110 da US-98 e os 126 daqui são coerentes: lá a unidade é linha (uma linha pode ter dois textos), aqui é nó.

**A tabela é o desenho do gate, não só o tamanho dele.** Os três primeiros buckets são a regra; os três últimos são o motivo de a regra não ser "qualquer literal dentro de JSX". Contar tudo dá 235 achados com 46% de ruído — e gate com falso positivo é gate que alguém desliga (mesma conclusão da [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) e da [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md), por caminhos diferentes).

### A periferia: medida em 31/07, remedida em 04/08

Um gate sobre nó JSX não vê texto visível que não é nó JSX. Em 31/07 eram três buracos com defeito dentro. **A US-98 fechou o defeito dos três** — o que sobra é o gate não ver o lugar, ou seja, regressão que passa verde. Estado em 04/08/2026:

| Buraco (31/07) | Estado hoje | Ainda precisa do gate? |
|---|---|---|
| Mapa de rótulos no topo do arquivo | `SOURCE_TYPE_HINT` é `Record<string, MessageKey>` ([`SetupWizard.tsx:32`](../../../apps/web/src/components/setup/SetupWizard.tsx)); o mapa de rótulo de etapa deixou de existir | **Não.** O tipo faz o trabalho: pôr texto no lugar da chave é erro de compilação no `pnpm typecheck` |
| Diálogo nativo | `t('home.confirmDelete', { name })` ([`HomeHero.tsx:63`](../../../apps/web/src/components/HomeHero.tsx)) | **Sim.** `window.confirm(string)` aceita qualquer literal |
| `metadata` do App Router | `generateMetadata()` lê o locale ([`layout.tsx:28`](../../../apps/web/src/app/layout.tsx)) | **Sim.** `title`/`description` são `string` crua |
| 7 mensagens de erro | `setError(t('setup.error.create'))` ([`SetupWizard.tsx:170`](../../../apps/web/src/components/setup/SetupWizard.tsx)) | **Sim.** `t()` devolve `string`; literal também é `string` |

O modo de falha da periferia é **pior** que o do corpo do componente, não menor: JSX vê-se na tela enquanto se desenvolve, mas a confirmação de apagar só dispara ao apagar, `setError` só na falha e `metadata` só na aba do navegador. Quem escreve e revisa em PT nunca tropeça neles.

**E a conta de cobri-la virou.** O argumento de 31/07 era que a periferia exige "qualquer `StringLiteral` com espaço em `apps/web/src`" e que isso traz 48 falsos positivos de Tailwind de volta. O teste de letra (`\p{L}`) que o bucket `expressão` passou a exigir mata esses 48. Medido em 04/08/2026 sobre `apps/web/src/**/*.{ts,tsx}`, literal com letra **e** espaço, fora de JSX: **168 achados, dos quais 164 são os dois dicionários** — `src/messages/pt-BR.ts` e `src/messages/en-US.ts`, exclusão por caminho. Restam **dois**, e nenhum é Tailwind:

| Achado | Por que é falso positivo |
|---|---|
| `'AUTH_SECRET ausente no web'` ([`auth.ts:22`](../../../apps/web/src/auth.ts)) | mensagem de `throw` para quem opera, não texto de interface |
| `url("data:image/svg+xml,…")` ([`SetupWizard.tsx:41`](../../../apps/web/src/components/setup/SetupWizard.tsx)) | SVG inline em CSS; tem letra e espaço por acidente de sintaxe |

Duas entradas de `LITERAL_ALLOW` compram a periferia inteira. Bem dentro do teto de ~15 que a *Questão em aberto* #3 usa como cláusula de morte. Por isso a periferia **entrou** no escopo.

### A proposta

Um script `.mjs` na raiz, no molde dos gates que já existem ([`check-doc-links.mjs`](../../../scripts/check-doc-links.mjs), [`readme-shape.test.mjs`](../../../scripts/readme-shape.test.mjs)), usando o parser do `typescript` que já é dependência da raiz. Um passo novo no [`ci.yml`](../../../.github/workflows/ci.yml). Zero dependência nova.

---

## Escopo

### Dentro do escopo

- **`scripts/check-jsx-literals.mjs`**: varre `apps/web/src/**/*.tsx` (exceto `*.test.tsx`), classifica pelos três buckets cobrados da baseline, imprime `arquivo:linha` + o texto, sai ≠ 0 se houver achado.
- **Segundo corpus, a periferia**: os mesmos arquivos mais os `.ts`, **menos `src/messages/`** (é lá que o texto deve morar), cobrando `StringLiteral` com letra e espaço interno **fora** de JSX. Bucket próprio no relatório (`periferia`), para a falha dizer de qual dos dois corpus veio. Fecha `window.confirm`, `setError` e `generateMetadata` — ver *A periferia*.
- **Um `it` a mais no describe de paridade dos dicionários** ([`i18n.test.tsx:98`](../../../apps/web/src/components/i18n.test.tsx)): valor idêntico nos dois idiomas é tradução esquecida, salvo jargão declarado. É o único achado de `src/messages/` que nem o tipo nem o teste de placeholder pegam. Não é script nem passo de CI — o `pnpm test` já corre esse arquivo.
- **`pnpm i18n:literals`** no `package.json` da raiz, ao lado de `docs:links` e `docs:shape`.
- **Passo no `ci.yml`**, depois do `pnpm test` e antes ou depois do *Gate de código morto* — passo separado, como todos os outros, para a aba de checks dizer qual gate caiu.
- **`LITERAL_ALLOW`**: `Map` de exceção com **motivo por entrada**, no padrão do `GHOST_ALLOW` da [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md). Chaveado por texto, não por linha.
- **Aviso quando entrada do `LITERAL_ALLOW` não casar mais com nada** — mesma guarda da US-88 contra allowlist fóssil.
- **Teste de regressão** `scripts/check-jsx-literals.test.mjs` no padrão `node:test` da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md): fixture `.tsx` temporária com literal é reprovada, fixture só com `t('chave')` passa, `finally` apaga.
- **Passo no CI para o teste do próprio gate** (`pnpm i18n:literals:test`) — o `pnpm test` da raiz é recursivo pelos workspaces e não alcança `scripts/`.

### Fora do escopo

- **ESLint.** A regra pronta existe (`react/jsx-no-literals`), mas o repo não tem lint: instalar `eslint` + `eslint-plugin-react` + config + `.eslintignore` para uma regra é infra nova para manter, contra ~80 linhas de script no molde de quatro gates que já existem. Reavaliar no dia em que houver uma **segunda** regra de lint desejada — aí a conta inverte.
- **O mapa de rótulos.** Único dos buracos de 31/07 que continua fora, e por já estar coberto duas vezes: a anotação `Record<string, MessageKey>` reprova texto no lugar da chave no `pnpm typecheck`, e um mapa **novo, sem anotação**, cai no corpus da periferia (`{ light: 'Armadura leve' }` é literal com letra e espaço fora de JSX). Gate a duplicar tipo é gate a manter de graça. **Teto conhecido:** rótulo de **uma palavra** num mapa não anotado (`{ light: 'Leve' }`) não é pego por nenhum dos dois — fechar isso obrigaria a largar a exigência de espaço, que traz de volta os 46 tokens curtos da baseline. Fica a convenção: mapa de rótulo nasce anotado.
- **`src/messages/`.** Os dois dicionários são 164 dos 168 literais da periferia — é o lugar onde texto **deve** estar. Excluídos por caminho, não por allowlist. Dos três riscos que isso deixa em aberto, dois já têm dono: chave faltando no `en-US` é erro de compilação pelo tipo `Record<Locale, Record<MessageKey, string>>` ([`messages/index.ts:13`](../../../apps/web/src/messages/index.ts)), e placeholder perdido na tradução tem teste desde a US-98 ([`i18n.test.tsx:102`](../../../apps/web/src/components/i18n.test.tsx)). O terceiro — **texto por traduzir** — não tinha dono e ganha um em *Dentro do escopo*.
- **`.test.tsx`.** Teste de tela afirma sobre o texto renderizado — `getByText('Criar novo personagem')` continua sendo a forma certa de escrever o teste depois da US-98. Incluir os testes reprovaria a suíte inteira por seguir a convenção correta.
- **Verificar se a chave existe no dicionário — já resolvido pela US-98, não é dívida.** `t('setup.tipo')` com chave inexistente passa neste gate, mas não passa no `pnpm typecheck`: `Translate` é `(key: MessageKey, …)` ([`messages/index.ts:18`](../../../apps/web/src/messages/index.ts)) e `MessageKey` é `keyof typeof ptBR`, então typo de chave é erro de compilação desde a entrega da US-98. Continua fora daqui pelo motivo certo — é uma assinatura, não um gate.
- **Modo `--fix`.** Extrair string exige inventar nome de chave e editar dois dicionários. É o bucket "reportar, não reescrever" da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md).
- **`apps/api` e `packages/`.** "Não têm JSX" deixou de justificar quando o corpus da periferia passou a varrer `.ts`. O motivo agora é medido (04/08/2026): **291 literais com letra e espaço em 35 arquivos**, e 158 deles em três — [`ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) (83), [`rubric.ts`](../../../packages/ai-engine/src/rubric.ts) (40), [`dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) (35). É prompt e rubrica: texto que **tem** de ser literal, e que um dicionário de UI pioraria. O texto de jogador que a API emite não é literal solto — é dado por locale ([`initial-adventures.ts`](../../../apps/api/prisma/initial-adventures.ts), mapa `pt-BR`/`en-US`), protegido pela estrutura e dono da [US-101](./US-101-ganchos-de-aventura-em-ingles.md). O corpus continua sendo `apps/web/src`.

---

## Critérios de aceite

- [ ] `pnpm i18n:literals` reporta cada achado com `arquivo:linha`, o texto e o bucket (`jsx-text` / `atributo` / `expressão`), e sai ≠ 0 quando houver.
- [ ] **Zero achados no corpus depois da US-98**, com o `LITERAL_ALLOW` inicial. Rodar o gate na branch de entrega da US-98 sai verde.
- [ ] **Zero falso positivo nos três buckets não cobrados da baseline:** as 48 classes Tailwind em `{…}`, os 46 tokens curtos (`'primary'`, `'tab'`, `'pt-BR'`) e os 15 `JsxText` de pontuação (`·`, `—`) não aparecem no relatório.
- [ ] Um `<p>Texto novo em português</p>` acrescentado a qualquer `.tsx` do corpus **reprova** o gate.
- [ ] Um `aria-label="Fechar"` acrescentado a qualquer `.tsx` do corpus **reprova** o gate; um `className="flex gap-2"` **não**.
- [ ] **Os dois falsos positivos medidos em 04/08/2026 não aparecem** (ver *Questões em aberto* #1): `alt=""` de imagem decorativa com `aria-hidden` ([`dm.tsx:126`](../../../apps/web/src/components/ui/dm.tsx)) e o separador `' · '` de `.join()` dentro de `{…}` ([`SetupWizard.tsx:488,495`](../../../apps/web/src/components/setup/SetupWizard.tsx)). Reprovar o primeiro empurra quem escreve a inventar um `alt` que o leitor de tela não deveria ouvir.
- [ ] **A periferia reprova:** um `window.confirm('Apagar?')`, um `setError('Erro ao salvar')` ou um `title: 'Ficha'` em `generateMetadata` acrescentados a qualquer arquivo do corpus derrubam o gate, no bucket `periferia`.
- [ ] **Texto por traduzir reprova o `pnpm test`:** uma chave nova com o mesmo valor nos dois dicionários e fora da lista de jargão derruba o teste de paridade. Os 9 idênticos de hoje (`Background`, `Features`, `HP`, `CON`, `INT`) continuam verdes.
- [ ] **`src/messages/` não é varrido:** os 164 literais dos dois dicionários não aparecem, e o `LITERAL_ALLOW` da periferia tem **duas** entradas (`auth.ts:22` e o `url("data:image/svg+xml,…")`), não 166.
- [ ] Entrada do `LITERAL_ALLOW` que não casa mais com nenhum texto do corpus aparece como **aviso**, não derruba o gate (a tela está certa; o allowlist é que envelheceu).
- [ ] `.test.tsx` não é varrido: a suíte atual continua verde sem alteração.
- [ ] **Nenhuma reescrita.** `git status` limpo depois de rodar o gate.
- [ ] O gate roda no CI como passo próprio e nomeado, e a falha dele identifica o arquivo sem abrir o log.
- [ ] **Eval / teste de regressão:** fixture `.tsx` temporária com um `JsxText`, um `aria-label` e um `className` — as duas primeiras reprovam, a terceira não; fixture só com `t('chave')` e `className` passa. Fixture apagada no `finally`, como a da US-79.

---

## Notas de implementação

- **O script tem de morar em `scripts/`.** Medido em 31/07/2026: rodar o mesmo `.mjs` de fora do repo dá `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript'` — a resolução de módulo parte do arquivo, não do `cwd`. Dentro de `scripts/`, `import ts from 'typescript'` resolve direto no `node_modules` da raiz (`typescript@^5.8.3`, [`package.json`](../../../package.json)).
- **Parser, não regex.** Comentário nunca dispara (não é `JsxText`), `className` nunca dispara (atributo fora da lista), e o gate pega **os dois idiomas** — depois da US-98 o defeito a barrar é literal em qualquer língua, não só acento português. A regex de acento que gerou a baseline da US-98 serviu para dimensionar e não serve para reprovar.
- **Núcleo da regra**, com os tipos que a baseline validou:

  ```js
  import ts from "typescript";

  // US-102: atributos que o jogador LÊ. className/href/key/id/type/role/data-*
  // ficam de fora — são contrato de código, não texto de interface.
  const VISIBLE_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label"]);

  function visit(node, src, report) {
    // 87 hits na baseline. O teste de letra descarta os 15 separadores (·, —, /).
    if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) report("jsx-text", node);

    if (ts.isJsxAttribute(node) && VISIBLE_ATTRS.has(node.name.getText(src))) {
      const lit = stringLiteralOf(node.initializer); // cobre "x" e {"x"}
      // O teste de letra também aqui: alt="" + aria-hidden é a forma CERTA de
      // imagem decorativa (dm.tsx:126) — reprová-la pede um alt que ninguém deve ouvir.
      if (lit && /\p{L}/u.test(lit.text)) report("atributo", lit);
    }
    ts.forEachChild(node, (n) => visit(n, src, report));
  }
  ```

- **O bucket `expressão` é o único que precisa de heurística — e é o que decide se o gate sobrevive.** `{cond ? 'A iniciar...' : 'Iniciar aventura'}` ([`SetupWizard.tsx:233`](../../../apps/web/src/components/setup/SetupWizard.tsx)) é defeito; `{cn('flex gap-2', x)}` não é, e os dois são `StringLiteral` dentro de `JsxExpression`. A separação medida que dá 23 contra 94: **é prosa se contém letra (`\p{L}`) e espaço interno, e não casa a forma de utilitário Tailwind** (só minúsculas/dígitos/`-`/`:`/`[`/`]`/`/`, com pelo menos um `-` ou `:`). Os 46 tokens curtos caem sozinhos por não terem espaço. **O teste de letra não é redundante com o de espaço:** `.join(' · ')` ([`SetupWizard.tsx:488,495`](../../../apps/web/src/components/setup/SetupWizard.tsx)) tem espaço interno, não é Tailwind, e não é texto — foi o falso positivo medido em 04/08/2026 (*Questões em aberto* #1). Separador com espaço à volta só cai pelo `\p{L}`.
- **Subir do literal até saber se está em atributo.** O mesmo `StringLiteral` pode aparecer em `{cn(...)}` de `className` e em `{cond ? 'a' : 'b'}` de conteúdo. Andar `node.parent` até o primeiro `JsxAttribute` (descarta) ou `JsxExpression` (cobra) é o que evita contar o mesmo nó duas vezes — a primeira medição desta baseline inflou 411 contra 117 reais por não fazer isso.
- **O corpus da periferia é o mesmo passeio por `node.parent`, com o sinal trocado.** No bucket `expressão` sobe-se até o primeiro `JsxAttribute` (descarta) ou `JsxExpression` (cobra); na periferia sobe-se até um `JsxElement`/`JsxSelfClosingElement`/`JsxFragment` — se **não** achar nenhum, o literal está fora de JSX e é da periferia. Mesma função, mesma varredura, um parâmetro: não é um segundo script.
- **O teste de texto por traduzir mede-se em 9.** Medido em 04/08/2026: 143 chaves em cada dicionário, **9 valores idênticos**, todos jargão que não se traduz (`Background`, `Features`, `HP`, `CON`, `INT`). Entra no describe que já existe, sem arquivo novo:

  ```ts
  // Mesma string nos dois idiomas = tradução esquecida, salvo jargão que não se traduz.
  const IDENTICO_OK = new Set(['Background', 'Features', 'HP', 'CON', 'INT'])
  it('valor idêntico nos dois idiomas é jargão declarado, não tradução esquecida', () => {
    const naoTraduzidos = Object.keys(ptBR).filter((key) => {
      const k = key as keyof typeof ptBR
      return ptBR[k] === enUS[k] && !IDENTICO_OK.has(ptBR[k])
    })
    expect(naoTraduzidos).toEqual([])
  })
  ```

  **Teto:** não pega tradução que difere de propósito e continua em português (`'Iniciar aventura'` no `en-US` reescrito como `'Iniciar a aventura'`). Pega o caso que acontece de verdade, que é copiar a linha do `pt-BR` e esquecer de traduzir.
- **`LITERAL_ALLOW` é `Map<texto, motivo>`, não `Set` e não por linha.** Chave por linha quebra no primeiro `prettier`/edição acima; chave por texto sobrevive. Espera-se que nasça quase vazio — nome do produto (`AI Dungeon Master`) e pouco mais, porque a regra de pontuação já cobre `·` e `—` estruturalmente. Se passar de ~15 entradas, o desenho errado é a regra, não o allowlist.
- **O gate não se envenena como o da US-88.** Lá o script indexava `scripts/`, se lia e acusava as próprias entradas do allowlist. Aqui o corpus é `.tsx` e o script é `.mjs` — nunca se vê. **Mas o teste sim:** a fixture é um `.tsx` de verdade. Criar em `os.tmpdir()`, nunca dentro de `apps/web/src`, e apagar no `finally`.
- **Chave inexistente resolve-se de graça no `tsc`, não aqui.** Tipar o dicionário e derivar `t(k: keyof typeof ptBR)` faz `t('setup.tipo')` (typo) virar erro de compilação no `pnpm typecheck` que já roda no CI. Vale ser feito **na US-98**, não aqui — é uma assinatura, não um gate.
- **O teto mais alto do gate não é de corpus, é de classe: texto que não é literal em lugar nenhum do front.** O caso vivo é a mensagem de exceção da API. A API lança em português (`'Personagem ${characterId} não encontrado'`, [`adventure.service.ts:39`](../../../apps/api/src/adventure/adventure.service.ts)) e o cliente propaga o corpo cru (`throw new Error(await res.text())`, [`api.ts:24`](../../../apps/web/src/lib/api.ts)). Hoje não vaza porque os três consumidores descartam o erro e mostram dicionário — [`SetupWizard.tsx:170`](../../../apps/web/src/components/setup/SetupWizard.tsx), [`HomeHero.tsx:58`](../../../apps/web/src/components/HomeHero.tsx), [`GameView.tsx:458`](../../../apps/web/src/components/game/GameView.tsx), verificado em 04/08/2026. Mas um `catch (e) { setError(String(e)) }` põe português na tela de um anglófono **sem um único literal para o gate ver**. Não é buraco de corpus (varrer mais arquivos não resolve): é convenção, e mora no `AGENTS.md` → *Frontend*. Registrado aqui para o gate verde não ser lido como cobertura que ele não dá.
- **Um `pnpm dead` verde não garante nada sobre este gate, e vice-versa.** São o mesmo tipo de ferramenta apontado para lados opostos; nenhum dos dois substitui o outro.

---

## Questões em aberto

1. **Ligar com zero ou com ratchet?** **Resolvido: zero, e o corpus já está lá.** Medido em 04/08/2026, com a US-98 fechada: a regra dos três buckets sobre `apps/web/src/**/*.tsx` dá **3 achados e nenhum defeito real**. Ratchet não tem o que contar e o `LITERAL_ALLOW` nasce **vazio** — nem o nome do produto apareceu, porque `AI Dungeon Master` está no dicionário como qualquer outro texto.

   Os 3 achados são falso positivo da regra como escrita acima, não dívida. Corrigir a regra antes de ligar: entrar no allowlist seria transformar bug do gate em exceção permanente.

   | Achado | Bucket | O que falta na regra |
   |---|---|---|
   | `join(' · ')` ([`SetupWizard.tsx:488`](../../../apps/web/src/components/setup/SetupWizard.tsx) e `:495`) | `expressão` | exigir `\p{L}`, não só "tem espaço interno" — separador com espaço à volta passa pelo teste de prosa |
   | `alt=""` ([`dm.tsx:126`](../../../apps/web/src/components/ui/dm.tsx)) | `atributo` | exigir texto não-vazio. `alt=""` + `aria-hidden` é a forma **correta** de imagem decorativa; reprová-la empurra quem escreve a inventar um `alt` que o leitor de tela não deveria ouvir |

   Os dois `· ` são `StringLiteral` dentro do callback de um `.map()` dentro de `JsxExpression` — o passeio por `node.parent` das *Notas de implementação* pega os dois; o que falta é só o teste de letra.
2. **O corpus deve incluir `.test.tsx` algum dia?** Hoje não (ver *Fora do escopo*), e o gatilho de reabertura muda: "aparecer uma convenção de teste que não afirme sobre texto renderizado" é inobservável — ninguém repara no dia em que acontece. Gatilho checável: **reabrir quando um teste importar o dicionário para montar a asserção** (`getByText(ptBR['home.criar'])`). Aí o literal deixou de ser a convenção do arquivo de teste e o corpus pode crescer sem reprovar a suíte. Enquanto nenhum teste fizer isso, não reabrir.
3. **Cláusula de morte, como a da [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) #1?** **Existe, mas com o sinal invertido.** Lá o argumento era "se o bucket nunca acender, apague o gate". Aqui o bucket nunca acender é **o sucesso**: é gate preventivo, não detector de dívida existente. O que mata gate preventivo não é silêncio, é **contorno** — e contorno aqui tem medida: o `LITERAL_ALLOW` a crescer. Cláusula de morte: **passar de ~15 entradas** (o número que as *Notas de implementação* já usam) obriga a rever a regra ou apagar o gate. Cai no mesmo momento em que a conta do ESLint inverte (*Fora do escopo*, primeira entrada): um ponto de decisão para os dois, não dois.

---

## Referências no código

- [scripts/check-doc-links.mjs](../../../scripts/check-doc-links.mjs) — molde: varredura por diretório, buckets no relatório, `NAME_ALLOW`/`GHOST_ALLOW` com motivo, exit ≠ 0, nunca escreve sem `--fix`.
- [scripts/check-doc-links.test.mjs](../../../scripts/check-doc-links.test.mjs) — padrão de fixture temporária com `try/finally`.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — onde o passo entra; os comentários explicam por que cada gate é um passo separado.
- [package.json](../../../package.json) — `typescript@^5.8.3` nas devDependencies da raiz (a única dependência que o gate usa) e os scripts `docs:links` / `docs:shape` ao lado dos quais o novo entra.
- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — maior concentração da baseline (48 `JsxText` + 7 atributos) e onde vivem os mapas `STEP_LABEL` / `SOURCE_TYPE_HINT` que o gate **não** vê.
- [apps/web/src/components/game/GameView.tsx](../../../apps/web/src/components/game/GameView.tsx) — segunda maior (25 + 5); `:814` concentra os `placeholder` condicionais que o bucket `expressão` precisa pegar.
- [apps/web/src/components/HomeHero.tsx](../../../apps/web/src/components/HomeHero.tsx) — `:56`, o `window.confirm` que é o buraco mais visível do gate.
