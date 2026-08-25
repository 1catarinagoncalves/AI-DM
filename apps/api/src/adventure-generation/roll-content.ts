import { createSeededRandom, deriveAdventureSeed, type Locale } from '@ai-dm/shared'
import { readLgmrdTables, type LgmrdTable, type LgmrdTableRow } from './lgmrd-tables'

export interface RolledPatronOrNpc {
  behavior: string
  ancestry: string
}

export interface RolledAdventureContent {
  premissaCandidates: string[]
  locais: string
  monumentos: string
  complicacao: { condition: string; description: string; origin: string }
  patronsandnpcs: RolledPatronOrNpc[]
}

// US-158: uma linha de `patronsandnpcs` dá `behavior`+`ancestry` para ~1 NPC — o modelo
// inventa nome/papel em cima disso (ver Notas de implementação da US-158), então
// rolar 7x cobre os ~7 NPCs do backlog.
const NPC_ROLL_COUNT = 7

// US-192: 5 é o número do artigo-fonte (Adventure Generator, Shadowdark RPG) — rolar N
// candidatos de `1d20quests` e deixar `generatePremissa` (ai.service.ts) escolher/elaborar
// o que mais puxa a personagem DIRETAMENTE para a ação, não arbitrário.
const PREMISSA_ROLL_COUNT = 5

function pickRow(table: LgmrdTable, rand: () => number): LgmrdTableRow {
  return table.data[Math.floor(rand() * table.data.length)]!
}

// US-147: um sub-seed por tabela (characterId+propósito+order), pela mesma razão do
// roll-registry — o conteúdo não pode deslocar de sequência conforme o registro foi ou não
// escolhido manualmente (rolagens independentes entre si). `attempt` (US-150, reseed): default
// `0`, repassado ao seed de cada tabela.
function tableSeed(characterId: string, order: number, purpose: string, attempt = 0): number {
  return deriveAdventureSeed(`${characterId}:${purpose}`, order, attempt)
}

// US-158: sub-seed POR ROLL (`npc-1`..`npc-7`), não um único `npc` compartilhado — mesma
// garantia de independência do resto da tabela: rolar mais ou menos NPCs no futuro não
// desloca a sequência dos outros campos.
function rollPatronsAndNpcs(characterId: string, order: number, table: LgmrdTable, attempt: number): RolledPatronOrNpc[] {
  return Array.from({ length: NPC_ROLL_COUNT }, (_, i) => {
    const row = pickRow(table, createSeededRandom(tableSeed(characterId, order, `npc-${i + 1}`, attempt)))
    return { behavior: String(row['behavior']), ancestry: String(row['ancestry']) }
  })
}

// US-192: sub-seed POR ROLL (`premissa-1`..`premissa-5`), mesmo padrão de `rollPatronsAndNpcs`
// — cada candidato independente do resto da tabela, rolar mais/menos candidatos no futuro
// não desloca a sequência dos outros campos.
function rollPremissaCandidates(characterId: string, order: number, table: LgmrdTable, attempt: number): string[] {
  return Array.from({ length: PREMISSA_ROLL_COUNT }, (_, i) => {
    const row = pickRow(table, createSeededRandom(tableSeed(characterId, order, `premissa-${i + 1}`, attempt)))
    return String(row['item'])
  })
}

/**
 * Conteúdo — matéria-prima bruta das tabelas do LGMRD, rolada pelo seed determinístico da
 * US-146. Ainda não é prosa (isso é US-158, locais/NPCs, e US-149, segredos) nem uma
 * GeneratedAdventure montada (US-144) — só a lista de escolhas roladas.
 *
 * `locais`/`monumentos` vêm da MESMA linha de `locationsmonumentsanditems` — um roll dá os
 * dois juntos na fonte (LGMRD), então usam o mesmo sub-seed.
 */
export function rollContent(
  characterId: string,
  order: number,
  tables: ReturnType<typeof readLgmrdTables> = readLgmrdTables(),
  attempt = 0,
): RolledAdventureContent {
  const locationRow = pickRow(tables.tables['locationsmonumentsanditems'], createSeededRandom(tableSeed(characterId, order, 'locais', attempt)))
  const conditionRow = pickRow(tables.tables['conditiondescriptionandorigin'], createSeededRandom(tableSeed(characterId, order, 'complicacao', attempt)))

  return {
    premissaCandidates: rollPremissaCandidates(characterId, order, tables.tables['1d20quests'], attempt),
    locais: String(locationRow['location']),
    monumentos: String(locationRow['monument']),
    complicacao: {
      condition: String(conditionRow['condition']),
      description: String(conditionRow['description']),
      origin: String(conditionRow['origin']),
    },
    patronsandnpcs: rollPatronsAndNpcs(characterId, order, tables.tables['patronsandnpcs'], attempt),
  }
}

// 2026-08-25: as 20 linhas de `patronsandnpcs` chegam em INGLÊS da tabela do LGMRD e eram
// injetadas verbatim no prompt de prosa (`buildLocationsAndNpcsPrompt`, ai.service.ts) — o
// modelo copiava a palavra crua para dentro da narração pt-BR («o lizardfolk tem a chave»,
// «a catfolk cheery»). Mesmo defeito que a palavra-semente de local/monumento, mas resolvido
// no CÓDIGO em vez de por instrução de prompt: a lista é FECHADA (20 valores por coluna) e a
// tradução é decisão editorial fixa, não escolha criativa por aventura.
//
// A rolagem (`rollContent`) segue devolvendo o valor EN canônico — igual ao dataset do SRD,
// `en-US` é a base nativa e `pt-BR` é overlay de RENDERIZAÇÃO (ADR 005). Só o prompt traduz.
const PATRON_ROW_PT_BR: Record<string, string> = {
  // coluna `behavior`
  Enthusiastic: 'entusiasmado',
  Flighty: 'volúvel',
  Shifty: 'esquivo',
  Optimistic: 'otimista',
  Paranoid: 'paranoico',
  'Well spoken': 'eloquente',
  Superior: 'soberbo',
  Haughty: 'altivo',
  Pessimistic: 'pessimista',
  Suspicious: 'desconfiado',
  Worried: 'preocupado',
  Greedy: 'ganancioso',
  Brave: 'corajoso',
  Stern: 'severo',
  Sly: 'astuto',
  Wise: 'sábio',
  Reserved: 'reservado',
  Cheery: 'animado',
  Opportunistic: 'oportunista',
  'Soft spoken': 'de fala mansa',
  // coluna `ancestry`. Halfling/orc/drow/tiefling/goblin ficam como estão: é a forma
  // corrente em pt-BR (Galápagos), traduzir inventaria termo que ninguém usa na mesa.
  Human: 'humano',
  Elf: 'elfo',
  Dwarf: 'anão',
  Halfling: 'halfling',
  Orc: 'orc',
  Drow: 'drow',
  Tiefling: 'tiefling',
  Dragonborn: 'draconato',
  Fey: 'feérico',
  Goblin: 'goblin',
  Construct: 'constructo',
  Celestial: 'celestial',
  Ghost: 'fantasma',
  "Wizard's familiar": 'familiar de mago',
  'Talking animal': 'animal falante',
  Avian: 'ave humanoide',
  // 'sáurio'/'felino' e não 'homem-lagarto'/'mulher-gato': o NPC ainda não tem gênero
  // quando esta linha entra no prompt — quem inventa nome e papel é o modelo.
  Lizardfolk: 'sáurio',
  Catfolk: 'felino',
  Lycanthrope: 'licantropo',
  Artifact: 'artefato',
}

/**
 * Verte uma linha rolada de `patronsandnpcs` para o idioma da mesa. `en-US` devolve a linha
 * como está (a tabela JÁ é a base nativa); `pt-BR` aplica o overlay acima. Valor fora do mapa
 * passa cru — a tabela do LGMRD pode ganhar linha nova antes do mapa, e um NPC com a palavra
 * em inglês é melhor que a geração inteira falhar. `patron-row-map-completo` (teste) é quem
 * pega esse buraco antes de chegar em produção.
 */
export function localizePatronRow(row: RolledPatronOrNpc, locale: Locale): RolledPatronOrNpc {
  if (locale === 'en-US') return row
  return {
    behavior: PATRON_ROW_PT_BR[row.behavior] ?? row.behavior,
    ancestry: PATRON_ROW_PT_BR[row.ancestry] ?? row.ancestry,
  }
}
