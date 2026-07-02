import { z } from 'zod'

export const SystemAttributeSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  min: z.number().int(),
  max: z.number().int(),
  default: z.number().int(),
})

const StartingKitItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().min(1),
})

export const SystemConfigSchema = z.object({
  attributes: z.array(SystemAttributeSchema).min(1),
  startingKits: z.record(z.string(), z.array(StartingKitItemSchema))
    .refine(kits => 'default' in kits, { message: 'startingKits precisa de uma chave "default"' }),
})

export type SystemAttribute = z.infer<typeof SystemAttributeSchema>
export type SystemConfig = z.infer<typeof SystemConfigSchema>

/** Zod dinâmico: um campo por atributo do sistema, min/max do próprio config. Rejeita chaves fora do config. */
export function buildCharacterAttributesSchema(attributes: SystemAttribute[]) {
  const shape = Object.fromEntries(
    attributes.map(a => [a.key, z.number().int().min(a.min).max(a.max)]),
  )
  return z.object(shape).strict()
}
