import { z } from 'zod'

// US-232: NPC ganha `want` (motivação individual — carrega o antagonismo agora que
// `antagonist` saiu; NPC neutro tem `want` sem `factionId`) e `factionId?` (vínculo
// filho→facção, direção única — aponta pra factions[].id; o gate checa que o id existe).
// US-242: `interactions` (fala pré-escrita na autoria) saiu — nunca era lida no turno ao
// vivo, a fala do NPC é sempre gerada fresca pelo Mestre (ver ADR/story para o porquê).
// US-233: `combatRole?` — papel de statblock (Minion/Soldier/Brute, US-152), preenchido pelo
// PASSO 2 determinístico pra NPC que é inimigo de encontro `combat`. Ausente pra NPC narrativo.
// NÃO é `role` (texto narrativo livre, US-232) — valores espelham MonsterRole
// (apps/api/src/adventure-generation/monster-roles.ts) por VALOR LITERAL, não por import
// (shared não pode depender de apps/api).
// US-252: `nominalCreature?` — nome de criatura do bestiário SRD (US-251) escolhido pra dar
// forma ficcional ao `combatRole` (ex.: Soldier → "Orc"), em inglês. Insumo pra quem narra, não
// rótulo exposto cru — ausente pra NPC sem combatRole.
export const AdventureNpcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  want: z.string().min(1),
  factionId: z.string().min(1).optional(),
  combatRole: z.enum(['Minion', 'Soldier', 'Brute']).optional(),
  nominalCreature: z.string().min(1).optional(),
})

// US-232: mundo autoral nomeado (ex.: "Khemsar, o Mar de Areia") — DISTINTO da chave
// coarse `setting` do registry, que sobrevive só como dimensão de filtro/eval.
export const AdventureWorldSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  anchors: z.array(z.string()).optional(), // locais-âncora nomeados
})

// US-232: facção de 1ª classe (antes só existia `npc.role` solto). Quantidade sorteada em
// [2,4] no Game Server (roll-registry.ts); os `want` colidem — SÃO o antagonismo, agora que
// `antagonist` saiu do schema. Facção NÃO vira seção de render (D8): dissolve em Story/NPCs.
export const AdventureFactionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1), // poder / submundo / culto / …
  want: z.string().min(1),
})

// US-232: meta + item de prêmio (efeito em ficção, SEM números) + local onde resolve.
// Substitui o `objective: string` da US-169 — cresce pra objeto (seção Objective do D8).
export const AdventureObjectiveSchema = z.object({
  description: z.string().min(1),
  reward: z.object({ name: z.string().min(1), effect: z.string().min(1) }), // efeito em ficção, sem números
  locationId: z.string().min(1), // onde resolve
})

// US-232: obstáculo NÃO-COMBATE preso a local. `test` é perícia/atributo nomeado SEM CD.
// Distinto de `encounters[]` (combate) e da `hazardTable` removida (d8 rolável aleatória).
export const AdventureChallengeSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  test: z.string().min(1), // perícia/atributo nomeado, SEM CD
  situation: z.string().min(1),
  consequence: z.string().min(1),
})

// US-232: fecho ramificado sem herói (~3 rumos, cada um com custo, nenhum "o certo").
// SUBSTITUI `conclusion` (string), que saiu.
export const AdventureResolutionBranchSchema = z.object({
  choice: z.string().min(1),
  consequence: z.string().min(1),
})

// US-232: `location.factionId?` — vínculo filho→facção, direção única pro gate.
export const AdventureLocationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  aspects: z.array(z.string()),
  boxedText: z.string().min(1),
  description: z.string().min(1),
  occupants: z.array(z.string()),
  factionId: z.string().min(1).optional(),
  // US-187: mesmos 3 valores de AdventureEncounterSchema.type — que tipo de cena este
  // local puxa melhor, decidido pelo modelo na mesma chamada que escreve o resto da
  // prosa. Só consumido pela distribuição de locationId (US-166), nunca pelo ledger.
  vibe: z.enum(['combat', 'skill', 'social']),
})

// `locationId` referencia AdventureLocationSchema.id; `npcIds[]` referencia AdventureNpcSchema.id.
// US-166: cada encontro é uma SITUAÇÃO completa (framework Sly Flourish — location=locationId,
// inhabitants=npcIds, behaviors/goal/complications fecham as outras 3 perguntas). `type` guia
// o QUE o modelo escreve (skill→obstáculo físico/ambiental, social→negociação, combat→ameaça e
// cerco) mas não trava perícia — a perícia rolada no turno continua 100% emergente.
// US-232: ganha `fiction` — a NARRATIVA da cena (o "blob" de Situação que o exemplar escreve,
// o que o render/export mostra ao jogador); behaviors/goal/complications/unlocks continuam
// como a DECOMPOSIÇÃO Sly Flourish extraída da mesma cena, consumida por motor/ledger.
export const AdventureEncounterSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  npcIds: z.array(z.string()),
  type: z.enum(['combat', 'skill', 'social']),
  fiction: z.string().min(1),
  behaviors: z.string().min(1),
  goal: z.string().min(1),
  complications: z.string().min(1),
  // US-193: o elo da trilha (hurdles-based design, The Arcane Library). O que este encontro
  // ENTREGA — informação, acesso, aliado, recurso — que faz o próximo existir. Na posição 8
  // descreve o que a vitória resolve, não um próximo encontro. Sem id: o vínculo é a ordem.
  // Campo de AUTORIA: nenhum código de runtime o lê (fica fora do ledger, ver Fora do escopo).
  // Aventuras geradas antes desta story não têm `unlocks` e NÃO revalidam contra este schema —
  // reparse de artefato antigo não é caminho suportado; não há backfill.
  unlocks: z.string().min(1),
})

// `setting`/`tone`/`areaType` guardam a CHAVE canônica, mesmo contrato de catalogLabel
// (US-105) — rótulo se resolve na leitura, não aqui.
export const AdventureRegistrySchema = z.object({
  setting: z.string().min(1),
  tone: z.string().min(1),
  areaType: z.string().min(1),
})

// US-144 / ADR-012: schema único do artefato de aventura gerada.
// US-232: autoria mundo-primeiro (D5/D6) — o schema CRESCE (não substitui a US-144):
//   + world, factions[], story, objective (objeto), challenges[], branchedResolution[]
//   − conclusion (→ branchedResolution), antagonist (→ factions[].want + Final ligado ao
//     fecho), secrets (autoria mundo-primeiro não gera segredos).
// Referência cruzada é sempre por `id` (nunca texto livre) — o grafo fechar é responsabilidade
// do gate da US-150, não deste schema. `registry` é o mesmo objeto decidido por `rollRegistry`
// (dimensão de filtro/eval), independente do `world` autoral.
export const GeneratedAdventureSchema = z.object({
  id: z.string().min(1),
  levelRange: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  registry: AdventureRegistrySchema,
  // US-144: sinopse curta (uma linha, lista/Quest). `story` (abaixo) é a narrativa central.
  summary: z.string().min(1),
  world: AdventureWorldSchema,
  // US-232: seção Story do exemplar em prosa coesa (conflito central + forças em jogo — as
  // facções dissolvidas na narrativa). ⚠ DISTINTO de `Character.story` (background do jogador,
  // que entra como TOM): mesmo nome, objetos diferentes — sempre qualificar `adventure.story`.
  story: z.string().min(1),
  factions: z.array(AdventureFactionSchema),
  npcs: z.array(AdventureNpcSchema),
  locations: z.array(AdventureLocationSchema),
  challenges: z.array(AdventureChallengeSchema),
  encounters: z.array(AdventureEncounterSchema),
  start: z.string().min(1),
  objective: AdventureObjectiveSchema,
  // US-232: fecho ramificado obrigatório — ≥1 ramo, na prática acompanha a contagem de facções.
  branchedResolution: z.array(AdventureResolutionBranchSchema).min(1),
  followUps: z.array(z.string()),
  // modelId do arm da escada `authoringModels` (model.ts) que gerou a autoria — proveniência
  // pra comparar qualidade entre modelos sem precisar dos logs. Opcional: artefato pré-existente
  // não tem esse dado e não revalida contra o schema (mesma postura de `unlocks` acima).
  generationModel: z.string().min(1).optional(),
  // US-256: a autoria virou 2 chamadas (fatia 1A + resto 1B), cada uma com sua escada — `generationModel`
  // guarda o arm da 1A (a prosa que a jogadora lê primeiro: mundo/NPCs/locais/gancho); este guarda o da 1B
  // (encontros/desafios/fecho). Opcional pelo mesmo motivo de `generationModel`.
  restGenerationModel: z.string().min(1).optional(),
})

export type AdventureNpc = z.infer<typeof AdventureNpcSchema>
export type AdventureChallenge = z.infer<typeof AdventureChallengeSchema>
export type AdventureLocation = z.infer<typeof AdventureLocationSchema>
export type AdventureEncounter = z.infer<typeof AdventureEncounterSchema>
export type AdventureRegistry = z.infer<typeof AdventureRegistrySchema>
export type GeneratedAdventure = z.infer<typeof GeneratedAdventureSchema>
