import { describe, it, expect } from 'vitest'
import { CreateCharacterSchema } from './character.schema'

// US-40: o Zod do controller corta chaves desconhecidas no `.parse()`. Se `deity`
// não estiver no schema, é silenciosamente descartado ANTES do service — foi esse
// o bug (divindade preenchida no wizard não persistia). Este teste tranca a barreira.

const base = {
  userId: 'u1', systemId: 'sys-1', name: 'Seraphine', gender: 'Feminino',
  race: 'Humano', class: 'Paladino', attributes: { forca: 16 },
}

describe('CreateCharacterSchema — background.deity (US-40)', () => {
  it('preserva a divindade (nome + portfolio) no parse', () => {
    const dto = CreateCharacterSchema.parse({
      ...base,
      background: { deity: { name: 'Solariel', portfolio: 'justiça e cura' } },
    })
    expect(dto.background?.deity).toEqual({ name: 'Solariel', portfolio: 'justiça e cura' })
  })

  it('aceita divindade só com nome (portfolio opcional)', () => {
    const dto = CreateCharacterSchema.parse({ ...base, background: { deity: { name: 'Tymora' } } })
    expect(dto.background?.deity).toEqual({ name: 'Tymora' })
  })

  it('background sem divindade continua válido', () => {
    const dto = CreateCharacterSchema.parse({ ...base, background: { story: 'Uma andarilha' } })
    expect(dto.background?.deity).toBeUndefined()
  })
})
