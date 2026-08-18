import type { GeneratedAdventure, WorldEntity } from '@ai-dm/shared'
import { MONSTER_ROLE_CR } from './monster-roles'

/**
 * US-151: semeia o ledger `Adventure.entities` a partir do artefato JÁ VALIDADO pelo gate
 * (US-150) — substitui `extractOpeningEntities` (ai.service.ts) como fonte quando a
 * aventura vem do motor: leitura determinística de um objeto estruturado, não extração
 * por LLM de prosa livre. Síncrona de propósito (sem chamada de rede).
 *
 * NPC de combate (`role` ∈ `MONSTER_ROLE_CR`) é filtrado — não é entidade nomeada durável,
 * é um combatente genérico ("Brute", "Soldier") que morre no próprio encontro.
 */
export function seedLedgerFromGeneratedAdventure(adventure: GeneratedAdventure): WorldEntity[] {
  const now = new Date().toISOString()
  const locationTitleById = new Map(adventure.locations.map((l) => [l.id, l.title]))

  const secretEntities: WorldEntity[] = adventure.secrets.map((secret) => ({
    nome: secret.id,
    tipo: 'outro',
    local: locationTitleById.get(secret.locationId),
    nota: secret.text,
    sabido: 'publico',
    revelado: false,
    atualizadoEm: now,
  }))

  const npcEntities: WorldEntity[] = adventure.npcs
    .filter((npc) => !(npc.role in MONSTER_ROLE_CR))
    .map((npc) => ({
      nome: npc.name,
      tipo: 'npc',
      local: findOccupiedLocationTitle(adventure, npc.id),
      nota: npc.role,
      revelado: true,
      atualizadoEm: now,
    }))

  return [...secretEntities, ...npcEntities]
}

// NPC narrativo nunca aparece em `encounters[].npcIds` (só combate aparece lá) — o
// reverse-lookup certo é `locations[].occupants[]`, que já guarda `id` (não nome, US-158).
function findOccupiedLocationTitle(adventure: GeneratedAdventure, npcId: string): string | undefined {
  return adventure.locations.find((location) => location.occupants.includes(npcId))?.title
}
