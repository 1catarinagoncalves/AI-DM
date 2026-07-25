import { describe, it, expect } from 'vitest'
import type { WorldEntity } from '@ai-dm/shared'
import { mergeEntities, formatEntities } from './entities'

describe('mergeEntities', () => {
  it('insere entidade nova', () => {
    const out = mergeEntities([], [{ nome: 'Vigia', tipo: 'npc', local: 'sala secreta', estado: 'neutra' }])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ nome: 'Vigia', tipo: 'npc', local: 'sala secreta', estado: 'neutra' })
    expect(out[0]!.atualizadoEm).toBeTruthy()
  })

  it('faz upsert por nome tolerante a acento/caixa e faz merge PARCIAL', () => {
    const current: WorldEntity[] = [
      { nome: 'Tobias', tipo: 'npc', local: 'capela', estado: 'inconsciente', nota: 'padeiro possuído', atualizadoEm: '2020-01-01' },
    ]
    // patch só muda o estado, referindo o nome sem acento/caixa diferente
    const out = mergeEntities(current, [{ nome: 'TOBIAS', estado: 'acordado' }])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      nome: 'Tobias', // grafia original preservada
      tipo: 'npc',
      local: 'capela', // preservado (não veio no patch)
      estado: 'acordado', // sobrescrito
      nota: 'padeiro possuído', // preservado
    })
  })

  it('NÃO reverte campo não informado (regressão do bug de amnésia)', () => {
    const current: WorldEntity[] = [
      { nome: 'Vigia', local: 'sala secreta', nota: 'guardiã da bacia', atualizadoEm: '2020-01-01' },
    ]
    const out = mergeEntities(current, [{ nome: 'Vigia', estado: 'aguarda' }])
    // a nota e o local NÃO podem sumir só porque o patch não os trouxe
    expect(out[0]!.nota).toBe('guardiã da bacia')
    expect(out[0]!.local).toBe('sala secreta')
    expect(out[0]!.estado).toBe('aguarda')
  })

  it('ignora nome vazio e preserva a ordem de primeira aparição', () => {
    const out = mergeEntities(
      [{ nome: 'Elara', atualizadoEm: '2020-01-01' }],
      [{ nome: '  ' }, { nome: 'Barnabé', tipo: 'npc' }],
    )
    expect(out.map((e) => e.nome)).toEqual(['Elara', 'Barnabé'])
  })

  // US-75: os dois eixos são ORTOGONAIS e seguem a mesma semântica parcial dos
  // demais campos — omitido preserva, presente sobrescreve (o mecanismo de promoção).
  it('preserva sabido/revelado quando o patch os omite e sobrescreve quando os traz', () => {
    const current: WorldEntity[] = [
      { nome: 'Morvath', tipo: 'npc', local: 'arboreto', sabido: 'publico', revelado: false, atualizadoEm: '2020-01-01' },
    ]
    // patch só muda o estado — ambos os eixos DEVEM ficar
    const kept = mergeEntities(current, [{ nome: 'Morvath', estado: 'ausente' }])
    expect(kept[0]).toMatchObject({ sabido: 'publico', revelado: false, estado: 'ausente' })
    // promoção: reveal ao jogador (revelado false→true) sem tocar em sabido
    const revealed = mergeEntities(current, [{ nome: 'Morvath', revelado: true }])
    expect(revealed[0]).toMatchObject({ sabido: 'publico', revelado: true })
    // promoção independente: segredo que se espalha (privado→publico) sem tocar em revelado
    const spread = mergeEntities(
      [{ nome: 'capangas', sabido: 'privado', revelado: true, atualizadoEm: '2020-01-01' }],
      [{ nome: 'capangas', sabido: 'publico' }],
    )
    expect(spread[0]).toMatchObject({ sabido: 'publico', revelado: true })
  })
})

describe('formatEntities', () => {
  it('vazio quando não há entidades', () => {
    expect(formatEntities([])).toBe('')
    expect(formatEntities(null)).toBe('')
  })

  it('rende uma linha por entidade com tipo, local, estado e nota', () => {
    const out = formatEntities([
      { nome: 'Vigia', tipo: 'npc', local: 'sala secreta', estado: 'neutra', nota: 'deu permissão', atualizadoEm: '' },
    ])
    expect(out).toBe('- [NPC] Vigia — em sala secreta; neutra; deu permissão')
  })

  // US-71: NPC que está em `presentes` tem posição = sceneState.local; a linha
  // "— em {local}" é redundante e é suprimida (match tolerante a acento/caixa).
  // Estado/nota permanecem; a entidade continua listada.
  it('suprime "em {local}" de entidade presente na cena, mantendo estado e nota', () => {
    const helio: WorldEntity = { nome: 'Hélio', tipo: 'npc', local: 'forja de Hélio', estado: 'ocupado', nota: 'ferreiro da vila', atualizadoEm: '' }
    expect(formatEntities([helio], ['HELIO'])).toBe('- [NPC] Hélio — ocupado; ferreiro da vila')
    // fora de `presentes` → o local volta a aparecer
    expect(formatEntities([helio], ['outro'])).toBe('- [NPC] Hélio — em forja de Hélio; ocupado; ferreiro da vila')
    // sem estado/nota, presente → só o nome
    expect(formatEntities([{ nome: 'Hélio', tipo: 'npc', local: 'forja', atualizadoEm: '' }], ['Hélio'])).toBe('- [NPC] Hélio')
  })

  // US-75: caso comum (publico + revelado, ou ausentes) NÃO ganha marcador — sem ruído.
  it('não marca o caso comum publico+revelado', () => {
    expect(formatEntities([{ nome: 'Marta', tipo: 'npc', sabido: 'publico', revelado: true, atualizadoEm: '' }]))
      .toBe('- [NPC] Marta')
  })

  // US-75: fato privado (Erro 2) e fato oculto (Erro 3) ganham marcadores distintos.
  it('marca privado (restrito) e oculto (revelado:false)', () => {
    expect(formatEntities([{ nome: 'capangas', tipo: 'outro', sabido: 'privado', nota: 'no moinho', atualizadoEm: '' }]))
      .toBe('- [Entidade] capangas — (restrito — só quem viu); no moinho')
    expect(formatEntities([{ nome: 'Morvath', tipo: 'npc', local: 'arboreto', revelado: false, atualizadoEm: '' }]))
      .toBe('- [NPC] Morvath — ⚠ OCULTO — verdade do mundo, NÃO revele ao jogador ainda; em arboreto')
  })
})
