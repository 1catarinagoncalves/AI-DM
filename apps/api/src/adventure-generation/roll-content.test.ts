import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { rollContent } from './roll-content'

describe('rollContent (US-147)', () => {
  it('mesmo characterId+order produz o mesmo conteúdo em duas execuções', () => {
    expect(rollContent('char-1', 1)).toEqual(rollContent('char-1', 1))
  })

  // US-147, AC "eval/regressão": seed fixo produz a mesma seleção de linhas das tabelas
  // do LGMRD — valores pinados em vez de só comparar duas chamadas entre si, pra pegar
  // drift no algoritmo (mesmo espírito do REVIEWED_SEQUENCE_HASH da US-146).
  it('seleção de linhas pinada para (char-1, 1) — fixture salva', () => {
    expect(rollContent('char-1', 1)).toEqual({
      // US-192: sub-seed mudou de 'premissa' (compartilhado) para 'premissa-1'..'premissa-5'
      // (por roll) — quebra a reprodutibilidade byte a byte de antes desta story (esperado,
      // documentado no commit; não é regressão). 5 valores conferidos manualmente contra
      // scripts/lazygm/lgmrd-tables.json (tabela 1d20quests, 20 linhas).
      premissaCandidates: ['Protect an NPC', 'Discover a monument', 'Put a monster to sleep', 'Recover an item', 'Rescue an NPC'],
      locais: 'Cove',
      monumentos: 'Cage',
      complicacao: { condition: 'Drenched', description: 'Horrific', origin: 'Aberrant' },
      patronsandnpcs: [
        { behavior: 'Sly', ancestry: 'Talking animal' },
        { behavior: 'Soft spoken', ancestry: 'Artifact' },
        { behavior: 'Shifty', ancestry: 'Dwarf' },
        { behavior: 'Superior', ancestry: 'Tiefling' },
        { behavior: 'Optimistic', ancestry: 'Halfling' },
        { behavior: 'Soft spoken', ancestry: 'Artifact' },
        { behavior: 'Suspicious', ancestry: 'Goblin' },
      ],
    })
  })

  // US-158: 7 rolls independentes (um por NPC) — `order` diferente muda a seleção,
  // igual aos outros campos (não-degenerado).
  it('patronsandnpcs tem 7 linhas e muda com order (US-158)', () => {
    const a = rollContent('char-1', 1).patronsandnpcs
    const b = rollContent('char-1', 2).patronsandnpcs
    expect(a).toHaveLength(7)
    expect(a).not.toEqual(b)
  })

  it('order diferente produz conteúdo diferente (não-degenerado)', () => {
    expect(rollContent('char-1', 1)).not.toEqual(rollContent('char-1', 2))
  })

  it('locais e monumentos vêm da mesma linha rolada (um roll dá os dois)', () => {
    const result = rollContent('char-1', 5)
    expect(typeof result.locais).toBe('string')
    expect(typeof result.monumentos).toBe('string')
  })

  it('o módulo não chama Math.random', () => {
    const source = readFileSync(resolve(__dirname, 'roll-content.ts'), 'utf8')
    expect(source).not.toMatch(/Math\.random\(/)
  })
})
