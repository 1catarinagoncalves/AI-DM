# US-32 — Modificadores de atributo do personagem

**Épico:** Free
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** US-01 (Atributos do personagem)
**Criada em:** 2026-07-07

---

## História

> **Como** jogador,
> **quero** ver o modificador de cada atributo ao lado do valor bruto,
> **para que** eu saiba o bônus ou penalidade que ele adiciona às minhas rolagens de dado.

---

## Contexto e motivação

### O problema observado

Depois da US-01, o jogador vê os valores brutos dos atributos (ex.: Força 14, Destreza 8) na página de chat com o mestre. Mas no jogo o que importa não é o valor bruto — é o **modificador** que ele gera (+2, -1). Hoje o jogador precisa calcular de cabeça toda vez que o mestre pede uma rolagem.

### Por que a solução atual não basta

A US-01 deixou explicitamente "calcular os modificadores dos atributos" fora de escopo. Os valores brutos estão persistidos e exibidos, mas o modificador não é derivado em lugar nenhum — nem no banco, nem na interface, nem no contexto que o DM Agent recebe.

### A proposta

Derivar o modificador de cada atributo a partir do valor bruto pela regra de D&D 5e — `floor((valor - 10) / 2)` — e exibi-lo junto do valor bruto na ficha (ex.: `Força 14 (+2)`). O modificador é calculado, não armazenado: é sempre função do valor bruto.

---

## Escopo

### Dentro do escopo

- Função de cálculo do modificador a partir do valor bruto (regra 5e).
- Exibição do modificador **em destaque** com o valor bruto pequeno abaixo, no estilo das fichas oficiais (modificador grande com sinal; valor bruto secundário embaixo).
- **Vale igualmente para o sistema D&D e para o sistema Free** — mesma fórmula, mesma exibição, sem ramo de código por sistema.
- O modificador entra no contexto que o DM Agent recebe (ver US-23), para o mestre pedir rolagens com o bônus correto.

### Fora do escopo

- Modificar valores de atributo por eventos da história (segue fora, como na US-01).
- Bônus de proficiência, perícias e testes de resistência — modificadores compostos ficam para story futura.
- Rolagem automática de d20 aplicando o modificador — é responsabilidade do Game Server / tool de dados, não desta story.

---

## Regra de cálculo

Modificador = `floor((valorAtributo - 10) / 2)`, arredondando sempre para baixo.

| Valor | Mod | Valor | Mod |
|---|---|---|---|
| 1 | -5 | 12-13 | +1 |
| 2-3 | -4 | 14-15 | +2 |
| 4-5 | -3 | 16-17 | +3 |
| 6-7 | -2 | 18-19 | +4 |
| 8-9 | -1 | 20-21 | +5 |
| 10-11 | 0 | | |

Referência completa: [modificadores-atributos.md](./modificadores-atributos.md) (roll20 / SRD 5e).

---

## Critérios de aceite

- [ ] Existe uma função que recebe um valor de atributo e retorna o modificador pela fórmula `floor((valor - 10) / 2)`.
- [ ] Na página de chat com o mestre, cada atributo mostra o modificador em destaque, com sinal explícito, e o valor bruto pequeno abaixo (ex.: `-1` grande sobre `8` pequeno para Destreza; `0` sobre `10` para Constituição).
- [ ] O cálculo e a exibição são idênticos nos dois sistemas — um personagem D&D e um personagem Free com o mesmo valor bruto mostram o mesmo modificador.
- [ ] O contexto entregue ao DM Agent inclui o modificador de cada atributo, não só o valor bruto.
- [ ] O modificador **não** é gravado no banco — é derivado do valor bruto na exibição, então mudar o valor bruto muda o modificador sem migração.
- [ ] **Eval / teste de regressão:** casos de fronteira passam — `valor=1 → -5`, `8 → -1`, `10 → 0`, `11 → 0`, `15 → +2`, `20 → +5`. Um valor ímpar (15) e o par seguinte (14) retornam o mesmo modificador (+2).

---

## Notas de implementação

- Cálculo é uma linha: `Math.floor((score - 10) / 2)`. Colocar em `packages/shared` para o web, a API e o ai-engine reusarem o mesmo helper — evita três implementações divergentes.
- Formatação do sinal: `mod >= 0 ? \`+${mod}\` : \`${mod}\`` (o `-` já vem no número negativo; `0` mostra como `0`, não `+0`).
- Reaproveitar o componente que a US-01 criou para exibir os atributos abaixo do HP — só acrescentar o modificador ao lado de cada linha.
- Injetar o modificador no contexto que o DM Agent recebe (US-23 — DM ciente da ficha), para o mestre pedir rolagens com o bônus correto. O mesmo helper de `packages/shared` alimenta tanto a exibição quanto o contexto do agente.

---

## Questões em aberto

Nenhuma — escopo fechado.

---

## Referências no código

- `packages/shared` — local proposto para o helper de modificador compartilhado entre web/api/ai-engine.
- Componente de exibição de atributos criado na US-01 (abaixo do HP na página de chat) — ponto de extensão para o modificador.
- `docs/sdlc/01-requisitos/modificadores-atributos.md` — regra de cálculo e tabela de referência 5e.
