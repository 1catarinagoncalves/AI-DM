# Como ancorar uma assertiva que grepa o system prompt

Convenção anti-drift (US-72 → US-77). Vale para **todo** `expect(prompt).toMatch(...)`
em `evals/cases/*` e em `packages/ai-engine/src/prompts/dm-system.test.ts`.

O prompt (`packages/ai-engine/src/prompts/dm-system.ts`) é reescrito quase toda semana.
Assertiva ancorada em prosa autoral fica vermelha sem nenhuma regressão de comportamento —
já aconteceu duas vezes (`e0a6817` reescreveu `sanitizer will DELETE` → `DELETES`; a US-71
renomeou o cabeçalho `SPATIAL & SCENE CONTINUITY`). Um eval vermelho tem de significar
"o contrato quebrou", não "alguém trocou um adjetivo".

## Âncoras permitidas

- **Nome de tool** (`rollDice`, `getSpell`, `updateScene`) — o código possui a string.
- **Dado que o próprio teste injetou** no fixture (`Level: 3`, `Divindade: Solariel (…)`,
  `- Chama Sagrada (truque)`, `«Praça da vila ao anoitecer»`).
- **Conceito com regex tolerante**: os DOIS lados do contrato presos na mesma frase com
  `[^.]{0,N}` entre eles. Ex.: `/saniti[sz]er\b[^.]{0,40}(delete|remove)/i`.

**Condição de unicidade — vale para as três.** A âncora só serve se o token for único no
prompt **RENDERIZADO** daquele fixture. `rollDice` aparece em 5 seções, `updateScene` em 3,
e `feminino` é ao mesmo tempo dado de fixture e palavra da regra de concordância. Sem checar
unicidade, "nome de tool é âncora estável" leva direto ao falso verde.

## Âncoras proibidas

- Conjugação e adjetivo (`will DELETE`, `offer and narrate`).
- Exemplo em pt-BR dentro da regra (`quero rolar`, `rolo Percepção`).
- Texto decorativo dentro do parêntese de um cabeçalho
  (`## Class features (read-only — … NEVER resolve …)`).
- Frase longa copiada inteira do prompt.

## Cabeçalho de seção: duas perguntas de triagem

Não existe regra "cabeçalho é/não é âncora". O critério é **quem possui a string**:

1. **O cabeçalho é referenciado por nome por outra parte do sistema?**
   Sim → é **contrato**, ancore nele. Ex.: `## Cena atual` e `## Entidades do mundo` são
   citados em prosa inglesa no system prompt e na `description` de `recordEntity`.
   Desde a US-84 esse nome vem de uma constante (`SCENE_BLOCK`, `ENTITIES_BLOCK`,
   `INVENTORY_BLOCK`, `SKILLS_LINE` em `dm-system.ts`) — o acoplamento **de nome** morreu,
   mas o cabeçalho continua sendo o identificador da seção e continua sendo a âncora certa.
2. Não → **existe no corpo da seção um token que o código possui e que não aparece em
   nenhuma outra seção?**
   Sim → ancore nele. Não → **mantenha o cabeçalho**: é o único identificador único que a
   seção tem. Ex.: `## ⚠️ TURN RESOLUTION ORDER` fica, porque `rollDice` (o candidato óbvio)
   também aparece em 5 outras seções — a assertiva sobreviveria à deleção da seção inteira.

Cabeçalho renomeado = vermelho **visível**, uma linha de regex para consertar. Âncora
tolerante demais = verde **invisível** escondendo uma seção deletada. Entre ruído barato e
silêncio caro, escolha ruído.

## Constante de prompt: identificador SIM, conteúdo de regra NÃO (US-84)

A US-77 rejeitou "exportar os contratos do prompt como constantes e os testes casarem a
constante": o eval passaria a testar a si mesmo — deletar a regra deletaria também a
assertiva, e nada ficaria vermelho. Essa rejeição continua valendo **para o conteúdo da
regra**.

A US-84 extraiu constantes para outra coisa: o **identificador escrito por dois emissores**.
`## Cena atual` é emitido por `buildTurnStateBlock` (camada 3, na mensagem) e citado pela
prosa de `buildDmSystemPrompt` (camada 2, cacheada) — e `Entidades do mundo` ainda por um
terceiro, a `description` de `recordEntity` em `apps/api`. Duas grafias manuais do mesmo
nome, em pacotes diferentes: renomear uma ponta deixava o prompt mandando o modelo confiar
num bloco fantasma, sem quebrar teste, `typecheck` nem log.

A linha divisória:

| | US-77 (proibido) | US-84 (correto) |
|---|---|---|
| O que a constante guarda | o TEXTO da regra | o NOME do bloco |
| Quantos escritores | um | dois ou mais, em camadas/pacotes diferentes |
| Se o alvo sumir | a assertiva some junto → falso verde | o teste de conteúdo continua o de sempre |

Regra prática: **um escritor com muitos leitores é interface — ancore, não extraia.**
Só o segundo *escritor* justifica a constante. Por isso `## Estado atual` ficou de fora
(ninguém o cita) e os cabeçalhos decorativos (`## ⚠️ TURN RESOLUTION ORDER`) também.

## Assertiva de existência de regra ≠ assertiva de presença de seção

Nome de tool é âncora estável para **"o prompt manda fazer X"**. Para **"a seção Y existe"**
é armadilha: o prompt repete as tools de propósito em várias seções.

## Assertiva negativa (`not.toMatch`) tem regra própria

Ancore em **literal fechado, nunca em conceito tolerante**. O risco inverte: regex tolerante
casa mais fácil, logo produz **falso vermelho** (`not.toMatch(/Elara/)` só é seguro porque é
literal). O lado a provar também é o simétrico: adicionar a string proibida fica vermelho;
reescrever a prosa em volta fica verde.

## Método de prova — quatro execuções, não duas

Antes de commitar uma reancoragem, rode um script descartável que carrega
`buildDmSystemPrompt` do **`dist`** (`pnpm --filter './packages/*' build` antes — os eval
cases importam `@ai-dm/ai-engine` do dist, não do src) e monta três textos:

| | o que é | resultado esperado |
|---|---|---|
| **base** | prompt como está | ✅ passa |
| **reescrito** | `.replace()` simulando a reescrita da frase **e do cabeçalho** | ✅ passa |
| **removido** | filtro que apaga a linha de contrato | ❌ **falha** |

Rode as regex **escolhida E rejeitada** nos três textos — a quarta execução é o
**controle negativo**. A prova dos dois lados mostra que a regex escolhida funciona; não
mostra que ela precisava ser aquela. Sem o controle, a próxima pessoa "simplifica" o
endurecimento de volta porque nada registra o que ele comprava.

Exemplo trabalhado (`dm-system.test.ts` — regra de concordância de gênero):

| Regex | base | reescrito | removido |
|---|---|---|---|
| escolhida: `/gender[^.]{0,40}"feminino"/i` | ✅ | ✅ | ❌ (correto) |
| rejeitada: `/gender[^.]{0,40}feminino/i` | ✅ | ✅ | ⚠️ **passa** — falso verde |

As duas são indistinguíveis em *base* e *reescrito*. O que as separa é um **marcador
sintático**: as aspas. Sem elas a regex casa `- Gender: ${characterGender}` da ficha
(`dm-system.ts:365`), que o fixture injeta, e a assertiva passa a provar que o personagem
tem gênero em vez de provar que a regra existe.

A reescrita simulada **tem de mexer no cabeçalho também**, senão a prova não cobre o caso
que motivou a US-71.
