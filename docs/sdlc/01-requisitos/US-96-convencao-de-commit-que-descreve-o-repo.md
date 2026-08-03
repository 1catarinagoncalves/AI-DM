# US-96 — A convenção de mensagem de commit passa a descrever este repo

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma
**Criada em:** 2026-07-30

---

## História

> **Como** mantenedora do AI DM,
> **quero** que a regra de mensagem de commit escrita no `CLAUDE.md` seja a regra que o repo de fato segue,
> **para que** ela deixe de ser instrução ignorada — e um agente que a lê pare de escrever commits fora do padrão real.

---

## Contexto e motivação

### O problema observado

O `CLAUDE.md` manda, em *Regras de trabalho para o Claude Code*: *"Commits seguem Conventional Commits"*, com três exemplos (`feat(ai-engine): …`, `fix(game): …`, `chore(deps): …`).

Medido no histórico em 30/07/2026, contra o padrão `tipo(escopo)?: assunto`:

| | commits |
|---|---:|
| Total | 108 |
| Conformes a Conventional Commits | **4** (3,7%) |

Remedido em 03/08/2026, com as três categorias separadas:

| | commits | |
|---|---:|---:|
| Total | 124 | |
| Conformes a Conventional Commits | 11 | 8,9% |
| `US-NN …` | 37 | 29,8% |
| Nenhuma das duas | **76** | **61,3%** |

Uma parte segue **outra** convenção — coerente e legível, só que não a que está escrita:

```
US-89 — Export que ninguém importa para de sobreviver no repo
US-90 — README de evals com o mapa do subsistema
US-91 — Convenções de Implementação (e o bloco Backend do AGENTS.md) deixam de descrever um projeto que não é este
```

E a maior parte não segue nenhuma (`Correções CI`, `Redesign AI DM`, `Atualizações US 88`, `Update README.md`) — 61,3% na remedição acima. São os commits manuais.

### Por que isto importa mais do que parece

Não é higiene cosmética. O `CLAUDE.md` é lido por agente a cada sessão como instrução normativa. Uma regra com 3,7% de aderência ensina duas coisas erradas ao mesmo tempo: ao agente, que o padrão do repo é um que ele não vê no `git log`; à leitora, que as regras daquele arquivo são decorativas — e o custo disso não fica contido na regra de commit, contamina a autoridade do arquivo inteiro.

É exatamente o defeito que a [US-91](./US-91-auditar-convencoes-de-implementacao.md) atacou nas *Convenções de Implementação* ("*deixam de descrever um projeto que não é este*") e que a [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) atacou nos identificadores inexistentes. Mesma família, outro arquivo.

### A proposta

Escolher **uma** das duas convenções e deixar as duas metades do repo — doc e histórico — dizerem a mesma coisa. Recomendação: adotar o padrão que já é praticado (`US-NN — título`, com fallback para mudanças sem story), porque ele descreve o trabalho real deste projeto (uma story por commit, rastreável até o arquivo em `docs/sdlc/01-requisitos/`), enquanto Conventional Commits só ganharia sentido com changelog ou versionamento automático — nenhum dos quais existe aqui, nem está no roadmap da Fase 1.

### Decisão (03/08/2026)

A remedição desfez a premissa: o repo não segue *uma* outra convenção. Ele tem **dois autores com dois comportamentos**. Os `US-NN — título` são commits do agente; os 76 sem padrão (`Correções mobile`, `Atualizações prompt`, `MVP`) são commits manuais da mantenedora, que commita à mão por preferência — não por esquecimento de uma regra.

Uma convenção única, portanto, ou é ignorada pela metade humana ou impõe fricção onde ela não é desejada. A regra escrita passa a **descrever as duas metades**:

- commit de agente: `US-NN — título`, com assunto livre para mudança sem story;
- commit manual: livre, e o agente não normaliza nem sugere renomear;
- **sem gate.** O `CLAUDE.md` diz isso explicitamente, como manda o 4º critério de aceite.

Conventional Commits fica descartado (11/124, e nada no roadmap consome changelog gerado). Gate fica descartado enquanto a maioria dos commits for manual e intencionalmente livre: um gate aqui reprovaria a autora do repo. Se um dia houver mais de uma pessoa committando, ou changelog automático, a questão #2 reabre com dados novos.

---

## Escopo

### Dentro do escopo

- Decidir a convenção (ver *Questões em aberto* #1) e reescrever o bloco do `CLAUDE.md`, com exemplos tirados do `git log` real, não inventados.
- Espelhar no `AGENTS.md` se ele repetir a regra.
- Um gate leve, e só se a convenção escolhida for verificável por regex: passo no CI que valida as mensagens **do intervalo do push** (`git log <before>..<after>`), nunca o histórico inteiro.

### Fora do escopo

- **Reescrever histórico.** 108 commits, deploy contínuo a partir da `main`, um `graphify-out/` versionado que depende de SHAs. Reescrever é caro, arriscado e não compra nada.
- **commitlint + husky.** Duas dependências e um hook de git por uma regra de uma linha. O `CLAUDE.md` já manda *"não adicione dependências sem verificar se já existe algo equivalente"*, e para "a primeira linha casa com um regex" o equivalente é `grep -E`. Se a convenção escolhida for Conventional Commits **com** escopos validados contra uma lista, aí o commitlint volta à mesa — mas isso é consequência da decisão #1, não premissa.
- **Bloquear commit na máquina local** (hook `pre-commit`). A [US-80](./US-80-ci-typecheck-testes-e-evals.md) já rejeitou hook local como guard: depende de configuração por máquina e é pulável com `--no-verify`.

---

## Critérios de aceite

- [x] O `CLAUDE.md` descreve a convenção que o `git log` mostra, com pelo menos dois exemplos **copiados** do histórico (`US-89 — …`, `US-51 — …`, mais os exemplos de commit sem story).
- [x] A taxa de aderência dos commits **posteriores** a esta story é medida com o mesmo comando desta seção e registrada aqui — a linha de base é 3,7% (4/108, 30/07/2026). **Substituída pela medição de três categorias de 03/08/2026** (ver *Contexto*): a taxa Conventional deixa de ser a métrica, porque a convenção adotada não é essa. A métrica que fica é a do commit de agente — `US-NN — título` —, aferível com `git log --format=%s <sha-desta-story>..HEAD | grep -cE '^US-[0-9]+[a-z]? — .+'`.
- [x] ~~Se houver gate~~ — não há gate. Ver *Decisão*.
- [x] Se **não** houver gate: o `CLAUDE.md` diz explicitamente que a convenção não é verificada automaticamente. Regra sem gate pode existir; regra sem gate que **finge** ter gate, não.
- [x] Nenhum commit do histórico foi reescrito (`git log --format=%H | tail -1` inalterado).

---

## Notas de implementação

- **Comando da medição**, para a linha de base ser reproduzível:

  ```bash
  git log --format=%s | grep -cE '^(feat|fix|chore|docs|refactor|test|build|ci|perf|style|revert)(\([a-z0-9./-]+\))?!?: .+'
  ```

- **Se a escolha for `US-NN — título`:** o regex precisa aceitar as mudanças legítimas sem story (correção de typo, ajuste de CI, merge). Um `US-\d+[a-z]? — .+` puro reprovaria `fix(web): min-h-0 na coluna de jogo`, que é um commit bom. Prever a forma alternativa explicitamente em vez de deixar a pessoa contornar com `--no-verify`.
- **O travessão é `—` (em dash), não `-`.** Copiar do histórico; um regex com o hífen errado reprova todo commit conforme e é o tipo de gate que dura uma tarde.
- **Se a escolha for Conventional Commits:** aceitar que os 104 antigos ficam fora e que o gate só olha para frente. Dizer isso no `CLAUDE.md`, senão a próxima auditoria reabre a mesma discussão.

---

## Questões em aberto

1. ~~**Qual convenção fica?**~~ Respondida em 03/08/2026: `US-NN — título` para o agente, livre para o commit manual. Ver *Decisão*.
2. ~~**Vale gate?**~~ Não, enquanto a maioria dos commits for manual e livre por escolha. Reabre se entrar segunda pessoa no repo ou changelog automático.

---

## Referências no código

- `CLAUDE.md`, seção *Regras de trabalho para o Claude Code* — o bloco "Commits seguem Conventional Commits" e seus três exemplos.
- `AGENTS.md` — verificar se repete a regra antes de editar só um dos dois.
- [US-91](./US-91-auditar-convencoes-de-implementacao.md) e [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md) — mesmo defeito (doc normativo que descreve outro projeto), outro alvo.
