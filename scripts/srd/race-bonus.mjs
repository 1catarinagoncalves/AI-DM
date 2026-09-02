// Bônus de atributo por raça ("+2 Destreza" no cartão de espécie), extraído do traço
// "Ability Score Increase" (SpeciesTrait.2014.json). É regra do 5e formatada, não prosa autoral
// como kicker/blurb (US-203) — dá pra extrair mecanicamente em vez de exigir overlay curado.
//
// Módulo separado do ingest.mjs por tamanho (aquele já passa de 500 linhas) e por
// responsabilidade: aqui não há overlay nem dataset bruto, só o texto do traço já resolvido.

// Formato do dataset só tem 3 formas: "Your X score increases by N[, and your Y score
// increases by M]", "Your ability scores each increase by 1" (Human) e "Your X score increases
// by N, and TWO other ability scores of your choice increase by M" (Half-Elf, única ocorrência
// nas 13 chaves jogáveis — por isso `CHOICE_COUNT_WORDS` cobre só "two").
const CHOICE_COUNT_WORDS = { one: 1, two: 2, three: 3 }

export function parseAbilityScoreIncrease(desc, attrOrder) {
  const allSix = desc.match(/ability scores? each increase by (\d+)/i)
  if (allSix) {
    const amount = Number(allSix[1])
    return { fixed: attrOrder.map((attr) => ({ attr, amount })), choice: null }
  }
  const fixed = []
  for (const m of desc.matchAll(/your (\w+) score increases by (\d+)/gi)) {
    const attr = m[1].toLowerCase()
    if (attrOrder.includes(attr)) fixed.push({ attr, amount: Number(m[2]) })
  }
  const choiceMatch = desc.match(/(\w+) other ability scores? of your choice increase by (\d+)/i)
  const choice = choiceMatch
    ? { count: CHOICE_COUNT_WORDS[choiceMatch[1].toLowerCase()] ?? Number(choiceMatch[1]), amount: Number(choiceMatch[2]) }
    : null
  return { fixed, choice }
}

// A frase de escolha livre (só Half-Elf) e o "+1 em todos" (Human) são a única parte deste
// bônus que não vem de dado nenhum — viram literal curada por locale, mesmo padrão do US-52
// pras poucas frases que o dataset não cobre. Os outros pedaços usam o rótulo já resolvido de
// `attributes` (Força/Strength conforme a passagem de `buildConfig`).
const CHOICE_PHRASE = {
  'en-US': ({ count, amount }) => `+${amount} to ${count === 1 ? 'one other ability' : `${count} other abilities`} of your choice`,
  'pt-BR': ({ count, amount }) => `+${amount} em ${count === 1 ? 'outro atributo' : `${count} outros atributos`} à sua escolha`,
}
const ALL_ATTRS_PHRASE = {
  'en-US': (amount) => `+${amount} to all abilities`,
  'pt-BR': (amount) => `+${amount} em todos os atributos`,
}

// Roda DEPOIS de `buildRaceFeatures` (ingest.mjs): reusa o combinado raiz+subespécie que ela já
// monta (uma subespécie herda o traço da raiz — Anão da Colina precisa do CON+2 do Anão E do
// próprio SAB+1), em vez de duplicar essa junção aqui. Só emite bônus pra quem `raceFeatures`
// emitiu (a mesma chave JOGÁVEL — raiz COM subespécie já não está lá, US-142).
export function buildRaceBonuses(raceFeatures, attributes, locale) {
  const attrOrder = attributes.map((a) => a.key)
  const labelFor = (attr) => attributes.find((a) => a.key === attr)?.label ?? attr
  const bonuses = {}
  for (const [raceKey, features] of Object.entries(raceFeatures)) {
    const asiTraits = features.filter((f) => f.key === 'ability-score-increase')
    if (asiTraits.length === 0) continue
    const merged = new Map()
    let choice = null
    for (const trait of asiTraits) {
      const parsed = parseAbilityScoreIncrease(trait.description, attrOrder)
      for (const { attr, amount } of parsed.fixed) merged.set(attr, (merged.get(attr) ?? 0) + amount)
      if (parsed.choice) choice = parsed.choice
    }
    // Human (única raça com as 6 chaves) some por um texto curto em vez de 6 fragmentos "+1 X".
    const allSixEqual = merged.size === attrOrder.length && new Set(merged.values()).size === 1
    const parts = allSixEqual
      ? [ALL_ATTRS_PHRASE[locale](merged.get(attrOrder[0]))]
      : attrOrder.filter((attr) => merged.has(attr)).map((attr) => `+${merged.get(attr)} ${labelFor(attr)}`)
    if (choice) parts.push(CHOICE_PHRASE[locale](choice))
    if (parts.length) bonuses[raceKey] = parts.join(', ')
  }
  return bonuses
}
