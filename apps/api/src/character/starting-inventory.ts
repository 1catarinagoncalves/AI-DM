import type { InitialAdventureHook, SystemConfig } from '@ai-dm/shared'

// US-127: `getStartingInventory`/`getClassFeatures`/`getClassSpells` mudaram de casa para
// packages/shared/src/starting-kit.ts — a etapa `review` do wizard (apps/web) precisa do MESMO
// lookup que a criação usa para persistir, e web não importa de apps/api. `resolveInitialHook`/
// `resolveHookTemplate` ficam aqui: só a adventure (apps/api) os usa, depois que o personagem
// já foi criado — não fazem parte do preview da criação.

/**
 * Escolhe o gancho de aventura inicial pela classe do personagem (US-28). `classKey` do hook
 * é a chave canônica EN desde a US-54, e desde a US-105 `Character.class` também é — logo a
 * comparação é direta. Classe sem gancho próprio cai no hook `default`. Devolve null só
 * quando o sistema não traz catálogo algum.
 */
export function resolveInitialHook(config: SystemConfig, classKey: string): InitialAdventureHook | null {
  const hooks = config.initialAdventures?.hooks
  if (!hooks || hooks.length === 0) return null
  return hooks.find((h) => h.classKey === classKey) ?? hooks.find((h) => h.classKey === 'default') ?? null
}

/** Resolve placeholders do hook antes de persistir. Suporta {characterName} e {characterClass}. */
export function resolveHookTemplate(
  text: string,
  vars: { characterName: string; characterClass: string },
): string {
  return text
    .replace(/\{characterName\}/g, vars.characterName)
    .replace(/\{characterClass\}/g, vars.characterClass)
}
