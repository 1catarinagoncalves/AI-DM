# Backlog — Economia de recursos do personagem

**Objetivo:** o personagem passa a **gastar e recuperar** o que a ficha diz que ele tem — slot de
magia, recurso de classe (Ki, pontos de feitiçaria) e descanso — em vez de a ficha listar
capacidades que nada consome.

**Decisão de produto pendente:** este backlog transforma o Mestre de **narrador permissivo** em
**árbitro de regra** num eixo em que ele hoje não arbitra. O jogador vai sentir. Ver
*Decisões abertas* #1 — nada aqui deve ser construído antes dessa decisão.

**Criado em:** 2026-08-12
**Atualizado em:** 2026-08-12 (mesmo dia) — a triagem do `katherineberton/spell-slot-tracker`
corrigiu três coisas: a recarga deixa de ser enum binário (REC-6), o upcasting entra no REC-3, e o
REC-5 ganha a unidade de **dia de jogo contável**. Ver *A segunda referência*.
**Atualizado em:** 2026-08-12 (mesmo dia, segunda vez) — o `blakewatson/minimal-character-sheet`
acrescentou o **piso** de cada item: contador genérico em vez de recurso modelado (REC-4) e slot
plano com a regra fora do dado (REC-2). Ver *A terceira referência*.

Este documento **não é uma user story**. É a sequência de tarefas até o objetivo, com
dependências e o que já existe. Cada item vira um `US-*.md` próprio quando entrar em execução.

> **Rótulos, não números de story.** `REC-1`…`REC-6` são identificadores **internos deste
> documento**, para as dependências se referenciarem. O número real (`US-NNN`) é atribuído **no
> dia em que a story for escrita**. Enquanto isso, `REC-N` não corresponde a story nenhuma.

---

## Por que este backlog existe

A lacuna foi levantada ao triar [vietts/dm-dashboard-oss](https://github.com/vietts/dm-dashboard-oss)
(Next.js + Supabase, MIT, sem LLM) — painel de DM humano cuja metade voltada ao jogador é
justamente a mecânica que o AI DM não tem: preparação de magia com controle de slot, recursos de
classe e sistema de descanso com recuperação automática. Metade DM daquele repo (bestiário,
encounter builder, árvore narrativa) **não** interessa: é trabalho que aqui é do modelo.

A referência é **catálogo de escopo, não fonte de código**. Nada de lá é copiado; o que ela
oferece é a lista do que falta, no stack certo.

Verificado em 12/08/2026 (`packages/shared/src`, `packages/ai-engine/src`, `apps/api/src`,
`schema.prisma`):

| Peça | Estado | Evidência |
|---|---|---|
| Slot de magia | **ausente por decisão escrita** | [`system.ts:51`](../../../packages/shared/src/types/system.ts) — *"Sem slots/preparação/componentes (motor de spellcasting fica fora)"*; [`dm-system.ts:289`](../../../packages/ai-engine/src/prompts/dm-system.ts) diz ao modelo *"You do NOT track spell slots"*; a `description` do `getSpell` repete |
| Recurso de classe | **ausente**, e o schema não tem onde | `SystemClassFeatureSchema` — *"Awareness apenas — sem usos/custo/mecânica"*. Zero ocorrência de `ki`/`sorcery` no código |
| Descanso curto/longo | **ausente** | Zero ocorrência. Há `updateCharacterHp` (cura arbitrária), não recuperação regida por regra |

Não é esquecimento: é uma camada adiada de propósito, três vezes, por comentário no código.
Este backlog é a camada.

### A segunda referência

[katherineberton/spell-slot-tracker](https://github.com/katherineberton/spell-slot-tracker) —
Flask/SQLAlchemy/Postgres + React, **sem licença** (todos os direitos reservados), último push em
**julho de 2022**, escopo de projeto de bootcamp. **Nada dali é copiável nem seria copiado**: a
regra que ele implementa é SRD, que este repo já fixa via Open5e ([ADR 004](../../adr/004-origem-do-dado-de-sistema.md)).

Serve como **contraexemplo útil**: ele implementou a economia inteira e por isso mostra onde a
primeira versão deste backlog estava estreita. Três correções vieram dali, e estão marcadas
`(2ª referência)` nos itens.

### A terceira referência

[blakewatson/minimal-character-sheet](https://github.com/blakewatson/minimal-character-sheet) —
Vue 3 + PHP/SQLite, **MIT**, 434 commits, último push **11/08/2026**, em produção. A referência
mais viva do lote, e deliberadamente **mínima** — o adjetivo que interessa num projeto onde a
ficha vira prompt e cada campo custa token todo turno.

Ela não corrige os itens: dá o **piso** de cada um. Onde a 2ª referência mostrou que o modelo
precisava ser mais rico, esta mostra até onde dá para ser pobre e ainda servir. As duas leituras
estão nos itens como alternativa declarada, marcadas `(3ª referência)` — a escolha entre piso e
modelo rico é a *Decisão aberta* #4, não uma conclusão deste documento.

---

## O achado que muda o custo

O artefato do SRD **não tem** tabela de slot. Mas a origem tem, e o `ingest` a joga fora numa
linha — [`ingest.mjs:250`](../../../scripts/srd/ingest.mjs):

```js
const isSpellEngine = (f) => /_(spellcasting|pact-magic)$/.test(f.pk) // conjuração é a US-42 (classSpells)
```

As features `<classe>_spellcasting` e `<classe>_pact-magic` **existem no dataset** e são
descartadas de propósito, porque a US-42 tratou magia como awareness. É nelas que a progressão de
conjuração vive.

Consequência para o planejamento: slot **não** é "voltar ao pipeline da US-47 e re-ingerir tudo"
(o custo que a dependência D2 do [backlog do Lazy GM](./backlog-aventuras-autorais-lazygm.md)
descreve). É parar de filtrar uma coisa e parsear a tabela dela. E há molde pronto: o `ingest` já
extrai tabela markdown de dentro de um `desc` em `parseStartingKit` (US-51), inclusive com
`PDF_SPLITS` para palavra quebrada na extração do PDF.

**Armadilha conhecida, no mesmo arquivo:** `isNoise = (f) => norm(f.fields.desc) === '[Column data]'`
— linhas de coluna de tabela chegam como entradas próprias e já são filtradas como ruído. A tabela
de slot provavelmente chega decomposta assim.

**Nuance sobre nível.** O `ingest` **já lê** `featureItems[].fields.level` (`ingest.mjs:248`,
`filter((i) => i.fields.level === 1)`). O que é plano é o **artefato**, não a origem: o nível é
lido, usado como filtro e descartado na gravação. Isso não resolve a D2 do backlog irmão — não
verifiquei se a progressão completa de todos os domínios está lá — mas restringe o problema.

---

## Depende de

| # | Dependência | Estado | Onde dói |
|---|---|---|---|
| **D1** | **Progressão de nível** | `Character.level` é `Int @default(1)` e nada no repo o incrementa (mesma D1 do backlog do Lazy GM) | Slot e recurso escalam com nível. **Não bloqueia o corte mínimo**: nível 1 é quantidade fixa e conhecida |
| **D2** | **Dado de progressão no artefato** | Ver *O achado* acima: para slot, restrito a um filtro + parser. Para feature acima do nível 1, aberto | Bloqueia REC-4 por inteiro |
| **D3** | **Orçamento de tools** | 6 tools hoje (`AGENTS.md` → *Tools disponíveis*). Cada `description` vai ao modelo **todo turno** | Três tools novas seriam +50% de superfície no caminho quente. Ver *Decisões abertas* #2 |

---

## Tarefas

**REC-1 — a tabela de conjuração deixa de ser descartada no ingest**
Remover o descarte de `<classe>_spellcasting` / `<classe>_pact-magic` **para fins de progressão**
(elas seguem fora de `classFeatures`, que é awareness e continua sendo). Parsear a tabela do
`desc` no molde de `parseStartingKit`; gravar campo novo no artefato. Idempotência byte-a-byte é
critério da US-47 — o campo entra ordenado e estável.
No corte mínimo, só a linha de nível 1.
Depende de: nada.

**REC-2 — o estado do personagem guarda o que foi gasto**
`CharacterState` ([`schema.prisma:46`](../../../apps/api/prisma/schema.prisma)) tem `hp`, `maxHp`,
`attributes`, `inventory`, `conditions`, `sceneState`. Ganha **uma** coluna `resources Json?`, no
precedente do `sceneState Json?` — e **uma só**, cobrindo slot e pool de classe juntos, porque
REC-4 precisa da mesma forma e duas colunas para a mesma economia é dívida no dia 1.
Migração na Neon por `migrate deploy` (`pnpm db:migrate` falha ali com P1017/shadow DB —
`AGENTS.md` → *Armadilhas*).

**O piso, se o modelo rico não se pagar *(3ª referência)*.** A alternativa mínima é guardar só o
estado, sem regra nenhuma no dado:

```js
lvl1Spells: { slots: 0, expended: 0 },   // ... até lvl9
```

Nove campos irmãos, planos. A regra de recarga fica **fora do dado** — em código ou no prompt.
Custa quase nada e serve o REC-3 inteiro; o preço é que a recuperação arcana e a conversão de
pontos de feitiçaria viram lógica escrita à mão em vez de dado declarado, e cada classe nova mexe
em código. Decisão aberta #4.
Depende de: REC-1.

**REC-3 — gastar passa por tool, como todo o resto do estado**
Mudança de estado viaja por tool call ([`narration.ts:67`](../../../packages/shared/src/narration.ts)).
Uma tool para a economia inteira, não uma por recurso (D3).
Muda também o **contrato do `getSpell`**: hoje a `description` promete ao modelo
*"does NOT spend slots, roll damage/healing, or track preparation"*. Essa promessa deixa de ser
verdadeira e o texto muda com ela.
⚠ `getSpell` é **âncora de eval** — ver [`evals/PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md).
Alterar a `description` sem reancorar quebra o guard.

**Upcasting entra aqui *(2ª referência)*.** A primeira versão deste item assumia "gasta slot do
nível da magia", e isso é falso em 5e: conjurar uma magia de 1º nível com slot de 2º é escolha
comum e legítima. Logo, **quem escolhe o nível do slot é o Mestre, não a tool** — o parâmetro de
nível é explícito na chamada, e a tool valida disponibilidade em vez de inferir. Sem isso o
jogador perde uma decisão tática que a ficha promete.
Fora do escopo do REC-3: o **efeito** do upcasting (dano/alvo extra por nível acima). `getSpell`
é awareness e continua sendo — gastar o slot certo não é resolver o efeito dele.
Depende de: REC-2.

**REC-4 — recursos de classe (Ki, pontos de feitiçaria)**
Mais caro que slot por dois motivos verificados: `SystemClassFeatureSchema` **não tem** campo de
uso/custo/recarga (*"Awareness apenas"*), e Ki e pontos de feitiçaria são features de nível 2–3 —
o filtro `lvl1` do ingest as descarta inteiras. Precisa de D1 **e** de D2.
Registrado também que o `seed.ts` já deixa Clérigo, Feiticeiro e Bruxo de fora das features de
nível 1 por dependerem de subclasse, que a Fase 1 não escolhe.
**Fora do corte mínimo.**

**Há uma versão barata, e ela quase não custa nada *(3ª referência)*.** O
`minimal-character-sheet` **não modela Ki nem pontos de feitiçaria**. Dá ao jogador um contador
genérico:

```js
trackableFields: [],  // { name, used, max, notes }
```

A ferramenta madura resolveu "recursos de classe" **não modelando recurso de classe nenhum**. E
isso casa com a filosofia que este repo já usa em todo lado: o modelo não precisa que o sistema
*entenda* Ki — precisa saber que existe um pote chamado Ki, com 5 de teto e 2 gastos. É o mesmo
contrato de awareness do `SystemClassFeature` e do `getSpell`.

O que a versão barata **não** resolve: de onde sai o teto (continua sendo D1+D2, ou vem do
jogador na criação) e a recarga não-trivial do mago e do feiticeiro (REC-6). Mas ela desacopla
REC-4 do artefato do SRD — e um REC-4 que só depende de o jogador declarar seus potes **sai do
"fora do corte mínimo"**.
Depende de: REC-2. (Versão completa: D1, D2, REC-2.)

**REC-5 — descanso curto e longo**
É o **integrador**: restaura o que REC-2 e REC-4 controlam. Construído antes deles, não tem o que
restaurar.
Duas costuras próprias: **dado de vida** (o `CharacterState` não tem — descanso curto em 5e gasta
dado de vida, então ou entra aqui ou o descanso curto fica só recarregando pool) e **tempo**.

**O tempo precisa de unidade contável, não de rótulo *(2ª referência)*.** A primeira versão deste
item dizia só que "descanso avança o relógio da ficção, hoje em `sceneState.periodo`". O problema
é mais duro: `periodo` é **texto livre** escrito pelo `updateScene` (`manhã`/`tarde`/`noite`), e
texto livre não delimita *"uma vez por dia"* — que é como 5e conta descanso longo e recuperação
arcana. Falta a unidade, não o rótulo.
Mínimo que resolve: um contador monotônico de **dia de jogo** no estado, incrementado pelo
descanso longo. Não precisa de calendário nem de hora; precisa de um número que só cresce e
contra o qual um "uma vez por dia" se verifica. `periodo` continua sendo prosa para a narração.
No corte mínimo: **só descanso longo**, restaurando slot, e o contador de dia junto — sem ele o
próprio "uma vez por dia" do descanso longo não é verificável.
Depende de: REC-2 (mínimo), REC-4 (completo).

**REC-6 — a recarga é por-recurso, e não cabe num enum de dois valores**
Pacto mágico do bruxo recarrega em descanso **curto**; a maioria recarrega em **longo**. Foi assim
que este item nasceu, propondo `recarga: 'curto' | 'longo'`.

***(2ª referência)* — esse enum já é estreito.** O `spell-slot-tracker` implementou a economia
inteira e expõe pelo menos **quatro** formas distintas:

| Forma | Quem | Por que não cabe no enum |
|---|---|---|
| descanso longo | maioria das classes | — |
| descanso curto | pacto do bruxo | o enum cobre |
| **recuperação arcana** | mago | recarrega slot em descanso **curto**, mas com **pool próprio limitado**, ele mesmo recarregado uma vez por descanso longo |
| **pontos de feitiçaria** | feiticeiro | **conversão nos dois sentidos** entre pool e slot |

A do mago é a que quebra: não é "recarrega em X", é **um recurso que recarrega outro**, com teto
próprio e sua própria recarga. A do feiticeiro é pior ainda — troca bidirecional, não recarga.

Consequência: o modelo do REC-2 precisa de recurso com **teto, gasto e regra de recarga própria**,
onde a regra pode referenciar **outro recurso** — não de um campo enum. É mais caro no dia 1 e
muito mais barato que a migração depois.
**Decidir em REC-2, não depois.** Bruxo entra no corte mínimo se o modelo nascer assim; mago e
feiticeiro seguem em REC-4 de qualquer forma (features de nível 2–3, travadas em D1/D2).
Depende de: REC-2.

---

## Corte mínimo

Para um conjurador de **nível 1** gastar slot e recuperá-lo: **REC-1 (só a linha de nível 1) +
REC-2 + REC-3 (com upcasting) + REC-5 (só descanso longo, com contador de dia)** — quatro stories,
mais a decisão do REC-6 embutida no REC-2.

Fica de fora: recurso de classe (REC-4, travado em D1/D2), descanso curto, dado de vida, e
progressão acima do nível 1.

Roda ponta a ponta e responde a pergunta que importa antes de o resto ser construído: **um Mestre
que pode negar uma conjuração melhora ou piora a partida?**

---

## O que fica de fora deste backlog

- **Classe de armadura.** Também ausente do repo (verificado 12/08/2026: um único hit em fixture
  de teste, e `CharacterState` não a tem). É irmã destas três — a mesma camada de mecânica que
  as US-108…111 deixaram pela metade, dando alvo ao d20 em tudo **menos** no ataque. Fica fora
  porque não é *recurso que se gasta e recupera*, que é o eixo deste documento. Backlog próprio.
- **Concentração, componentes, preparação.** O `dm-system.ts:289` lista os quatro juntos; só o
  slot entra aqui. Preparação é escolha diária (outro loop); concentração é estado de combate (mais
  perto de `conditions`) e entra no
  [backlog-combate-por-turno.md](./backlog-combate-por-turno.md) (INI-5) — só faz sentido dentro de
  um loop de turno, que é do outro backlog.
- **Dano e cura de magia.** `getSpell` é awareness e continua sendo: gastar o slot não é resolver
  o efeito. Motor de efeito é camada acima desta.
- **Progressão de nível.** É a D1, backlog próprio, compartilhado com o do Lazy GM.

---

## Decisões abertas

1. **Árbitro ou narrador?** Hoje o Mestre nunca nega uma conjuração — magia é awareness pura. Com
   slot real ele passa a poder responder *"você não tem mais slot de 1º nível"*. Isso é mudança de
   produto, não de implementação: aproxima de RPG de mesa e afasta de narrativa fluida. **Decidir
   antes do REC-1** — se a resposta for "narrador", este backlog inteiro não se constrói.
2. **Uma tool ou três?** Uma tool com discriminador (`tipo`) mantém a superfície do prompt em 7;
   três tools específicas são mais claras para o modelo e custam +50% de `description` em todo
   turno. O precedente da casa é a tool genérica (`updateInventory` cobre adicionar e remover).
3. **O modelo vai chamar a tool?** É o mesmo problema de disciplina que já mordeu duas vezes:
   `updateScene` ignorada em **9 de 24 viagens** (US-71), e a rede da
   [US-115](./US-115-reconciliacao-de-entidades-pos-turno.md) existe porque `recordEntity` tem o
   mesmo risco. Aqui é pior: um slot não gasto é **vantagem silenciosa para o jogador**, que
   ninguém reclama e o log não acusa. Provavelmente precisa de um detector determinístico —
   narração descreve conjuração e o turno não chamou a tool — no molde do `guardrails.ts`.
   **Medir antes de construir a rede**, como a US-115 faz.
4. **Piso ou modelo rico?** É a decisão de modelagem mais pesada do backlog, e as duas
   referências externas puxam para lados opostos — o que é o valor delas, não um problema.
   - A *(2ª referência)* encareceu a resposta: recurso com teto, gasto e **regra de recarga que
     pode referenciar outro recurso** (recuperação arcana recarrega slot; pontos de feitiçaria
     convertem nos dois sentidos). Regra vira **dado declarado**; classe nova é uma linha.
   - A *(3ª referência)* mostra o piso funcionando em produção: slots planos, contador genérico,
     **regra fora do dado**. Barato hoje; classe nova mexe em código.

   Não dá para adiar: o REC-2 grava a coluna, e trocar depois é migração de dado de jogo em
   partida em andamento. **Recomendação:** começar pelo piso e subir se o REC-6 doer — porque o
   corte mínimo é nível 1, onde nenhuma das recargas exóticas existe ainda.

---

## Referências no código

- [`scripts/srd/ingest.mjs`](../../../scripts/srd/ingest.mjs) — `:248` o filtro de nível que já lê
  `featureItems[].fields.level`; `:250` `isSpellEngine`, a linha que descarta a tabela de
  conjuração; `isNoise` (`[Column data]`), a armadilha da tabela decomposta; `parseStartingKit`, o
  molde de parser de tabela markdown dentro de `desc`.
- [`packages/shared/src/types/system.ts:51`](../../../packages/shared/src/types/system.ts) —
  `SystemSpellSchema` e o comentário que põe slot fora; `SystemClassFeatureSchema` e o
  *"sem usos/custo/mecânica"* que bloqueia REC-4.
- [`apps/api/prisma/schema.prisma:46`](../../../apps/api/prisma/schema.prisma) — `CharacterState`,
  onde a coluna `resources` entra; `sceneState Json?` é o precedente.
- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — o objeto `tools`
  (`:349-585`) e o orçamento do D3; `getSpell` e a `description` que REC-3 muda.
- [`packages/ai-engine/src/prompts/dm-system.ts:289`](../../../packages/ai-engine/src/prompts/dm-system.ts) —
  a promessa ao modelo de que ele NÃO controla slot; muda com o REC-3.
- [`packages/ai-engine/src/guardrails.ts`](../../../packages/ai-engine/src/guardrails.ts) — casa do
  detector da *Decisão aberta* #3, se ele for necessário.
- [`evals/PROMPT-ANCHORS.md`](../../../evals/PROMPT-ANCHORS.md) — por que mexer na `description` do
  `getSpell` não é edição de texto solta.
- [backlog-aventuras-autorais-lazygm.md](./backlog-aventuras-autorais-lazygm.md) — D1 e D2 são
  compartilhadas; a nuance sobre `level` no ingest refina o que aquele documento afirma sobre o
  artefato.

### Referências externas e o que cada uma autorizou

Ambas foram lidas por README e metadados da API do GitHub — **código não lido, não executado, não
auditado**. Nenhuma decisão deste backlog se apoia na autoridade delas: o que sustenta cada item é
a verificação no código deste repo, na tabela de *Por que este backlog existe* e em *O achado*.

| Repositório | Licença | Rendeu |
|---|---|---|
| [vietts/dm-dashboard-oss](https://github.com/vietts/dm-dashboard-oss) | MIT | a lista das três lacunas — o escopo deste backlog |
| [katherineberton/spell-slot-tracker](https://github.com/katherineberton/spell-slot-tracker) | **sem licença** | as três correções: recarga não-binária (REC-6), upcasting (REC-3), dia contável (REC-5) |
| [blakewatson/minimal-character-sheet](https://github.com/blakewatson/minimal-character-sheet) | MIT | o **piso**: slot plano com regra fora do dado (REC-2) e contador genérico em vez de recurso modelado (REC-4). Puxa na direção oposta à 2ª referência — a tensão está na *Decisão aberta* #4 |
