# US-126 — Benefícios da origem na ficha do personagem (em jogo)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (`Character.origin.key` persistido)
**Relacionado:** [US-124](./US-124-exibir-beneficios-narrativos-origem.md) (já entregou `connection`/`memento` na ficha, blocos irmãos deste) · [US-125](./US-125-beneficios-origem-no-system-prompt.md) (mesmo filtro de tipos de benefício, lado do PROMPT do mestre — nenhum dos dois lados existe ainda) · [US-127](./US-127-revisao-espelha-ficha-completa.md) (extraiu `BackgroundPanel` de `GameView.tsx` para arquivo próprio, base do que existe hoje)
**Criada em:** 2026-08-09
**Revisada em:** 2026-08-13 — escopo reduzido: nome da origem já está na ficha (entregue por outra story antes desta ser puxada); só falta a lista de benefícios.

---

## História

> **Como** jogador,
> **quero** ver os benefícios não-mecanizados da origem que escolhi (proficiência em ferramenta, idioma, item, traço) na aba "Background" da minha ficha,
> **para que** eu lembre o que a origem concretamente me deu sem voltar pra tela de criação — hoje só o NOME da origem aparece ([BackgroundPanel.tsx:53-58](../../../apps/web/src/components/character/BackgroundPanel.tsx:53)); os benefícios ficam presos em `config.backgrounds`.

---

## Contexto e motivação

O nome da origem já é resolvido e exibido — `page.tsx` acha a entrada em `config.backgrounds` por `character.origin.key` e passa só `name` pra `GameView` → `BackgroundPanel` ([page.tsx:53-54](../../../apps/web/src/app/play/[adventureId]/page.tsx:53)). `connection`/`memento` também já aparecem, em blocos irmãos (US-124). O que falta é só a lista de **benefícios** (`benefits[]` de `SystemBackground`) — hoje esse array nem chega na `GameView`, fica só no `config` que a page já tem em mãos.

---

## Escopo

### Dentro do escopo

- **`resolveOrigin(backgrounds, originKey)`** (nova função pura, `packages/shared`, perto de `catalogLabel`/`resolveSheetEntries`): devolve `{ name: string; benefits: SystemBackgroundBenefit[] } | undefined`. Substitui o `find` inline de [page.tsx:54](../../../apps/web/src/app/play/[adventureId]/page.tsx:54).
- **Filtro dos 4 tipos "awareness"** (`feature`, `tool_proficiency`, `language`, `equipment`) — mesmo corte que a US-125 propõe pro prompt do mestre. `ability_score`/`skill_proficiency` ficam de fora (já mecanizados como número, US-123/US-131); `adventures_and_advancement`/`connection_and_memento` também (texto longo, sem parser aqui).
- **`BackgroundPanel`** ([BackgroundPanel.tsx:53-58](../../../apps/web/src/components/character/BackgroundPanel.tsx:53)) ganha lista de cards abaixo do nome da origem — um por benefício filtrado, mesmo estilo `<li className="rounded-md border border-border bg-background/40 p-3">` que `FeaturesPanel` já usa ([FeaturesPanel.tsx:51-56](../../../apps/web/src/components/character/FeaturesPanel.tsx:51)).
- **Prop nova** `originBenefits?: { name: string; description: string }[]` em `BackgroundPanel`, `GameView` (junto de `characterOrigin` em [GameView.tsx:54](../../../apps/web/src/components/game/GameView.tsx:54)) e `page.tsx` (junto de `originName`, [page.tsx:80](../../../apps/web/src/app/play/[adventureId]/page.tsx:80)) — `characterOrigin`/`originName` continuam existindo, sem quebrar o que já funciona.
- **Mensagens novas**, se algum rótulo estático for necessário além do que `game.background.origin` já cobre — nenhuma string nova hardcoded no JSX (gate da US-102).
- **Teste:** `resolveOrigin` unitário (`packages/shared`) — chave ausente, sem correspondência, válida com benefícios mistos (só os 4 tipos voltam). `BackgroundPanel`/`GameView.test.tsx` — origem com benefícios filtrados aparecem em cards, origem sem nenhum benefício dos 4 tipos (nome sozinho, sem lista vazia decorativa) — os dois primeiros casos do escopo antigo (nome aparece / bloco some sem origem) já têm cobertura existente, não precisam de teste novo.

### Fora do escopo

- **`connection_and_memento`** — já entregue pela US-124, blocos próprios fora de `resolveOrigin`. Não mexer.
- **`adventures_and_advancement`** — texto longo, continua sem exibição em lugar nenhum da ficha.
- **`ability_score`/`skill_proficiency`** — já mecanizados (US-123/US-131), aparecem como número nos blocos de atributos/perícias.
- **Editar a origem pela ficha** — sem editor pós-criação hoje, fora daqui.
- **Lado do prompt do mestre (US-125)** — consumidor irmão do mesmo filtro, story separada; nenhuma das duas depende da outra estar pronta primeiro.

---

## Modelo de dados proposto

Nenhuma mudança de schema/Prisma/API.

```ts
// packages/shared — perto de catalogLabel/resolveSheetEntries
export function resolveOrigin(
  backgrounds: SystemBackground[] | undefined,
  originKey: string | undefined,
): { name: string; benefits: SystemBackgroundBenefit[] } | undefined {
  if (!originKey) return undefined
  const found = backgrounds?.find((b) => b.key === originKey)
  if (!found) return undefined
  return { name: found.name, benefits: found.benefits }
}
```

O filtro dos 4 tipos "awareness" aplica-se em `apps/web` (ou reaproveita a constante da US-125 se ela já tiver sido implementada — ver §Notas).

---

## Critérios de aceite

- [ ] `resolveOrigin` encontra a origem por `key`; `originKey` ausente ou sem entrada correspondente → `undefined`, sem lançar.
- [ ] `BackgroundPanel` mostra um card por benefício `feature`/`tool_proficiency`/`language`/`equipment` da origem resolvida, abaixo do nome.
- [ ] `ability_score`/`skill_proficiency`/`adventures_and_advancement`/`connection_and_memento` nunca viram card nessa lista, mesmo presentes no array de benefícios.
- [ ] Origem com zero benefícios dos 4 tipos filtrados → nome aparece sozinho, sem lista vazia decorativa.
- [ ] `page.tsx` passa `originBenefits` à `GameView` sem novo endpoint (mesmo `findOne` que já devolve `character.origin` e `config.backgrounds`).
- [ ] Nenhuma string nova hardcoded no JSX (gate da US-102).

---

## Notas de implementação

- **Reaproveita o card de `FeaturesPanel`** ([FeaturesPanel.tsx:51-56](../../../apps/web/src/components/character/FeaturesPanel.tsx:51)) — mesmo estilo nome+descrição, não inventar um terceiro.
- **Lista de tipos excluídos duplicada, de propósito, entre US-125 e esta story** — dois consumidores pequenos (prompt vs. UI) em pacotes diferentes (`ai-engine` vs. `web`/`shared`); extrair constante compartilhada antes de existir um terceiro consumidor é abstração cedo demais.
- **`resolveOrigin` fica em `packages/shared`**, mesma casa de `catalogLabel`/`resolveSheetEntries` — `page.tsx` já importa os dois de lá ([page.tsx:3](../../../apps/web/src/app/play/[adventureId]/page.tsx:3)).

---

## Referências no código

- [apps/web/src/components/character/BackgroundPanel.tsx:53-58](../../../apps/web/src/components/character/BackgroundPanel.tsx:53) — bloco "Origem" atual (só nome), a estender.
- [apps/web/src/components/character/FeaturesPanel.tsx:51-56](../../../apps/web/src/components/character/FeaturesPanel.tsx:51) — molde do card nome+descrição a reaproveitar.
- [apps/web/src/components/game/GameView.tsx:54,568](../../../apps/web/src/components/game/GameView.tsx:54) — `Props.characterOrigin` e chamada de `BackgroundPanel`, onde `originBenefits` entra.
- [apps/web/src/app/play/[adventureId]/page.tsx:53-54,80](../../../apps/web/src/app/play/[adventureId]/page.tsx:53) — resolução atual de `originName` (`find` inline), a substituir por `resolveOrigin`.
- `packages/shared/src/types/system.ts:85-174` — `SystemBackgroundBenefitSchema`/`SystemBackgroundSchema` (US-121, fonte do dado).
- [US-124](./US-124-exibir-beneficios-narrativos-origem.md) — `connection`/`memento` já entregues, blocos irmãos.
- [US-125](./US-125-beneficios-origem-no-system-prompt.md) — mesmo filtro de tipos, lado do mestre.
- [US-127](./US-127-revisao-espelha-ficha-completa.md) — extraiu `BackgroundPanel`/`FeaturesPanel` para arquivos próprios.
