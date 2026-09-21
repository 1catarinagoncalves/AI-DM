import { describe, it, expect } from 'vitest'
import { missingFor, type AdvanceInputs } from './missingFor'

// US-259: estado "tudo resolvido" — todo teste parte dele e desfaz UMA condição, então o que
// aparece em `missingFor` é exatamente a pendência que o teste provocou.
const ready: AdvanceInputs = {
  hasSystem: true,
  classKey: 'wizard', classKeys: ['wizard', 'fighter'],
  subclassCount: undefined, subclass: undefined,
  classToolCount: undefined, classToolChosen: 0,
  equipmentSlotCount: undefined, equipmentChoices: [],
  raceKey: 'elf', raceKeys: ['elf', 'dragonborn', 'hill-dwarf', 'high-elf', 'human'],
  draconicAncestry: undefined, raceToolChoice: undefined, raceLanguageChoice: undefined,
  budget: 27, remaining: 0,
  originAbilityGrant: false, abilityChoice: undefined,
  raceAbilityCount: undefined, raceAbilityChosen: 0,
  skillsRequired: 2, skillsChosen: 2,
  originSkillCount: undefined, originSkillChosen: 0,
  raceSkillCount: undefined, raceSkillChosen: 0,
  wizardCantripCount: 3, raceCantripChoice: undefined,
  name: 'Lyra', gender: 'Feminino', genders: ['Feminino', 'Masculino'],
  alignment: 'lawful-good', alignmentKeys: ['lawful-good'],
  originToolCount: undefined, originToolChosen: 0,
}

const missing = (step: Parameters<typeof missingFor>[0], over: Partial<AdvanceInputs>) =>
  missingFor(step, { ...ready, ...over })

describe('missingFor (US-259)', () => {
  it('estado completo não deixa nada faltando em nenhuma etapa', () => {
    for (const step of ['system', 'class', 'race', 'background', 'attributes', 'skills', 'spells', 'identity', 'review', 'world'] as const) {
      expect(missingFor(step, ready), step).toEqual([])
    }
  })

  it('system: sem sistema escolhido', () => {
    expect(missing('system', { hasSystem: false })).toEqual(['setup.missing.system'])
  })

  it('class: lista as cinco pendências possíveis e cada uma some sozinha', () => {
    const all = {
      classKey: '', subclassCount: 3, classToolCount: 2, classToolChosen: 1,
      equipmentSlotCount: 2, equipmentChoices: ['0'],
    }
    expect(missing('class', all)).toEqual([
      'setup.missing.class', 'setup.missing.subclass', 'setup.missing.classTool', 'setup.missing.equipment',
    ])
    expect(missing('class', { ...all, classKey: 'wizard' })).not.toContain('setup.missing.class')
    expect(missing('class', { ...all, subclass: 'champion' })).not.toContain('setup.missing.subclass')
    expect(missing('class', { ...all, classToolChosen: 2 })).not.toContain('setup.missing.classTool')
    expect(missing('class', { ...all, equipmentChoices: ['0', '1'] })).not.toContain('setup.missing.equipment')
  })

  it('class: subclasse com 0 ou 1 entrada não pede escolha; slot vazio ("") conta como pendente', () => {
    expect(missing('class', { subclassCount: 1 })).toEqual([])
    expect(missing('class', { subclassCount: 0 })).toEqual([])
    expect(missing('class', { equipmentSlotCount: 2, equipmentChoices: ['0', ''] })).toEqual(['setup.missing.equipment'])
  })

  it('class: classe fora do catálogo é pendente', () => {
    expect(missing('class', { classKey: 'bard' })).toEqual(['setup.missing.class'])
  })

  it('race: raça, ancestralidade, ferramenta e idioma — só as que a raça escolhida exige', () => {
    expect(missing('race', { raceKey: '' })).toEqual(['setup.missing.race'])
    expect(missing('race', { raceKey: 'dragonborn' })).toEqual(['setup.missing.draconicAncestry'])
    expect(missing('race', { raceKey: 'dragonborn', draconicAncestry: 'red' })).toEqual([])
    expect(missing('race', { raceKey: 'hill-dwarf' })).toEqual(['setup.missing.raceTool'])
    expect(missing('race', { raceKey: 'human' })).toEqual(['setup.missing.raceLanguage'])
    expect(missing('race', { raceKey: 'human', raceLanguageChoice: 'elvish' })).toEqual([])
  })

  it('attributes: pontos do point-buy, +1 de origem e escolha de raça', () => {
    expect(missing('attributes', { remaining: 2 })).toEqual(['setup.missing.attributePoints'])
    expect(missing('attributes', { budget: undefined, remaining: 0 })).toEqual([])
    expect(missing('attributes', { originAbilityGrant: true })).toEqual(['setup.missing.originAbility'])
    expect(missing('attributes', { originAbilityGrant: true, abilityChoice: 'wisdom' })).toEqual([])
    expect(missing('attributes', { raceAbilityCount: 2, raceAbilityChosen: 1 })).toEqual(['setup.missing.raceAbility'])
    expect(missing('attributes', { raceAbilityCount: 2, raceAbilityChosen: 2 })).toEqual([])
  })

  it('skills: classe, origem e raça, cada uma com a própria contagem', () => {
    expect(missing('skills', { skillsChosen: 1 })).toEqual(['setup.missing.skills'])
    expect(missing('skills', { skillsRequired: 0, skillsChosen: 0 })).toEqual([])
    expect(missing('skills', { originSkillCount: 1 })).toEqual(['setup.missing.originSkills'])
    expect(missing('skills', { originSkillCount: 0 })).toEqual([])
    expect(missing('skills', { raceSkillCount: 2, raceSkillChosen: 1 })).toEqual(['setup.missing.raceSkills'])
    expect(missing('skills', { skillsChosen: 0, originSkillCount: 1, raceSkillCount: 2 })).toEqual([
      'setup.missing.skills', 'setup.missing.originSkills', 'setup.missing.raceSkills',
    ])
  })

  it('spells: só o Alto-elfo com truque de mago disponível bloqueia', () => {
    expect(missing('spells', { raceKey: 'high-elf' })).toEqual(['setup.missing.raceCantrip'])
    expect(missing('spells', { raceKey: 'high-elf', raceCantripChoice: 'light' })).toEqual([])
    expect(missing('spells', { raceKey: 'high-elf', wizardCantripCount: 0 })).toEqual([])
    expect(missing('spells', { raceKey: 'elf' })).toEqual([])
  })

  // Regressão US-259: só com o nome preenchido a copy dizia "nada é obrigatório além do nome",
  // mas o avanço exigia gênero e alinhamento também.
  it('identity: só o nome preenchido deixa gênero e alinhamento faltando', () => {
    expect(missing('identity', { gender: '', alignment: '' })).toEqual([
      'setup.missing.gender', 'setup.missing.alignment',
    ])
  })

  it('identity: nome só de espaços conta como vazio; gênero/alinhamento fora da lista também', () => {
    expect(missing('identity', { name: '   ' })).toEqual(['setup.missing.name'])
    expect(missing('identity', { gender: 'Outro' })).toEqual(['setup.missing.gender'])
    expect(missing('identity', { alignment: 'chaotic-evil' })).toEqual(['setup.missing.alignment'])
  })

  it('background: ferramenta(s) da origem só bloqueiam quando a origem exige escolha', () => {
    expect(missing('background', { originToolCount: 1 })).toEqual(['setup.missing.originTools'])
    expect(missing('background', { originToolCount: 1, originToolChosen: 1 })).toEqual([])
    expect(missing('background', { originToolCount: 0 })).toEqual([])
    expect(missing('background', {})).toEqual([])
  })
})
