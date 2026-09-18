import type { GeneratedAdventure, WorldEntity } from '@ai-dm/shared'
import { MONSTER_ROLE_CR } from './monster-roles'

/**
 * US-151: semeia o ledger `Adventure.entities` a partir do artefato JÁ VALIDADO pelo gate
 * (US-150) — leitura determinística de um objeto estruturado, não extração por LLM. Síncrona.
 *
 * US-232: autoria mundo-primeiro — `antagonist`/`secrets` saíram do artefato, então as entradas
 * derivadas deles saíram daqui. Em troca, semeia o que a US-232 introduz (piso desta story; a
 * derivação avançada — revelar facção aos poucos, edges de tensão — é MA-9):
 *   - `factionEntities` (1 por facção, `tipo: 'faccao'`, `revelado: false`);
 *   - `npcEntities.nota` inclui `want` + nome da facção (quando `factionId` presente);
 *   - `locationEntities.nota` inclui um segmento por `challenges[]` do local (mesmo padrão de
 *     `encounters[]`).
 * Sem isso o ledger nasceria mais POBRE exatamente na parte que esta story existe pra melhorar.
 *
 * `revelado: false` em tudo: nenhuma entidade nasce "conhecida" — o Mestre vê nome/local sob
 * `⚠ OCULTO` (consistência) até promover via `recordEntity` quando a ficção apresentar (US-199).
 *
 * US-246: `world`/`story` tinham um único consumidor (tela de setup) e nunca chegavam ao DM
 * Agent em jogo — semeia `world.anchors[]` (`tipo: 'local'`) e uma síntese truncada de
 * `world.description`+`story` (`tipo: 'outro'`, nome = `world.name`) pra fechar essa lacuna
 * sem duplicar a prosa inteira a cada turno (custo de tokens/cache).
 */
export function seedLedgerFromGeneratedAdventure(adventure: GeneratedAdventure): WorldEntity[] {
  const now = new Date().toISOString()
  const locationTitleById = new Map(adventure.locations.map((l) => [l.id, l.title]))
  const factionNameById = new Map(adventure.factions.map((f) => [f.id, f.name]))

  // US-232: facção é entidade de 1ª classe — `tipo: 'faccao'` já existe no enum de WorldEntity
  // (character.ts), sem uso até aqui, zero mudança de schema.
  const factionEntities: WorldEntity[] = adventure.factions.map((faction) => ({
    nome: faction.name,
    tipo: 'faccao',
    nota: `${faction.kind} — quer: ${faction.want}`,
    revelado: false,
    atualizadoEm: now,
  }))

  // US-232: `nota` carrega motivação individual (`want`) e afiliação de facção — chegam ao
  // Mestre pela mesma via que `role` já chegava, sem precisar de `relacoes` (edge é vínculo
  // DESCOBERTO em jogo; afiliação de facção é fato estrutural do artefato, mesmo status de `role`).
  const npcEntities: WorldEntity[] = adventure.npcs
    .filter((npc) => !(npc.role in MONSTER_ROLE_CR))
    .map((npc) => ({
      nome: npc.name,
      tipo: 'npc',
      local: findOccupiedLocationTitle(adventure, npc.id),
      nota: [
        npc.role,
        npc.want && `Quer: ${npc.want}`,
        npc.factionId && `Facção: ${factionNameById.get(npc.factionId) ?? npc.factionId}`,
      ].filter(Boolean).join(' — '),
      revelado: false,
      atualizadoEm: now,
    }))

  // US-166/US-232: cada encontro/desafio que hospeda um local soma um segmento à `nota` — sem
  // isso o obstáculo não-combate de um local nunca chega ao ledger (mesma lacuna que existiria
  // pra encontro se a US não portasse behaviors/goal/complications).
  const encountersByLocationId = new Map<string, typeof adventure.encounters>()
  for (const encounter of adventure.encounters) {
    const list = encountersByLocationId.get(encounter.locationId) ?? []
    list.push(encounter)
    encountersByLocationId.set(encounter.locationId, list)
  }
  const challengesByLocationId = new Map<string, typeof adventure.challenges>()
  for (const challenge of adventure.challenges) {
    const list = challengesByLocationId.get(challenge.locationId) ?? []
    list.push(challenge)
    challengesByLocationId.set(challenge.locationId, list)
  }

  const locationEntities: WorldEntity[] = adventure.locations.map((location) => {
    const baseNota = [location.boxedText, location.aspects.join(', ')].filter(Boolean).join(' — ')
    const encounterSegments = (encountersByLocationId.get(location.id) ?? [])
      .map((e) => `${e.type} — objetivo: ${e.goal}; comportamento: ${e.behaviors}; complicação: ${e.complications}`)
    const challengeSegments = (challengesByLocationId.get(location.id) ?? [])
      .map((c) => `desafio — teste: ${c.test}; situação: ${c.situation}; consequência: ${c.consequence}`)
    const extra = [...encounterSegments, ...challengeSegments]
    const nota = extra.length > 0 ? [baseNota, ...extra].join(' | ') : baseNota
    return {
      nome: location.title,
      tipo: 'local',
      nota,
      revelado: false,
      atualizadoEm: now,
    }
  })

  // US-246: `world.anchors[]` são locais-âncora que a autoria nomeou no worldbuilding mas não
  // necessariamente materializou em `locations[]` — sem isso o Mestre não tem esse nome em
  // lugar nenhum do prompt e arrisca contradizer o que a própria autoria já decidiu.
  const anchorEntities: WorldEntity[] = (adventure.world.anchors ?? []).map((anchor) => ({
    nome: (anchor.split(' — ')[0] ?? anchor).trim(),
    tipo: 'local',
    nota: anchor,
    revelado: false,
    atualizadoEm: now,
  }))

  // US-246: síntese curta de `world.description`+`story` — não o texto integral (custo de
  // cache todo turno via `entitiesSection`, mesmo motivo da US-56) — o bastante pro Mestre não
  // inventar geografia/história que a autoria já decidiu. Truncamento determinístico: esta
  // função é síncrona por design (ver comentário no topo do arquivo); extração por LLM
  // quebraria esse contrato.
  const worldEntity: WorldEntity = {
    nome: adventure.world.name,
    tipo: 'outro',
    nota: truncateToSentence(
      `${firstSentence(adventure.world.description)} ${firstSentence(adventure.story)}`,
      300,
    ),
    revelado: false,
    atualizadoEm: now,
  }

  return [...factionEntities, ...npcEntities, ...locationEntities, ...anchorEntities, worldEntity]
}

// NPC narrativo mora em `locations[].occupants[]`, que guarda `id` (não nome, US-158).
function findOccupiedLocationTitle(adventure: GeneratedAdventure, npcId: string): string | undefined {
  return adventure.locations.find((location) => location.occupants.includes(npcId))?.title
}

function firstSentence(text: string): string {
  return text.match(/^[^.!?]*[.!?]/)?.[0].trim() ?? text.trim()
}

// US-246: corta em `maxLen`, mas recua até o último fim de frase dentro do limite — nunca
// no meio de uma palavra/frase.
function truncateToSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'))
  return lastEnd > 0 ? slice.slice(0, lastEnd + 1) : slice
}
