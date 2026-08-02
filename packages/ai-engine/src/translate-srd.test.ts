import { describe, it, expect } from 'vitest'
import { pickRequested } from './translate-srd'

// US-52: o retorno do modelo é gravado num arquivo do REPO (scripts/srd/locale/pt-BR.json),
// não numa resposta descartável. Chave inventada aqui é lixo versionado — daí o filtro.
describe('pickRequested', () => {
  const batch = [
    { key: 'spells:magic-missile', name: 'Magic Missile', description: 'You create three darts.' },
    { key: 'features:wizard_ritual-adept', name: 'Ritual Adept', description: 'You can cast rituals.' },
  ]

  it('aceita as chaves do lote e apara o espaço em branco', () => {
    const picked = pickRequested(batch, [
      { key: 'spells:magic-missile', name: ' Mísseis Mágicos ', description: 'Cria três dardos.\n' },
    ])
    expect(picked).toEqual({ 'spells:magic-missile': { name: 'Mísseis Mágicos', description: 'Cria três dardos.' } })
  })

  it('descarta chave que não foi pedida', () => {
    const picked = pickRequested(batch, [{ key: 'spells:fireball', name: 'Bola de Fogo', description: 'Explode.' }])
    expect(picked).toEqual({})
  })

  it('descarta entrada com name ou description vazios', () => {
    const picked = pickRequested(batch, [
      { key: 'spells:magic-missile', name: '', description: 'Cria três dardos.' },
      { key: 'features:wizard_ritual-adept', name: 'Adepto de Rituais', description: '   ' },
    ])
    expect(picked).toEqual({})
  })

  it('fica com a primeira quando o modelo repete a chave', () => {
    const picked = pickRequested(batch, [
      { key: 'spells:magic-missile', name: 'Mísseis Mágicos', description: 'Primeira.' },
      { key: 'spells:magic-missile', name: 'Dardos Mágicos', description: 'Segunda.' },
    ])
    expect(picked['spells:magic-missile']?.description).toBe('Primeira.')
  })
})
