import { z } from 'zod'

// US-144: fala escrita do NPC numa interação — as PALAVRAS EXATAS, não descrição de
// personalidade (isso fica em AdventureNpcSchema.role). `encounterId` ausente = interação
// fora de combate (ex.: NPC encontrado num local sem encontro estruturado).
const AdventureNpcInteractionSchema = z.object({
  encounterId: z.string().min(1).optional(),
  narrative: z.string().min(1),
})

export const AdventureNpcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  interactions: z.array(AdventureNpcInteractionSchema),
})

// Segredo/pista (os 40 prompts do LGMRD, US-149) — só `text`, de propósito. Nunca ganha
// `narrative`: segredo é fato, não fala de NPC (ver AdventureNpcSchema.interactions acima).
// `locationId` referencia AdventureLocationSchema.id — vínculo verificável, não nome repetido.
export const AdventureSecretSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  text: z.string().min(1),
})

export const AdventureLocationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  aspects: z.array(z.string()),
  boxedText: z.string().min(1),
  description: z.string().min(1),
  occupants: z.array(z.string()),
})

// `locationId` referencia AdventureLocationSchema.id; `npcIds[]` referencia AdventureNpcSchema.id.
export const AdventureEncounterSchema = z.object({
  id: z.string().min(1),
  locationId: z.string().min(1),
  npcIds: z.array(z.string()),
})

// US-144 / ADR-012: schema único do artefato de aventura gerada (os Eight Steps do LGMRD).
// Referência cruzada é sempre por `id` (nunca texto livre) — o grafo fechar é responsabilidade
// do gate da US-150, não deste schema. `setting`/`tone`/`areaType` guardam a CHAVE canônica,
// mesmo contrato de catalogLabel (US-105) — rótulo se resolve na leitura, não aqui.
export const GeneratedAdventureSchema = z.object({
  id: z.string().min(1),
  levelRange: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  setting: z.string().min(1),
  tone: z.string().min(1),
  areaType: z.string().min(1),
  summary: z.string().min(1),
  npcs: z.array(AdventureNpcSchema),
  secrets: z.array(AdventureSecretSchema),
  locations: z.array(AdventureLocationSchema),
  encounters: z.array(AdventureEncounterSchema),
  start: z.string().min(1),
  conclusion: z.string().min(1),
  followUps: z.array(z.string()),
})

export type AdventureNpc = z.infer<typeof AdventureNpcSchema>
export type AdventureSecret = z.infer<typeof AdventureSecretSchema>
export type AdventureLocation = z.infer<typeof AdventureLocationSchema>
export type AdventureEncounter = z.infer<typeof AdventureEncounterSchema>
export type GeneratedAdventure = z.infer<typeof GeneratedAdventureSchema>
