import { describe, it, expect } from 'vitest'
import type { WorldEntity, EntityEdge } from '@ai-dm/shared'
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

  // US-113: retrocompat — entidade gravada antes desta US não tem `relacoes`, e um
  // patch que não toca `relacoes` não pode inventar a chave.
  it('preserva entidade sem relacoes quando o patch não menciona relacoes', () => {
    const current: WorldEntity[] = [{ nome: 'Vigia', estado: 'neutra', atualizadoEm: '2020-01-01' }]
    const out = mergeEntities(current, [{ nome: 'Vigia', estado: 'aliada' }])
    expect(out[0]!.relacoes).toBeUndefined()
    expect(out[0]!.estado).toBe('aliada')
  })

  it('insere relacoes numa entidade que ainda não tinha nenhuma', () => {
    const out = mergeEntities([], [
      { nome: 'Marta', tipo: 'npc', relacoes: [{ relacao: 'irmã de', para: 'Morvath', fonte: 'abertura' }] },
    ])
    expect(out[0]!.relacoes).toHaveLength(1)
    expect(out[0]!.relacoes![0]).toMatchObject({ relacao: 'irmã de', para: 'Morvath', fonte: 'abertura' })
    expect(out[0]!.relacoes![0]!.atualizadoEm).toBeTruthy()
  })

  it('funde aresta por (relacao, para) tolerante a acento/caixa e faz merge PARCIAL', () => {
    const current: WorldEntity[] = [
      {
        nome: 'Marta',
        relacoes: [{ relacao: 'irmã de', para: 'Morvath', fonte: 'abertura', sabido: 'publico', revelado: true, atualizadoEm: '2020-01-01' }],
        atualizadoEm: '2020-01-01',
      },
    ]
    // mesma aresta, grafia com acento/caixa diferente, só muda revelado
    const out = mergeEntities(current, [
      { nome: 'Marta', relacoes: [{ relacao: 'IRMÃ DE', para: 'morvath', fonte: 'turno: clx8', revelado: false }] },
    ])
    expect(out[0]!.relacoes).toHaveLength(1)
    expect(out[0]!.relacoes![0]).toMatchObject({
      relacao: 'irmã de', // grafia original preservada
      para: 'Morvath', // grafia original preservada
      fonte: 'turno: clx8', // sobrescrito
      sabido: 'publico', // preservado (patch não trouxe)
      revelado: false, // sobrescrito
    })
  })

  it('adiciona aresta nova sem afetar as existentes da mesma entidade', () => {
    const current: WorldEntity[] = [
      {
        nome: 'Marta',
        relacoes: [{ relacao: 'irmã de', para: 'Morvath', fonte: 'abertura', atualizadoEm: '2020-01-01' }],
        atualizadoEm: '2020-01-01',
      },
    ]
    const out = mergeEntities(current, [
      { nome: 'Marta', relacoes: [{ relacao: 'deve dinheiro a', para: 'guilda dos moleiros', fonte: 'turno: clx9' }] },
    ])
    expect(out[0]!.relacoes).toHaveLength(2)
    expect(out[0]!.relacoes!.map((r: EntityEdge) => r.relacao)).toEqual(['irmã de', 'deve dinheiro a'])
  })

  // US-113 Questões em aberto #1: a aresta é independente das pontas — as duas
  // entidades podem estar reveladas e o VÍNCULO entre elas ser oculto.
  it('aresta revelado:false é independente do revelado das pontas', () => {
    const current: WorldEntity[] = [
      { nome: 'Morvath', tipo: 'npc', local: 'arboreto', revelado: true, atualizadoEm: '2020-01-01' },
    ]
    const out = mergeEntities(current, [
      { nome: 'Morvath', relacoes: [{ relacao: 'dono de', para: 'arboreto', fonte: 'turno: clx4', revelado: false }] },
    ])
    expect(out[0]!.revelado).toBe(true) // a entidade continua revelada
    expect(out[0]!.relacoes![0]!.revelado).toBe(false) // só o vínculo é oculto
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

  // US-113: entidade sem `relacoes` (retrocompat) não ganha linha extra.
  it('não renderiza linha extra para entidade sem relacoes', () => {
    expect(formatEntities([{ nome: 'Marta', tipo: 'npc', atualizadoEm: '' }]))
      .toBe('- [NPC] Marta')
  })

  it('renderiza vínculo indentado com a fonte entre parênteses', () => {
    const out = formatEntities([
      {
        nome: 'Marta',
        tipo: 'npc',
        relacoes: [{ relacao: 'irmã de', para: 'Morvath', fonte: 'abertura', atualizadoEm: '' }],
        atualizadoEm: '',
      },
    ])
    expect(out).toBe('- [NPC] Marta\n    → irmã de: Morvath (abertura)')
  })

  it('marca vínculo privado e oculto, independente dos marcadores da entidade', () => {
    const out = formatEntities([
      {
        nome: 'Morvath',
        tipo: 'npc',
        local: 'arboreto',
        revelado: true, // a entidade em si já foi revelada
        relacoes: [
          { relacao: 'dono de', para: 'arboreto', fonte: 'turno: clx4', revelado: false, atualizadoEm: '' },
          { relacao: 'deve dinheiro a', para: 'guilda', fonte: 'turno: clx9', sabido: 'privado', atualizadoEm: '' },
        ],
        atualizadoEm: '',
      },
    ])
    expect(out).toBe(
      '- [NPC] Morvath — em arboreto\n' +
        '    → dono de: arboreto (turno: clx4, ⚠ OCULTO — verdade do mundo, NÃO revele ao jogador ainda)\n' +
        '    → deve dinheiro a: guilda (turno: clx9, restrito — só quem viu)',
    )
  })

  // US-113: `para` é texto cru, sem lookup no ledger — entidade ausente não é erro.
  it('aresta com para apontando para entidade ausente do ledger renderiza pelo nome cru', () => {
    const out = formatEntities([
      { nome: 'Marta', tipo: 'npc', relacoes: [{ relacao: 'conhece', para: 'alguém que não está no ledger', fonte: 'abertura', atualizadoEm: '' }], atualizadoEm: '' },
    ])
    expect(out).toBe('- [NPC] Marta\n    → conhece: alguém que não está no ledger (abertura)')
  })
})
