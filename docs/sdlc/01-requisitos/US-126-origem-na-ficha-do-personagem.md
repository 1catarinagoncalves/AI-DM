# US-126 — Origem visível na ficha do personagem (em jogo)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) (catálogo `config.backgrounds`) · [US-122](./US-122-escolha-background-catalogo-na-criacao.md) (`Character.origin.key` persistido) · [US-45](./US-45-background-na-ficha-da-interface.md) (aba "Background" da ficha, `BackgroundPanel` — esta story estende o painel que já existe, não cria aba nova)
**Relacionado:** [US-41](./US-41-features-traits-de-classe.md) (`FeaturesPanel` — precedente de card "nome + descrição" reaproveitado aqui) · [US-124](./US-124-exibir-beneficios-narrativos-origem.md) (exibe os mesmos benefícios na CRIAÇÃO — mas, atualização 12/08/2026: `connection_and_memento` JÁ chegou na ficha por lá, em blocos próprios do `BackgroundPanel` — `Character.origin.connection`/`memento`, `game.background.connection`/`memento` —, não pelo bloco "Origem" que ESTA story ainda propõe; `adventures_and_advancement` continua sem aparecer em lugar nenhum da ficha, ver §Fora do escopo atualizado) · [US-125](./US-125-beneficios-origem-no-system-prompt.md) (mesmo filtro de tipos de benefício, mas para o PROMPT do mestre — os dois consomem o mesmo dado sem se tocar)
**Criada em:** 2026-08-09

---

## História

> **Como** jogador,
> **quero** ver a origem que escolhi na criação (nome + benefícios) na aba "Background" da minha ficha, durante o jogo,
> **para que** eu lembre quem meu personagem é sem voltar pra tela de criação — hoje `Character.origin.key` (US-122) fica invisível fora da criação, mesmo já sendo usado nos bastidores pela mecânica (US-123) e pelo mestre (US-125).

---

## Contexto e motivação

### O problema observado

A US-45 já deu à ficha (sidebar da `GameView`, em jogo) uma aba **"Background"** com história/ideais/vínculos/fraquezas/divindade ([GameView.tsx:111-159](../../../apps/web/src/components/game/GameView.tsx:111), `BackgroundPanel`). A US-122 trouxe um dado novo e **irmão** desse — `Character.origin.key`, a origem do catálogo A5E escolhida na criação — mas nenhuma tela de jogo o mostra. Race e classe aparecem fixas no topo da ficha (`characterClass`/`characterRace`, resolvidas por `catalogLabel`); a origem, que é informação do mesmo tipo (identidade fechada por catálogo), simplesmente não aparece em lugar nenhum depois que a criação termina.

### Por que a solução atual não basta

`character.origin` já é devolvido por `findOne` ([character.service.ts:208](../../../apps/api/src/character/character.service.ts:208)) — é scalar do `Character`, sem `select` que o exclua, mesma situação que a US-45 já observou para `background`. O dado existe e já chega à página (`app/play/[adventureId]/page.tsx`); falta **resolver** a chave contra `config.backgrounds` (mesmo `find` por `key` que outras resoluções de catálogo já fazem) e **passar** o resultado à `GameView`.

### A proposta

Estender o `BackgroundPanel` que a US-45 já criou com um bloco novo — **"Origem"** — que aparece quando `character.origin.key` resolve contra `config.backgrounds`: nome da origem em destaque + os benefícios não-mecanizados e não-longos, no mesmo formato de card que `FeaturesPanel` já usa para `ClassFeature` (nome + descrição). Sem escolher origem (ou sistema sem catálogo), o bloco simplesmente não aparece — mesmo padrão condicional dos outros blocos do painel.

---

## Escopo

### Dentro do escopo

- **`resolveOrigin(backgrounds, originKey)`** (nova função pura, `packages/shared`, perto de `catalogLabel`/`resolveSheetEntries`): dado `config.backgrounds` (US-121) e `character.origin?.key` (US-122), devolve `{ name: string; benefits: SystemBackgroundBenefit[] } | undefined` — a entrada encontrada por `key`, ou `undefined` se ausente/sem catálogo.
- **Filtro dos mesmos 4 tipos "awareness"** que a US-125 já define para o prompt do mestre (`feature`, `tool_proficiency`, `language`, `equipment`) — `ability_score`/`skill_proficiency` ficam de fora (já mecanizados e visíveis como número, US-123) e `adventures_and_advancement`/`connection_and_memento` também (texto longo/Markdown, sem parser aqui — ver §Fora do escopo).
- **`BackgroundPanel`** ([GameView.tsx:111](../../../apps/web/src/components/game/GameView.tsx:111)) ganha um bloco novo "Origem": nome da origem (`SheetHeading`) + lista de cards `nome: descrição` para os benefícios filtrados, mesmo estilo visual dos cards de `FeaturesPanel` ([GameView.tsx:192-198](../../../apps/web/src/components/game/GameView.tsx:192)) — não reinventa componente novo.
- **`hasAny`** do painel (linha 123 hoje) passa a considerar também a origem — origem presente conta como conteúdo, mesmo sem nenhum dos outros eixos preenchidos (evita cair no empty state com origem escolhida e nada mais preenchido).
- **`Props`/`GameView`**: novo campo opcional `origin?: { name: string; benefits: { name: string; description: string }[] }`, ao lado de `background`/`features`/`spells` ([GameView.tsx:70-76](../../../apps/web/src/components/game/GameView.tsx:70)).
- **`app/play/[adventureId]/page.tsx`**: resolve `origin` a partir de `config?.backgrounds` + `character.origin?.key` (mesmo bloco onde `features`/`spells` já são resolvidos, [page.tsx:52-56](../../../apps/web/src/app/play/[adventureId]/page.tsx:52)) e repassa à `GameView`.
- **Mensagens novas** (`game.background.origin*`), nos dois locales — nenhuma string nova hardcoded no JSX (gate da US-102).
- **Teste:** `GameView.test.tsx` cobre personagem com origem (nome + benefícios aparecem no bloco), personagem sem origem/sem catálogo (bloco não aparece, resto do painel intocado), e origem com zero benefícios dos 4 tipos filtrados (nome aparece sozinho, sem lista vazia decorativa).

### Fora do escopo

- **`connection_and_memento` no bloco "Origem" desta story** — continua fora do card list de `resolveOrigin`/`EXCLUDED_TYPES` (mesmo filtro da US-125). **Atualização 12/08/2026:** isso NÃO significa mais "ausente da ficha" — a US-124 passou a exibir `connection_and_memento` na ficha por conta própria, em blocos `game.background.connection`/`memento` do `BackgroundPanel`, irmãos do bloco "Origem" (não dentro dele, não via `resolveOrigin`). Ver `Character.origin.connection`/`memento` e `apps/web/src/components/character/BackgroundPanel.tsx`. Duplicar aqui seria mostrar a mesma informação duas vezes na mesma aba.
- **`adventures_and_advancement`** — esse SIM continua sem aparecer em lugar nenhum da ficha (nem aqui, nem na US-124 — lá só virou parágrafo na tela de CRIAÇÃO). Texto longo, sem parser/exibição pensados para a ficha em jogo; extensão natural, não pedida aqui nem lá.
- **`ability_score`/`skill_proficiency`** — já mecanizados (US-123): o bônus de atributo e as perícias da origem aparecem como número nos blocos que já existem (atributos/perícias da aba "Ficha"), mostrar o texto cru duplicaria informação.
- **Editar a origem pela ficha** — sem editor pós-criação hoje (mesma exclusão da US-45 pro background); fora daqui também.
- **Nova aba própria pra origem** — a US-45 decidiu que cada aba nova é decisão de sua própria story; origem é dado de identidade fechada por catálogo, mesma natureza do que a aba "Background" já mostra, então entra como bloco dentro dela, não como aba nova.
- **Mostrar isso em outra tela além da `GameView`** — mesmo corte da US-45 (alvo é só a sidebar em jogo).

---

## Modelo de dados proposto

Nenhuma mudança de schema/Prisma/API. `Character.origin.key` (US-122) e `config.backgrounds` (US-121) já existem; esta story só adiciona uma função de resolução (`packages/shared`) e um bloco de render (`apps/web`).

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

O filtro dos 4 tipos "awareness" aplica-se no `apps/web` (ou reaproveita, se a US-125 já tiver sido implementada, a mesma constante de tipos excluídos — ver §Notas).

---

## Critérios de aceite

- [ ] `resolveOrigin` encontra a origem por `key` em `config.backgrounds`; `originKey` ausente ou sem entrada correspondente → `undefined`, sem lançar.
- [ ] Bloco "Origem" aparece no `BackgroundPanel` só quando há origem resolvida; mostra o nome em destaque e um card por benefício `feature`/`tool_proficiency`/`language`/`equipment`.
- [ ] `ability_score`/`skill_proficiency`/`adventures_and_advancement`/`connection_and_memento` nunca aparecem no bloco "Origem" desta ficha, mesmo se presentes no array de benefícios da origem.
- [ ] Personagem sem origem escolhida (ou sistema sem `config.backgrounds`) → bloco "Origem" não aparece; resto do painel "Background" (história/ideais/vínculos/fraquezas/divindade) funciona exatamente como hoje.
- [ ] Personagem com origem escolhida mas história/ideais/vínculos/fraquezas/divindade todos vazios → painel NÃO cai no empty state (origem sozinha já conta como conteúdo).
- [ ] `app/play/[adventureId]/page.tsx` resolve e passa `origin` à `GameView` sem novo endpoint (mesmo `findOne` que já devolve `character.origin`).
- [ ] Nenhuma string nova hardcoded no JSX (gate da US-102); mensagens novas nos dois locales.
- [ ] **Eval / teste de regressão:** `GameView.test.tsx` cobre os três casos do §Escopo (origem com benefícios, sem origem, origem sem benefícios dos tipos filtrados); teste de `resolveOrigin` (unitário, `packages/shared`) cobre chave ausente, chave sem correspondência, e chave válida.

---

## Notas de implementação

- **Reaproveita o padrão de card de `FeaturesPanel`** ([GameView.tsx:192-198](../../../apps/web/src/components/game/GameView.tsx:192)) — mesmo `<li className="rounded-md border border-border bg-background/40 p-3">` com nome em destaque + descrição esmaecida abaixo. Evita um terceiro estilo visual pro mesmo tipo de conteúdo (nome + descrição curta).
- **Não procure `connection`/`memento` dentro de `resolveOrigin` ou do `EXCLUDED_TYPES` desta story** — eles não vêm de `benefits[]`/`resolveOrigin` nenhum. A US-124 gravou o texto escolhido direto em `Character.origin.connection`/`memento` (campos irmãos de `origin.key`, fora de `benefits`) e o `BackgroundPanel` já lê os dois independente desta story existir ou não. Bloco "Origem" (nome + cards awareness) e blocos "Conexão"/"Memento" são três seções irmãs do mesmo painel, não uma dentro da outra.
- **Lista de tipos excluídos duplicada, de propósito, entre US-125 e esta story.** São dois consumidores pequenos (prompt vs. UI) em pacotes diferentes (`ai-engine` vs. `web`/`shared`); extrair uma constante compartilhada antes de existir um terceiro consumidor seria abstração cedo demais. Se uma terceira tela precisar do mesmo filtro, aí sim vale mover pra `packages/shared`.
- **`resolveOrigin` fica em `packages/shared`, não `apps/web`** — mesma casa de `catalogLabel`/`resolveSheetEntries`, que já resolvem chave-de-ficha contra catálogo-de-config para outras telas (`page.tsx` já importa os dois de lá).
- **Ordem do bloco dentro do painel:** entra como mais uma seção condicional do `BackgroundPanel`, ao lado de `story`/`deity`/`lists` — posição exata (antes ou depois da história) é decisão de layout fina, sem impacto funcional.

---

## Referências no código

- [apps/web/src/components/game/GameView.tsx:70-76](../../../apps/web/src/components/game/GameView.tsx:70) — `Props`, onde `origin` entra.
- [apps/web/src/components/game/GameView.tsx:111-159](../../../apps/web/src/components/game/GameView.tsx:111) — `BackgroundPanel` (US-45), painel a estender.
- [apps/web/src/components/game/GameView.tsx:161-228](../../../apps/web/src/components/game/GameView.tsx:161) — `FeaturesPanel`, molde do card nome+descrição a reaproveitar.
- [apps/web/src/app/play/[adventureId]/page.tsx:41-73](../../../apps/web/src/app/play/[adventureId]/page.tsx:41) — resolução de `config`/`features`/`spells`; `origin` entra no mesmo bloco.
- [apps/api/src/character/character.service.ts:208](../../../apps/api/src/character/character.service.ts:208) — `findOne`, já devolve `Character.origin` sem mudança.
- `packages/shared/src/types/system.ts` — `catalogLabel`/`resolveSheetEntries` (precedentes), `SystemBackgroundSchema`/`SystemBackgroundBenefitSchema` (US-121, fonte do dado).
- [US-45](./US-45-background-na-ficha-da-interface.md) — aba "Background" e `BackgroundPanel`, base desta story.
- [US-121](./US-121-catalogo-backgrounds-a5e-adventurers-guide.md) / [US-122](./US-122-escolha-background-catalogo-na-criacao.md) — dependências diretas.
- [US-125](./US-125-beneficios-origem-no-system-prompt.md) — mesmo filtro de tipos, lado do mestre.
