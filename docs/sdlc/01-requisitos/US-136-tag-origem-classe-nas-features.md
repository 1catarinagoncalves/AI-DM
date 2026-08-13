# US-136 — Tag origem/classe nas features da revisão e da ficha

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-135](./US-135-feature-de-origem-na-criacao-e-ficha.md) (mistura features de classe e de origem em `Character.features`/`resolveCharacterFeatures`, sem nenhuma marca de proveniência) · [US-41](./US-41-features-traits-de-classe.md) (`FeaturesPanel`, `ClassFeature`) · [US-127](./US-127-revisao-espelha-ficha-completa.md) (revisão do wizard e ficha em jogo consomem o MESMO `FeaturesPanel` — esta story muda um componente, os dois lugares ganham a tag junto)
**Criada em:** 2026-08-13

---

## História

> **Como** jogador,
> **quero** que cada item da aba "Features" (na revisão da criação e na ficha em jogo) diga se veio da minha classe ou da minha origem,
> **para que** eu identifique de onde veio cada poder/traço sem ter que decorar nomes de background e classe.

---

## Contexto e motivação

### O problema observado

A US-135 juntou as features de classe e de origem na MESMA lista de `Character.features`, resolvida por `resolveCharacterFeatures` e exibida pelo `FeaturesPanel` — sem nenhuma distinção visual entre as duas fontes (só `name` + `description`, ver `apps/web/src/components/character/FeaturesPanel.tsx:10-13`, comentário explícito: "`key`/`source` são dado de persistência, sem papel na exibição"). Um paladino com origem Criminoso vê *Lay on Hands* e *Thieves' Cant* lado a lado, na mesma lista, sem pista de qual é poder de classe e qual é traço da origem.

### Por que a solução atual não basta

`resolveCharacterFeatures` (`packages/shared/src/starting-kit.ts:66-75`) já sabe, internamente, quais chaves vieram de `classList` e quais de `originList` — mas monta um mapa sintético de UMA entrada (`{ combined: [...classList, ...originList] }`) antes de chamar `resolveSheetEntries`, e o resultado que sai não carrega mais essa informação. `SystemClassFeature` (schema persistido, `packages/shared/src/types/system.ts:55-60`) não é o lugar certo para guardar isso — é dado de catálogo compartilhado com o prompt do mestre, sem noção de "para qual personagem". A distinção precisa nascer no momento do merge, não no schema.

### A proposta

`resolveCharacterFeatures` passa a devolver cada item já marcado com a origem (`'class'` ou `'background'`), calculada por pertencimento às duas listas ANTES do merge — não por parsing de prefixo de chave. `FeaturesPanel` ganha um badge pequeno por item, condicionado a essa marca. Como a revisão do wizard e a ficha em jogo já compartilham o mesmo componente (US-127), a mudança aparece nas duas telas de uma vez.

---

## Escopo

### Dentro do escopo

- **`resolveCharacterFeatures`** (`packages/shared/src/starting-kit.ts:66`): retorno passa de `SystemClassFeature[]` para um tipo que soma `origin: 'class' | 'background'` a cada entrada (ex.: `CharacterFeature = SystemClassFeature & { origin: 'class' | 'background' }`). A marca é calculada checando se `f.key` está no `Set` de chaves de `classList`/`originList` **antes** de montar o mapa `combined` — não faz parsing de prefixo de chave (`a5e-ag_*` vs `<classe>_*`), que é um detalhe de formato do dataset, não uma garantia de contrato. `SystemClassFeatureSchema` **não muda** — o campo novo só existe no tipo de retorno desta função, não no catálogo persistido.
- **`FeaturesPanel`** (`apps/web/src/components/character/FeaturesPanel.tsx`): `ClassFeature` ganha `origin?: 'class' | 'background'`. Quando presente, renderiza um badge curto ao lado do nome (chave de mensagem nova, não string hardcoded — gate US-102). Quando ausente, sem badge — compatível com qualquer chamador que não passe pela `resolveCharacterFeatures` (nenhum conhecido hoje, mas mantém o componente sem depender de um único caminho de dados).
- **3 sites de leitura já existentes** (`apps/api/src/ai/ai.service.ts:340`, `apps/web/src/components/setup/SetupWizard.tsx:241`, `apps/web/src/app/play/[adventureId]/page.tsx:66`) — nenhuma mudança de código: os três já chamam `resolveCharacterFeatures` e só o de `ai.service.ts` (prompt do mestre) ignora o campo novo (`origin` não entra no texto do prompt, é só apresentação de UI).
- **Mensagens novas** em `apps/web/src/messages/pt-BR.ts` e `en-US.ts`, ao lado de `game.features.title`/`game.features.empty`: rótulo curto para cada valor de `origin` (ex. `game.features.tag.class` = "Classe" / `game.features.tag.background` = "Origem").
- **Teste em `starting-kit.test.ts`**: `resolveCharacterFeatures` com personagem tendo features de classe e de origem — cada item do retorno tem o `origin` correto; feature aposentada (`retiredFeatures`) resolvida via fallback também recebe `origin` coerente com de onde a chave veio.
- **Teste novo para `FeaturesPanel`** (não existe teste de componente para ele hoje): lista mista renderiza os dois badges corretos; item sem `origin` não quebra e não mostra badge.

### Fora do escopo

- **Magias (`spells`)** — hoje só vêm de classe (não existe magia de origem no catálogo), então a lista de magias não ganha tag nesta story. Se um dia existir magia de background, é story separada.
- **Cor/estilo final do badge** — só precisa ser legível e distinguível; polimento visual fica a critério de quem implementar, sem specs de design aqui.
- **Filtrar ou agrupar a lista por origem/classe** — a lista continua única, na mesma ordem que a US-135 já define (classe primeiro, origem depois); a tag é só rótulo, não reorganiza nada.
- **Traits raciais** — mesmo corte da US-41/US-135 (fonte de dados diferente, sem campo equivalente).

---

## Modelo de dados proposto

Não é mudança de schema persistido nem de Prisma — só o tipo de retorno de uma função pura em `packages/shared`, consumido apenas por UI (o site de leitura em `ai.service.ts` ignora o campo).

```ts
// packages/shared/src/starting-kit.ts
export type CharacterFeature = SystemClassFeature & { origin: 'class' | 'background' }

export function resolveCharacterFeatures(
  config: SystemConfig,
  classKey: string,
  originKey: string | undefined,
  featureKeys: string[],
): CharacterFeature[] {
  // ...
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `origin` | `'class' \| 'background'` | De qual das duas listas (`classFeatures`/`backgroundFeatures`) a chave veio, calculado por pertencimento ao `Set` correspondente antes do merge. |

**Persistência:** nenhuma — campo calculado na leitura, não guardado em `Character.features` (que continua só um `string[]` de chaves, US-100/US-135).

---

## Critérios de aceite

- [ ] `resolveCharacterFeatures` devolve `origin: 'class'` para chaves vindas de `classFeatures`/`default` e `origin: 'background'` para chaves vindas de `backgroundFeatures`, sem alterar `SystemClassFeatureSchema`.
- [ ] `FeaturesPanel` mostra um badge por item da lista de features indicando classe ou origem.
- [ ] Revisão do wizard (etapa `review`) mostra a tag assim que `origin.key` está selecionado; trocar a origem antes do submit atualiza a tag junto com o item (mesma garantia de atualização que a US-135 já tem para o conteúdo).
- [ ] Ficha em jogo (`GameView`) mostra a mesma tag para personagem já persistido, sem código novo no site de leitura (só o retorno de `resolveCharacterFeatures` muda).
- [ ] Nenhuma string nova hardcoded no JSX (gate da US-102) — rótulos das tags vêm de chave de mensagem em `pt-BR.ts`/`en-US.ts`.
- [ ] **Eval / teste de regressão:** `starting-kit.test.ts` cobre `resolveCharacterFeatures` com classe+origem misturadas, verificando `origin` de cada item; teste novo de `FeaturesPanel` cobre lista mista renderizando os dois badges e item sem `origin` sem quebrar.

---

## Notas de implementação

- **Não faça parsing de prefixo de chave** (`a5e-ag_*` vs `<classe>_*`) para decidir a origem — mesmo os prefixos sendo hoje disjuntos (US-135 §Notas), é um detalhe de formato do dataset, não um contrato. Calcule a partir dos dois `Set`s (`classList`/`originList`) que `resolveCharacterFeatures` já monta, antes do merge em `combined`.
- **`resolveSheetEntries` não muda de assinatura** — ela resolve chave→`SystemClassFeature` normalmente; a marca `origin` é adicionada DEPOIS, num `.map()` sobre o resultado, consultando os dois `Set`s.
- **Feature aposentada** (`retiredFeatures`, US-100): uma chave que caiu no fallback de aposentadoria ainda precisa de `origin` coerente — o `Set` de pertencimento é calculado sobre as chaves de `classList`/`originList` (que incluem tanto vigentes quanto aposentadas indiretamente, ver US-100), não sobre o resultado já resolvido.
- **Badge é só apresentação** — não introduza lógica de negócio nova no `FeaturesPanel`; ele já é read-only/awareness (US-41).

---

## Questões em aberto

1. Rótulo exato da tag ("Origem" vs "Background", "Classe" vs "Class Feature") — decisão de copy, não bloqueia implementação; seguir o vocabulário já usado na ficha (US-98/US-99 já usam "Origem" para `background` na UI em pt-BR — conferir consistência no momento de escrever a mensagem).

---

## Referências no código

- [apps/web/src/components/character/FeaturesPanel.tsx:10-13](../../../apps/web/src/components/character/FeaturesPanel.tsx:10) — `ClassFeature`, onde `origin?` entra.
- [packages/shared/src/starting-kit.ts:66-75](../../../packages/shared/src/starting-kit.ts:66) — `resolveCharacterFeatures`, onde a mistura acontece hoje sem marca de proveniência.
- [packages/shared/src/types/system.ts:55-60](../../../packages/shared/src/types/system.ts:55) — `SystemClassFeatureSchema`, que NÃO muda.
- [apps/web/src/components/setup/SetupWizard.tsx:241,894](../../../apps/web/src/components/setup/SetupWizard.tsx:241) — preview da revisão, primeiro lugar onde a tag aparece.
- [apps/web/src/components/game/GameView.tsx:556](../../../apps/web/src/components/game/GameView.tsx:556) — ficha em jogo, segundo lugar (mesmo componente).
- [apps/web/src/messages/pt-BR.ts:205-206](../../../apps/web/src/messages/pt-BR.ts:205) / [en-US.ts:195-196](../../../apps/web/src/messages/en-US.ts:195) — onde as chaves `game.features.tag.*` entram, ao lado de `game.features.title`.
- [US-135](./US-135-feature-de-origem-na-criacao-e-ficha.md) — story que juntou as duas fontes sem distinção; esta story adiciona a distinção.
- [US-127](./US-127-revisao-espelha-ficha-completa.md) — por que mudar `FeaturesPanel` cobre as duas telas de uma vez.
