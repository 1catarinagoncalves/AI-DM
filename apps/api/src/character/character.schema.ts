import { z } from 'zod'

/**
 * FONTE DE VERDADE do contrato de criação de personagem.
 *
 * O schema Zod é a trust boundary (valida o input do cliente no controller) E a
 * origem do tipo do service (`CreateCharacterDto = z.infer<...>`). Assim as duas
 * camadas NÃO PODEM divergir: um campo que não estiver aqui não existe no tipo,
 * e o código do service que o usar não compila.
 *
 * Motivação (US-40): `deity` foi adicionado à interface do service e ao render,
 * mas não a este schema. Como `.parse()` DESCARTA chaves desconhecidas em
 * silêncio, a divindade era cortada antes do service — sem erro, sem persistir.
 * Com o tipo derivado do schema, esquecer o schema quebra o build, não a gravação.
 *
 * Regra ao adicionar um campo: edite ESTE schema. O tipo do service vem de graça;
 * o web (`apps/web/src/lib/api.ts`) é o único outro ponto e deve espelhar a forma.
 */
export const CreateCharacterSchema = z.object({
  userId: z.string().min(1),
  systemId: z.string().min(1),
  name: z.string().min(1).max(60),
  gender: z.string().min(1).max(40),
  race: z.string().min(1).max(40),
  class: z.string().min(1).max(40),
  // Atributos dinâmicos: validados contra System.config.attributes no service, não aqui.
  attributes: z.record(z.string(), z.number()),
  // Perícias proficientes (US-27): keys validadas contra System.config.skills no service.
  skills: z.array(z.string()).optional(),
  // Background narrativo (US-39/US-40): texto livre, normalizado no service. Limites de
  // tamanho são guarda de trust boundary (input do cliente).
  background: z.object({
    story: z.string().max(2000).optional(),
    ideals: z.array(z.string().max(500)).max(20).optional(),
    bonds: z.array(z.string().max(500)).max(20).optional(),
    flaws: z.array(z.string().max(500)).max(20).optional(),
    // Divindade/patrono (US-40): nome + portfólio, normalizado no service.
    deity: z.object({
      name: z.string().max(100),
      portfolio: z.string().max(500).optional(),
    }).optional(),
  }).optional(),
})

/** Tipo do DTO do service, derivado do schema — nunca declarado à mão. */
export type CreateCharacterDto = z.infer<typeof CreateCharacterSchema>
