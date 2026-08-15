// US-106 — o catálogo do Free é montado de REFERÊNCIAS ao artefato do SRD + ENTRADAS PRÓPRIAS
// (ADR 004 §3.1, decisões 6a/6f). Antes, o `seed.ts` guardava o texto curado em pt-BR: o Free
// nunca acompanhava o idioma e a ficha não tinha chave onde se pendurar (US-100).
//
// Referência = só a chave; o texto vem do artefato do locale pedido. Entrada própria = literal
// bilíngue, para o conteúdo que NÃO existe em SRD nenhum. Não é caso raro: 7 dos 34 truques do
// Free vieram de livros fora do SRD, e 2 features existem só no 5.1, que a união do ADR 009
// ainda não alcançou (só `races` está ligada). Ver ADR 009 §7.
//
// Mora aqui e não no `seed.ts` para ficar testável (o seed roda `main()` ao importar) e para
// manter os dois arquivos abaixo do teto de 500 linhas do AGENTS.md.
import type { Locale } from '@ai-dm/shared'
import type { SystemClassFeature, SystemConfig, SystemSpell } from '@ai-dm/shared'

/** O recorte do artefato que a montagem consome — o mesmo que `readSrdArtifact` devolve. */
type SrdCatalog = Pick<SystemConfig, 'classFeatures' | 'classSpells'>

// A CURADORIA do Free: quais entradas do SRD entram. É o que faz o Free ser um 5e enxuto
// (14 de 24 features, 27 de 84 magias) e é a única coisa que precisa de revisão humana num bump
// — o texto vem junto, traduzido, sem digitação. Chaves geradas do artefato, não digitadas.
// US-139: `paladin_divine-sense`/`ranger_natural-explorer` voltaram a ser referência — eram
// AUTHORED_FEATURES porque a união do ADR 009 só alcançava `races` (comentário abaixo delas,
// pré-US-139); a troca de fonte pro 5.1 (não mais 5.2) devolveu as duas ao catálogo vivo.
const freeFeatureRefs: Record<string, string[]> = {
  barbarian: ['barbarian_rage', 'barbarian_unarmored-defense'],
  bard: ['bard_bardic-inspiration'],
  druid: ['druid_druidic'],
  fighter: ['fighter_fighting-style', 'fighter_second-wind'],
  monk: ['monk_martial-arts', 'monk_unarmored-defense'],
  paladin: ['paladin_lay-on-hands', 'paladin_divine-sense'],
  ranger: ['ranger_favored-enemy', 'ranger_natural-explorer'],
  rogue: ['rogue_expertise', 'rogue_sneak-attack', 'rogue_thieves-cant'],
  wizard: ['wizard_arcane-recovery'],
}

// Recorte da US-42, agora por chave: TODOS os truques da lista da classe; Paladino e Patrulheiro
// (sem truques) recebem 2 magias de nível 1. Chave de magia NÃO é prefixada por classe — a mesma
// `light` aparece na lista do mago e na do clérigo.
//
// US-139: `starry-wisp`/`elementalism`/`sorcerous-burst` SAÍRAM — eram truques do 5.2, revertidos
// pela troca de fonte pro 5.1 (ADR 009 §8). Não viram AUTHORED_SPELLS: `retiredSpells` "nunca
// entra em personagem novo" (US-100) é a mesma regra aqui — o Free para de oferecer os três pros
// jogadores novos, igual ao D&D. `AUTHORED_SPELLS` continua só pro conteúdo que nunca foi SRD.
//
// `message`/`spare-the-dying` também saíram do druid — não é remoção, é RE-ASSOCIAÇÃO: o 5.1
// as liga a outras classes (`message`: bardo/feiticeiro/mago; `spare-the-dying`: clérigo), não
// ao druida. Medido no artefato real de 15/08/2026 (`config.classSpells`).
//
// `paladin` SAIU inteiro — não tem substituto. `config.classSpells.paladin` vem VAZIO no 5.1: o
// dataset do Open5e não marca Paladino como elegível pra `bless`/`cure-wounds` (nem nenhuma
// outra magia nível ≤1) do jeito que o 5.2 marcava — limitação do dataset pra meio-conjurador,
// não decisão de conteúdo. Não virou AUTHORED_SPELLS: o mecanismo força `level: 0` (comentário
// abaixo, "truque autoral é sempre nível 0") e Abençoar/Curar Ferimentos são nível 1 — forçar
// cantrip seria dado errado, pior que não oferecer nada. Paladino no Free fica sem magia de
// classe por hora (Patrulheiro continua com as duas). Produto pode querer revisar.
const freeSpellRefs: Record<string, string[]> = {
  bard: ['dancing-lights', 'light', 'mage-hand', 'mending', 'message', 'minor-illusion', 'prestidigitation', 'true-strike', 'vicious-mockery'],
  cleric: ['guidance', 'light', 'mending', 'resistance', 'sacred-flame', 'spare-the-dying', 'thaumaturgy'],
  druid: ['druidcraft', 'guidance', 'mending', 'poison-spray', 'produce-flame', 'resistance', 'shillelagh'],
  ranger: ['cure-wounds', 'hunters-mark'],
  sorcerer: ['acid-splash', 'chill-touch', 'dancing-lights', 'fire-bolt', 'light', 'mage-hand', 'mending', 'message', 'minor-illusion', 'poison-spray', 'prestidigitation', 'ray-of-frost', 'shocking-grasp', 'true-strike'],
  warlock: ['chill-touch', 'eldritch-blast', 'mage-hand', 'minor-illusion', 'poison-spray', 'prestidigitation', 'true-strike'],
  wizard: ['acid-splash', 'chill-touch', 'dancing-lights', 'fire-bolt', 'light', 'mage-hand', 'mending', 'message', 'minor-illusion', 'poison-spray', 'prestidigitation', 'ray-of-frost', 'shocking-grasp', 'true-strike'],
}

/**
 * Entrada própria do Free: bilíngue literal, porque não há artefato de onde herdar. A chave vive
 * no MESMO espaço das outras (`thunderclap`, não `free:thunderclap`) — quem diz de onde veio é o
 * `source`, e prefixar por fonte obrigaria toda comparação a desmontar a chave.
 */
type AuthoredEntry = {
  key: string
  classes: string[]
  'en-US': { name: string; description: string }
  'pt-BR': { name: string; description: string }
}

// Vazio desde a US-139: as 2 features que moravam aqui (`paladin_divine-sense`,
// `ranger_natural-explorer`) viraram referência (`freeFeatureRefs`) — a troca de fonte pro 5.1
// devolveu as duas ao catálogo vivo, exatamente o dia que o comentário original previa. Tipo e
// mecanismo ficam prontos pro próximo gap (US-121 já usa o mesmo padrão pra `AUTHORED_SPELLS`).
const AUTHORED_FEATURES: AuthoredEntry[] = []

// Os 7 truques que vieram de livros que NÃO são SRD — verificados um a um contra o `srd-2024` e o
// `srd-2014` (ADR 009 §4). Bump do dataset não os alcança, e é de propósito: são o conteúdo em que
// o Free deixa de ser um subconjunto do D&D.
const AUTHORED_SPELLS: AuthoredEntry[] = [
  {
    key: 'blade-ward',
    classes: ['wizard', 'bard', 'sorcerer', 'warlock'],
    'en-US': { name: 'Blade Ward', description: 'defensive energy briefly blunts the damage of physical blows.' },
    'pt-BR': { name: 'Guarda de Lâmina', description: 'energia defensiva reduz por um instante o dano de golpes físicos.' },
  },
  {
    key: 'friends',
    classes: ['wizard', 'bard', 'sorcerer', 'warlock'],
    'en-US': { name: 'Friends', description: 'briefly sways someone more easily (who notices the charm afterwards).' },
    'pt-BR': { name: 'Amizade', description: 'por um instante influencia alguém com mais facilidade (que depois nota o encanto).' },
  },
  {
    key: 'mind-sliver',
    classes: ['wizard', 'sorcerer', 'warlock'],
    'en-US': { name: 'Mind Sliver', description: 'a psychic sliver wounds the mind and hampers the target’s next saving throw.' },
    'pt-BR': { name: 'Estilhaço Mental', description: 'lasca psíquica fere a mente e atrapalha o próximo salvamento do alvo.' },
  },
  {
    key: 'thorn-whip',
    classes: ['druid'],
    'en-US': { name: 'Thorn Whip', description: 'a whip of thorns wounds the target and drags it closer.' },
    'pt-BR': { name: 'Chicote de Espinhos', description: 'um chicote de espinhos fere e puxa o alvo para perto.' },
  },
  {
    key: 'thunderclap',
    classes: ['wizard', 'druid', 'bard', 'sorcerer', 'warlock'],
    'en-US': { name: 'Thunderclap', description: 'a wave of thunder bursts all around, hitting everyone nearby.' },
    'pt-BR': { name: 'Estrondo', description: 'uma onda de trovão explode ao redor, atingindo todos por perto.' },
  },
  {
    key: 'toll-the-dead',
    classes: ['wizard', 'cleric', 'warlock'],
    'en-US': { name: 'Toll the Dead', description: 'a mournful bell tolls and wounds the target’s mind or flesh.' },
    'pt-BR': { name: 'Dobre dos Mortos', description: 'um dobre fúnebre soa e fere a mente ou a carne do alvo.' },
  },
  {
    key: 'word-of-radiance',
    classes: ['cleric'],
    'en-US': { name: 'Word of Radiance', description: 'a sacred word makes searing light burn the foes all around.' },
    'pt-BR': { name: 'Palavra Radiante', description: 'uma palavra sagrada faz luz ofuscante ferir os inimigos ao redor.' },
  },
]

/**
 * Guard da decisão 6d, restrita a REFERÊNCIA: chave que o artefato não conhece falha o seed,
 * nomeando domínio, classe e chave. É o que torna um bump que retire conteúdo usado pelo Free
 * um erro alto, em vez de uma descoberta em produção. Entrada própria não passa por aqui — ela
 * não tem o que resolver.
 *
 * Filtra e NÃO reordena: a ordem do artefato é o que mantém o diff do config estável entre bumps.
 */
function resolveRefs<T extends { key: string }>(domain: string, classKey: string, keys: string[], pool: T[]): T[] {
  const wanted = new Set(keys)
  const found = pool.filter(entry => wanted.has(entry.key))
  if (found.length === wanted.size) return found
  const missing = keys.filter(key => !pool.some(entry => entry.key === key))
  throw new Error(
    `Free: ${domain}.${classKey} referencia chave inexistente no artefato do SRD: ${missing.join(', ')}. ` +
    'Rode `pnpm srd:ingest` antes do seed, ou remova a referência (ADR 004, decisão 6d).',
  )
}

/** Toda classe citada pelas referências OU por uma entrada própria — nenhuma some por só ter autoral. */
function classKeys(refs: Record<string, string[]>, authored: AuthoredEntry[]): string[] {
  return [...new Set([...Object.keys(refs), ...authored.flatMap(entry => entry.classes)])]
}

function authoredIn(authored: AuthoredEntry[], classKey: string, locale: Locale) {
  return authored
    .filter(entry => entry.classes.includes(classKey))
    .map(entry => ({ key: entry.key, ...entry[locale], source: 'authored' }))
}

export function buildFreeClassFeatures(srd: SrdCatalog, locale: Locale): Record<string, SystemClassFeature[]> {
  const out: Record<string, SystemClassFeature[]> = { default: [] }
  for (const classKey of classKeys(freeFeatureRefs, AUTHORED_FEATURES)) {
    const refs = resolveRefs('classFeatures', classKey, freeFeatureRefs[classKey] ?? [], srd.classFeatures?.[classKey] ?? [])
    out[classKey] = [...refs, ...authoredIn(AUTHORED_FEATURES, classKey, locale)]
      .sort((a, b) => a.key.localeCompare(b.key))
  }
  return out
}

export function buildFreeClassSpells(srd: SrdCatalog, locale: Locale): Record<string, SystemSpell[]> {
  const out: Record<string, SystemSpell[]> = { default: [] }
  for (const classKey of classKeys(freeSpellRefs, AUTHORED_SPELLS)) {
    const refs = resolveRefs('classSpells', classKey, freeSpellRefs[classKey] ?? [], srd.classSpells?.[classKey] ?? [])
    // Truque autoral é sempre nível 0: os 7 vieram da aba Cantrip do wiki 2024 (US-42).
    const own = authoredIn(AUTHORED_SPELLS, classKey, locale).map(entry => ({ ...entry, level: 0 }))
    out[classKey] = [...refs, ...own]
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.key.localeCompare(b.key))
  }
  return out
}
