# US-89 — Export que ninguém importa para de sobreviver no repo

**Épico:** 0 — Infra e documentação
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-80](./US-80-ci-typecheck-testes-e-evals.md) — **satisfeita**. É onde o gate ganha dentes (`pnpm typecheck`, `test` e `eval` já rodam em todo push e PR).
**Nasceu de:** sessão de 27/07/2026. `packages/ai-engine/src/tools/roll-dice.ts` exportava `rollDiceTool`, **nunca importado por ninguém**, com `execute` que só lançava exceção e uma interface (`formula: "2d6+3"`) que contradizia a `rollDice` viva. Estava lá desde o scaffold de 27/06/2026 — um mês, com `typecheck`, `test`, `eval` e gate de docs verdes o tempo todo. Achado à mão, apagado à mão.
**Relacionada a:** [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) (mesmo buraco visto do lado da doc: lá a doc cita código que não existe, aqui o código existe e ninguém cita), [US-86](./US-86-gate-de-caminhos-em-arvores-de-diretorio-nos-docs.md) e [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md) (família de gate mecânico), [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) (*"toda linha que reafirma um arquivo é dívida"* — o mesmo argumento aplicado a código).

**Criada em:** 2026-07-27

---

## História

> **Como** dev (ou agente) que abre um arquivo do repo para entender como algo funciona,
> **quero** que código sem nenhum consumidor reprove no CI,
> **para que** eu não gaste leitura — nem escreva código novo — em cima de uma interface que o projeto abandonou.

---

## Contexto e motivação

### O problema observado

O `rollDiceTool` não era só código não usado. Era uma **segunda interface, contraditória, para uma tool viva**: recebia `formula: "2d6+3"` (o LLM monta a rolagem) enquanto a `rollDice` real recebe `skill`/`ability` e monta a fórmula no servidor, com a instrução explícita *"NEVER pass a modifier of your own"* ([`ai.service.ts:349`](../../../apps/api/src/ai/ai.service.ts)). Um agente que abrisse o arquivo do pacote — o caminho que o próprio `AGENTS.md` mandava seguir, com a convenção "uma tool por arquivo" — implementaria a tool errada, obedecendo.

Custo de código morto não é o byte. É que ele **responde perguntas**, e responde errado.

### Por que a solução atual não basta

`tsc` não pega, e não é configuração faltando: `noUnusedLocals` é análise **intra-arquivo**. Um símbolo exportado é, por definição, parte da API pública do módulo — o compilador não pode saber se alguém fora do programa o consome. `roll-dice.ts` compilava limpo, e continuaria compilando limpo para sempre.

| Ferramenta | O que pega | Pegaria o `rollDiceTool`? |
|---|---|---|
| `tsc --noEmit` | erro de tipo, símbolo local sem uso | ❌ |
| `pnpm test` | comportamento do que é testado | ❌ (código morto não tem teste) |
| `pnpm eval` | qualidade do DM Agent | ❌ |
| `pnpm docs:links` | link e caminho na doc | ❌ |
| Revisão humana | tudo, em teoria | ❌ — um mês, várias sessões |

Não há formatter nem linter no projeto (`AGENTS.md` → *Formatação*), então também não existe `no-unused-vars` de ESLint — que, de qualquer forma, teria o mesmo teto intra-arquivo.

### Baseline medida (27/07/2026)

Sem instalar nada: script descartável (mini-knip) sobre `apps/*/src`, `packages/*/src`, `scripts/` e `evals/`, casando `export const|function|class|type|interface|enum` e `export { … }`, e procurando cada nome em todos os outros arquivos.

| Métrica | Valor |
|---|---|
| Exports nomeados | 165 |
| Sem uso fora do próprio arquivo | **32** |
| Deps declaradas e nunca importadas (heurística crua) | 9 |
| Arquivos sem nenhum importador | 17 |

**Os três números medem coisas diferentes, e só o primeiro é sinal quase puro.** Verificação por amostra dos 32:

| Classe | Exemplo verificado | Quantos | O que fazer |
|---|---|---|---|
| **Ponto cego do probe** | `judgeBatch` — usado por `packages/ai-engine/run-bakeoff.mjs`, que está na raiz do pacote e não em `src/` | poucos | nada: é uso legítimo, o probe é que era estreito |
| **Exportado sem consumidor externo** | `PRICES` (`rubric.ts:176`), `ChatInput` (`ai.service.ts:35`), `primaryModel` (`model.ts:76`) — usados só dentro do arquivo que os define | maioria | tirar a palavra `export`; o símbolo continua |
| **Morto de verdade** | `EventLogEntry` e `CharacterStatePatch` ([`packages/shared/src/types/game.ts`](../../../packages/shared/src/types/game.ts)) — zero ocorrências em qualquer lugar | poucos | apagar |

O segundo achado é o irônico: `EventLogEntry` é o tipo da tool `addEventLog` — uma das 5 "Future tools" que nunca existiram e que a [US-83](./US-83-readme-com-arquitetura-alto-nivel.md) já tinha caçado na doc. O contrato do fantasma sobreviveu ao fantasma.

Os outros dois números são quase só falso positivo da heurística crua, e é isso que dimensiona o trabalho de configuração:

- **Deps:** dos 9, `react-dom`, `tailwindcss`, `@nestjs/platform-express`, `@prisma/client`, `pg` e `rxjs` são runtime/build que ninguém importa por nome. **O único verdadeiro é `@ai-sdk/react`** (`apps/web/package.json:14`) — instalado, nunca importado, e é a origem da mentira do `useChat` que a [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) registra.
- **Arquivos:** os 17 são entrypoint — `middleware.ts` e `next-auth.d.ts` (convenção do Next), os `scripts/*.mjs` (CLI), e os 12 `evals/cases/*.ts` (carregados pela suíte). **Zero achados reais.**

Ou seja: a ferramenta certa aqui não é a que acha mais, é a que **sabe o que é entrypoint**. É exatamente o que o `knip` traz de pronto (plugins de Next.js, NestJS, Vitest), e é por isso que a story é "adotar `knip`" e não "escrever nosso checker" — o gate de docs a gente escreveu porque não havia nada; aqui há.

---

## Escopo

### Dentro do escopo

- `knip` como **devDependency da raiz** (`pnpm add -Dw knip`), com `knip.json` versionado.
- Configuração dos entrypoints reais até a saída ficar **sem falso positivo conhecido**: `run-bakeoff.mjs`, `scripts/*.mjs`, `evals/cases/*.ts`, e os plugins de Next/Nest/Vitest para `middleware.ts`, `page.tsx`, `route.ts`, `maxDuration`, decorators.
- Script `pnpm dead` (nome a confirmar) na raiz, no padrão dos outros gates (`docs:links`).
- **Triagem da baseline**, decidindo caso a caso: apagar o morto, tirar `export` do interno, ou declarar entrypoint na config. Nenhuma dessas três é automática.
- Apagar o que a triagem confirmar como morto — incluindo `EventLogEntry`/`CharacterStatePatch` e a dep `@ai-sdk/react`, se a [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) não tiver chegado antes.
- Passo no workflow da [US-80](./US-80-ci-typecheck-testes-e-evals.md), depois de `pnpm test` — **só depois da saída estar limpa** (ver *Questões em aberto* #1).

### Fora do escopo

- **`knip --fix`.** Deleção automática de export é o oposto de leitura: o valor da triagem está em decidir *qual das três coisas* cada achado é. Mesmo princípio do "reportar, não reescrever" da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) (`:99`).
- **Mover as 6 tools vivas para o pacote.** Elas fecham sobre `this.prisma` (ou, no `getSpell`, sobre o contexto do turno); extrair exige inverter a dependência. É decisão de design, não limpeza — e continua sem story.
- **Deps de runtime/build por heurística de import.** Se um plugin do `knip` não souber que `pg` é o adapter do Prisma, a entrada vai para o `ignoreDependencies` com motivo escrito, não para o `package.json` como remoção.
- **Adotar ESLint junto.** Tentação natural ("já que vamos instalar ferramenta de análise"), escopo diferente, e o `AGENTS.md` registra que a ausência de linter é estado conhecido e não acidente. Story própria se alguém quiser.
- **Cobertura de teste como sinal de código morto.** Outra ferramenta, outra conversa.

---

## Critérios de aceite

- [ ] `knip` instalado como devDep da raiz, com `knip.json` versionado e um script de raiz que o roda.
- [ ] **Saída limpa na baseline:** rodar o script com o repo no estado pós-triagem sai com 0 achados e exit 0.
- [ ] Cada entrada de `ignore*`/`entry` na config tem **comentário com o motivo** (por que aquele arquivo é entrypoint, ou por que aquela dep não aparece em import). Config sem motivo vira depósito.
- [ ] `EventLogEntry` e `CharacterStatePatch` apagados de `packages/shared`, ou mantidos com comentário citando a US que vai consumi-los.
- [ ] `@ai-sdk/react` removido de `apps/web`, ou usado de verdade.
- [ ] Os símbolos da classe "exportado sem consumidor externo" perdem o `export` **sem mudar comportamento**: `pnpm typecheck` e `pnpm test` continuam verdes.
- [ ] Passo novo no [`ci.yml`](../../../.github/workflows/ci.yml), separado (não `&&` em cima de outro), para a aba de checks mostrar qual etapa caiu — convenção já registrada no topo do workflow.
- [ ] `pnpm install` continua funcionando para quem clona: sem placeholder inválido no `pnpm-workspace.yaml` (ver *Notas*).

---

## Notas de implementação

- **⚠️ Instalar a dep pode travar todo comando `pnpm`.** Armadilha já registrada no `AGENTS.md` → *Armadilhas do repo*: o pnpm acrescenta pacote com build script ao `allowBuilds:` do `pnpm-workspace.yaml` com um placeholder literal (`'@scarf/scarf': set this to true or false`), e isso derruba o preflight de **qualquer** comando `pnpm` com `ERR_PNPM_IGNORED_BUILDS`. Depois do `pnpm add -Dw knip`, conferir o `pnpm-workspace.yaml` **antes** de rodar qualquer outra coisa.
- **Configurar por workspace, não por regex global.** O repo tem 4 pacotes com contratos de entrypoint diferentes (App Router, NestJS, biblioteca pura, suíte de eval). Uma config única com `ignore` largo esconde exatamente a classe de achado que motivou a story.
- **`packages/shared` é caso especial e merece decisão explícita.** É pacote de contrato: um tipo exportado sem consumidor *hoje* pode ser o contrato de uma US da fila — ou um fóssil, como `EventLogEntry` provou ser. A regra que evita as duas dores: tipo sem consumidor ou é apagado, ou ganha comentário com o número da US que vai consumi-lo. Sem comentário, é fóssil.
- **A ordem importa:** configurar até zerar **antes** de pôr no CI. Gate que nasce vermelho é gate que nasce com `continue-on-error`, e aí não é gate.
- **Não versionar o probe desta baseline.** Ele foi instrumento de medição, não ferramenta: heurística de substring, cego para arquivo fora de `src/`. Os números acima valem como ordem de grandeza; a saída do `knip` configurado é que vira a linha de base real.

---

## Questões em aberto

1. **CI ou local?** O `knip` é o primeiro gate deste repo cuja saída depende de configuração fina — os outros (typecheck, test, docs:links) são binários. Se a triagem deixar resíduo que ninguém quer resolver agora, a alternativa honesta é rodar local/manual por uma fase e só depois promover a CI. Decidir com a saída na mão, não antes.
2. **"Exportado sem consumidor externo" vale reprovar?** É a maior fatia dos 32 e o fix é remover uma palavra. Argumento a favor: `export` é declaração de API pública; exportar o que ninguém consome é o mesmo ruído do `// Future tool`. Contra: em pacote de biblioteca, atrito constante por algo que não quebra nada. Dá para ligar a regra separadamente no `knip` — decidir depois de ver quantos sobram após a triagem.
3. **`unused exports in test files`?** O probe achou 0, mas foi porque a heurística exclui teste. Vale medir com o `knip` configurado antes de decidir se entra no gate.
4. **Vale a pena para 165 exports?** O repo é pequeno; o `rollDiceTool` foi achado a olho. O argumento não é volume, é **tempo de sobrevivência**: um mês, com 5 gates verdes e várias sessões lendo o repo. E o custo de manutenção do `knip` é a config, que só muda quando entra framework novo.

---

## Referências no código

- [packages/shared/src/types/game.ts](../../../packages/shared/src/types/game.ts) — `EventLogEntry` (`:22`) e `CharacterStatePatch` (`:40`), os 2 achados mortos de verdade.
- [packages/ai-engine/src/model.ts](../../../packages/ai-engine/src/model.ts) — `primaryModel` (`:76`) e vizinhos: classe "exportado, usado só dentro do arquivo".
- [packages/ai-engine/src/rubric.ts](../../../packages/ai-engine/src/rubric.ts) — `PRICES` (`:176`, interno) e `judgeBatch` (`:379`, consumido por `run-bakeoff.mjs` na raiz do pacote — o ponto cego que a config precisa cobrir).
- [apps/web/package.json](../../../apps/web/package.json) — `@ai-sdk/react` (`:14`), a única dep declarada e nunca importada.
- [apps/api/src/ai/ai.service.ts](../../../apps/api/src/ai/ai.service.ts) — objeto `tools` (`:349-585`): a interface viva que o `rollDiceTool` morto contradizia.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — onde o passo novo entra, e a convenção de um passo por gate.
- [AGENTS.md](../../../AGENTS.md) — *Armadilhas do repo* (o `@scarf/scarf`), *Formatação* (por que não há linter) e a regra "roadmap não vira código" em *Padrões de código → Comentários*.
