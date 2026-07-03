import type { ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

// Gera o schema OpenAPI de um body a partir do MESMO schema Zod que o valida em
// runtime — fonte única, a doc atualiza-se sozinha quando o schema muda. O
// `example` é opcional e só ilustra (não influencia a validação).
export function zodBody(schema: ZodType, example?: unknown): SchemaObject {
  // any: as tipagens genéricas do zodToJsonSchema causam TS2589 ("type
  // instantiation excessively deep") ao inferir sobre ZodType; cortamos a
  // inferência aqui. O output em runtime é um JSON Schema válido.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (zodToJsonSchema as any)(schema, { target: 'openApi3', $refStrategy: 'none' }) as SchemaObject
  return example === undefined ? s : { ...s, example }
}
