import { RACE_EXTRA_LANGUAGE_CHOICE } from '@ai-dm/shared'
import type { MessageKey } from '@/messages'
import type { Step } from './SetupWizard'

// US-259: o que falta para o "Próximo" liberar. `canAdvance` (US-26) só devolvia booleano e o
// botão apagado (`disabled:pointer-events-none`) não deixa nem `title` chegar — a jogadora
// clicava sem saber o motivo. Agora `canAdvance` é DERIVADA desta lista (vazia = pode avançar),
// então a linha "Falta: …" e o `disabled` nunca divergem. Módulo à parte porque SetupWizard.tsx
// passa de 2300 linhas; os comentários de US abaixo moravam nas condições do antigo
// `canAdvance` e vieram junto com elas.
export type MissingKey = Extract<MessageKey, `setup.missing.${string}`>

/**
 * Estado que `canAdvance` já lia, em valores crus (contagens, chaves) — os catálogos derivados
 * ficam no componente. Contagem `undefined` = a etapa não tem essa escolha para o que foi
 * selecionado (classe sem `choice`, raça sem `grant.choice`, origem sem grant).
 */
export interface AdvanceInputs {
  hasSystem: boolean
  classKey: string; classKeys: readonly string[]
  subclassCount: number | undefined; subclass: string | undefined
  classToolCount: number | undefined; classToolChosen: number
  equipmentSlotCount: number | undefined; equipmentChoices: readonly string[]
  raceKey: string; raceKeys: readonly string[]
  draconicAncestry: string | undefined; raceToolChoice: string | undefined; raceLanguageChoice: string | undefined
  budget: number | undefined; remaining: number
  originAbilityGrant: boolean; abilityChoice: string | undefined
  raceAbilityCount: number | undefined; raceAbilityChosen: number
  skillsRequired: number; skillsChosen: number
  originSkillCount: number | undefined; originSkillChosen: number
  raceSkillCount: number | undefined; raceSkillChosen: number
  wizardCantripCount: number; raceCantripChoice: string | undefined
  name: string; gender: string; genders: readonly string[]
  alignment: string; alignmentKeys: readonly string[]
  originToolCount: number | undefined; originToolChosen: number
}

type Check = readonly [isPending: boolean, key: MissingKey]

function pending(checks: readonly Check[]): MissingKey[] {
  return checks.filter(([isPending]) => isPending).map(([, key]) => key)
}

// Escolha exata pedida (`count`) e ainda não feita. `count === 0` ou `undefined` = sem escolha.
function short(count: number | undefined, chosen: number): boolean {
  return count !== undefined && count !== 0 && chosen !== count
}

// US-226: slot `''` é "ainda não escolhido" (índice 0 = opção A é válido). Checa por índice
// (não por `.length`) porque um slot preenchido fora de ordem deixaria buracos no array que
// `.length` sozinho não pegaria.
function hasEmptySlot(slotCount: number, choices: readonly string[]): boolean {
  for (let i = 0; i < slotCount; i++) if (choices[i] === undefined || choices[i] === '') return true
  return false
}

// US-210: nome e gênero saíram daqui — moraram na etapa `class` até a US-205, agora vivem na
// etapa `identity` (ver `missingForIdentity`). Sobra só a classe — mais subclasse quando a
// classe escolhida tem mais de uma opção (marshal, hoje). Classe com 0 ou 1 subclasse não exige
// nada aqui: sem catálogo não há o que escolher, com 1 entrada só ela preenche sozinha no service.
function missingForClass(s: AdvanceInputs): MissingKey[] {
  return pending([
    [!s.classKeys.includes(s.classKey), 'setup.missing.class'],
    [s.subclassCount !== undefined && s.subclassCount > 1 && !s.subclass, 'setup.missing.subclass'],
    // US-221: classe com `toolProficiencies.choice` (Bardo/Monge) exige exatamente `choice.count`
    // escolhas — mesmo espírito da checagem de subclass acima.
    [s.classToolCount !== undefined && s.classToolChosen !== s.classToolCount, 'setup.missing.classTool'],
    // US-226: classe com `startingEquipmentChoices` exige um valor não-vazio em CADA slot.
    // US-229: `equipmentSlotCount` é `.slots` (achatado, inclui o sintético de `fixed`) no lugar
    // de `.choices` cru — mesma checagem, mais slots quando a classe tem item genérico em `fixed`.
    [s.equipmentSlotCount !== undefined && hasEmptySlot(s.equipmentSlotCount, s.equipmentChoices), 'setup.missing.equipment'],
  ])
}

function missingForRace(s: AdvanceInputs): MissingKey[] {
  return pending([
    [!s.raceKeys.includes(s.raceKey), 'setup.missing.race'],
    // US-211: dragonborn exige a ancestralidade dracônica escolhida — mesmo espírito da
    // checagem de subclass em `missingForClass`.
    [s.raceKey === 'dragonborn' && !s.draconicAncestry, 'setup.missing.draconicAncestry'],
    // Traço "Tool Proficiency" do anão: mesmo espírito da checagem de draconicAncestry acima.
    [s.raceKey === 'hill-dwarf' && !s.raceToolChoice, 'setup.missing.raceTool'],
    // US-214: mesmo espírito das duas checagens acima, generalizado às 3 raças de
    // RACE_EXTRA_LANGUAGE_CHOICE — nunca bloqueia as outras 6.
    [RACE_EXTRA_LANGUAGE_CHOICE.includes(s.raceKey) && !s.raceLanguageChoice, 'setup.missing.raceLanguage'],
  ])
}

// US-123: além do point-buy fechado, background com grant.kind === 'ability' exige uma linha
// escolhida para o +1 livre (a linha fixa não conta, é automática).
// US-212: além do point-buy e do grant de origem, raça com grant.choice exige o número certo de
// escolhas feitas — mesmo espírito das duas checagens acima, terceira fonte.
function missingForAttributes(s: AdvanceInputs): MissingKey[] {
  return pending([
    [s.budget !== undefined && s.remaining !== 0, 'setup.missing.attributePoints'],
    [s.originAbilityGrant && !s.abilityChoice, 'setup.missing.originAbility'],
    [s.raceAbilityCount !== undefined && s.raceAbilityChosen !== s.raceAbilityCount, 'setup.missing.raceAbility'],
  ])
}

// Sem perícias no config → etapa livre; senão exige exatamente `skillsRequired`. US-131: além
// disso, background com grant.kind === 'skills' exige as `chooseCount` chaves da origem (mesmo
// espírito do bônus de atributo, mas aqui a escolha acontece nesta etapa, não na `background` —
// perícia de origem e perícia de classe ficam na mesma tela).
// US-220: Meio-elfo (Skill Versatility) exige as `raceSkillChoiceCount` escolhas próprias, além
// das da classe/origem já checadas acima — `skillsRequired` já soma a substituta da colisão
// fixa×fixa (ver §Colisão) ao orçamento da classe.
function missingForSkills(s: AdvanceInputs): MissingKey[] {
  return pending([
    [s.skillsRequired !== 0 && s.skillsChosen !== s.skillsRequired, 'setup.missing.skills'],
    [short(s.originSkillCount, s.originSkillChosen), 'setup.missing.originSkills'],
    [s.raceSkillCount !== undefined && s.raceSkillChosen !== s.raceSkillCount, 'setup.missing.raceSkills'],
  ])
}

// US-210: nome, gênero e alinhamento — a condição composta que morava em canAdvance('class')
// antes da US-205 reabrir a posição (ver Contexto da US-210). `appearance`/`personality` são
// opcionais, não entram aqui. US-259: os três são obrigatórios, e a copy da etapa agora diz isso.
function missingForIdentity(s: AdvanceInputs): MissingKey[] {
  return pending([
    [s.name.trim() === '', 'setup.missing.name'],
    [!s.genders.includes(s.gender), 'setup.missing.gender'],
    [!s.alignmentKeys.includes(s.alignment), 'setup.missing.alignment'],
  ])
}

export function missingFor(step: Step, s: AdvanceInputs): MissingKey[] {
  switch (step) {
    case 'system': return pending([[!s.hasSystem, 'setup.missing.system']])
    case 'class': return missingForClass(s)
    case 'race': return missingForRace(s)
    case 'attributes': return missingForAttributes(s)
    case 'skills': return missingForSkills(s)
    // US-213: só bloqueia quando o Alto-elfo TEM truque de mago pra escolher — nos demais casos
    // (não é Alto-elfo, ou catálogo do Mago vazio) a etapa nunca bloqueia o avanço.
    case 'spells': return pending([[s.raceKey === 'high-elf' && s.wizardCantripCount > 0 && !s.raceCantripChoice, 'setup.missing.raceCantrip']])
    case 'identity': return missingForIdentity(s)
    // Origem, conexão e memento são opcionais — etapa `background` não bloqueia o avanço por
    // causa deles (mesmo espírito de US-39: texto livre também é opcional). A escolha do grant de
    // PERÍCIA acontece na etapa `skills` (ver acima), não aqui — mesmo padrão do bônus de
    // atributo, cujo aviso também é só informativo nesta etapa.
    // US-132: a escolha do grant de FERRAMENTA é diferente — acontece NESTA etapa (não há etapa
    // `tools` própria pra adiar, ver §Onde aparece na criação e na ficha), por isso bloqueia o
    // avanço até `toolChoice` ter exatamente `chooseCount` chaves.
    case 'background': return pending([[short(s.originToolCount, s.originToolChosen), 'setup.missing.originTools']])
    case 'review': return []
    // US-157: Cenário/Tom/Tipo de Área são opcionais (Aleatório é uma escolha válida) — o passo
    // `world` nunca bloqueia; o footer usa `createWorldAdventure`, não `next()`.
    case 'world': return []
  }
}
