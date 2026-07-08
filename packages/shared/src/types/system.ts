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

// Perícia do sistema (US-27). `ability` referencia a `key` de um atributo do
// próprio config; o modificador da perícia deriva desse atributo + proficiência.
export const SystemSkillSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  ability: z.string().min(1),
})

// Gancho de aventura inicial por classe (US-28). Textos podem conter placeholders
// {characterName} e {characterClass}, resolvidos no backend antes de persistir.
export const InitialAdventureHookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  // Classe base à qual se aplica, ou 'default' (fallback para classes desconhecidas/custom).
  classKey: z.string().min(1),
  pitch: z.string().min(1),
  primaryQuestTitle: z.string().min(1),
  primaryQuestDescription: z.string().min(1),
  openingNarration: z.string().min(1),
  tags: z.array(z.string()).default([]),
})

export const SystemConfigSchema = z.object({
  attributes: z.array(SystemAttributeSchema).min(1),
  startingKits: z.record(z.string(), z.array(StartingKitItemSchema))
    .refine(kits => 'default' in kits, { message: 'startingKits precisa de uma chave "default"' }),
  // Orçamento de point-buy da etapa de Atributos (US-26). Ausente → inputs livres min/max.
  pointBuy: z.object({ budget: z.number().int().positive() }).optional(),
  // Perícias do sistema (US-27). Ausente → etapa de Perícias inativa. Quando presente,
  // `proficiency.choices` proficiências são escolhidas na criação, cada uma somando
  // `proficiency.bonus` ao modificador do atributo-âncora.
  skills: z.array(SystemSkillSchema).optional(),
  proficiency: z.object({
    choices: z.number().int().min(0),
    bonus: z.number().int(),
  }).optional(),
  // Catálogo de aventuras iniciais (US-28). Opcional para não invalidar configs legados;
  // quando presente, precisa de um hook classKey 'default' obrigatório.
  initialAdventures: z.object({
    hooks: z.array(InitialAdventureHookSchema).min(1)
      .refine(hooks => hooks.some(h => h.classKey === 'default'), {
        message: 'initialAdventures.hooks precisa de um hook com classKey "default"',
      }),
  }).optional(),
})

export type SystemAttribute = z.infer<typeof SystemAttributeSchema>
export type SystemSkill = z.infer<typeof SystemSkillSchema>
export type InitialAdventureHook = z.infer<typeof InitialAdventureHookSchema>
export type SystemConfig = z.infer<typeof SystemConfigSchema>

/** Zod dinâmico: um campo por atributo do sistema, min/max do próprio config. Rejeita chaves fora do config. */
export function buildCharacterAttributesSchema(attributes: SystemAttribute[]) {
  const shape = Object.fromEntries(
    attributes.map(a => [a.key, z.number().int().min(a.min).max(a.max)]),
  )
  return z.object(shape).strict()
}
