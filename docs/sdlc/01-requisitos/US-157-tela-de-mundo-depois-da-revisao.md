# US-157 — A tela de mundo, depois da revisão

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-156](./US-156-catalogos-registro-dto-validacao.md) (catálogos de `settings`/`tones`/`areaTypes` e DTO validado)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-157) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-46](./US-46-acessibilidade-wcag-aa.md) (WCAG AA) · [US-66](./US-66-telas-mobile-friendly.md) (mobile) · [US-102](./US-102-gate-de-string-literal-no-jsx.md) (gate de string literal no JSX)
**Criada em:** 2026-08-15

---

## História

> **Como** jogador criando um personagem,
> **quero** escolher o cenário, o tom e o tipo de área da minha primeira aventura — ou deixar cada um no aleatório —,
> **para que** eu possa jogar o tipo de história que quero, sem precisar mexer em nada se não me importar.

---

## Contexto e motivação

### O problema observado

O `SetupWizard` hoje termina em `review`, com a sequência `'system' | 'race-class' | 'background' | 'attributes' | 'skills' | 'review'` ([SetupWizard.tsx:25-26](../../../apps/web/src/components/setup/SetupWizard.tsx)). Não há passo nenhum para escolher `setting`/`tone`/`areaType` da aventura — a US-156 entrega o catálogo e a validação server-side, mas sem tela, o `CreateAdventureDto` só pode chegar com os três campos ausentes (sempre sorteado), nunca com escolha do jogador.

### Por que a solução atual não basta

`review` é o último passo hoje, e ele **fecha o personagem** — é onde a ficha inteira é revisada antes de criar. Misturar a escolha de registro da aventura dentro de `review` faria a revisão mostrar algo que ainda não foi escolhido (o registro só existe depois que o jogador passa por essa etapa), confundindo dois objetos com ciclos de decisão diferentes: o personagem (fechado em `review`) e a aventura (aberta pela nova tela).

### A proposta

Um sétimo passo, **depois** de `review`: três grupos de opção (Cenário, Tom, Tipo de Área), cada um com as entradas do catálogo mais **Aleatório** — que na tela é uma opção visível e no DTO é o campo omitido. Padrão: os três em Aleatório, então avançar sem tocar em nada continua sendo um clique.

---

## Escopo

### Dentro do escopo

- **Novo `Step` no `SetupWizard`**: `type Step = 'system' | 'race-class' | 'background' | 'attributes' | 'skills' | 'review' | 'world'`, adicionado ao **final** do array `steps` ([SetupWizard.tsx:25-26](../../../apps/web/src/components/setup/SetupWizard.tsx)) — depois de `review`, nunca antes.
- **Três grupos de rádio** (Cenário/`setting`, Tom/`tone`, Tipo de Área/`areaType`), cada um populado por `config.settings`/`config.tones`/`config.areaTypes` (US-156) mais a opção **Aleatório**. Grupo de rádio com rótulo associado — não `div` clicável (mesma disciplina de acessibilidade que toda tela nova do wizard segue, [US-46](./US-46-acessibilidade-wcag-aa.md)).
- **Estado inicial: os três em Aleatório.** Avançar sem tocar em nada envia o DTO com os três campos omitidos — caminho de um clique preservado.
- **Ao enviar:** cada grupo com opção diferente de Aleatório manda a `key` no `CreateAdventureDto`; grupo em Aleatório omite o campo (nunca envia uma chave `"random"` — mesma disciplina da US-156: ausência é a representação de aleatório).
- **Chaves de i18n novas em `setup.world.*`**, nos dois locales (pt-BR/en-US), seguindo o padrão de mensagens do resto do wizard ([messages](../../../apps/web/src/messages), consumido via `useT`).
- **[US-46](./US-46-acessibilidade-wcag-aa.md) e [US-66](./US-66-telas-mobile-friendly.md)** valem como em toda tela nova do wizard — sem exceção para esta.
- **Nenhuma string literal solta no JSX** — passa pelo gate da [US-102](./US-102-gate-de-string-literal-no-jsx.md), mesma disciplina de `GENDERS` (que é `value`, não texto de tela) versus rótulos, que sempre vêm do dicionário ou do `config` no locale ativo.

### Fora do escopo

- **O catálogo em si** (`config.settings`/`tones`/`areaTypes`) e a validação server-side — [US-156](./US-156-catalogos-registro-dto-validacao.md), consumidos aqui, não redefinidos.
- **A ordem dos passos anteriores** — `system`, `race-class`, `background`, `attributes`, `skills`, `review` permanecem exatamente como estão; esta story só acrescenta um passo ao final.
- **Mudar `CreateAdventureDto`** — já ganhou os três campos opcionais na [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md)/[US-156](./US-156-catalogos-registro-dto-validacao.md); esta story só é o primeiro emissor real de valores não-vazios para eles.

---

## Modelo de dados proposto

> Sem schema novo — consome `SystemCatalogEntry[]` (US-156) e popula `CreateAdventureDto` (US-153/US-156) já existente.

```ts
// apps/web/src/components/setup/SetupWizard.tsx
type Step = 'system' | 'race-class' | 'background' | 'attributes' | 'skills' | 'review' | 'world'
const steps: Step[] = ['system', 'race-class', 'background', 'attributes', 'skills', 'review', 'world']

// Estado local do passo novo — 'random' é sentinela SÓ no estado da tela, nunca no DTO enviado.
const [setting, setSetting] = useState<string | 'random'>('random')
const [tone, setTone] = useState<string | 'random'>('random')
const [areaType, setAreaType] = useState<string | 'random'>('random')
```

**Persistência:** nenhuma nova — o resultado alimenta `CreateAdventureDto`, já coberto pela US-156.

---

## Critérios de aceite

- [ ] `SetupWizard` tem um sétimo passo, `'world'`, posicionado **depois** de `'review'` no array `steps`.
- [ ] A tela mostra três grupos de rádio (Cenário, Tom, Tipo de Área), cada um com as entradas do catálogo do sistema + Aleatório.
- [ ] Estado inicial dos três grupos é Aleatório; avançar sem alterar nada envia `CreateAdventureDto` com os três campos omitidos.
- [ ] Selecionar uma opção não-Aleatório em qualquer grupo envia a `key` correspondente no DTO; nenhuma chave `"random"` é enviada em nenhum caso.
- [ ] Cada grupo de rádio tem rótulo associado (label + input, não `div` clicável) — auditável por teste de acessibilidade.
- [ ] Todo texto da tela vem de `setup.world.*` (dicionário), nos dois locales — nenhuma string literal solta no JSX (gate US-102).
- [ ] A tela responde ao layout mobile ([US-66](./US-66-telas-mobile-friendly.md)) e passa nos critérios de contraste/foco da [US-46](./US-46-acessibilidade-wcag-aa.md).
- [ ] `pnpm typecheck` e `pnpm test` (web) passam.
- [ ] **Eval / teste de regressão:** teste de componente que avança do passo `world` sem tocar em nada e confirma que o DTO resultante não tem `setting`/`tone`/`areaType`; teste que seleciona um valor em cada grupo e confirma que o DTO carrega as três `key`s corretas.

---

## Notas de implementação

- **`GENDERS` é o precedente de "lista de `value`, não texto de tela"** ([SetupWizard.tsx:35](../../../apps/web/src/components/setup/SetupWizard.tsx)) — mas aqui é o oposto: `setting`/`tone`/`areaType` vêm do **catálogo do sistema** (como `races`/`classes` desde a US-105), não de lista literal no componente. Não replicar o padrão de `GENDERS` para estes três campos.
- **`optionCardClass`** ([SetupWizard.tsx:74-80](../../../apps/web/src/components/setup/SetupWizard.tsx)) já dá a materialidade visual de cartão de opção selecionável — reusar para os três grupos, mesma linguagem visual do resto do wizard.
- **A opção "Aleatório" é `<input type="radio">` como as outras**, com valor sentinela só no estado do componente (`'random'`) — nunca serializado no payload. Traduzir a checagem "está em random?" para "omite o campo" na hora de montar o DTO enviado.
- **`review` continua o último passo do PERSONAGEM** — nenhuma lógica de `review` muda; ela não sabe que existe um passo depois, e não precisa saber (navegação por índice, como o comentário da US-123 já documenta).

---

## Questões em aberto

1. O botão "Criar personagem" (hoje ao final de `review`) precisa virar "Avançar" em `review` e um novo "Criar aventura"/"Começar" em `world`? Provavelmente sim — mas o texto exato e se a criação do `Character` e da `Adventure` continuam sendo duas chamadas separadas (como são hoje, personagem primeiro, aventura depois) ou passam a ser uma UX contígua é decisão de implementação, não fixada pelo backlog.

---

## Referências no código

- [apps/web/src/components/setup/SetupWizard.tsx:25-26](../../../apps/web/src/components/setup/SetupWizard.tsx) — `Step`, `steps`, onde o passo novo entra.
- [apps/web/src/components/setup/SetupWizard.tsx:74-80](../../../apps/web/src/components/setup/SetupWizard.tsx) — `optionCardClass`, reusado para os cartões de opção do novo passo.
- [US-156](./US-156-catalogos-registro-dto-validacao.md) — catálogos e DTO que esta tela consome.
- [US-46](./US-46-acessibilidade-wcag-aa.md), [US-66](./US-66-telas-mobile-friendly.md), [US-102](./US-102-gate-de-string-literal-no-jsx.md) — disciplinas que toda tela nova do wizard segue.
- [Backlog — Motor de geração de aventuras one-shot §GEN-14](./backlog-motor-de-geracao-de-aventuras.md) (US-157) — texto de origem.
