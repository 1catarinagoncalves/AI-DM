import { z } from 'zod'
import { GeneratedAdventureSchema } from '@ai-dm/shared'

/**
 * US-256: a "fatia inicial" da aventura — o que a chamada 1A escreve (world/summary/story/
 * factions/npcs/locations/start), JÁ com ids mintados. Derivada do schema do artefato final (`pick`,
 * não cópia) pra nunca divergir dele: a união fatia + resto tem de cobrir `GeneratedAdventure`
 * campo a campo (teste em adventure-authoring.test.ts). É imutável depois de liberada — o gate
 * reprovado regenera só a 1B, então mundo/NPCs/locais que a jogadora leu são os do artefato final.
 */
export const AdventureSliceSchema = GeneratedAdventureSchema.pick({
  id: true,
  levelRange: true,
  registry: true,
  summary: true,
  world: true,
  story: true,
  factions: true,
  npcs: true,
  locations: true,
  start: true,
  generationModel: true,
})

export type AdventureSlice = z.infer<typeof AdventureSliceSchema>

/**
 * US-256: envelope gravado em `Adventure.authoredSlice`. `challenge` e `namingRegister` viajam junto
 * porque não existem em nenhum outro lugar depois da criação (o DTO e o sorteio do reseed não são
 * persistidos) e o "tentar de novo" da 1B precisa deles: `challenge` pro orçamento de combate e pro
 * gate, `namingRegister` pra os nomes NOVOS da 1B (item de recompensa etc.) soarem no mesmo
 * registro do mundo que a fatia já escreveu.
 */
export const AuthoredSliceRecordSchema = z.object({
  slice: AdventureSliceSchema,
  challenge: z.enum(['adventure', 'challenge']),
  namingRegister: z.string().min(1),
})

export type AuthoredSliceRecord = z.infer<typeof AuthoredSliceRecordSchema>
