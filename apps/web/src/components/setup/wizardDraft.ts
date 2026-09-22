import type { SystemConfig } from '@ai-dm/shared'
import type { Step } from './SetupWizard'

// US-261: rascunho da criação em `sessionStorage` (dura a aba: cobre F5 e clique errado em
// "Voltar aos personagens", sem carregar rascunho velho contra um catálogo que mudou semanas
// depois). Módulo fora do SetupWizard (2300+ linhas): só o I/O e a validação contra o
// catálogo; quem conhece os ~25 `useState` é o componente.
//
// Sem storage (janela privada, dados de site bloqueados) toda função aqui degrada em silêncio
// e o wizard funciona como antes da US-261.
const DRAFT_KEY = 'aidm.wizard.draft'
// Rascunho com `v` diferente é descartado, nunca migrado. Mudou o formato → suba este número.
const DRAFT_VERSION = 1

export type WizardDraft = {
  v: typeof DRAFT_VERSION
  systemId: string
  step: Step
  furthest: number
  charData: { name: string; gender: string; race: string; class: string; alignment: string; appearance: string; personality: string }
  subclass: string | undefined
  level: string
  draconicAncestry: string | undefined
  raceToolChoice: string | undefined
  raceLanguageChoice: string | undefined
  raceCantripChoice: string | undefined
  raceAbilityChoice: string[]
  raceSkillChoice: string[]
  classToolChoice: string[]
  equipmentChoices: string[]
  weaponModeChoices: Record<number, 'companion' | 'double'>
  attrs: Record<string, number>
  skills: string[]
  bg: { story: string; ideals: string; bonds: string; flaws: string; deity: string }
  origin: string | undefined
  connectionRoll: string | undefined
  mementoRoll: string | undefined
  abilityChoice: string | undefined
  skillChoice: string[]
  toolChoice: string[]
}

// Cada grupo é o que `handleSelectSystem` já zera ao trocar de sistema — o mesmo par
// "chave do catálogo + escolhas que dependem dela", agora aplicado quando a chave some.
const NO_CLASS_CHOICES = { subclass: undefined, classToolChoice: [], equipmentChoices: [], weaponModeChoices: {}, skills: [] }
const NO_RACE_CHOICES = {
  draconicAncestry: undefined, raceToolChoice: undefined, raceLanguageChoice: undefined,
  raceCantripChoice: undefined, raceAbilityChoice: [], raceSkillChoice: [],
}
const NO_ORIGIN_CHOICES = { origin: undefined, connectionRoll: undefined, mementoRoll: undefined, abilityChoice: undefined, skillChoice: [], toolChoice: [] }

const absent = (key: string | undefined, catalog: readonly { key: string }[] | undefined): boolean =>
  !!key && !catalog?.some(entry => entry.key === key)

/**
 * Descarta do rascunho toda chave que o catálogo carregado já não tem, com as escolhas que
 * dependiam dela, e recua `step`/`furthest` até a etapa afetada — nunca avança. Sem isso um
 * `class` sumido chegaria à API e voltaria como "Erro ao criar personagem" na revisão.
 * Ex.: catálogo sem `wizard` + rascunho em `skills` → devolve `step: 'class'`, `class: ''`.
 */
export function reconcileDraft(draft: WizardDraft, config: SystemConfig | null, steps: readonly Step[]): WizardDraft {
  // Slot pulado em `equipmentChoices` é buraco no array (setEquipmentChoiceAt); o JSON o grava
  // como null, e null não é '' ("não escolhido") — o wizard leria como a opção 0.
  let out: WizardDraft = { ...draft, equipmentChoices: draft.equipmentChoices.map(choice => choice ?? '') }
  const reset = (at: Step, patch: Partial<WizardDraft>) => {
    const atIndex = steps.indexOf(at)
    out = { ...out, ...patch, step: steps[Math.min(steps.indexOf(out.step), atIndex)]!, furthest: Math.min(out.furthest, atIndex) }
  }
  if (absent(out.charData.class, config?.classes)) reset('class', { charData: { ...out.charData, class: '' }, ...NO_CLASS_CHOICES })
  if (absent(out.subclass, config?.subclasses?.[out.charData.class])) reset('class', { subclass: undefined })
  if (absent(out.charData.race, config?.races)) reset('race', { charData: { ...out.charData, race: '' }, ...NO_RACE_CHOICES })
  if (absent(out.origin, config?.backgrounds)) reset('background', NO_ORIGIN_CHOICES)
  if (absent(out.charData.alignment, config?.alignments)) reset('identity', { charData: { ...out.charData, alignment: '' } })
  return out
}

/** Serializa o rascunho atual. `v` fica aqui dentro: o chamador não decide a versão. */
export function stringifyDraft(fields: Omit<WizardDraft, 'v'>): string {
  return JSON.stringify({ v: DRAFT_VERSION, ...fields })
}

export function writeWizardDraft(json: string): void {
  try { sessionStorage.setItem(DRAFT_KEY, json) } catch { /* sem storage o wizard funciona como antes (US-261) */ }
}

export function clearWizardDraft(): void {
  try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* idem */ }
}

/**
 * Lê o rascunho, acha o sistema dele na lista carregada e o reconcilia com o catálogo.
 * `null` para qualquer falha (sem rascunho, outra versão, sistema que sumiu, storage que
 * lança, JSON quebrado): o wizard segue como se nunca tivesse existido.
 */
export function loadWizardDraft<S extends { id: string; config: SystemConfig | null }>(
  systems: readonly S[], steps: readonly Step[],
): { system: S; draft: WizardDraft } | null {
  try {
    const stored: Partial<WizardDraft> | null = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null')
    if (stored?.v !== DRAFT_VERSION || !steps.includes(stored.step as Step)) return null
    const system = systems.find(s => s.id === stored.systemId)
    // Só `v`/`step`/`systemId` são checados: esta chave só é escrita por `stringifyDraft`,
    // e formato novo sobe DRAFT_VERSION. Qualquer erro daqui para baixo cai no catch.
    return system ? { system, draft: reconcileDraft(stored as WizardDraft, system.config, steps) } : null
  } catch { return null }
}
