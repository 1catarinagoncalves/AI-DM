import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import type { GeneratedAdventure } from '@ai-dm/shared'
import {
  adventureEvalPassed,
  assertAdventureArtifact,
  exemplarHeadings,
  exemplarSection,
  renderAdventureEvalReport,
  EXEMPLAR_SECTION_NAMES,
  type AdventureAssertion,
  type AdventureAssertionName,
  type AdventureEvalMeta,
  type AdventureEvalRun,
} from './adventure-eval'
import { brute, EXPECTED_GOOD, goodAdventure } from './adventure-eval.test-helpers'
import { ADVENTURE_EVAL_ATTEMPT, ADVENTURE_EVAL_ORDER, ADVENTURE_EVAL_PROFILES, expectationFor } from './adventure-eval-profiles'
import { rollFactionCount } from './roll-registry'
import { AREA_TYPES, SETTINGS, TONES } from './registry-catalog'

// `revelado` sai sempre `false` do seed real — nenhum artefato o faz nascer revelado. Pra provar que
// `ledger-oculto` MORDE (e não é um assert que sempre passa), o teste liga este flag e o mock do seed
// devolve o ledger real com as entidades reveladas.
const seedFault = vi.hoisted(() => ({ revealAll: false }))
vi.mock('./seed-ledger', async (importOriginal) => {
  const real = await importOriginal<typeof import('./seed-ledger')>()
  return {
    ...real,
    seedLedgerFromGeneratedAdventure: (adventure: GeneratedAdventure) => {
      const ledger = real.seedLedgerFromGeneratedAdventure(adventure)
      return seedFault.revealAll ? ledger.map((entity) => ({ ...entity, revelado: true })) : ledger
    },
  }
})

// US-238: AC de regressão — artefato bom passa em todos os asserts; cada artefato deliberadamente
// quebrado falha exatamente no assert que ele viola, com o valor ofensor no `detail`.

const EXPECTED = EXPECTED_GOOD

const failedNames = (results: AdventureAssertion[]): AdventureAssertionName[] => results.filter((r) => !r.ok).map((r) => r.name)
const detailOf = (results: AdventureAssertion[], name: AdventureAssertionName): string => results.find((r) => r.name === name)!.detail

describe('assertAdventureArtifact — artefato bom (US-238)', () => {
  it('passa nos 8 asserts', () => {
    const results = assertAdventureArtifact(goodAdventure(), EXPECTED)
    expect(results).toHaveLength(8)
    expect(failedNames(results)).toEqual([])
  })
})

describe('assertAdventureArtifact — artefato deliberadamente quebrado (US-238)', () => {
  it('grafo órfão (challenge.locationId inexistente) reprova grafo-fecha e nomeia o id', () => {
    const broken = goodAdventure()
    broken.challenges[0]!.locationId = 'loc-999'
    const results = assertAdventureArtifact(broken, EXPECTED)
    expect(failedNames(results)).toEqual(['grafo-fecha'])
    expect(detailOf(results, 'grafo-fecha')).toContain('loc-999')
  })

  it('NPC referenciado pelo encontro que não existe reprova grafo-fecha', () => {
    const broken = goodAdventure()
    broken.encounters[0]!.npcIds = ['npc-999']
    const results = assertAdventureArtifact(broken, EXPECTED)
    expect(failedNames(results)).toContain('grafo-fecha')
    expect(detailOf(results, 'grafo-fecha')).toContain('npc-999')
  })

  it('factionId que não resolve reprova grafo-fecha', () => {
    const broken = goodAdventure()
    broken.npcs[0]!.factionId = 'faction-9'
    const results = assertAdventureArtifact(broken, EXPECTED)
    expect(failedNames(results)).toEqual(['grafo-fecha'])
    expect(detailOf(results, 'grafo-fecha')).toContain('faction-9')
  })

  it('número de mecânica na prosa ("CD 15") reprova prosa-sem-numero e nomeia o campo', () => {
    const broken = goodAdventure()
    broken.challenges[0]!.situation = 'O sino balança sem vento. Um teste de Percepção (CD 15) revela quem observa.'
    const results = assertAdventureArtifact(broken, EXPECTED)
    expect(failedNames(results)).toEqual(['prosa-sem-numero'])
    expect(detailOf(results, 'prosa-sem-numero')).toContain('challenges')
  })

  it('espaço duplo e quebra de linha extra na prosa NÃO contam como número vazado', () => {
    const noisy = goodAdventure()
    noisy.story = 'Três ordens  disputam a cripta.\n\n\nNenhuma quer o selo rompido.'
    expect(failedNames(assertAdventureArtifact(noisy, EXPECTED))).toEqual([])
  })

  it('encontro acima do orçamento do nível reprova orcamento-cabe', () => {
    const broken = goodAdventure()
    broken.npcs.push(brute('npc-4'), brute('npc-5'))
    broken.encounters[0]!.npcIds = ['npc-3', 'npc-4', 'npc-5']
    const results = assertAdventureArtifact(broken, EXPECTED)
    expect(failedNames(results)).toEqual(['orcamento-cabe'])
    expect(detailOf(results, 'orcamento-cabe')).toContain('encounter-1')
  })

  it('contagem de facções diferente da pinada reprova facoes', () => {
    const broken = goodAdventure()
    broken.factions.pop()
    const results = assertAdventureArtifact(broken, EXPECTED)
    expect(failedNames(results)).toEqual(['facoes'])
    expect(detailOf(results, 'facoes')).toContain('esperava 3')
  })

  it('duas facções com o mesmo want reprovam facoes', () => {
    const broken = goodAdventure()
    broken.factions[1]!.want = ' Manter a cripta lacrada '
    const results = assertAdventureArtifact(broken, EXPECTED)
    expect(failedNames(results)).toEqual(['facoes'])
    expect(detailOf(results, 'facoes')).toContain('mesmo want')
  })

  it('sem factionCount pinado, contagem fora de [2,4] reprova facoes', () => {
    const broken = goodAdventure()
    broken.factions = [broken.factions[0]!]
    broken.npcs[0]!.factionId = undefined
    broken.npcs[1]!.factionId = undefined
    broken.locations[0]!.factionId = undefined
    const results = assertAdventureArtifact(broken, { challenge: 'adventure', minChallenges: 3 })
    expect(detailOf(results, 'facoes')).toContain('fora da faixa')
  })

  it('objective.reward com efeito em branco reprova objetivo-com-premio', () => {
    const broken = goodAdventure()
    broken.objective.reward.effect = '   '
    expect(failedNames(assertAdventureArtifact(broken, EXPECTED))).toEqual(['objetivo-com-premio'])
  })

  it('menos desafios não-combate que o mínimo reprova desafios-nao-combate', () => {
    const broken = goodAdventure()
    broken.challenges.pop()
    const results = assertAdventureArtifact(broken, EXPECTED)
    expect(failedNames(results)).toContain('desafios-nao-combate')
    expect(detailOf(results, 'desafios-nao-combate')).toContain('mínimo 3')
  })

  it('ledger que semeia entidade revelada reprova ledger-oculto e nomeia a entidade', () => {
    seedFault.revealAll = true
    try {
      const results = assertAdventureArtifact(goodAdventure(), EXPECTED)
      expect(failedNames(results)).toEqual(['ledger-oculto'])
      expect(detailOf(results, 'ledger-oculto')).toMatch(/nasceu com revelado/)
    } finally {
      seedFault.revealAll = false
    }
  })

  it('seção do exemplar sem conteúdo (followUps vazio) reprova estrutura-8-secoes e nomeia a seção', () => {
    const broken = goodAdventure()
    broken.followUps = []
    const results = assertAdventureArtifact(broken, EXPECTED)
    expect(failedNames(results)).toEqual(['estrutura-8-secoes'])
    expect(detailOf(results, 'estrutura-8-secoes')).toContain('Follow Up Ideas')
  })
})

describe('exemplar de estrutura (US-238)', () => {
  const exemplar = readFileSync(resolve(__dirname, '../../../../evals/exemplars/cripta-do-veu-silencioso.md'), 'utf8')

  it('os cabeçalhos do exemplar batem com as seções que o eval cobra — deriva reprova', () => {
    expect(exemplarHeadings(exemplar)).toEqual(EXEMPLAR_SECTION_NAMES)
  })

  it('exemplarHeadings ignora cabeçalho de outro nível', () => {
    expect(exemplarHeadings('# A\n## B\n### C\n#### D\n### E')).toEqual(['C', 'E'])
  })
})

describe('perfis pinados (US-238)', () => {
  it('ids e characterIds são únicos (sub-seed distinto por perfil)', () => {
    expect(new Set(ADVENTURE_EVAL_PROFILES.map((p) => p.id)).size).toBe(ADVENTURE_EVAL_PROFILES.length)
    expect(new Set(ADVENTURE_EVAL_PROFILES.map((p) => p.characterId)).size).toBe(ADVENTURE_EVAL_PROFILES.length)
  })

  it('eixos de registro fixados existem nos catálogos do sorteio (chave canônica, não rótulo)', () => {
    for (const { id, registry } of ADVENTURE_EVAL_PROFILES) {
      expect(SETTINGS as readonly string[], `${id}.setting`).toContain(registry.setting)
      expect(TONES as readonly string[], `${id}.tone`).toContain(registry.tone)
      expect(AREA_TYPES as readonly string[], `${id}.areaType`).toContain(registry.areaType)
    }
  })

  it('a contagem de facções esperada é a do sorteio, repetível e dentro de [2,4]', () => {
    for (const profile of ADVENTURE_EVAL_PROFILES) {
      const { factionCount } = expectationFor(profile, 3)
      expect(factionCount).toBe(rollFactionCount(profile.characterId, ADVENTURE_EVAL_ORDER, ADVENTURE_EVAL_ATTEMPT))
      expect(factionCount).toBeGreaterThanOrEqual(2)
      expect(factionCount).toBeLessThanOrEqual(4)
    }
  })
})

describe('exemplarSection (US-238)', () => {
  it('devolve o texto sob o cabeçalho, sem o cabeçalho seguinte, também com CRLF', () => {
    const md = '## T\r\n\r\n### Setting\r\nA floresta.\r\n\r\n### Story\r\nO enredo.\r\n'
    expect(exemplarSection(md, 'Setting')).toBe('A floresta.')
    expect(exemplarSection(md, 'Story')).toBe('O enredo.')
  })

  it('seção inexistente → undefined', () => {
    expect(exemplarSection('### Setting\nx', 'Story')).toBeUndefined()
  })

  it('acha a Setting do exemplar real (âncora do juiz)', () => {
    const md = readFileSync(resolve(__dirname, '../../../../evals/exemplars/cripta-do-veu-silencioso.md'), 'utf8')
    expect(exemplarSection(md, 'Setting')).toContain('Floresta de Ashwyrne')
  })
})

describe('relatório do runner (US-238)', () => {
  const META: AdventureEvalMeta = { mode: 'pipeline', gitHead: 'abc1234', timestamp: '2026-09-20T18-00-00', judgeModel: 'gemini-x' }
  const passing: AdventureEvalRun = { profileId: 'p1', assertions: assertAdventureArtifact(goodAdventure(), EXPECTED), gate: 'ok', judgeMedia: 4.8 }

  it('passa só se todo perfil gerou e todo assert passou — nota do juiz nunca reprova nem aprova', () => {
    expect(adventureEvalPassed([passing])).toBe(true)
    expect(adventureEvalPassed([{ ...passing, judgeMedia: 1 }])).toBe(true)
    expect(adventureEvalPassed([{ ...passing, error: 'escada esgotada' }])).toBe(false)
    const orphan = goodAdventure()
    orphan.challenges[0]!.locationId = 'loc-999'
    expect(adventureEvalPassed([{ ...passing, assertions: assertAdventureArtifact(orphan, EXPECTED), judgeMedia: 5 }])).toBe(false)
  })

  it('relatório lista assert por assert com o detalhe da falha e marca a nota do juiz como informativa', () => {
    const orphan = goodAdventure()
    orphan.challenges[0]!.locationId = 'loc-999'
    const md = renderAdventureEvalReport([{ ...passing, assertions: assertAdventureArtifact(orphan, EXPECTED), gate: 'reprovou (graph)' }], META)
    expect(md).toContain('❌ reprovou')
    expect(md).toContain('| grafo-fecha | ❌ |')
    expect(md).toContain('loc-999')
    expect(md).toContain('7/8 asserts')
    expect(md).toContain('Juiz (informativo, não decide): 4.80/5')
    expect(md).toContain('pipeline (temperature 0')
  })

  it('perfil cuja geração falhou aparece com o erro, e sem juiz vira n/a', () => {
    const md = renderAdventureEvalReport([{ profileId: 'p2', assertions: [], gate: '-', error: 'escada de 1 modelos esgotada' }, { ...passing, judgeMedia: undefined }], META)
    expect(md).toContain('## p2 — ❌ geração falhou')
    expect(md).toContain('escada de 1 modelos esgotada')
    expect(md).toContain('Juiz (informativo, não decide): n/a')
  })
})
