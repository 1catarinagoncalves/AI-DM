# US-102 — Tela nova nasce traduzida

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-98](./US-98-i18n-da-interface-web.md) — **obrigatória e anterior**. Enquanto o dicionário não existir, o gate nasce com 126 achados legítimos, e gate que nasce vermelho vira `continue-on-error` em duas semanas (foi a lição do `docs:links`, que só apertou de `--only-md` para gate completo quando a [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) zerou a baseline).
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

### Os três buracos, medidos

Um gate sobre nó JSX não vê texto visível que não é nó JSX. Os casos que existem hoje:

| Buraco | Onde | Por que escapa |
|---|---|---|
| Mapa de rótulos no topo do arquivo | `STEP_LABEL`, `SOURCE_TYPE_HINT` ([`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx)) | `ObjectLiteralExpression` em escopo de módulo, sem relação sintática com JSX |
| Diálogo nativo | `window.confirm('Deletar … Esta ação não pode ser desfeita.')` ([`HomeHero.tsx:56`](../../../apps/web/src/components/HomeHero.tsx)) | chamada de função, zero JSX |
| `metadata` do App Router | [`layout.tsx`](../../../apps/web/src/app/layout.tsx) | objeto exportado, resolvido no servidor |

Some-se a esses as **7 mensagens de erro** que a US-98 vai extrair ([`SetupWizard.tsx:155,170`](../../../apps/web/src/components/setup/SetupWizard.tsx), [`GameView.tsx:448`](../../../apps/web/src/components/game/GameView.tsx), [`HomeHero.tsx:78,138`](../../../apps/web/src/components/HomeHero.tsx)): hoje são literais em `setError('…')` e em objeto `Message`, também fora do JSX.

O gate cobre o corpo do componente (126 de ~136 casos conhecidos) e não cobre a periferia (~10). Vale assim: o corpo é onde a tela nova nasce, e cobrir a periferia exige a heurística "qualquer `StringLiteral` com espaço em `apps/web/src`", que é justamente a que traz os 48 falsos positivos de Tailwind de volta.

### A proposta

Um script `.mjs` na raiz, no molde dos gates que já existem ([`check-doc-links.mjs`](../../../scripts/check-doc-links.mjs), [`readme-shape.test.mjs`](../../../scripts/readme-shape.test.mjs)), usando o parser do `typescript` que já é dependência da raiz. Um passo novo no [`ci.yml`](../../../.github/workflows/ci.yml). Zero dependência nova.

---

## Escopo

### Dentro do escopo

- **`scripts/check-jsx-literals.mjs`**: varre `apps/web/src/**/*.tsx` (exceto `*.test.tsx`), classifica pelos três buckets cobrados da baseline, imprime `arquivo:linha` + o texto, sai ≠ 0 se houver achado.
- **`pnpm i18n:literals`** no `package.json` da raiz, ao lado de `docs:links` e `docs:shape`.
- **Passo no `ci.yml`**, depois do `pnpm test` e antes ou depois do *Gate de código morto* — passo separado, como todos os outros, para a aba de checks dizer qual gate caiu.
- **`LITERAL_ALLOW`**: `Map` de exceção com **motivo por entrada**, no padrão do `GHOST_ALLOW` da [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md). Chaveado por texto, não por linha.
- **Aviso quando entrada do `LITERAL_ALLOW` não casar mais com nada** — mesma guarda da US-88 contra allowlist fóssil.
- **Teste de regressão** `scripts/check-jsx-literals.test.mjs` no padrão `node:test` da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md): fixture `.tsx` temporária com literal é reprovada, fixture só com `t('chave')` passa, `finally` apaga.
- **Passo no CI para o teste do próprio gate** (`pnpm i18n:literals:test`) — o `pnpm test` da raiz é recursivo pelos workspaces e não alcança `scripts/`.

### Fora do escopo

- **ESLint.** A regra pronta existe (`react/jsx-no-literals`), mas o repo não tem lint: instalar `eslint` + `eslint-plugin-react` + config + `.eslintignore` para uma regra é infra nova para manter, contra ~80 linhas de script no molde de quatro gates que já existem. Reavaliar no dia em que houver uma **segunda** regra de lint desejada — aí a conta inverte.
- **Os três buracos acima** (mapa de rótulos, `window.confirm`, `metadata`). Ficam para a revisão humana e para a checklist da US-98. Reabrir só com baseline nova mostrando que uma tela nasceu PT-only por esse caminho.
- **`.test.tsx`.** Teste de tela afirma sobre o texto renderizado — `getByText('Criar novo personagem')` continua sendo a forma certa de escrever o teste depois da US-98. Incluir os testes reprovaria a suíte inteira por seguir a convenção correta.
- **Verificar se a chave existe no dicionário.** `t('setup.tipo')` com chave inexistente passa neste gate. É outra classe (chave órfã), e o alvo natural dela é o `typecheck` — dicionário tipado com `keyof` resolve de graça no `tsc`, sem gate nenhum. Nota de implementação, não escopo.
- **Modo `--fix`.** Extrair string exige inventar nome de chave e editar dois dicionários. É o bucket "reportar, não reescrever" da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md).
- **`apps/api` e `packages/`.** Não têm JSX. O corpus é `apps/web/src` e só.

---

## Critérios de aceite

- [ ] `pnpm i18n:literals` reporta cada achado com `arquivo:linha`, o texto e o bucket (`jsx-text` / `atributo` / `expressão`), e sai ≠ 0 quando houver.
- [ ] **Zero achados no corpus depois da US-98**, com o `LITERAL_ALLOW` inicial. Rodar o gate na branch de entrega da US-98 sai verde.
- [ ] **Zero falso positivo nos três buckets não cobrados da baseline:** as 48 classes Tailwind em `{…}`, os 46 tokens curtos (`'primary'`, `'tab'`, `'pt-BR'`) e os 15 `JsxText` de pontuação (`·`, `—`) não aparecem no relatório.
- [ ] Um `<p>Texto novo em português</p>` acrescentado a qualquer `.tsx` do corpus **reprova** o gate.
- [ ] Um `aria-label="Fechar"` acrescentado a qualquer `.tsx` do corpus **reprova** o gate; um `className="flex gap-2"` **não**.
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
      if (lit) report("atributo", lit);
    }
    ts.forEachChild(node, (n) => visit(n, src, report));
  }
  ```

- **O bucket `expressão` é o único que precisa de heurística — e é o que decide se o gate sobrevive.** `{cond ? 'A iniciar...' : 'Iniciar aventura'}` ([`SetupWizard.tsx:233`](../../../apps/web/src/components/setup/SetupWizard.tsx)) é defeito; `{cn('flex gap-2', x)}` não é, e os dois são `StringLiteral` dentro de `JsxExpression`. A separação medida que dá 23 contra 94: **é prosa se tem espaço interno ou caractere acentuado, e não casa a forma de utilitário Tailwind** (só minúsculas/dígitos/`-`/`:`/`[`/`]`/`/`, com pelo menos um `-` ou `:`). Os 46 tokens curtos caem sozinhos por não terem espaço.
- **Subir do literal até saber se está em atributo.** O mesmo `StringLiteral` pode aparecer em `{cn(...)}` de `className` e em `{cond ? 'a' : 'b'}` de conteúdo. Andar `node.parent` até o primeiro `JsxAttribute` (descarta) ou `JsxExpression` (cobra) é o que evita contar o mesmo nó duas vezes — a primeira medição desta baseline inflou 411 contra 117 reais por não fazer isso.
- **`LITERAL_ALLOW` é `Map<texto, motivo>`, não `Set` e não por linha.** Chave por linha quebra no primeiro `prettier`/edição acima; chave por texto sobrevive. Espera-se que nasça quase vazio — nome do produto (`AI Dungeon Master`) e pouco mais, porque a regra de pontuação já cobre `·` e `—` estruturalmente. Se passar de ~15 entradas, o desenho errado é a regra, não o allowlist.
- **O gate não se envenena como o da US-88.** Lá o script indexava `scripts/`, se lia e acusava as próprias entradas do allowlist. Aqui o corpus é `.tsx` e o script é `.mjs` — nunca se vê. **Mas o teste sim:** a fixture é um `.tsx` de verdade. Criar em `os.tmpdir()`, nunca dentro de `apps/web/src`, e apagar no `finally`.
- **Chave inexistente resolve-se de graça no `tsc`, não aqui.** Tipar o dicionário e derivar `t(k: keyof typeof ptBR)` faz `t('setup.tipo')` (typo) virar erro de compilação no `pnpm typecheck` que já roda no CI. Vale ser feito **na US-98**, não aqui — é uma assinatura, não um gate.
- **Um `pnpm dead` verde não garante nada sobre este gate, e vice-versa.** São o mesmo tipo de ferramenta apontado para lados opostos; nenhum dos dois substitui o outro.

---

## Questões em aberto

1. **Ligar com zero ou com ratchet?** Preferência: **zero**, no PR que fecha a US-98. Ratchet (contagem máxima por arquivo num JSON) só faz sentido se a US-98 deixar resíduo grande, e ela não deve — o critério de aceite dela já é "nenhuma string PT literal restou no JSX das telas listadas". Se sobrar resíduo pequeno, allowlist por caminho com motivo escrito, não ratchet: contador em arquivo é dívida que ninguém lê.
2. **O corpus deve incluir `.test.tsx` algum dia?** Hoje não (ver *Fora do escopo*). Reabrir só se aparecer uma convenção de teste que não afirme sobre texto renderizado.
3. **Cláusula de morte, como a da [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) #1?** **Não se aplica, e o motivo importa.** Lá o argumento era "se o bucket nunca acender, apague o gate". Aqui o bucket nunca acender é **o sucesso**: é gate preventivo, não detector de dívida existente. O que mediria a inutilidade dele é outra coisa — nenhuma tela nova em toda a Fase 2. Registrado para não ser apagado pelo argumento errado.

---

## Referências no código

- [scripts/check-doc-links.mjs](../../../scripts/check-doc-links.mjs) — molde: varredura por diretório, buckets no relatório, `NAME_ALLOW`/`GHOST_ALLOW` com motivo, exit ≠ 0, nunca escreve sem `--fix`.
- [scripts/check-doc-links.test.mjs](../../../scripts/check-doc-links.test.mjs) — padrão de fixture temporária com `try/finally`.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — onde o passo entra; os comentários explicam por que cada gate é um passo separado.
- [package.json](../../../package.json) — `typescript@^5.8.3` nas devDependencies da raiz (a única dependência que o gate usa) e os scripts `docs:links` / `docs:shape` ao lado dos quais o novo entra.
- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — maior concentração da baseline (48 `JsxText` + 7 atributos) e onde vivem os mapas `STEP_LABEL` / `SOURCE_TYPE_HINT` que o gate **não** vê.
- [apps/web/src/components/game/GameView.tsx](../../../apps/web/src/components/game/GameView.tsx) — segunda maior (25 + 5); `:814` concentra os `placeholder` condicionais que o bucket `expressão` precisa pegar.
- [apps/web/src/components/HomeHero.tsx](../../../apps/web/src/components/HomeHero.tsx) — `:56`, o `window.confirm` que é o buraco mais visível do gate.
