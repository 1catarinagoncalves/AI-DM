# Modificadores de atributo — tabela do SRD 2024

**Fonte:** System Reference Document 5.2 ("SRD 2024"), Wizards of the Coast LLC, obtido do
**Open5e** (`open5e/open5e-api`, tag `v2.1.0`), regras `srd-2024_the-six-abilities_ability-scores`
e `srd-2024_the-six-abilities_ability-modifiers`. Licença **CC-BY-4.0** — ver
[NOTICE-open5e.md](../../../scripts/srd/NOTICE-open5e.md).

**Versão legível por máquina:** `scripts/srd/ability-modifiers.srd-2024.json`, gerado do mesmo
texto por `pnpm srd:ingest` ([US-108](./US-108-tabela-de-modificadores-do-srd-2024.md)). Esta
página é para gente ler; o artefato é o que o teste confere. Os dois saem da mesma origem, e
divergência entre eles reprova em `packages/shared/src/ability.test.ts`.

> Esta página substituiu (06/08/2026) uma compilação de blog e vídeo que parava em 20-21 e não
> tinha procedência — era a única referência normativa por trás da regra que o jogo aplica.

---

## Regra de cálculo

Modificador = `floor((pontuação - 10) / 2)`.

O arredondamento para baixo não é escolha de implementação: o SRD 2024 traz o *callout*
**"Round Down"**, que manda arredondar para baixo em toda divisão ou multiplicação do jogo,
*"mesmo se a fração for metade ou mais"*, salvo regra que diga o contrário.

No código, a regra é uma linha em [`ability.ts`](../../../packages/shared/src/ability.ts)
(`abilityModifier`) — a tabela abaixo **não** é consultada em runtime: ela é o oráculo que
prova que a fórmula continua reproduzindo o SRD, valor a valor, de 1 a 30.

---

## Tabela de modificadores (SRD 2024)

| Pontuação | Modificador | Pontuação | Modificador |
|---|---|---|---|
| 1 | -5 | 16-17 | +3 |
| 2-3 | -4 | 18-19 | +4 |
| 4-5 | -3 | 20-21 | +5 |
| 6-7 | -2 | 22-23 | +6 |
| 8-9 | -1 | 24-25 | +7 |
| 10-11 | +0 | 26-27 | +8 |
| 12-13 | +1 | 28-29 | +9 |
| 14-15 | +2 | 30 | +10 |

São as 16 faixas do SRD, cobrindo a pontuação inteira sem buraco. As edições anteriores paravam
em +5 (pontuação 21): as faixas de 22 a 30 existem porque **monstro** chega lá.

> **Cuidado ao copiar do dataset:** o texto do Open5e usa tipografia, não ASCII — o modificador
> vem com U+2212 MINUS SIGN (`−5`) e a faixa com U+2013 EN DASH (`2–3`). `Number('−5')` devolve
> `NaN`. A tabela acima já está normalizada em ASCII.

---

## O que cada faixa de pontuação significa (SRD 2024)

| Pontuação | Significado |
|---|---|
| 1 | O mínimo a que uma pontuação normalmente chega. Efeito que a reduza a 0 explica o que acontece. |
| 2-9 | Capacidade fraca. |
| 10-11 | A média humana. |
| 12-19 | Capacidade forte. |
| 20 | O máximo de um aventureiro, salvo característica que diga o contrário. |
| 21-29 | Capacidade extraordinária. |
| 30 | O máximo absoluto. |

É esta tabela que fixa o **domínio 1–30** de `abilityModifier`: fora dele a função lança, em vez
de devolver um número plausível para um estado impossível ([US-108](./US-108-tabela-de-modificadores-do-srd-2024.md)).

**Não confundir com a faixa da ficha.** Os `min`/`max` do `System.config` (10–18 no artefato do
SRD) são decisão de **produto** — o point-buy da criação de personagem, não regra do SRD. As duas
convivem: o Zod valida 10–18 na criação, `abilityModifier` valida 1–30 no cálculo.

---

## Onde isto é usado

- `abilityModifier` / `skillModifier` / `buildSkillSheet` em `packages/shared/src/ability.ts` — o
  cálculo único, reusado pela web, pela API e pelo ai-engine.
- A ficha na página de chat mostra o modificador em destaque com a pontuação bruta embaixo
  ([US-32](./US-32-modificadores-de-atributo.md)).
- O bloco de estado do turno entrega ao mestre `Força 14 (+2)`, nunca só o valor bruto.
- Teste de perícia e de atributo resolvem o modificador **da ficha**, nunca um número dado pelo
  modelo ([US-38](./US-38-rolagens-ancoradas-na-ficha.md)).
