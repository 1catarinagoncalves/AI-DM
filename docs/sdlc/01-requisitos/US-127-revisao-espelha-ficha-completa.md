# US-127 — Revisão da criação espelha a ficha completa (kit, features, magias, PV)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-26](./US-26-criacao-personagem-em-etapas.md) (wizard, etapa `review`) · [US-45](./US-45-background-na-ficha-da-interface.md) (`BackgroundPanel`) · [US-41](./US-41-features-traits-de-classe.md) (`FeaturesPanel`, `config.classFeatures`) · [US-42](./US-42-magias-conhecidas.md) (`config.classSpells`) · [US-51](./US-51-kits-iniciais-do-srd.md) (`config.startingKits`, `getStartingInventory`) · [US-27](./US-27-pericias-do-personagem.md) (`buildSkillSheet`, modificador de perícia)
**Relacionado:** [US-124](./US-124-exibir-beneficios-narrativos-origem.md) (mesma etapa `review`, mas para os benefícios de origem — não duplicado aqui)
**Criada em:** 2026-08-11

---

## História

> **Como** jogador,
> **quero** que a etapa "Revisão" da criação mostre o que a minha ficha vai mostrar depois — kit inicial da classe, perícias já com modificador, features, magias conhecidas e PV inicial, além do background por extenso —
> **para que** eu confirme o personagem sabendo de verdade o que estou criando, em vez de confirmar às cegas e só descobrir o resto (às vezes irreversível — sem editor pós-criação) na ficha.

---

## Contexto e motivação

### O problema observado

A etapa `review` do wizard ([SetupWizard.tsx:512-570](../../../apps/web/src/components/setup/SetupWizard.tsx:512)) e a ficha em jogo ([GameView.tsx](../../../apps/web/src/components/game/GameView.tsx)) mostram o MESMO personagem, mas com campos bem diferentes:

- Atributos: revisão mostra o valor cru (`"Força 15"`); ficha mostra o modificador (`+2`), via `abilityModifier`/`formatModifier` ([GameView.tsx:634-635](../../../apps/web/src/components/game/GameView.tsx:634)).
- Perícias: revisão lista só o nome escolhido; ficha mostra nome + modificador + marca de proficiência, via `buildSkillSheet` (`packages/shared/src/ability.ts:56`).
- Background: revisão vira `"Preenchido"`/`"—"` ([SetupWizard.tsx:556-558](../../../apps/web/src/components/setup/SetupWizard.tsx:556)); ficha mostra o texto inteiro de história/ideais/vínculos/fraquezas via `BackgroundPanel` ([GameView.tsx:111](../../../apps/web/src/components/game/GameView.tsx:111)).
- Divindade: revisão mostra só o nome ([SetupWizard.tsx:561-568](../../../apps/web/src/components/setup/SetupWizard.tsx:561)); ficha mostra nome + portfólio.
- Kit inicial, features de classe, magias conhecidas e PV inicial: **não aparecem em lugar nenhum da revisão** — só surgem na ficha, depois que o personagem já foi criado.

### Por que a solução atual não basta

O jogador confirma o personagem sem saber o que vai carregar, o que sabe fazer de especial ou quantos PV tem — e não há editor pós-criação (mesma exclusão que a [US-45](./US-45-background-na-ficha-da-interface.md) já registrou). Pior: os campos que já existem nos dois lugares (atributos, perícias, background) foram **reimplementados do zero** na revisão em vez de reaproveitar `BackgroundPanel`/`buildSkillSheet`/`abilityModifier` — o mesmo padrão de duplicação que já causa a divergência de hoje, e que continuaria causando a próxima toda vez que um campo novo entrar só de um lado.

### A proposta

Tudo que falta já está disponível **sem endpoint novo**: kit inicial, features e magias vêm do `config` que o wizard já carrega via `api.listSystems()` — `config.startingKits[classKey]`, `config.classFeatures[classKey]`, `config.classSpells[classKey]` (US-51/US-41/US-42), já resolvidos no locale ativo. PV inicial é `10 + abilityModifier(constitution)`, a mesma conta que `adventure.service.ts:102-103` já faz ao criar a aventura. A revisão passa a computar esse preview a partir do estado que já tem (`charData.class`, `attrs`) e a **reaproveitar** os componentes que a ficha já usa — `BackgroundPanel` e `FeaturesPanel` — em vez de ter uma segunda cópia do layout. Isso resolve os dois pedidos ao mesmo tempo: paridade de campos hoje, e paridade estrutural daqui pra frente (um componente muda, os dois lugares mudam juntos).

---

## Escopo

### Dentro do escopo

- **Mover `getStartingInventory`, `getClassFeatures` e `getClassSpells`** de `apps/api/src/character/starting-inventory.ts` para `packages/shared/src/starting-kit.ts` (perto de `catalogLabel`/`resolveSheetEntries`, mesma casa de outras resoluções de catálogo por chave). `apps/api` (`adventure.service.ts`, `character.service.ts`) passa a importar as três de `@ai-dm/shared`; `apps/web` ganha o mesmo import. `resolveInitialHook`/`resolveHookTemplate` ficam em `apps/api` — são específicas da adventure (depois que o personagem já existe), não do preview da criação.
  - **Desvio do plano original:** a ideia inicial era o preview ler `config.classFeatures[classKey]` direto (sem `getClassFeatures`). Na implementação, `apps/web/src/app/play/[adventureId]/page.tsx:56-60` já resolve features/magias encadeando `getClassFeatures`/`getClassSpells` (as CHAVES que a criação vai persistir) com `resolveSheetEntries` (que resolve chave→objeto no locale ativo, incluindo `retiredFeatures`/`retiredSpells`). Reusar essa MESMA dupla de funções no preview — em vez de indexar o config à mão — elimina de vez o risco de o preview mostrar uma feature que a criação não vai persistir (ou vice-versa): é literalmente o mesmo cálculo, não uma cópia paralela.
- **Extrair `BackgroundPanel` e `FeaturesPanel`** de `GameView.tsx` para um local compartilhado dentro de `apps/web` (ex. `apps/web/src/components/character/`), sem mudar a assinatura de props. `GameView` continua a consumi-los com dado persistido; o step `review` do `SetupWizard` passa a consumi-los com o preview calculado no estado local.
- **Etapa `review`** ganha, na ordem que fizer sentido ao lado do que já existe:
  - Atributos com modificador (`abilityModifier`/`formatModifier`), ao lado do valor cru já mostrado.
  - Perícias com modificador e marca de proficiência, via `buildSkillSheet(skillCatalog, attrs, skills, system.config.proficiency.bonus)`.
  - Background por extenso via `BackgroundPanel`, substituindo o `"Preenchido"`/`"—"` atual — incluindo divindade com portfólio.
  - Bloco novo "PV inicial": `10 + abilityModifier(attrs['constitution'] ?? 10)` — mesma fórmula e mesmo fallback de `adventure.service.ts:102`.
  - Bloco novo "Kit inicial": `getStartingInventory(system.config, charData.class)`.
  - Bloco novo "Features e magias" via `FeaturesPanel`, com `resolveSheetEntries(config.classFeatures, config.retiredFeatures, classKey, getClassFeatures(config, classKey))` (e o mesmo para magias) — a mesma dupla chave→objeto que `page.tsx` já usa para a ficha, só aplicada antes da persistência existir.
- **Testes:** `SetupWizard.test.tsx` cobre os blocos novos com classe que tem kit/features/magias próprios, com classe que cai no `default`, e com sistema sem esses campos no config (nenhum bloco quebra, nenhum aparece vazio de forma decorativa). Teste de regressão comparando o preview da revisão com a ficha pós-criação para o mesmo personagem (mesmos dados, mesmo componente — não duas implementações que podem divergir de novo).

### Fora do escopo

- **Editor na revisão** — os blocos novos são leitura, mesmo padrão do resto da etapa; mudar algo continua exigindo "Voltar".
- **PV por dado de vida real da classe** — hoje é fixo `10 + mod CON` para qualquer classe (mesma simplificação de `adventure.service.ts`); esta story só EXIBE a conta existente, não muda a fórmula.
- **Origem (US-122) com benefícios por extenso na revisão** — já é a [US-124](./US-124-exibir-beneficios-narrativos-origem.md), em paralelo; esta story não duplica esse bloco.
- **Inventário além do kit inicial** (itens ganhos em jogo) e **condições** — não existem antes da aventura começar; ficam de fora da revisão como já ficam fora do `Character` recém-criado.

---

## Modelo de dados proposto

Nenhuma mudança de schema/Prisma/API — só realocação de função pura e extração de componente.

```ts
// packages/shared — realocada de apps/api/src/character/starting-inventory.ts
export function getStartingInventory(config: SystemConfig, classKey: string): InventoryItem[] {
  return config.startingKits[classKey] ?? (config.startingKits.default as InventoryItem[])
}
```

```tsx
// apps/web/src/components/character/BackgroundPanel.tsx (extraído de GameView.tsx, mesma assinatura)
export function BackgroundPanel({ background }: { background?: CharacterBackground }) { /* ... */ }

// apps/web/src/components/character/FeaturesPanel.tsx (extraído de GameView.tsx, mesma assinatura)
export function FeaturesPanel({ features, spells }: { features?: ClassFeature[]; spells?: SystemSpell[] }) { /* ... */ }
```

`SetupWizard` monta o preview a partir do que já tem em estado — sem chamada de API nova. `getClassFeatures`/`getClassSpells` (as chaves que a criação vai persistir) encadeadas com `resolveSheetEntries` (a mesma resolução chave→objeto que `page.tsx` já faz para a ficha):

```ts
const previewKit = system?.config ? getStartingInventory(system.config, charData.class) : []
const previewFeatures = system?.config
  ? resolveSheetEntries(system.config.classFeatures, system.config.retiredFeatures, charData.class, getClassFeatures(system.config, charData.class))
  : []
const previewSpells = system?.config
  ? resolveSheetEntries(system.config.classSpells, system.config.retiredSpells, charData.class, getClassSpells(system.config, charData.class))
  : []
const conMod = abilityModifier(attrs['constitution'] ?? 10)
const previewHp = 10 + conMod
```

---

## Critérios de aceite

- [x] Etapa `review` mostra atributos com modificador ao lado do valor cru.
- [x] Etapa `review` mostra perícias escolhidas com modificador e marca de proficiência (mesmo `buildSkillSheet` da ficha).
- [x] Etapa `review` mostra história/ideais/vínculos/fraquezas/divindade (com portfólio) por extenso via `BackgroundPanel`, não mais `"Preenchido"`/`"—"`.
- [x] Etapa `review` mostra PV inicial (`10 + mod CON`) e kit inicial da classe escolhida (`getStartingInventory`).
- [x] Etapa `review` mostra features de classe e magias conhecidas da classe escolhida via `FeaturesPanel`, caindo no `default` quando a classe não tem entrada própria no config.
- [x] Sistema sem `pointBuy`/`skills`/`classFeatures`/`classSpells` no config → os blocos correspondentes não aparecem (mesmo padrão condicional que a etapa já segue para as outras seções), sem quebrar a revisão.
- [x] `GameView` (ficha em jogo) continua renderizando exatamente igual após a extração de `BackgroundPanel`/`FeaturesPanel` — nenhuma regressão visual ou de teste existente.
- [x] `apps/api` (`adventure.service.ts`, `character.service.ts`) importa `getStartingInventory`/`getClassFeatures`/`getClassSpells` de `packages/shared`; `apps/api/src/character/starting-inventory.ts` fica só com `resolveInitialHook`/`resolveHookTemplate`.
- [x] Nenhuma string nova hardcoded no JSX (gate da US-102); mensagens novas nos dois locales (`setup.review.hp`, `setup.review.kit`; `setup.review.filled`/`setup.review.deity` removidas por ficarem órfãs).
- [x] **Teste de regressão:** `SetupWizard.test.tsx` cobre os blocos novos (kit/features/magias com classe própria, classe caindo no `default`, sistema sem os campos no config) e o `BackgroundPanel` reusado prova que preview e ficha pós-criação nunca podem divergir nesses campos — é o mesmo componente, não duas implementações.

---

## Notas de implementação

- **`abilityModifier` lança exceção para score fora de 3–20** (`packages/shared/src/ability.ts:22-26`); `adventure.service.ts:102` por isso usa `attrs['constitution'] ?? 10` cru em vez de chamar `abilityModifier` direto — a revisão precisa do MESMO fallback (`attrs['constitution'] ?? 10`) antes de passar pra `abilityModifier`, senão um sistema custom sem atributo `constitution` quebra a etapa inteira.
- **`getClassFeatures`/`getClassSpells` + `resolveSheetEntries`, não indexação direta do config.** A ideia original era ler `config.classFeatures[classKey]` à mão; a implementação reusa a MESMA dupla de funções que `character.service.ts` (persistência) e `page.tsx` (leitura da ficha) já usam — o preview literalmente calcula "o que vai ser salvo" e resolve "como isso aparece no locale ativo" pelos dois caminhos existentes, em vez de reimplementar o `map[classKey] ?? map.default` que a US-100 já resolveu duas vezes noutro lugar.
- **Por que extrair componente em vez de só igualar os campos:** igualar os campos a mão (copiar o JSX da ficha pra revisão) resolve hoje e reabre a mesma lacuna no primeiro campo novo que alguém adicionar só de um lado — o próprio motivo desta story existir. Extrair `BackgroundPanel`/`FeaturesPanel` torna a divergência estruturalmente impossível: um componente, dois consumidores.
- **`getStartingInventory` muda de pacote, não de assinatura** — `apps/api` troca só o import; nenhum teste de contrato da API muda.

---

## Referências no código

- [apps/web/src/components/setup/SetupWizard.tsx:557](../../../apps/web/src/components/setup/SetupWizard.tsx:557) — etapa `review`, com os blocos novos.
- [apps/web/src/components/character/BackgroundPanel.tsx](../../../apps/web/src/components/character/BackgroundPanel.tsx) — extraído de `GameView.tsx`; consumido por `GameView` e pela etapa `review`.
- [apps/web/src/components/character/FeaturesPanel.tsx](../../../apps/web/src/components/character/FeaturesPanel.tsx) — idem.
- [apps/web/src/components/game/GameView.tsx](../../../apps/web/src/components/game/GameView.tsx) — ficha em jogo, agora só CONSOME os dois painéis acima.
- [apps/web/src/app/play/[adventureId]/page.tsx:56-60](../../../apps/web/src/app/play/[adventureId]/page.tsx:56) — `getClassFeatures`/`getClassSpells` + `resolveSheetEntries`, o mesmo encadeamento que o preview da revisão reusa.
- [packages/shared/src/starting-kit.ts](../../../packages/shared/src/starting-kit.ts) — `getStartingInventory`/`getClassFeatures`/`getClassSpells`, realocadas de `apps/api/src/character/starting-inventory.ts`.
- [apps/api/src/character/starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — só `resolveInitialHook`/`resolveHookTemplate` depois da realocação.
- [apps/api/src/adventure/adventure.service.ts:102-103](../../../apps/api/src/adventure/adventure.service.ts:102) — fórmula de PV inicial (`10 + conMod`) que o preview espelha.
- [packages/shared/src/ability.ts](../../../packages/shared/src/ability.ts) — `abilityModifier`, `formatModifier`, `buildSkillSheet`.
- [packages/shared/src/types/system.ts:98-143](../../../packages/shared/src/types/system.ts:98) — `SystemConfigSchema` (`startingKits`, `classFeatures`, `classSpells`), já carregado no wizard via `system.config`.
- [US-45](./US-45-background-na-ficha-da-interface.md) / [US-41](./US-41-features-traits-de-classe.md) / [US-51](./US-51-kits-iniciais-do-srd.md) — origem dos componentes/funções reaproveitados.
