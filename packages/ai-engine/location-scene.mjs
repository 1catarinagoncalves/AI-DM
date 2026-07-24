// Cena-ímã de REPLAY DE TRANSIÇÃO (US-71) — o pior caso do anexo `erro location.md`,
// compartilhada pelo capturador do baseline ANTIGO e pelo A/B `location-ab-bakeoff.mjs`
// para que os dois braços usem EXATAMENTE a mesma cena, personagem e histórico.
//
// Turno 1: Anetra passa na forja de Hélio; a narração conta a despedida, a travessia da
// rua, a CHEGADA e a saudação de Hélio; o sceneState termina em `local = forja`,
// `presentes = [Hélio]`. Turno 2: a jogadora só CONTINUA a conversa. O braço ANTIGO
// tende a re-narrar a chegada inteira (replay); o NOVO responde ali mesmo.
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

const character = {
  systemName: 'D&D 5e',
  characterName: 'Anetra',
  characterGender: 'feminino',
  characterClass: 'ladina',
  characterRace: 'humana',
  sheet: { level: 3, hp: 21, maxHp: 21, attributes: { dexterity: 16, charisma: 14 }, conditions: [] },
}

const sceneState = {
  local: 'forja de Hélio',
  ambiente: 'interno',
  periodo: 'manhã',
  presentes: ['Hélio'],
  objetos_em_cena: ['bigorna', 'martelo'],
  atualizadoEm: '2026-07-24T09:12:00Z',
}

const entities = [
  { nome: 'Hélio', tipo: 'npc', local: 'forja de Hélio', estado: 'trabalhando na bigorna', nota: 'ferreiro da vila, conhece Anetra desde criança', atualizadoEm: '' },
  { nome: 'Elara', tipo: 'npc', local: 'capela', estado: 'preocupada com a viagem de Anetra', nota: 'sacerdotisa que criou Anetra', atualizadoEm: '' },
]

const turnStateArgs = {
  sheet: character.sheet,
  sceneState,
  entities,
  mainQuest: 'Descobrir o que aconteceu com as crianças desaparecidas rumo ao Pântano de Ossos',
  activeQuests: ['Reunir suprimentos antes de partir da vila'],
  inventory: ['Adaga', 'Gazua', 'Capa de viagem'],
  memorySummary: 'Anetra cresceu na capela da vila sob os cuidados de Elara. Notícias de crianças sumindo perto do Pântano de Ossos a decidiram a partir. Antes de sair, passou para se despedir de gente da vila.',
}

// Narração do TURNO 1 já com a viagem + chegada + saudação — é contra ELA que se mede o replay.
const turn1Action = 'Passar na casa do ferreiro antes de partir.'
const turn1Narration = `Você se despede de Elara na porta da capela; ela aperta seu braço, os olhos úmidos, e sussurra um voto de proteção. Do outro lado da rua de terra batida, Tobias acena do balcão da padaria e o velho Barnabé observa da soleira, cachimbo apagado entre os dentes.

Você atravessa a rua sob o sol fraco da manhã. Um cão vira-lata trota atrás de você por alguns passos, rabo abanando, antes de desistir.

O calor da fornalha bate no seu rosto assim que você cruza a porta baixa da forja. Hélio ergue os olhos da bigorna, o martelo suspenso no ar, a barba salpicada de fuligem.

— Anetra! Achei que a menina ia passar o dia na capela. — Ele apoia o martelo e limpa as mãos no avental. — Vai sair?

- 🗡️ Contar a Hélio que vai para o Pântano de Ossos.
- 💬 Perguntar se ele ouviu falar das crianças desaparecidas.
- 🎒 Pedir que reforce sua adaga antes da viagem.`

// TURNO 2: só CONTINUA a conversa, na MESMA forja. O esperado é Hélio responder ali.
const turn2Action = 'Conto a Hélio que vou para o Pântano de Ossos e peço o conselho dele antes de partir.'

export const SCENE = {
  character,
  turnStateArgs,
  turn1Action,
  turn1Narration,
  turn2Action,
  oldSnapshotPath: resolve(HERE, 'location-old.snapshot.json'),
}
