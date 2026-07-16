import { describe, it, expect } from 'vitest'
import { stripFabricatedRolls, stripReasoningLeak, formatDiceBreakdown } from './narration'

describe('stripReasoningLeak — canais de raciocínio na prosa', () => {
  it('corta o canal analysis do gpt-oss, colado pelo marcador degradado', () => {
    // Forma real do bug: tokens especiais removidos, `assistantfinal` cola o
    // raciocínio à primeira letra da narração.
    const { clean, removed } = stripReasoningLeak(
      'Need to interpret qualitatively: total 11 is moderate. Proceed with final answer.assistantfinalA lâmina reluz no chão úmido.',
    )
    expect(clean).toBe('A lâmina reluz no chão úmido.')
    expect(removed).toHaveLength(1)
    expect(removed[0]).toContain('Need to interpret')
  })

  it('corta os canais Harmony com os tokens ainda crus', () => {
    const { clean } = stripReasoningLeak(
      '<|channel|>analysis<|message|>preciso descrever a chuva<|end|><|start|>assistant<|channel|>final<|message|>A chuva cai fria.',
    )
    expect(clean).toBe('A chuva cai fria.')
  })

  it('corta bloco <think>, fechado ou truncado', () => {
    expect(stripReasoningLeak('<think>preciso descrever</think>A chuva cai.').clean).toBe('A chuva cai.')
    // Stream cortado no meio do raciocínio: não há narração a salvar.
    expect(stripReasoningLeak('A chuva cai.<think>agora preciso').clean).toBe('A chuva cai.')
  })

  it('NÃO toca em narração limpa — inclusive as opções em bullets e o travessão', () => {
    const narracao =
      'A lâmina reluz no chão úmido.\n— Quem vem lá? — grita o velho.\n\n- 🏹 Verificar as flechas.\n- 🚶‍♀️ Deixar a clareira.'
    const { clean, removed } = stripReasoningLeak(narracao)
    expect(clean).toBe(narracao)
    expect(removed).toHaveLength(0)
  })

  it('NÃO acusa prosa que apenas fala de análise ou de finais', () => {
    const narracao = 'Sua análise do ritual sugere um final sombrio para quem o completar.'
    expect(stripReasoningLeak(narracao).clean).toBe(narracao)
  })

  it('cadeia do onFinish: raciocínio ANTES das rolagens, na ordem do serviço', () => {
    // A ordem importa. O raciocínio vazado fala de rolagem ("total 11"), então
    // inverter os saneadores faria o stripFabricatedRolls comer frases soltas do
    // raciocínio e deixar o resto colado à narração.
    const vazado =
      'Need to interpret qualitatively: moderate success? The system gave total 11. ' +
      'That is moderate, not high. We must not mention roll numbers. Proceed with final answer.' +
      'assistantfinalA lâmina reluz no chão úmido enquanto Lyra vasculha a clareira.\n\n- 🏹 Verificar as flechas.'

    const { clean: semRaciocinio } = stripReasoningLeak(vazado)
    const { clean: final } = stripFabricatedRolls(semRaciocinio)

    expect(final).toBe('A lâmina reluz no chão úmido enquanto Lyra vasculha a clareira.\n\n- 🏹 Verificar as flechas.')
    expect(final).not.toMatch(/interpret|moderate|total 11|roll numbers/i)
  })
})

describe('US-29 — stripFabricatedRolls', () => {
  it('remove resultado inventado em PT-BR (frase inteira)', () => {
    const { clean, removed } = stripFabricatedRolls(
      'Com um total de 20 no teste de Percepção, você nota a sombra. Ela se move.',
    )
    expect(clean).not.toMatch(/20/)
    expect(clean).not.toMatch(/total/i)
    expect(clean).not.toMatch(/teste de Percep/i)
    expect(clean).toContain('Ela se move.') // frase seguinte preservada
    expect(removed).toHaveLength(1)
  })

  it('remove resultado inventado em EN', () => {
    const { clean } = stripFabricatedRolls('You roll a 17 on your Stealth check and slip past.')
    expect(clean).toBe('')
  })

  it('remove breakdown vazado na prosa', () => {
    const { clean } = stripFabricatedRolls('A lâmina desce. 1d20+5: [14] +5 = 19. Ela acerta.')
    expect(clean).not.toMatch(/1d20/)
    expect(clean).not.toMatch(/19/)
    expect(clean).toContain('A lâmina desce.')
    expect(clean).toContain('Ela acerta.')
  })

  it('preserva números que NÃO são rolagem (falso-positivo)', () => {
    const input = 'Três goblins bloqueiam a ponte; você tem 8 de HP.'
    expect(stripFabricatedRolls(input).clean).toBe(input)
  })

  it('preserva prosa sem número', () => {
    const input = 'A floresta cheira a musgo e chuva recente.'
    expect(stripFabricatedRolls(input).clean).toBe(input)
  })
})

describe('US-29 — formatDiceBreakdown', () => {
  it('formata como US-09', () => {
    expect(formatDiceBreakdown({ formula: '1d20+5', rolls: [14], modifier: 5, total: 19 })).toBe('1d20+5: [14] +5 = 19')
  })
  it('omite modificador zero e mostra vários dados', () => {
    expect(formatDiceBreakdown({ formula: '2d6', rolls: [4, 2], modifier: 0, total: 6 })).toBe('2d6: [4, 2] = 6')
  })
  it('modificador negativo', () => {
    expect(formatDiceBreakdown({ formula: '1d20-1', rolls: [10], modifier: -1, total: 9 })).toBe('1d20-1: [10] -1 = 9')
  })
})
