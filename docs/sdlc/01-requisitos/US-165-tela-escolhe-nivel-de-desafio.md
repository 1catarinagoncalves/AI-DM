# US-165 — Tela: jogador escolhe o nível de desafio do encontro

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) (`composeEncounterRoles(level, challenge)` parametrizada — sem ela não há valor real pra esta tela emitir) · [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (passo `world` do `SetupWizard`, onde o grupo de rádio desta story entra)
**Relacionado:** [US-156](./US-156-catalogos-registro-dto-validacao.md) (precedente de forma — catálogo+DTO+tela — mas não reusado literalmente: `challenge` não vem de catálogo, é enum fixo de dois valores) · [US-162](./US-162-jogador-escolhe-quantidade-de-segredos.md)/[US-163](./US-163-jogador-escolhe-tamanho-da-aventura.md) (dials irmãos com a mesma lacuna de tela — cada um ganha story própria quando a função subjacente estiver parametrizada, esta story não antecipa as deles) · [US-46](./US-46-acessibilidade-wcag-aa.md) (WCAG AA) · [US-66](./US-66-telas-mobile-friendly.md) (mobile) · [US-102](./US-102-gate-de-string-literal-no-jsx.md) (gate de string literal no JSX) · [US-167](./US-167-motor-consome-challenge-do-jogador.md) (fecha a Questão em aberto #2 desta story — orquestrador passa a ler `challenge` do DTO)
**Criada em:** 2026-08-18

---

## História

> **Como** jogador criando uma aventura,
> **quero** escolher entre modo aventura e modo desafio no passo de mundo do wizard,
> **para que** eu decida se aceito risco maior de combate sem precisar de API/teste — a US-161 parametriza a função, mas sem tela essa escolha só existe pra quem chama o código diretamente.

---

## Contexto e motivação

### O problema observado

A [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) resolveu explicitamente **não** entregar tela — `composeEncounterRoles(level, challenge)` fica parametrizada, mas nenhum DTO, catálogo ou componente expõe `challenge` ao jogador. `CreateAdventureDto` ([adventure.service.ts:9-11](../../../apps/api/src/adventure/adventure.service.ts)) hoje só tem `initialHookId` — nem os três campos de registro da US-156 existem ainda no código (US-153/US-156/US-157 seguem 📋 Planejada), então não há hoje nenhum jogador com acesso a `challenge` fora de teste.

### Por que a solução atual não basta

Sem esta story, "modo desafio" só é alcançável chamando `composeEncounterRoles` diretamente — nenhum jogador real chega lá. A US-161 deixou isso deliberadamente fora do seu escopo (função primeiro, produto depois); esta story fecha essa lacuna.

### A proposta

Um quarto grupo de rádio no passo `world` que a US-157 introduz — **Desafio**, com dois valores fixos (**Modo aventura** / **Modo desafio**), ao lado dos três grupos de registro (Cenário/Tom/Tipo de Área). Diferente daqueles três, `challenge` não vem de `config.settings/tones/areaTypes` (não é catálogo do sistema, é constante do domínio de encontro, US-159/US-161) — não precisa de `SystemCatalogEntry[]` nem de mudança em `SystemConfig`. Estado inicial: **Modo aventura** (mesmo default da US-161, não "Aleatório" — a US-161 não trata isso como sorteio, é escolha de risco).

---

## Escopo

### Dentro do escopo

- **Quarto grupo de rádio** no passo `world` (US-157): **Desafio**, dois valores — Modo aventura / Modo desafio. Rótulo associado (label + input), não `div` clicável.
- **Texto de apoio sob cada opção**, pra o jogador saber a diferença sem ler código: **Modo aventura** — "pode não ter combate" (nível 1–3 zera, US-159/US-161); **Modo desafio** — "combate garantido" (`singleMonsterCrCap` nunca zera). Sem essa distinção explícita, as duas opções parecem só rótulo de dificuldade cosmética, não a diferença mecânica real (presença ou ausência de combate).
- **Estado inicial: Modo aventura** — avançar sem tocar envia o DTO sem mudança de comportamento (equivalente a omitir o campo, mesmo contrato de default da US-161).
- **`CreateAdventureDto` ganha `challenge?: 'adventure' | 'challenge'`** (chave canônica EN, resolvida na Questão em aberto #3 da US-161: tradução direta de "modo aventura"/"modo desafio") — campo novo, opcional, sem afetar `initialHookId` nem os campos de registro da US-156/US-157.
- **Chaves de i18n novas em `setup.world.challenge.*`**, nos dois locales (pt-BR/en-US) — inclui `adventure.label`/`adventure.hint` e `challenge.label`/`challenge.hint`, o `hint` sendo o texto de apoio acima.
- **US-46/US-66/US-102** valem como em toda tela nova do wizard — sem exceção.

### Fora do escopo

- **Consumir `challenge` na geração real** — nenhum orquestrador (US-164) ou `createForCharacter` lê esse campo do DTO ainda; esta story só garante que o valor **chega** ao backend, não que ele **é usado**. Wiring fica pra quando o orquestrador ganhar esse parâmetro — mesma fronteira que a própria US-161 já deixou aberta pro composer. Story própria: [US-167](./US-167-motor-consome-challenge-do-jogador.md).
- **Tela pros dials irmãos** (densidade de segredos, US-162; tamanho da aventura, US-163) — cada um só ganha grupo de rádio quando a função subjacente estiver parametrizada (hoje nenhuma das duas está); não adiantar aqui.
- **"Aleatório" como quarta opção de `challenge`** — os três grupos de registro (US-157) têm Aleatório porque são sabor narrativo, sem efeito mecânico; `challenge` afeta orçamento de combate, sortear não faz sentido de produto (levantar isso é decisão de produto, não resolvida aqui).

---

## Modelo de dados proposto

Sem schema de banco novo. `CreateAdventureDto` ([adventure.service.ts:13-16](../../../apps/api/src/adventure/adventure.service.ts)) ganha um campo:

```ts
export interface CreateAdventureDto {
  initialHookId: string
  challenge?: 'adventure' | 'challenge' // 'adventure' = modo aventura, 'challenge' = modo desafio (US-161)
}
```

---

## Critérios de aceite

- [ ] Passo `world` (US-157) mostra um quarto grupo de rádio, **Desafio**, com Modo aventura / Modo desafio.
- [ ] Cada opção mostra texto de apoio explicando a diferença mecânica: Modo aventura pode não ter combate; Modo desafio garante combate.
- [ ] Estado inicial é Modo aventura; avançar sem alterar nada não muda o comportamento de hoje (equivalente a `challenge` omitido).
- [ ] Selecionar Modo desafio envia `challenge` correspondente no `CreateAdventureDto`.
- [ ] Grupo de rádio tem rótulo associado — auditável por teste de acessibilidade.
- [ ] Todo texto vem de `setup.world.challenge.*` (dicionário), nos dois locales — gate US-102.
- [ ] Tela responde ao layout mobile (US-66) e passa nos critérios de contraste/foco (US-46).
- [ ] `pnpm typecheck` e `pnpm test` (web) passam.
- [ ] **Eval / teste de regressão:** teste de componente confirma que o DTO carrega `challenge` correto para cada seleção, e que o valor default não quebra o caminho de um clique do passo `world`.

---

## Notas de implementação

- **Depende de US-157 existir primeiro** — o passo `world` (steps array, `optionCardClass`) precisa estar implementado antes deste grupo entrar; esta story não cria passo novo, só adiciona grupo a um existente.
- **Sem catálogo:** ao contrário de Cenário/Tom/Tipo de Área, os dois valores de `challenge` são hardcoded no componente (mesma constante EN que `composeEncounterRoles` espera) — não populado via `config`.

---

## Questões em aberto

1. ~~Nome canônico EN dos dois valores~~ **Resolvido: `'adventure'` / `'challenge'`**, mesma chave que a US-161 já usa em `composeEncounterRoles`.
2. ~~Quando o orquestrador (US-164) ganha `challenge` como parâmetro real~~ **Resolvido: story própria, [US-167](./US-167-motor-consome-challenge-do-jogador.md)**, criada em 2026-08-18.

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — passo `world` (a partir da US-157), onde o grupo de rádio entra.
- [`apps/api/src/adventure/adventure.service.ts:13-16`](../../../apps/api/src/adventure/adventure.service.ts) — `CreateAdventureDto`, ganha o campo `challenge` (número real pós-US-164, 2026-08-18).
- [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md) — `composeEncounterRoles(level, challenge)`, a função que esta tela finalmente dá acesso ao jogador.
- [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) — passo `world`, reusado, não recriado.
