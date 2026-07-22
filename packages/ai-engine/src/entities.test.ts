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
})
