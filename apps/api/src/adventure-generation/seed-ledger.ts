import type { GeneratedAdventure, WorldEntity } from '@ai-dm/shared'
import { MONSTER_ROLE_CR } from './monster-roles'

/**
 * US-151: semeia o ledger `Adventure.entities` a partir do artefato JÁ VALIDADO pelo gate
 * (US-150) — substitui `extractOpeningEntities` (ai.service.ts) como fonte quando a
 * aventura vem do motor: leitura determinística de um objeto estruturado, não extração
 * por LLM de prosa livre. Síncrona de propósito (sem chamada de rede).
 *
 * NPC de combate (`role` ∈ `MONSTER_ROLE_CR`) é filtrado de `npcEntities` — não é entidade
 * nomeada durável, é um combatente genérico ("Brute", "Soldier") que morre no próprio
 * encontro. US-171: mas a AMEAÇA em si precisa chegar ao Mestre antes do confronto —
 * ver `encounterNpcEntities` abaixo, semeada de `adventure.encounters` (não de `npcs[]`
 * direto), `revelado: false` (ameaça ainda não descoberta).
 */
export function seedLedgerFromGeneratedAdventure(adventure: GeneratedAdventure): WorldEntity[] {
  const now = new Date().toISOString()
  const locationTitleById = new Map(adventure.locations.map((l) => [l.id, l.title]))
  // US-189: o antagonista já é um AdventureNpc (US-188) — excluído por `id`, sempre
  // incondicional, dos dois mapeamentos abaixo que iterariam `npcs`/`encounters.npcIds` por
  // engano. As entradas dele no ledger (pública/oculta, US-191) nascem ao final da função.
  const antagonistNpcId = adventure.antagonist.npcId

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
    .filter((npc) => !(npc.role in MONSTER_ROLE_CR) && npc.id !== antagonistNpcId)
    .map((npc) => ({
      nome: npc.name,
      tipo: 'npc',
      local: findOccupiedLocationTitle(adventure, npc.id),
      nota: npc.role,
      revelado: true,
      atualizadoEm: now,
    }))

  // US-166: cada encontro que hospeda um local soma um segmento de situação (Sly Flourish:
  // type/goal/behaviors/complications) à `nota` — vários encontros no mesmo local (piso de
  // 8 locais é só instrução de prompt, não garantia de código) se acumulam, separados por " | ".
  const encountersByLocationId = new Map<string, typeof adventure.encounters>()
  for (const encounter of adventure.encounters) {
    const list = encountersByLocationId.get(encounter.locationId) ?? []
    list.push(encounter)
    encountersByLocationId.set(encounter.locationId, list)
  }

  // US-170: prosa de `boxedText`/`aspects` (US-158) ficava órfã — nunca lida fora do
  // teste. `revelado: false` sempre: nenhum local nasce "conhecido" (Questão #1 da US).
  const locationEntities: WorldEntity[] = adventure.locations.map((location) => {
    const baseNota = [location.boxedText, location.aspects.join(', ')].filter(Boolean).join(' — ')
    const encounterSegments = (encountersByLocationId.get(location.id) ?? [])
      .map((e) => `${e.type} — objetivo: ${e.goal}; comportamento: ${e.behaviors}; complicação: ${e.complications}`)
    const nota = encounterSegments.length > 0 ? [baseNota, ...encounterSegments].join(' | ') : baseNota
    return {
      nome: location.title,
      tipo: 'local',
      nota,
      revelado: false,
      atualizadoEm: now,
    }
  })

  // US-171/US-166: itera só encontros `type === 'combat'` — `skill`/`social` nunca têm
  // combatente orçado (`npcIds` deles nunca contém role de `MONSTER_ROLE_CR`, mas o filtro
  // explícito por `type` deixa a invariante robusta a mudança futura). `nome` inclui o `id`
  // porque `role` se repete no mesmo encontro (3 Soldier).
  const encounterNpcEntities: WorldEntity[] = adventure.encounters
    .filter((encounter) => encounter.type === 'combat')
    .flatMap((encounter) => {
      const local = locationTitleById.get(encounter.locationId)
      return encounter.npcIds
        .filter((npcId) => npcId !== antagonistNpcId)
        .map((npcId) => adventure.npcs.find((npc) => npc.id === npcId))
        .filter((npc): npc is (typeof adventure.npcs)[number] => npc !== undefined)
        .map((npc) => ({
          nome: `${npc.role} (${npc.id})`,
          tipo: 'npc' as const,
          local,
          nota: npc.role,
          revelado: false,
          atualizadoEm: now,
        }))
    })

  // US-189/US-191: `want`/`method`/`trait`/`weakness`/`connection` só existiam no artefato,
  // nunca chegavam ao Mestre durante o turno — mesmo mecanismo `revelado: false` de segredo/
  // local/combatente (US-151/170/171). `.at(-1)` em vez de `[length - 1]!`: encontro final
  // SEMPRE existe hoje (US-166), mas `.at` devolve `undefined` em vez de lançar se essa
  // garantia algum dia quebrar — a função degrada (ledger sem entrada do antagonista) em vez
  // de derrubar toda a geração.
  //
  // US-191: o NOME do antagonista deixou de ser segredo (Parte 2 já libera nomeá-lo desde a
  // abertura) — DUAS entradas em vez de uma: `antagonistPublicEntity` (nome, local,
  // sem `nota`) e `antagonistHiddenEntity` (mesmo nome — `WorldEntity.nome` é obrigatório,
  // não dá pra omitir sem mudar schema — `nota` com want/method/trait/weakness/connection,
  // `revelado: false`, o que ainda importa proteger até o confronto).
  //
  // US-199: reverte a Parte 2 — `antagonistPublicEntity` nasce `revelado: false` também.
  // O Mestre continua vendo nome+local (precisa, pra ser consistente), mas sob `⚠ OCULTO`
  // até promover via `recordEntity`. A ORDEM do `return` abaixo (pública ANTES da oculta)
  // é o que faz essa promoção acertar só a pública — `mergeEntities` patcheia a PRIMEIRA
  // ocorrência por `nome` (`findIndex`) — sem isso, `recordEntity({ revelado: true })`
  // promoveria a oculta junto e vazaria weakness/method no turno errado.
  const finalEncounter = adventure.encounters.at(-1)
  const antagonistLocal = finalEncounter && locationTitleById.get(finalEncounter.locationId)
  const antagonistPublicEntity: WorldEntity | undefined = finalEncounter && {
    nome: adventure.antagonist.name,
    tipo: 'npc',
    local: antagonistLocal,
    revelado: false,
    atualizadoEm: now,
  }
  const antagonistHiddenEntity: WorldEntity | undefined = finalEncounter && {
    nome: adventure.antagonist.name,
    tipo: 'npc',
    local: antagonistLocal,
    nota: [
      `Quer: ${adventure.antagonist.want}`,
      `Método: ${adventure.antagonist.method}`,
      `Traço: ${adventure.antagonist.trait}`,
      `Fraqueza: ${adventure.antagonist.weakness}`,
      `Conexão: ${adventure.antagonist.connection}`,
    ].join(' — '),
    revelado: false,
    atualizadoEm: now,
  }

  return [
    ...secretEntities,
    ...npcEntities,
    ...locationEntities,
    ...encounterNpcEntities,
    ...(antagonistPublicEntity ? [antagonistPublicEntity] : []),
    ...(antagonistHiddenEntity ? [antagonistHiddenEntity] : []),
  ]
}

// NPC narrativo nunca aparece em `encounters[].npcIds` (só combate aparece lá) — o
// reverse-lookup certo é `locations[].occupants[]`, que já guarda `id` (não nome, US-158).
function findOccupiedLocationTitle(adventure: GeneratedAdventure, npcId: string): string | undefined {
  return adventure.locations.find((location) => location.occupants.includes(npcId))?.title
}
