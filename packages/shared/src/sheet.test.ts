import { describe, it, expect } from 'vitest'
import { resolveSheetEntries } from './types/system'
import type { SystemClassFeature, SystemSpell } from './types/system'

// US-100: a MESMA ficha (as mesmas chaves) lida com dois configs devolve dois idiomas — é este
// par que a story promete. O que muda entre as duas leituras é o config, nunca o banco.
const featuresEn: Record<string, SystemClassFeature[]> = {
  barbarian: [{ key: 'barbarian_rage', name: 'Rage', description: 'You fly into a rage.', source: 'srd' }],
  paladin: [{ key: 'paladin_lay-on-hands', name: 'Lay On Hands', description: 'Healing touch.', source: 'srd' }],
  default: [],
}
const featuresPtBr: Record<string, SystemClassFeature[]> = {
  barbarian: [{ key: 'barbarian_rage', name: 'Fúria', description: 'Você entra em fúria.', source: 'srd' }],
  paladin: [{ key: 'paladin_lay-on-hands', name: 'Impor as Mãos', description: 'Toque que cura.', source: 'srd' }],
  default: [],
}
const spellsEn: Record<string, SystemSpell[]> = {
  cleric: [{ key: 'sacred-flame', name: 'Sacred Flame', level: 0, description: 'Radiance descends.', source: 'srd' }],
  default: [],
}
const spellsPtBr: Record<string, SystemSpell[]> = {
  cleric: [{ key: 'sacred-flame', name: 'Chama Sagrada', level: 0, description: 'Um clarão desce.', source: 'srd' }],
  default: [],
}

describe('resolveSheetEntries (US-100)', () => {
  it('a mesma chave devolve o par Fúria/Rage conforme o config do locale', () => {
    const keys = ['barbarian_rage']
    expect(resolveSheetEntries(featuresPtBr, undefined, 'barbarian', keys).map(f => f.name)).toEqual(['Fúria'])
    expect(resolveSheetEntries(featuresEn, undefined, 'barbarian', keys).map(f => f.name)).toEqual(['Rage'])
  })

  it('magia resolve nos dois locales e preserva nível e descrição', () => {
    expect(resolveSheetEntries(spellsPtBr, undefined, 'cleric', ['sacred-flame'])[0])
      .toMatchObject({ name: 'Chama Sagrada', level: 0, description: 'Um clarão desce.' })
    expect(resolveSheetEntries(spellsEn, undefined, 'cleric', ['sacred-flame'])[0])
      .toMatchObject({ name: 'Sacred Flame', level: 0 })
  })

  it('preserva a ORDEM das chaves da ficha, não a do catálogo', () => {
    const both = ['paladin_lay-on-hands', 'barbarian_rage']
    // Escopo `default` para alcançar as duas classes de uma vez não serve; aqui o ponto é só que
    // a saída acompanha a entrada — a lista da classe tem as duas na ordem inversa.
    const catalog = { knight: [...featuresPtBr['paladin']!, ...featuresPtBr['barbarian']!] }
    expect(resolveSheetEntries(catalog, undefined, 'knight', both).map(f => f.key)).toEqual(both)
  })

  it('classe sem lista própria cai no default (mesma regra da criação)', () => {
    const catalog = { default: featuresPtBr['barbarian']! }
    expect(resolveSheetEntries(catalog, undefined, 'inventor-steampunk', ['barbarian_rage']).map(f => f.name)).toEqual(['Fúria'])
  })

  // Carry-over da US-100 → Migração §3: a chave saiu do catálogo vivo num bump; a ficha de quem
  // a tinha continua exibindo o item, nos dois idiomas, em vez de perder a linha em silêncio.
  it('chave fora do catálogo vivo resolve pelo retired, nos dois locales', () => {
    const retiredPtBr = { 'ranger_natural-explorer': { key: 'ranger_natural-explorer', name: 'Explorador Nato', description: 'Move-se com maestria.', source: 'srd' } }
    const retiredEn = { 'ranger_natural-explorer': { key: 'ranger_natural-explorer', name: 'Natural Explorer', description: 'Moves with mastery.', source: 'srd' } }
    const keys = ['ranger_natural-explorer']
    expect(resolveSheetEntries(featuresPtBr, retiredPtBr, 'ranger', keys).map(f => f.name)).toEqual(['Explorador Nato'])
    expect(resolveSheetEntries(featuresEn, retiredEn, 'ranger', keys).map(f => f.name)).toEqual(['Natural Explorer'])
  })

  it('o catálogo vivo VENCE o retired para a mesma chave (conteúdo que voltou)', () => {
    const retired = { barbarian_rage: { key: 'barbarian_rage', name: 'Fúria (aposentada)', description: 'texto velho.', source: 'srd' } }
    expect(resolveSheetEntries(featuresPtBr, retired, 'barbarian', ['barbarian_rage']).map(f => f.name)).toEqual(['Fúria'])
  })

  it('chave sem dono em lugar nenhum vira entrada mínima (nome = chave), não some', () => {
    const out = resolveSheetEntries(featuresPtBr, undefined, 'barbarian', ['barbarian_fantasma'])
    expect(out).toHaveLength(1)
    expect(out[0]!.name).toBe('barbarian_fantasma')
  })

  it('sem catálogo no config → entrada mínima para cada chave (sem crash)', () => {
    expect(resolveSheetEntries(undefined, undefined, 'barbarian', ['barbarian_rage']).map(f => f.key)).toEqual(['barbarian_rage'])
    expect(resolveSheetEntries(featuresPtBr, undefined, 'barbarian', [])).toEqual([])
  })
})
