// US-101 — o mesmo personagem pede o gancho inicial nos dois idiomas: a RESOLUÇÃO não pode mudar
// (mesmo `id` por classe) e o TEXTO tem de mudar. Falha se um locale for ignorado (texto igual ao
// do outro) ou se a tradução comer um placeholder — os dois modos de quebrar que a story previu.
import { describe, it, expect } from 'vitest'
import { InitialAdventureHookSchema, type InitialAdventureHook } from '@ai-dm/shared'
import { resolveHookTemplate } from '../src/character/starting-inventory'
import { initialAdventuresByLocale } from './initial-adventures'

const ptBR = initialAdventuresByLocale['pt-BR'].hooks
const enUS = initialAdventuresByLocale['en-US'].hooks

// Os 5 campos que são TEXTO. `id`, `classKey` e `tags` são chave e ficam de fora de propósito.
const textFields = ['title', 'pitch', 'primaryQuestTitle', 'primaryQuestDescription', 'openingNarration'] as const

const twinOf = (hook: InitialAdventureHook) => enUS.find(candidate => candidate.id === hook.id)

describe('ganchos iniciais nos dois locales', () => {
  it('a resolução por classe é idêntica: mesmos id e classKey, na mesma ordem', () => {
    expect(enUS.map(h => [h.id, h.classKey])).toEqual(ptBR.map(h => [h.id, h.classKey]))
    expect(enUS).toHaveLength(13)
    expect(enUS.some(h => h.classKey === 'default')).toBe(true)
  })

  it('cada gancho en-US é válido pelo schema e tem os 5 campos preenchidos', () => {
    for (const hook of enUS) {
      expect(() => InitialAdventureHookSchema.parse(hook)).not.toThrow()
      for (const field of textFields) expect(hook[field].trim().length).toBeGreaterThan(0)
    }
  })

  it('todo campo de texto muda de idioma — nenhum ficou para trás em português', () => {
    for (const hook of ptBR) {
      const twin = twinOf(hook)!
      for (const field of textFields) expect(twin[field], `${hook.id}.${field}`).not.toBe(hook[field])
    }
  })

  it('os placeholders sobrevivem à tradução: interpolar não deixa nada cru', () => {
    const vars = { characterName: 'Seraphine', characterClass: 'Wizard' }
    for (const hook of [...ptBR, ...enUS]) {
      for (const field of textFields) {
        expect(resolveHookTemplate(hook[field], vars), `${hook.id}.${field}`).not.toMatch(/\{\w+\}/)
      }
    }
  })

  it('o gancho `default` continua nomeando a classe nos dois idiomas', () => {
    for (const hooks of [ptBR, enUS]) {
      const fallback = hooks.find(h => h.classKey === 'default')!
      expect(fallback.title).toContain('{characterClass}')
      expect(fallback.openingNarration).toContain('{characterClass}')
    }
  })
})
