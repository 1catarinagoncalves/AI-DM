# US-159 — Orçamento de encontro do LGMRD (Lazy Encounter Benchmark) para um personagem

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-145](./US-145-sync-lgmrd-notice.md) (`5e_Monster_Builder.json` baixado pelo sync)
**Relacionado:** [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) (consumidor — verificação 3 do gate) · [US-152](./US-152-statblocks-papel-orcamento.md) (consumidor — escolhe statblocks dentro deste orçamento) · [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) (a régua irmã, mas de **outro** dado — CD de teste de habilidade, não orçamento de encontro; ver a nota que aponta pra cá em *Fora do escopo* de lá) · [Backlog — Motor de geração de aventuras one-shot §GEN-9½](./backlog-motor-de-geracao-de-aventuras.md) (esta story, rótulo no backlog; corrigido em 17/08/2026 — GEN-9/GEN-7 citavam US-111 por engano)
**Criada em:** 2026-08-17

---

## História

> **Como** mantenedora,
> **quero** uma função que diga, para um personagem de um dado nível, qual soma de Challenge Rating (CR) de monstros já é "potencialmente letal" — usando o *Lazy Encounter Benchmark* do próprio `5e_Monster_Builder.json`,
> **para que** [US-152](./US-152-statblocks-papel-orcamento.md) tenha contra o quê escolher statblocks e [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) tenha contra o quê verificar o encontro gerado.

---

## Contexto e motivação

### O problema observado

[US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) e [US-152](./US-152-statblocks-papel-orcamento.md) citam "a régua de dificuldade do SRD 2024" e apontam para [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) — mas US-111 é a escala de **Classe de Dificuldade de teste de habilidade** (`Very easy` 5 … `Nearly impossible` 30, artefato `d20-tests.srd-2024.json`). Compara o total de um d20 contra um alvo; não tem nada a ver com quantos monstros um personagem aguenta num combate. É um dado diferente, e o repo confirma o vazio: nenhum artefato ingerido (`Rule.json` do pipeline `scripts/srd`, nem `d20-tests.mjs`) contém uma tabela de orçamento de encontro (XP threshold por nível, ao estilo *Easy/Medium/Hard/Deadly* do DMG). A citação errada estava também no backlog original (§GEN-9), corrigida em 17/08/2026 junto com a abertura desta story.

### Por que a solução atual não basta

Sem esta story, [US-152](./US-152-statblocks-papel-orcamento.md) não tem contra o que calibrar quantos Minion/Soldier/Brute povoam um encontro, e [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) não tem contra o que verificar "o orçamento cabe em um personagem" — a verificação 3 do gate existiria em texto, sem dado, exatamente o problema que a US-150 evita para as outras três verificações.

### A proposta

Não é preciso ingerir uma tabela nova de XP. O `5e_Monster_Builder.json` — já baixado pela [US-145](./US-145-sync-lgmrd-notice.md), já a fonte dos statblocks por papel da [US-152](./US-152-statblocks-papel-orcamento.md) — traz sua própria régua pronta, a seção **"The Lazy Encounter Benchmark"**: uma fórmula pequena, não uma tabela por nível.

> **An encounter might be deadly if the sum total of monster challenge ratings is greater than 1/4 of the sum total of character levels, for characters of 1st to 4th level; or greater than 1/2 of the sum total of character levels, for characters of 5th level or higher.**

E um teto complementar para monstro único (mesma seção, subseção *"The CR Cap for a Single Monster"*):

> **A single monster might be deadly if their challenge rating is equal to or higher than the average level of the characters, or 1.5 times the average level of the characters if the characters are 5th level or higher.**

Para **um** personagem (grupo = 1, mesma decisão da US-152), "soma de níveis" e "nível médio" colapsam no nível do próprio personagem — não há soma a fazer.

---

## Escopo

### Dentro do escopo

- **Extrair a seção "The Lazy Encounter Benchmark" de `5e_Monster_Builder.json`** para um derivado committed, no molde de [`extract-tables.mjs`](../../../scripts/lazygm/extract-tables.mjs) (US-147): `_data/` bruto é gitignored (US-145) e não existe em produção (CI/Render nunca rodam `lazygm:sync`); sem derivado committed, o cálculo quebra fora do ambiente da mantenedora.
- **Duas funções puras**, para um personagem de nível `L`:
  - `encounterDeadlyThreshold(level)` → `Math.floor(L / 4)` se `L <= 4`, senão `Math.floor(L / 2)`. Um encontro é "potencialmente letal" quando a soma de CR dos monstros **excede** (`>`, não `>=`) este valor — texto fonte usa "greater than".
  - `singleMonsterCrCap(level)` → `L` se `L < 5`, senão `L * 1.5`. Um monstro único é "potencialmente letal" quando seu CR **alcança ou passa** (`>=`) este valor — texto fonte usa "equal to or higher than", assimetria proposital em relação à primeira função.
- **CR como número, não string.** `5e_Monster_Builder.json` e os papéis da US-152 usam frações (`1/8`, `1/2`, `2`); esta story recebe CR já convertido (responsabilidade de quem chama, tipicamente US-152) — não faz parsing de string de fração.
- **Testes de regressão usando os exemplos já escritos no próprio artefato-fonte** (evita inventar números): cinco personagens nível 4 vs. quatro ogros CR 2 (`20/4=5`, soma CR `8`, `8>5` → letal); mesmo grupo em nível 5 (`25/2=12`, soma CR `8`, `8<12` → não letal); seis personagens nível 8 vs. três diabos-com-chifre CR 11 (`48/2=24`, soma CR `33`, `33>24` → letal).
- **Guard de vacuidade/drift:** o teste do extrator falha se a subseção não existir mais em `5e_Monster_Builder.json` sob o mesmo `id` — mesma disciplina de "vermelho no primeiro bump de tag" da US-108/US-111, adaptada a um dataset com versão própria (`3.1.0` hoje).

### Fora do escopo

- **Escolher quais statblocks (Minion/Soldier/Brute) preenchem o encontro dentro do orçamento.** É [US-152](./US-152-statblocks-papel-orcamento.md); esta story só devolve o número contra o qual comparar.
- **A verificação do gate em si** (que o encontro gerado está dentro do orçamento). É [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md); esta story só produz o dado.
- **Multiplicador por tamanho de grupo.** Mesma decisão da US-152: grupo = 1 até a fase 4; "soma de níveis" e "nível médio" das fórmulas originais do LGMRD (pensadas para grupo) não são generalizadas aqui — ficam reduzidas ao caso de 1 personagem.
- **Bandas Easy/Medium/Hard.** O *Lazy Encounter Benchmark* é deliberadamente um gauge binário (abaixo/acima do limiar), não uma tabela de faixas — o texto-fonte diz isso explicitamente ("doesn't provide specific measurements for easy, medium, or hard"). Não inventar bandas aqui.
- **Escalar o cálculo para grupo > 1 ou multiplayer.** Fase 4, quando a US-152 também reabrir o multiplicador.

---

## Modelo de dados proposto

Sem schema Zod, sem migração — mesma decisão de forma da [US-152](./US-152-statblocks-papel-orcamento.md).

```ts
// Derivado committed (extraído de 5e_Monster_Builder.json, mesmo padrão do lgmrd-tables.json)
interface LazyEncounterBenchmark {
  deadlyDivisor: { upToLevel4: 4; level5Plus: 2 }
  singleMonsterCapMultiplier: { upToLevel4: 1; level5Plus: 1.5 }
  levelBreakpoint: 5
}

function encounterDeadlyThreshold(level: number): number
function singleMonsterCrCap(level: number): number
```

**Persistência:** nenhuma. O derivado committed é o único artefato novo; o resultado do cálculo é consumido em memória por US-150/US-152 durante a geração.

**O `LazyEncounterBenchmark` acima é a forma do derivado committed, não algo lido em runtime pelas duas funções.** Ver *Notas de implementação* — as funções hardcodam a fórmula; o JSON serve só ao teste de drift do extrator.

---

## Critérios de aceite

- [x] `_data/5e_Monster_Builder.json` (raw, gitignored) tem sua seção "The Lazy Encounter Benchmark" extraída para um derivado committed, no mesmo espírito do `lgmrd-tables.json`.
- [x] `encounterDeadlyThreshold(level)` devolve `Math.floor(level / 4)` para nível 1–4 e `Math.floor(level / 2)` para nível 5+.
- [x] `singleMonsterCrCap(level)` devolve `level` para nível 1–4 e `level * 1.5` para nível 5+.
- [x] Os três exemplos numéricos do texto-fonte (ogros nível 4, mesmo grupo nível 5, diabos-com-chifre nível 8) passam como fixtures de teste, com os números do próprio artefato — não inventados.
- [x] Nenhum multiplicador de tamanho de grupo existe no código (mesma disciplina da US-152: constante `1`, não config).
- [x] Teste de drift: se a subseção "Using the Benchmark" ou "The CR Cap for a Single Monster" sumir ou mudar de `id` em `5e_Monster_Builder.json`, o extrator falha alto e claro — não silencia com valor antigo.
- [x] `pnpm typecheck` e testes do módulo passam.

---

## Notas de implementação

- **O texto-fonte é assimétrico de propósito.** Soma de CR usa "greater than" (`>`); CR de monstro único usa "equal to or higher than" (`>=`). Não uniformizar os dois para o mesmo operador — é o próprio LGMRD que define os dois testes com limiares diferentes.
- **Onde este módulo mora:** ao lado de `lgmrd-tables.ts` em [`apps/api/src/adventure-generation/`](../../../apps/api/src/adventure-generation/) — mesmo pacote que já lê `5e_Monster_Builder.json` (via US-152) e `lgmrd-tables.json` (via US-147/US-149).
- **`1/4` e `1/2` do texto-fonte não são as mesmas frações que os CRs de papel** (`1/8`, `1/2`, `2` da US-152) — não confundir os dois usos de fração da mesma seção do dataset.
- **Derivado committed é arquivo próprio (`lazy-encounter-benchmark.json`, via `extract-benchmark.mjs`), não extensão de `lgmrd-tables.json`/`extract-tables.mjs`.** A seção "The Lazy Encounter Benchmark" é prosa (`type: 'paragraph'`, campo `markdown`) — as subsections `usingthebenchmark` e `thecrcapforasinglemonster` não têm `content[].type === 'table'`. `extractTables()` (US-147) pressupõe tabela em toda subsection que lê (`content?.find(c => c.type === 'table')`, gravado como `{headers, data}`); forçar esta seção lá dentro quebraria esse contrato ou obrigaria `LgmrdTables.tables` a aceitar uma chave sem `headers`/`data`, que nenhum outro consumidor (`readSecretPrompts`, a rolagem da US-147) espera. A fonte também é outro arquivo (`5e_Monster_Builder.json`, não `LGMRD.json`) — motivo a mais pra não misturar no mesmo extrator. Script irmão, mesmo molde raw→committed, artefato próprio.
- **As duas funções hardcodam a fórmula; não leem o derivado committed em runtime.** `encounterDeadlyThreshold`/`singleMonsterCrCap` não chamam `readFileSync` — a fórmula (`Math.floor(L/4)` ou `Math.floor(L/2)`; `L` ou `L*1.5`) é fixa, pequena, e "Persistência: nenhuma" (acima) já registrava isto antes de virar decisão explícita. O `lazy-encounter-benchmark.json` existe só para o teste de drift do extrator comparar `id`/`title` de `usingthebenchmark` e `thecrcapforasinglemonster` contra o `5e_Monster_Builder.json` bruto — nunca é lido pelas funções de negócio. Diferente de `readLgmrdTables()`/`readSecretPrompts()`, onde o JSON committed **é** o dado consumido: aqui o derivado é só guarda de vacuidade, a fórmula em si não vem de tabela pra parsear.
- **Level 1 dá limiar `0`.** `Math.floor(1/4) = 0`: para um personagem solo de nível 1, qualquer CR somado (mesmo um único Minion CR 1/8) já excede `0` e conta como "potencialmente letal" pelo benchmark bruto. Isto é o comportamento esperado do LGMRD, não um bug — é exatamente o sinal que motivou a US-152 ("nenhum encontro gerado mate um personagem solo de nível 1"): no nível 1, o benchmark é um alarme sensível, não um teto folgado. A calibração de quantos Minions ainda são jogáveis apesar do alarme é decisão da US-152, não desta story.

---

## Questões em aberto

Nenhuma.

---

## Referências no código

- [US-145](./US-145-sync-lgmrd-notice.md) — `5e_Monster_Builder.json`, a fonte desta story.
- [`scripts/lazygm/extract-tables.mjs`](../../../scripts/lazygm/extract-tables.mjs) — molde do extrator raw→committed (US-147), a adaptar para a nova seção/arquivo-fonte.
- [`scripts/lazygm/lgmrd-tables.json`](../../../scripts/lazygm/lgmrd-tables.json) — o derivado irmão já committed, mesmo padrão.
- [`apps/api/src/adventure-generation/lgmrd-tables.ts`](../../../apps/api/src/adventure-generation/lgmrd-tables.ts) — `readLgmrdTables()`, o leitor irmão em runtime (`fs`, não `import`, para não arrastar o `rootDir` do `tsc`).
- [US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md) — consumidor: verificação 3 do gate.
- [US-152](./US-152-statblocks-papel-orcamento.md) — consumidor: escolha de statblocks dentro do orçamento.
- [US-111](./US-111-classe-de-dificuldade-do-srd-2024.md) — a régua de dado diferente que estava citada por engano no lugar desta.
