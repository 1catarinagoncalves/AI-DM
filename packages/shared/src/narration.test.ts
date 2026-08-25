import { describe, it, expect } from 'vitest'
import { stripFabricatedRolls, stripReasoningLeak, stripWorldStateTags, formatDiceBreakdown, detectDegeneration, hasOptionsList } from './narration'

describe('stripWorldStateTags — tags de estado vazadas na prosa', () => {
  it('remove o tag fechado com JSON aninhado, mantendo a prosa ao redor', () => {
    const { clean, removed } = stripWorldStateTags(
      'Você sobe a escada.\n\n[WORLD_STATE_UPDATE: {"scene": {"local": "farol", "presentes": ["Tomas"]}}]\n\n- 🌊 Seguir para a igreja.',
    )
    expect(clean).toBe('Você sobe a escada.\n\n- 🌊 Seguir para a igreja.')
    expect(removed).toHaveLength(1)
  })

  it('corta o tag ainda ABERTO no fim (stream ao vivo, o "]" não chegou)', () => {
    const { clean } = stripWorldStateTags('A chama dança no pedestal.\n\n[WORLD_STATE_UPDATE: {"scene": {"local": "far')
    expect(clean).toBe('A chama dança no pedestal.')
  })

  it('NÃO toca em colchetes legítimos da prosa', () => {
    const narracao = 'Você lê a nota [1] rabiscada à margem.\n\n- 🔍 Guardar a nota.'
    expect(stripWorldStateTags(narracao).clean).toBe(narracao)
  })
})

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

  it('corta ANÚNCIO do teste sem número (US-… vazamento de mecânica)', () => {
    const { clean, removed } = stripFabricatedRolls(
      'Vou testar sua Furtividade para ver se você se reposiciona sem ser vista. Você desliza rente à rocha.',
    )
    expect(clean).not.toMatch(/testar|Furtividade/i)
    expect(clean).toContain('Você desliza rente à rocha.')
    expect(removed).toHaveLength(1)
  })

  it('corta imperativo "faça um teste" e "role os dados"', () => {
    expect(stripFabricatedRolls('Faça um teste de Percepção. A sombra se move.').clean).toBe('A sombra se move.')
    expect(stripFabricatedRolls('Role os dados. A porta range.').clean).toBe('A porta range.')
  })

  it('corta anúncio em EN ("let me roll", "make a check")', () => {
    expect(stripFabricatedRolls('Let me roll for your Stealth. You slip past.').clean).toBe('You slip past.')
    expect(stripFabricatedRolls('Make a Perception check. The shadow moves.').clean).toBe('The shadow moves.')
  })

  it('NÃO corta "rolar" físico nem "verificar" (falso-positivo do anúncio)', () => {
    const fisico = 'Você rola morro abaixo entre as pedras soltas.'
    expect(stripFabricatedRolls(fisico).clean).toBe(fisico)
    const check = 'Deixe-me ver o mapa: a estrada segue para o norte.'
    expect(stripFabricatedRolls(check).clean).toBe(check)
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

describe('US-69 — detectDegeneration', () => {
  it('detecta o loop de token único com espaço ("cra " 30×)', () => {
    expect(detectDegeneration('A erva se chama '.concat('cra '.repeat(30)))).toBe(true)
  })

  it('detecta o loop colado sem espaço ("cracra…")', () => {
    expect(detectDegeneration('O nome soa como cra'.concat('cra'.repeat(20)))).toBe(true)
  })

  it('detecta o loop de n-grama (frase curta repetida)', () => {
    expect(detectDegeneration('ela olha '.repeat(8))).toBe(true)
  })

  it('NÃO dispara em ênfase legítima (2-3× repetições)', () => {
    expect(detectDegeneration('— Não, não, não! — ela grita, e corre, corre, CORRE pela ponte.')).toBe(false)
  })

  it('NÃO dispara em narração normal', () => {
    expect(
      detectDegeneration(
        'A névoa desce sobre a clareira e o velho ergue a lanterna, os olhos fixos na sombra que se move entre as árvores.',
      ),
    ).toBe(false)
  })

  it('NÃO dispara em texto curto', () => {
    expect(detectDegeneration('A porta range.')).toBe(false)
  })
})

describe('US-74 — hasOptionsList (contrato de fecho da narração)', () => {
  it('detecta a lista de opções em bullets com emoji', () => {
    const narracao =
      'Você abre a porta.\n\n- 🗡️ Entrar na sala.\n- 💬 Chamar por alguém.'
    expect(hasOptionsList(narracao)).toBe(true)
  })

  it('detecta bullet mesmo com indentação', () => {
    expect(hasOptionsList('Fim da cena.\n  - 🚶 Seguir em frente.')).toBe(true)
  })

  it('NÃO conta o travessão do diálogo como opção (é fala, não bullet)', () => {
    const soDialogo = 'Você entra na estalagem.\n\n— Volveu cedo — diz Marta.\n— Quer quarto?'
    expect(hasOptionsList(soDialogo)).toBe(false)
  })

  it('turno truncado (cliffhanger sem opções) = false — o bug real', () => {
    const truncado =
      'Você sobe as escadas, senta na beira da cama e desata o cordão das cartas.\n\nVocê abre a primeira.'
    expect(hasOptionsList(truncado)).toBe(false)
  })

  // Regressão de 25/08/2026: turno de prod cortado DENTRO da 2ª opção. A 1ª opção completa
  // fazia `hasOptionsList` dar true, o gate do `onFinish` (ai.service.ts) deixava passar e o
  // beco-sem-saída era gravado — o bug que a US-74 existe para impedir, por outra porta.
  it('corte no meio de um bullet = false, mesmo com a opção anterior completa', () => {
    const truncadoNaSegundaOpcao =
      'Ela ergue a cabeça, os olhos arregalados.\n\n' +
      '- 🛐 **Ajoelhar-se ao lado da Afogadora** e purificar a âncora abissal\n' +
      '- 🗡️ **Tentar que'
    expect(hasOptionsList(truncadoNaSegundaOpcao)).toBe(false)
  })

  it('opção com ênfase FECHADA e sem pontuação final = true (as opções de prod são assim)', () => {
    const completo =
      'A tosse vem de novo.\n\n' +
      '- 🕯️ Ir pelo corredor com o símbolo **Lúcivis** na outra mão — cada segundo conta\n' +
      '- 💬 Perguntar o que mais o culto deixou no porão'
    expect(hasOptionsList(completo)).toBe(true)
  })

  it('narração vazia = false', () => {
    expect(hasOptionsList('')).toBe(false)
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
