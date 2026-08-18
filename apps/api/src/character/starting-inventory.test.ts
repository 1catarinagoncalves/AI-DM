import { describe, it, expect } from 'vitest'
import type { SystemConfig } from '@ai-dm/shared'
import { resolveInitialHook } from './starting-inventory'

// US-127: os testes de `getStartingInventory`/`getClassSpells` migraram para
// packages/shared/src/starting-kit.test.ts, junto com as funções.

// US-105: `classKey` do hook e `Character.class` são a MESMA chave canônica EN — comparação
// direta. Antes, `Character.class` era texto PT e precisava do CLASS_SYNONYMS no meio.
describe('resolveInitialHook (US-28/US-54/US-105)', () => {
  const hook = (id: string, classKey: string) => ({
    id, classKey, title: id, pitch: '',
    openingNarration: '', tags: [],
  })
  const config: SystemConfig = {
    attributes: [{ key: 'strength', label: 'Força', min: 3, max: 20, default: 10 }],
    startingKits: { default: [{ name: 'Adaga', qty: 1 }] },
    initialAdventures: {
      hooks: [hook('paladino-primeira-quebra', 'paladin'), hook('bruxo-preco-do-pacto', 'warlock'), hook('default-primeiro-sinal', 'default')],
    },
  }

  it('a chave da classe resolve o gancho de mesmo classKey', () => {
    expect(resolveInitialHook(config, 'paladin')?.id).toBe('paladino-primeira-quebra')
    expect(resolveInitialHook(config, 'warlock')?.id).toBe('bruxo-preco-do-pacto')
  })

  it('classe sem gancho próprio cai no default', () => {
    expect(resolveInitialHook(config, 'cartografa-estelar')?.id).toBe('default-primeiro-sinal')
    expect(resolveInitialHook(config, 'wizard')?.id).toBe('default-primeiro-sinal')
  })

  it('sistema sem catálogo → null (sem crash)', () => {
    const noHooks: SystemConfig = { attributes: config.attributes, startingKits: config.startingKits }
    expect(resolveInitialHook(noHooks, 'paladin')).toBeNull()
  })
})
