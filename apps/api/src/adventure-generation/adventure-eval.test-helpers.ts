import type { AdventureNpc, GeneratedAdventure } from '@ai-dm/shared'
import type { AdventureExpectation } from './adventure-eval'

// US-238: fixture do artefato "bom" compartilhada pelos testes do eval (asserts e live eval) — o que
// cada teste quebra é DEPOIS de partir desta forma, então ela vive num lugar só.

/** O que se espera do `goodAdventure`: 3 facções pinadas, ≥3 desafios não-combate, dial de aventura. */
export const EXPECTED_GOOD: AdventureExpectation = { challenge: 'adventure', factionCount: 3, minChallenges: 3 }

export const brute = (id: string): AdventureNpc => ({ id, name: 'Brute', role: 'Brute', combatRole: 'Brute', want: 'esmagar' })

// Nível 5: limiar de soma de CR = 2 e teto de monstro único = 7,5 — um Brute (CR 2) sozinho cabe.
// Todo local e todo NPC é referenciado (encontro, desafio, objetivo ou morador): grafo fechado, sem órfão.
export function goodAdventure(): GeneratedAdventure {
  return {
    id: 'eval-pin-ladino-5:999',
    levelRange: { min: 5, max: 5 },
    registry: { setting: 'urban-fantasy', tone: 'political-intrigue', areaType: 'city' },
    summary: 'Uma cripta sob a névoa desperta.',
    world: { name: 'Vhel-Toran', description: 'Uma cidade erguida entre costelas de pedra, onde a névoa sobe do rio.' },
    story: 'Três ordens disputam a cripta e nenhuma quer que o selo se rompa sozinho.',
    factions: [
      { id: 'faction-1', name: 'Guardiões do Selo', kind: 'ordem', want: 'manter a cripta lacrada' },
      { id: 'faction-2', name: 'Mercadores de Cinza', kind: 'submundo', want: 'saquear o que dorme lá dentro' },
      { id: 'faction-3', name: 'Coro Mudo', kind: 'culto', want: 'despertar a voz que foi calada' },
    ],
    npcs: [
      { id: 'npc-1', name: 'Irmã Odalys', role: 'sacerdotisa cansada', want: 'proteger o povo do bairro', factionId: 'faction-1' },
      { id: 'npc-2', name: 'Tavo Renk', role: 'atravessador de relíquias', want: 'vender antes que fechem o cais', factionId: 'faction-2' },
      brute('npc-3'),
    ],
    locations: [
      { id: 'loc-1', title: 'Praça do Sino', aspects: ['névoa', 'sino rachado'], boxedText: 'O sino rachado pende sem badalar.', description: 'Calçada úmida e bancas fechadas.', occupants: ['npc-1'], factionId: 'faction-1', vibe: 'social' },
      { id: 'loc-2', title: 'Cais das Relíquias', aspects: ['cordas', 'sal'], boxedText: 'Caixotes empilhados até a altura do peito.', description: 'Um armazém sem dono aparente.', occupants: ['npc-2'], vibe: 'skill' },
      { id: 'loc-3', title: 'Cripta do Coro', aspects: ['eco', 'pedra fria'], boxedText: 'Cada passo volta atrasado.', description: 'Nichos vazios ao longo das paredes.', occupants: [], vibe: 'combat' },
    ],
    challenges: [
      { id: 'challenge-1', locationId: 'loc-1', test: 'Sabedoria (Percepção)', situation: 'O sino balança sem vento.', consequence: 'A praça inteira percebe quem estava observando.' },
      { id: 'challenge-2', locationId: 'loc-2', test: 'Destreza (Furtividade)', situation: 'Vigias dormem sobre os caixotes.', consequence: 'Um alarme baixo corre pelo cais.' },
      { id: 'challenge-3', locationId: 'loc-3', test: 'Inteligência (Arcanismo)', situation: 'Os nichos zumbem em tom errado.', consequence: 'O eco responde com a voz de quem falhou.' },
    ],
    encounters: [
      { id: 'encounter-1', locationId: 'loc-3', npcIds: ['npc-3'], type: 'combat', fiction: 'Uma forma enorme se desprende do nicho central.', behaviors: 'Guarda o selo partido.', goal: 'Impedir que alguém toque o selo.', complications: 'O eco atrasa cada aviso.', unlocks: 'A confirmação de que o selo já estava partido.' },
    ],
    start: 'A névoa engoliu o sino, e você chega à Praça do Sino justo quando ele deixa de badalar.',
    objective: { description: 'Decidir o destino do selo partido.', reward: { name: 'Badalo de Cinza', effect: 'cala qualquer som que o portador queira esconder' }, locationId: 'loc-3' },
    branchedResolution: [
      { choice: 'Relacrar o selo', consequence: 'os nomes calados continuam calados' },
      { choice: 'Vender o que dorme', consequence: 'o cais enriquece e a praça adoece' },
      { choice: 'Deixar a voz falar', consequence: 'o Coro Mudo ganha a cidade' },
    ],
    followUps: ['O selo relacrado atrai quem nunca ouviu o sino.', 'O cais guarda outro caixote que ninguém abriu.', 'A voz calada deixou herdeiros.'],
  }
}
