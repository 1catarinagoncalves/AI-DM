import { describe, it, expect } from 'vitest'
import { GeneratedAdventureSchema } from './adventure-generation'

// US-232: schema mundo-primeiro. Uma aventura autoral escrita à mão (world/factions/story/
// objective/challenges/branchedResolution, npc.want, encounters[].fiction, SEM conclusion/
// antagonist/secrets) passa em .parse() nos dois locales; a forma velha (conclusion no lugar
// de branchedResolution) FALHA. Espelha "O Sarcófago que Sussurra": 3 facções, NPCs com want,
// itens na description do local, Final ligado ao fecho.
const seraphine = () => ({
  id: 'adv-1',
  levelRange: { min: 3, max: 3 },
  registry: { setting: 'fantasy', tone: 'mystery', areaType: 'settlement' },
  summary: 'Três facções disputam um sarcófago que sussurra os nomes dos mortos.',
  world: {
    name: 'Vhel-Toran, a Cidade das Costelas',
    description: 'Uma cidade erguida entre as costelas fossilizadas de um deus adormecido, onde a poeira canta ao vento e as ruas seguem o desenho de um esqueleto colossal.',
    anchors: ['A Nave das Costelas', 'O Poço dos Nomes'],
  },
  story: 'O sarcófago recém-desenterrado passou a sussurrar nomes — e três facções o querem por razões que colidem: os Guardiões do Osso para selá-lo, o Sindicato da Poeira para vendê-lo, o Coro Silente para acordá-lo.',
  factions: [
    { id: 'faction-1', name: 'Guardiões do Osso', kind: 'ordem', want: 'selar o sarcófago para sempre' },
    { id: 'faction-2', name: 'Sindicato da Poeira', kind: 'submundo', want: 'contrabandear o sarcófago para o maior lance' },
    { id: 'faction-3', name: 'Coro Silente', kind: 'culto', want: 'abrir o sarcófago e libertar o que sussurra' },
  ],
  npcs: [
    { id: 'npc-1', name: 'Irmã Kesh', role: 'guardiã veterana', want: 'proteger a cidade mesmo à custa da própria fé', factionId: 'faction-1' },
    { id: 'npc-2', name: 'Orin Palma-Rápida', role: 'contrabandista', want: 'engarrafar os sussurros e vendê-los', factionId: 'faction-2' },
    { id: 'npc-3', name: 'Tobias', role: 'coveiro assustado', want: 'apenas sobreviver a tudo isto' },
  ],
  locations: [
    { id: 'loc-1', title: 'A Nave das Costelas', aspects: ['eco de nomes', 'luz coada entre ossos'], boxedText: 'Sob o arco de uma costela colossal, o sarcófago repousa numa poça de poeira que brilha fraco.', description: 'A câmara guarda um cinzel de prata cravado numa costela e um mapa rasgado das catacumbas.', factionId: 'faction-1', occupants: ['npc-1'], vibe: 'social' },
    { id: 'loc-2', title: 'O Poço dos Nomes', aspects: ['fundo sem eco'], boxedText: 'Um poço seco desce mais fundo do que a luz alcança.', description: 'No parapeito, uma corda velha e uma lanterna quebrada.', occupants: ['npc-3'], vibe: 'skill' },
    { id: 'loc-3', title: 'O Mercado da Poeira', aspects: ['tendas de couro'], boxedText: 'Vozes regateiam sobre relíquias sob toldos empoeirados.', description: 'Entre as bancas, um baralho marcado e um frasco vazio rotulado "eco".', factionId: 'faction-2', occupants: ['npc-2'], vibe: 'social' },
  ],
  challenges: [
    { id: 'challenge-1', locationId: 'loc-2', test: 'teste de Força (Atletismo)', situation: 'descer o poço pela corda apodrecida sem despencar', consequence: 'a corda arrebenta e a queda desperta os ecos do fundo' },
    { id: 'challenge-2', locationId: 'loc-3', test: 'teste de Carisma (Enganação)', situation: 'convencer Orin a revelar o comprador sem pagar', consequence: 'Orin some com o sarcófago antes do confronto' },
  ],
  encounters: [
    { id: 'encounter-1', locationId: 'loc-1', npcIds: ['npc-1'], type: 'social', fiction: 'Irmã Kesh barra a entrada da nave, a mão sobre o cinzel de prata, exigindo saber de que lado o forasteiro está.', behaviors: 'Kesh vigia o sarcófago sem descanso.', goal: 'Entrar na nave e examinar o sarcófago.', complications: 'Kesh não confia em ninguém que não jure selá-lo.', unlocks: 'Kesh revela onde o Coro planeja abrir o sarcófago.' },
    { id: 'encounter-2', locationId: 'loc-3', npcIds: ['npc-2'], type: 'skill', fiction: 'Orin foge pelos toldos do mercado, derrubando bancas para atrasar a perseguição.', behaviors: 'Orin negocia o sarcófago com um comprador oculto.', goal: 'Impedir a venda do sarcófago.', complications: 'O mercado inteiro deve favores a Orin.', unlocks: 'O local e a hora do ritual do Coro Silente.' },
    { id: 'encounter-3', locationId: 'loc-1', npcIds: ['npc-1'], type: 'combat', fiction: 'No fundo da nave, o Coro entoa e o sarcófago começa a rachar; a escolha final se impõe — selar, vender ou abrir.', behaviors: 'O Coro Silente completa o ritual de abertura.', goal: 'Decidir o destino do sarcófago.', complications: 'Cada facção presente cobra sua parte no desfecho.', unlocks: 'O que sussurrava é libertado, contido ou vendido — conforme a escolha.' },
  ],
  start: 'Ravi chega a Vhel-Toran ao pôr do sol e é abordado por três mensageiros ao mesmo tempo, cada um jurando que o sarcófago é problema dele.',
  objective: {
    description: 'Decidir o destino do sarcófago que sussurra antes que uma das três facções o resolva à força.',
    reward: { name: 'Cinzel de Prata dos Guardiões', effect: 'sela ecos e vozes presas em pedra ao toque' },
    locationId: 'loc-1',
  },
  branchedResolution: [
    { choice: 'Selar o sarcófago com os Guardiões', consequence: 'os nomes calam, mas o Coro jura vingança' },
    { choice: 'Vender o sarcófago pelo Sindicato', consequence: 'ouro farto, e um comprador sem rosto agora possui os mortos' },
    { choice: 'Abrir o sarcófago com o Coro', consequence: 'o que sussurrava desperta, grato — e faminto' },
  ],
  followUps: [
    'Os Guardiões pedem ajuda para caçar o Coro sobrevivente.',
    'O comprador sem rosto envia um convite dourado.',
    'Algo libertado começa a colecionar nomes pela cidade.',
  ],
})

describe('GeneratedAdventureSchema (US-232, mundo-primeiro)', () => {
  it('valida uma aventura autoral escrita à mão em pt-BR (round-trip sem perder peça)', () => {
    const adventure = seraphine()
    expect(GeneratedAdventureSchema.parse(adventure)).toEqual(adventure)
  })

  it('valida uma aventura autoral escrita à mão em en-US', () => {
    const adventure = {
      ...seraphine(),
      id: 'adv-2',
      summary: 'Three factions vie for a sarcophagus that whispers the names of the dead.',
      world: { name: 'Vhel-Toran, the City of Ribs', description: 'A city built between the fossil ribs of a sleeping god.', anchors: ['The Rib Nave'] },
      story: 'The newly unearthed sarcophagus began whispering names, and three factions want it for reasons that collide.',
    }
    expect(GeneratedAdventureSchema.parse(adventure)).toEqual(adventure)
  })

  // AC: a forma VELHA (conclusion no lugar de branchedResolution) NÃO é mais aceita.
  it('rejeita a forma velha — conclusion em vez de branchedResolution', () => {
    const { branchedResolution, ...rest } = seraphine()
    void branchedResolution
    const legacy = { ...rest, conclusion: 'O pacto é rompido — ou renovado.' }
    expect(() => GeneratedAdventureSchema.parse(legacy)).toThrow()
  })

  // AC: antagonist saiu — um artefato que ainda o carrega passa (campo extra ignorado), mas o
  // que importa é que o schema NÃO o exige mais. Aqui provamos que a ausência dele é válida.
  it('valida sem antagonist nem secrets no objeto', () => {
    const adventure = seraphine()
    expect('antagonist' in adventure).toBe(false)
    expect('secrets' in adventure).toBe(false)
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })

  it('rejeita npc sem want', () => {
    const adventure = seraphine()
    // @ts-expect-error — removendo campo obrigatório de propósito
    delete adventure.npcs[0].want
    expect(() => GeneratedAdventureSchema.parse(adventure)).toThrow()
  })

  it('rejeita encontro sem fiction', () => {
    const adventure = seraphine()
    // @ts-expect-error — removendo campo obrigatório de propósito
    delete adventure.encounters[0].fiction
    expect(() => GeneratedAdventureSchema.parse(adventure)).toThrow()
  })

  it('rejeita objective como string (agora é objeto)', () => {
    const adventure = { ...seraphine(), objective: 'Impedir o Coro Silente.' }
    expect(() => GeneratedAdventureSchema.parse(adventure)).toThrow()
  })

  it('rejeita branchedResolution vazio', () => {
    const adventure = { ...seraphine(), branchedResolution: [] }
    expect(() => GeneratedAdventureSchema.parse(adventure)).toThrow()
  })

  it('objective.reward.effect e challenge.test são texto — sem campo de CD/dano/HP', () => {
    const adventure = seraphine()
    expect(typeof adventure.objective.reward.effect).toBe('string')
    for (const c of adventure.challenges) expect(typeof c.test).toBe('string')
    // O schema não tem onde pôr número de mecânica — parse aceita só os campos de texto.
    expect(GeneratedAdventureSchema.parse(adventure).challenges).toHaveLength(2)
  })

  // Integridade referencial continua sendo o gate (US-150), não o schema.
  it('não verifica integridade referencial — locationId órfão ainda passa em .parse()', () => {
    const adventure = seraphine()
    adventure.challenges[0]!.locationId = 'loc-inexistente'
    expect(() => GeneratedAdventureSchema.parse(adventure)).not.toThrow()
  })
})
