import { describe, it, expect } from 'vitest'
import { GeneratedAdventureSchema } from './adventure-generation'

// US-144: protege a inversão do backlog — uma locação e dois segredos escritos à mão
// (sem motor nenhum rodando) precisam passar em .parse() ANTES de o motor existir, nos
// dois locales. Prova que o schema não nasce moldado no que o gerador sabe produzir.
describe('GeneratedAdventureSchema (US-144)', () => {
  it('valida uma aventura escrita à mão em pt-BR (1 local, 2 segredos)', () => {
    const adventure = {
      id: 'adv-1',
      levelRange: { min: 1, max: 3 },
      setting: 'forest',
      tone: 'mystery',
      areaType: 'wilderness',
      summary: 'Uma vila à beira da floresta esconde um pacto antigo.',
      npcs: [{
        id: 'npc-1',
        name: 'Elenora',
        role: 'anciã da vila',
        interactions: [{ narrative: 'A floresta não perdoa quem quebra o pacto.' }],
      }],
      secrets: [
        { id: 'secret-1', locationId: 'loc-1', text: 'O poço esconde uma entrada para as catacumbas.' },
        { id: 'secret-2', locationId: 'loc-1', text: 'A anciã fez um pacto com algo nas catacumbas.' },
      ],
      locations: [{
        id: 'loc-1',
        title: 'Praça do Poço Velho',
        aspects: ['pedra rachada', 'névoa baixa'],
        boxedText: 'O poço no centro da praça exala um cheiro de terra molhada.',
        description: 'Uma praça de pedra com um poço lacrado ao centro.',
        occupants: ['Elenora'],
      }],
      encounters: [],
      start: 'O grupo chega à vila ao anoitecer, atraído por rumores de luzes nas catacumbas.',
      conclusion: 'O pacto é rompido — ou renovado, a depender da escolha do grupo.',
      followUps: ['O que vive nas catacumbas desperta.'],
    }

    expect(GeneratedAdventureSchema.parse(adventure)).toEqual(adventure)
  })

  it('valida uma aventura escrita à mão em en-US (1 local, 2 segredos)', () => {
    const adventure = {
      id: 'adv-2',
      levelRange: { min: 1, max: 3 },
      setting: 'forest',
      tone: 'mystery',
      areaType: 'wilderness',
      summary: 'A village at the edge of the forest hides an old pact.',
      npcs: [{
        id: 'npc-1',
        name: 'Elenora',
        role: 'village elder',
        interactions: [{ narrative: 'The forest does not forgive those who break the pact.' }],
      }],
      secrets: [
        { id: 'secret-1', locationId: 'loc-1', text: 'The well hides an entrance to the catacombs.' },
        { id: 'secret-2', locationId: 'loc-1', text: 'The elder made a pact with something in the catacombs.' },
      ],
      locations: [{
        id: 'loc-1',
        title: 'Old Well Square',
        aspects: ['cracked stone', 'low mist'],
        boxedText: 'The well at the square\'s center exhales a smell of wet earth.',
        description: 'A stone square with a sealed well at its center.',
        occupants: ['Elenora'],
      }],
      encounters: [],
      start: 'The party arrives at the village at dusk, drawn by rumors of lights in the catacombs.',
      conclusion: 'The pact is broken — or renewed, depending on the party\'s choice.',
      followUps: ['Whatever lives in the catacombs awakens.'],
    }

    expect(GeneratedAdventureSchema.parse(adventure)).toEqual(adventure)
  })

  // Critério de aceite: o schema não verifica se a referência aponta pra algo que existe —
  // isso é o gate da US-150. `secret.locationId` órfão continua passando aqui.
  it('não verifica integridade referencial — locationId órfão ainda passa em .parse()', () => {
    const adventure = {
      id: 'adv-3',
      levelRange: { min: 1, max: 1 },
      setting: 'forest',
      tone: 'mystery',
      areaType: 'wilderness',
      summary: 'Aventura mínima.',
      npcs: [{ id: 'npc-1', name: 'Elenora', role: 'anciã', interactions: [] }],
      secrets: [{ id: 'secret-1', locationId: 'loc-inexistente', text: 'Segredo órfão.' }],
      locations: [{
        id: 'loc-1',
        title: 'Praça',
        aspects: [],
        boxedText: 'Texto de caixa.',
        description: 'Descrição.',
        occupants: [],
      }],
      encounters: [],
      start: 'Início.',
      conclusion: 'Fim.',
      followUps: [],
    }

    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })
})
