# Backlog — Combate por turno

**Objetivo:** o combate passa a ter **ordem de ação**. Hoje, mesmo que os backlogs irmãos
(classe de armadura, economia de recursos) sejam construídos inteiros, "de quem é o turno" e "que
round é este" continuam sendo o Mestre decidindo — porque isso não é uma peça de mecânica que falta
num CD ou num recurso, é a estrutura por cima de todas elas.

**Decisão de produto pendente:** a mesma dos dois irmãos — narrador permissivo vs árbitro de regra
([backlog de CA](./backlog-classe-de-armadura-e-ataque.md), [backlog de
recursos](./backlog-economia-de-recursos-do-personagem.md)). Aqui pesa o máximo possível: não é mais
um tipo de teste, é o **loop de jogo inteiro** saindo do modelo. Ver *Decisões abertas* #1.

**Criado em:** 2026-08-12, a partir da leitura de
[SirDarcanos/openfray](https://github.com/SirDarcanos/openfray) (AGPL-3.0 — ver *Referências
externas*), pedida pela mantenedora depois de perguntar como funciona a iniciativa lá.

Este documento **não é uma user story**. É a sequência de tarefas até o objetivo, com dependências
e o que já existe. Cada item vira um `US-*.md` próprio quando entrar em execução.

> **Rótulos, não números de story.** `INI-0`…`INI-5` são identificadores **internos deste
> documento**. O número real (`US-NNN`) é atribuído no dia em que a story for escrita.

---

## O estado verificado

Levantado em 12/08/2026 em `apps/api/src`, `packages/shared/src`, `packages/ai-engine/src` e
`schema.prisma`.

**1. Zero conceito de turno, round ou iniciativa no código.** Grep por `encounter`/`iniciativa`/
`initiative`/`round`/`combat` em `apps/api/src` bate em seis arquivos — todos falso positivo: o
termo real é `background` (que contém a substring `ground`, que contém `round`). Em `packages/` os
hits são o mesmo tipo de ruído, mais scripts de bake-off que usam "round" como "arredondar". Nenhum
resultado é combate de verdade.

**2. Não existe estado efêmero por-combate em lugar nenhum do schema.** `CharacterState`
([`schema.prisma:46`](../../../apps/api/prisma/schema.prisma)) guarda `hp`, `maxHp`, `attributes`,
`inventory`, `conditions`, `sceneState` — tudo **durável**, entre turnos, entre sessões. Não há
conceito de "isto vale só enquanto este combate dura e some quando ele acaba". E não há registro de
monstro nenhum: o mais perto é `Adventure.entities` (`WorldEntity`, ledger de fatos revelados,
US-75) — que é a coisa errada para isto, porque estado de combate muda a cada ação e o ledger é
para fato relativamente estável.

**3. O que já existe, e ainda não roda: GEN-9.** O [backlog do
motor](./backlog-motor-de-geracao-de-aventuras.md) já planeja, no **caminho crítico da fase 1**,
gerar 4–5 encontros por aventura, cada um povoado por papéis (`Minion` CR 1/8, `Soldier` CR 1/2,
`Brute` CR 2, do `5e_Monster_Builder.json`) orçados para **um** personagem — grupo de tamanho 1,
"escrito como 1", até a fase 4. É a fonte natural da lista de combatentes de um encontro. Mas GEN-9
é planejamento, não código: nada disto está construído.

**4. O backlog de CA já cobre metade do que combate por turno precisa, e nenhuma das duas metades
pressupõe ordem.** DEF-3 (CA do monstro) e DEF-5 (monstro ataca o personagem) dão ao ataque um
alvo e um veredito — mas "quando" o monstro ataca, hoje, seria o Mestre decidindo o momento dentro
da narração. Alvo sem ordem resolve *se* acerta; não resolve *quem age agora*.

---

## A pergunta de schema que os dois irmãos não tiveram que responder

REC e DEF, na pior hipótese, adicionam uma coluna nova (`resources Json?`, CA como `Int`) num
registro que já existe e já é durável — o personagem. Combate por turno não tem essa saída: o que
precisa guardar (quem age, em que ordem, round atual, reação já usada, ação lendária restante) só
existe **enquanto o combate dura**, e cobre tanto o personagem quanto **cada monstro do encontro**,
que hoje não tem registro nenhum fora da narração.

Duas formas — a mesma tensão piso/modelo-rico da *Decisão aberta* #4 do backlog de recursos,
aplicada a um problema mais caro:

- **Piso.** Um campo `Adventure.encounter Json?`, no precedente de `sceneState Json?` e do `arc
  Json?` proposto na [US-112](./US-112-arco-de-beats-do-que-muda.md): `null` fora de combate,
  populado ao entrar, array plano de combatentes (id, nome, iniciativa, hp atual, condições),
  apagado ao sair.
- **Modelo rico.** Tabela `Combatant` relacional, uma linha por criatura por combate, FK para
  `Adventure`. Mais caro de migrar, mais barato de consultar e testar peça por peça.

Diferente do backlog de recursos, aqui **não dá para "começar pelo piso e trocar depois" de
graça**: trocar de JSON solto para tabela relacional no meio de produção é migrar dado de combate
potencialmente em andamento, não dado de personagem em repouso.

---

## Depende de

| # | Dependência | Estado | Onde dói |
|---|---|---|---|
| **D1** | **GEN-9 — statblocks por papel** | Planejada, caminho crítico da fase 1, ainda não construída | Fonte da lista de combatentes. Sem ela, INI-2 não tem o que instanciar |
| **D2** | **Corte mínimo do backlog de CA** (DEF-0+DEF-3+DEF-4, idealmente +DEF-2+DEF-5) | Ver [backlog de CA](./backlog-classe-de-armadura-e-ataque.md) | Sem alvo e veredito de ataque, "de quem é o turno" não muda o resultado de nada — só a ordem em que o Mestre já narrava |
| **D3** | **A decisão árbitro vs narrador** | Aberta, compartilhada com os dois backlogs irmãos | Bloqueia o backlog inteiro. Aqui é a versão mais cara da mesma pergunta |
| **D4** | **Piso ou modelo rico para o estado de combate** | Aberta, própria deste backlog | Ver *A pergunta de schema* acima e INI-1 |

---

## Tarefas

**✱ INI-0 — confirmar a forma que a GEN-9/passo-5 entrega**
Antes de desenhar schema de combate, ler o que o motor de geração vai de fato produzir para
"encontro" — se já sai como lista de combatentes pronta para iniciativa (nome, HP, papel) ou é
referência de template que precisa ser instanciada na hora do combate. **Não verificado nesta
análise** — a GEN-9 foi lida por cima do backlog do motor, não a fundo. Decide se INI-2 é
encanamento ou modelagem nova.
Depende de: nada, mas trava tudo abaixo.

**INI-1 — piso ou modelo rico**
Decidir a forma de *A pergunta de schema*. Ao contrário do backlog de recursos, aqui a decisão
precisa ser tomada antes de gravar qualquer coisa em produção — trocar depois custa dado de combate
em andamento, não dado de personagem em repouso.
Depende de: INI-0.

**INI-2 — instanciar o combate: lista de combatentes ordenada**
Sortear iniciativa (1d20 + Destreza, regra padrão do SRD) para cada combatente do encontro —
personagem e monstros do GEN-9 — e gravar no formato de INI-1.
Depende de: INI-1, D1, D2.

**INI-3 — de quem é o turno agora**
Ponteiro de turno ativo, e avançá-lo. A referência
([`openfray`, `src/combat/initiative.ts`](https://github.com/SirDarcanos/openfray) — AGPL,
**reimplementar, nunca copiar**, ver *Referências externas*) mostra o desenho: ponteiro por **id**
do combatente, nunca por índice puro de array (sobrevive a reordenação); pular quem está fora da
rotação (morto — "surpreso" nem existe nesta primeira versão, ver *Decisões abertas* #3); ao
esgotar a rodada, incrementar round e voltar ao topo da ordem.
Depende de: INI-2.

**INI-4 — reação, resetada por turno**
`reactionUsed`, zerado no início do turno de quem a usa. É o único pedaço da economia de ação
(ação / ação bônus / reação) com regra de reset simples e sem julgamento — ação e ação bônus
dependem do que a criatura *escolheu* fazer, que é narrativo; reação é só sim/não por round.
Candidato a ficar fora do corte mínimo se nenhuma regra construída ainda a consome (ataque de
oportunidade, contra-feitiço).
Depende de: INI-3.

**INI-5 — concentração**
O [backlog de recursos](./backlog-economia-de-recursos-do-personagem.md) excluiu isto de propósito
— *"concentração é estado de combate, mais perto de `conditions`"*. É aqui que ela mora: decrementa
por round, cai a zero, e só faz sentido dentro de um loop de turno que já existe. Sem INI-3 não há
"início do turno" contra o qual decrementar.
Depende de: INI-3.

---

## Uma feature do openfray que este backlog não usa: ação lendária

GEN-9 orça encontros para os papéis `Minion` (CR 1/8), `Soldier` (CR 1/2) e `Brute` (CR 2) — CRs
baixos, e ação lendária em 5e é mecânica de monstro solo/chefe de CR alto, não de mook. Só vira
tarefa se a GEN-9 ganhar um papel tipo "Chefe", que a fase 1 hoje não tem. Registrado, não
descartado — mesmo destino da ação de covil, que o próprio `openfray` também adia.

---

## Corte mínimo

Para o combate ter **ordem real**: **INI-0 + INI-1 + INI-2 + INI-3** — quatro stories, nenhuma
resolve reação, concentração ou ação lendária. Só resolve **quem age agora** e **quando o round
vira**.

Fica de fora: reação (INI-4), concentração (INI-5), ação lendária e ação de covil (ver seção
acima), e qualquer noção de surpresa antes do primeiro round (*Decisões abertas* #3).

---

## O que fica de fora deste backlog

- **Resolução de dano e acerto.** É o [backlog de CA](./backlog-classe-de-armadura-e-ataque.md),
  irmão — compartilha D2.
- **Slot de magia, recurso de classe, descanso.** É o [backlog de
  recursos](./backlog-economia-de-recursos-do-personagem.md), irmão — compartilha D3.
- **Ação lendária, ação de covil.** Ver seção dedicada acima.
- **Surpresa.** Não modelada nesta primeira versão — todo combatente começa "ativo" em INI-2. Ver
  *Decisões abertas* #3.
- **Mais de um personagem na mesma iniciativa.** GEN-9 já fixa grupo de tamanho 1 até a fase 4; o
  modo de desempate `pcs-first` do `openfray` (jogadores agem antes de monstro) não se aplica
  enquanto isso.

---

## Decisões abertas

1. **Árbitro ou narrador?** Idêntica à #1 dos dois backlogs irmãos, e responder uma responde as
   três. Aqui a resposta "narrador" é a mais cara de aceitar: nenhum dos três backlogs de mecânica
   se constrói, e o combate continua sendo o Mestre decidindo a ordem dentro da prosa.
2. **Desempate de iniciativa.** Destreza (padrão SRD) é a única opção que faz sentido hoje —
   `pcs-first` não serve com 1 personagem só, e `manual` (arrastar a ordem na UI, do `openfray`) é
   feature de mesa física que este produto não tem.
3. **Existe "surpresa"?** É estado decidido *antes* da primeira rolagem de iniciativa (teste de
   Furtividade vs Percepção, normalmente) — se entrar, é tarefa nova antes de INI-2, não um campo
   dentro de INI-3.
4. **Piso ou modelo rico (INI-1).** Mesma tensão da *Decisão aberta* #4 do backlog de recursos, sem
   a saída fácil de "decide depois" que lá existia — ver *A pergunta de schema*.

---

## Referências no código

- [`apps/api/prisma/schema.prisma:46`](../../../apps/api/prisma/schema.prisma) — `CharacterState`,
  onde confirma-se que não há estado efêmero de combate.
- [backlog-motor-de-geracao-de-aventuras.md](./backlog-motor-de-geracao-de-aventuras.md) — **GEN-9**
  (statblocks por papel, caminho crítico da fase 1), D1 deste backlog; o passo 5 da *Ordem de
  geração* é onde "encontros" nasce.
- [backlog-classe-de-armadura-e-ataque.md](./backlog-classe-de-armadura-e-ataque.md) — DEF-3/DEF-5,
  D2 deste backlog; a mesma D3 (árbitro vs narrador).
- [backlog-economia-de-recursos-do-personagem.md](./backlog-economia-de-recursos-do-personagem.md) —
  irmão; exclui concentração de propósito, ela entra aqui (INI-5); mesma decisão árbitro vs
  narrador; mesma tensão piso/modelo-rico na *Decisão aberta* #4 de lá, herdada em INI-1.
- [US-112-arco-de-beats-do-que-muda.md](./US-112-arco-de-beats-do-que-muda.md) — `Adventure.arc
  Json?`, o precedente citado no piso de *A pergunta de schema*.
- [backlog-mapa-em-tempo-real.md](./backlog-mapa-em-tempo-real.md) — irmão mais distante: mesma
  origem de referência (VTT), mesma fase 4, mas sem nome no roadmap — ao contrário deste backlog,
  que a fase 4 já nomeia via "turnos e iniciativa" (`AGENTS.md:18`).

### Referências externas

Lida por README, metadados da API do GitHub e leitura direta do arquivo-fonte
`src/combat/initiative.ts` (permitido sob AGPL — **ler para entender, nunca copiar**; ver
[registro de repositórios](../referencia/repositorios-de-referencia.md)). Nenhuma decisão aqui se
apoia na autoridade da referência: o que sustenta cada item é a verificação no código deste repo,
em *O estado verificado*.

| Repositório | Licença | Rendeu |
|---|---|---|
| [SirDarcanos/openfray](https://github.com/SirDarcanos/openfray) | **AGPL-3.0** | o desenho do ponteiro de turno por id (INI-3), o tick de round e o decremento de concentração no início do turno (INI-5), o alerta de que ação lendária não serve ao orçamento atual da GEN-9. Nada do TypeScript atravessa — só a estrutura, reimplementada do zero se e quando este backlog entrar em execução |
