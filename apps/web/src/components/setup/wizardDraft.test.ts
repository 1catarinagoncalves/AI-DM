import { describe, it, expect } from 'vitest'
import type { SystemConfig } from '@ai-dm/shared'
import type { Step } from './SetupWizard'
import { reconcileDraft, type WizardDraft } from './wizardDraft'

const steps: Step[] = ['system', 'class', 'race', 'background', 'attributes', 'skills', 'spells', 'identity', 'review', 'world']

// Rascunho completo até `skills`: todo grupo de escolha preenchido, para cada teste poder
// afirmar o que ficou e o que caiu.
const draft: WizardDraft = {
  v: 2, systemId: 'sys-1', step: 'skills', furthest: 'skills',
  charData: { name: 'Lyra', gender: 'Feminino', race: 'elf', class: 'wizard', alignment: 'lawful-good', appearance: '', personality: '' },
  subclass: 'evocation', level: '3',
  draconicAncestry: undefined, raceToolChoice: undefined, raceLanguageChoice: 'dwarvish', raceCantripChoice: 'light',
  raceAbilityChoice: ['wisdom'], raceSkillChoice: [],
  classToolChoice: ['lute'], equipmentChoices: ['0', '1'], weaponModeChoices: { 0: 'double' },
  attrs: { strength: 10 }, skills: ['athletics'],
  bg: { story: 'órfã', ideals: '', bonds: '', flaws: '', deity: '' },
  origin: 'bg-sage', connectionRoll: '2', mementoRoll: '3', abilityChoice: 'wisdom', skillChoice: ['arcana'], toolChoice: [],
}

const config = {
  classes: [{ key: 'wizard', label: 'Mago' }],
  subclasses: { wizard: [{ key: 'evocation', label: 'Evocação' }, { key: 'abjuration', label: 'Abjuração' }] },
  races: [{ key: 'elf', label: 'Elfo' }],
  backgrounds: [{ key: 'bg-sage', name: 'Sábio' }],
  alignments: [{ key: 'lawful-good', label: 'Leal e Bom' }],
} as unknown as SystemConfig

describe('reconcileDraft (US-261)', () => {
  it('rascunho cujas chaves todas existem no catálogo passa intacto', () => {
    expect(reconcileDraft(draft, config, steps)).toEqual(draft)
  })

  it('classe que sumiu do catálogo: cai com o que dependia dela e o wizard volta a `class`', () => {
    const out = reconcileDraft(draft, { ...config, classes: [] } as SystemConfig, steps)
    expect(out.charData.class).toBe('')
    expect([out.subclass, out.classToolChoice, out.equipmentChoices, out.skills]).toEqual([undefined, [], [], []])
    expect([out.step, out.furthest]).toEqual(['class', 'class'])
    expect(out.charData.race).toBe('elf') // grupo independente: sobrevive
  })

  it('subclasse fora do catálogo da classe: só ela cai', () => {
    const out = reconcileDraft({ ...draft, subclass: 'necromancy' }, config, steps)
    expect(out.subclass).toBeUndefined()
    expect(out.charData.class).toBe('wizard')
    expect(out.step).toBe('class')
  })

  it('raça e origem ausentes limpam suas escolhas; a etapa só recua até a mais cedo delas', () => {
    const out = reconcileDraft(draft, { ...config, races: [], backgrounds: [] } as SystemConfig, steps)
    expect([out.charData.race, out.raceLanguageChoice, out.raceAbilityChoice]).toEqual(['', undefined, []])
    expect([out.origin, out.connectionRoll, out.abilityChoice, out.skillChoice]).toEqual([undefined, undefined, undefined, []])
    expect(out.step).toBe('race')
  })

  it('não avança a etapa: quem estava antes da etapa afetada fica onde estava', () => {
    const out = reconcileDraft({ ...draft, step: 'class', furthest: 'class' }, { ...config, alignments: [] } as SystemConfig, steps)
    expect([out.step, out.furthest, out.charData.alignment]).toEqual(['class', 'class', ''])
  })

  it('buraco de `equipmentChoices` (null depois do JSON) volta a "" — não vira a opção 0', () => {
    const holey = { ...draft, equipmentChoices: [null, '1'] as unknown as string[] }
    expect(reconcileDraft(holey, config, steps).equipmentChoices).toEqual(['', '1'])
  })
})
