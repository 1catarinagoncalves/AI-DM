import type { ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

// Gera o schema OpenAPI de um body a partir do MESMO schema Zod que o valida em
// runtime — fonte única, a doc atualiza-se sozinha quando o schema muda. O
// `example` é opcional e só ilustra (não influencia a validação).
export function zodBody(schema: ZodType, example?: unknown): SchemaObject {
  const s = zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) as SchemaObject
  return example === undefined ? s : { ...s, example }
}
