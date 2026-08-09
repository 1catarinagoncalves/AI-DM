import { describe, it, expect } from 'vitest'
import {
  detectInventedRoll,
  checkNoSelfRoll,
  detectLanguageDrift,
  detectReasoningLeak,
  detectCanonDenial,
  detectSlopName,
  detectUnledgeredName,
} from './guardrails'
import type { WorldEntity } from '@ai-dm/shared'

// Guardrails do bake-off narrativo (US-17, slice 2). Detectores DETERMINÍSTICOS
// que cortam um candidato antes de gastar juiz. São funções puras: rodam no
// `pnpm test`/CI normal (sem API, sem custo). Só a orquestração do bake-off, que
// bate no NVIDIA, fica gated. Aqui testamos a lógica de detecção com strings fixas.

describe('guardrail — não rola dados sozinho', () => {
  describe('detectInventedRoll (a prosa contém um número de rolagem inventado?)', () => {
    it('pega notação de dado na prosa', () => {
      expect(detectInventedRoll('Rolo 1d20 e tiro 17 para acertar o goblin.').invented).toBe(true)
      expect(detectInventedRoll('Meu d20 crava um 18 no goblin.').invented).toBe(true)
    })

    it('pega verbo de rolagem + número sem notação', () => {
      expect(detectInventedRoll('Rolei um 15 no ataque e acerto.').invented).toBe(true)
      expect(detectInventedRoll('O resultado no dado foi 22, dano brutal.').invented).toBe(true)
    })

    it('NÃO confunde números de cena (HP, quantidade, distância) com rolagem', () => {
      expect(detectInventedRoll('Três goblins avançam a 10 metros, você tem 44 de vida.').invented).toBe(false)
      expect(detectInventedRoll('A chuva fina cai enquanto Aurora relincha, nervosa.').invented).toBe(false)
    })
  })

  describe('checkNoSelfRoll (verdict do guardrail)', () => {
    it('PASSA quando o modelo chamou rollDice, mesmo com número na prosa', () => {
      // a tool devolve o número real; a prosa refletir isso é esperado, não violação.
      expect(checkNoSelfRoll({ calledRollDice: true, narration: 'Rolo 1d20... 17! Acerto.' }).passed).toBe(true)
    })

    it('FALHA quando NÃO chamou rollDice E inventou o número na prosa', () => {
      const r = checkNoSelfRoll({ calledRollDice: false, narration: 'Tiro um 18 no d20 e decapito o goblin.' })
      expect(r.passed).toBe(false)
      expect(r.reason).toMatch(/rollDice/i)
    })

    it('PASSA quando não chamou rollDice mas também não resolveu nada na prosa', () => {
      // narrar a aproximação sem cravar resultado não é auto-rolagem.
      expect(checkNoSelfRoll({ calledRollDice: false, narration: 'Avanço espada em punho em direção ao goblin.' }).passed).toBe(true)
    })
  })
})

describe('guardrail — deriva de idioma (narração saiu do PT-BR?)', () => {
  it('NÃO acusa deriva em narração PT-BR legítima', () => {
    const pt =
      'A chuva fina batia no seu elmo enquanto você desmontava. O portão entreaberto rangia, e uma silhueta observava das sombras. O que você faz?'
    expect(detectLanguageDrift(pt).drift).toBe(false)
  })

  it('acusa deriva quando a narração vem em inglês', () => {
    const en =
      'The rain falls on your helmet as you dismount. The gate creaks open and a figure watches from the shadows. What do you do?'
    expect(detectLanguageDrift(en).drift).toBe(true)
  })

  it('tolera empréstimos isolados no meio do PT (status, goblin)', () => {
    const pt = 'Você checa o status do goblin: ele ainda respira, encolhido contra a parede fria.'
    expect(detectLanguageDrift(pt).drift).toBe(false)
  })

  // US-97: o alvo deixa de ser cravado em PT. Mesa em inglês → deriva é o CONTRÁRIO.
  it('com alvo en-US, narração inglesa NÃO é deriva e narração PT é', () => {
    const en =
      'The rain falls on your helmet as you dismount. The gate creaks open and a figure watches from the shadows. What do you do?'
    const pt =
      'A chuva fina batia no seu elmo enquanto você desmontava. O portão entreaberto rangia, e uma silhueta observava das sombras. O que você faz?'
    expect(detectLanguageDrift(en, 'en-US').drift).toBe(false)
    expect(detectLanguageDrift(pt, 'en-US').drift).toBe(true)
  })

  it('sem alvo, continua medindo contra pt-BR (comportamento de antes da US-97)', () => {
    const en = 'The gate creaks open and a figure watches from the shadows. What do you do?'
    expect(detectLanguageDrift(en).drift).toBe(detectLanguageDrift(en, 'pt-BR').drift)
  })
})

describe('guardrail — vazamento de reasoning / voz de assistente', () => {
  it('pega tag de reasoning na prosa', () => {
    expect(detectReasoningLeak('<think>preciso descrever a chuva</think> A chuva cai.').leak).toBe(true)
  })

  it('pega voz de assistente (EN e PT)', () => {
    expect(detectReasoningLeak('As an AI, I will now narrate the scene.').leak).toBe(true)
    expect(detectReasoningLeak('Aqui está a cena: você chega à vila.').leak).toBe(true)
    expect(detectReasoningLeak('Claro! Vou narrar a chegada para você.').leak).toBe(true)
  })

  it('pega canal Harmony cru do gpt-oss', () => {
    // O gpt-oss narra em canais (analysis/final). Quando o provider não os
    // parseia, o raciocínio chega colado à prosa pelo marcador `assistantfinal`.
    const vazado =
      'Need to interpret qualitatively: total 11 is moderate. Proceed with final answer.assistantfinalA lâmina reluz no chão úmido.'
    expect(detectReasoningLeak(vazado).leak).toBe(true)
    expect(detectReasoningLeak('<|channel|>analysis<|message|>preciso descrever a chuva').leak).toBe(true)
  })

  it('pega abertura com bullet de meta-comentário', () => {
    expect(detectReasoningLeak('- Cena: chegada à vila\n- Clima: chuva\nVocê chega.').leak).toBe(true)
  })

  it('NÃO acusa narração limpa, incluindo diálogo com travessão', () => {
    expect(detectReasoningLeak('— Quem vem lá? — grita o velho da janela. A chuva cai fria.').leak).toBe(false)
    expect(detectReasoningLeak('A chuva fina batia no seu elmo. O portão rangia.').leak).toBe(false)
  })
})

describe('detectCanonDenial (amnésia de entidade — bug da Vigia)', () => {
  const CANON = ['Vigia', 'sala secreta', 'Tobias']

  // Fixture REAL: a narração exata que disparou o bug — o mestre negou a Vigia e a
  // sala secreta que estavam no canon. Travada como regressão: se algum dia o
  // detector deixar de pegar isto, o teste quebra.
  const TRANSCRIPT_BUG =
    'Anetra... você hesita por um instante. Mas a sala secreta... o Vigia... você não faz ideia do que Elara ou Tobias estão falando.\n\n' +
    '— Senhora Ulkas — diz o velho zelador com cuidado —, não há nenhuma sala secreta nesta capela. E nunca ouvi falar de nenhum "Vigia" em Willowdale.'

  it('REPROVA a narração real do bug (nega entidade cadastrada)', () => {
    expect(detectCanonDenial(TRANSCRIPT_BUG, CANON).denied).toBe(true)
  })

  it('APROVA a resposta correta (engaja com a entidade como real)', () => {
    const bom =
      'Você desce os degraus de volta à sala secreta. A Vigia ergue os olhos negros da bacia de água escura, imóvel, como se já esperasse por você.\n\n' +
      '— Preciso saber do homem de rosto liso — você diz. A luz de Solariel pulsa no símbolo gravado no chão.'
    expect(detectCanonDenial(bom, CANON).denied).toBe(false)
  })

  it('NÃO confunde um NPC que ignora um FATO com negar a entidade', () => {
    // A Vigia (que EXISTE) apenas não sabe quem enviou a sombra — legítimo, não é amnésia.
    const npcNaoSabe = 'A Vigia inclina a cabeça. Ela não faz ideia de quem enviou a criatura, mas sente o mesmo mal.'
    expect(detectCanonDenial(npcNaoSabe, CANON).denied).toBe(false)
  })

  it('passa quando nenhuma entidade do ledger é mencionada (nada a negar)', () => {
    // frase de negação PRESENTE, mas nenhuma entidade do ledger citada → sem canon a negar
    expect(detectCanonDenial('Você nunca ouvi falar de tal lugar.', CANON).denied).toBe(false)
    expect(detectCanonDenial('A chuva cai fria sobre a estrada.', []).denied).toBe(false)
  })
})

describe('detectSlopName — blocklist determinístico de onomástica (US-36)', () => {
  it('pega os nomes de slop da lista fechada, insensível a caixa/acento', () => {
    expect(detectSlopName('A pequena Elara sumiu na noite.').slop).toBe(true)
    expect(detectSlopName('O padre KAEL ergueu o símbolo.').slop).toBe(true)
    expect(detectSlopName('Zephyr soprou entre as árvores.').match).toBe('zephyr')
  })

  it('não confunde o nome do personagem-jogador (Seraphine) com o slop Seraphina', () => {
    expect(detectSlopName('Lady Seraphine ergue a espada.').slop).toBe(false)
    expect(detectSlopName('A feiticeira Seraphina lançou o feitiço.').slop).toBe(true)
  })

  it('whole-word: não acusa slop dentro de outra palavra', () => {
    // "aria" dentro de "Mariana" não deve reprovar
    expect(detectSlopName('Mariana caminhou pela praça.').slop).toBe(false)
    expect(detectSlopName('Um nome original: Orphaion, o velho sábio.').slop).toBe(false)
  })
})

describe('detectUnledgeredName — nome próprio na narração fora do ledger (US-115, fase A)', () => {
  const entity = (nome: string): WorldEntity => ({ nome, atualizadoEm: new Date().toISOString() })
  const LEDGER: WorldEntity[] = [entity('Vigia'), entity('Tobías')]
  const JOGADOR = 'Anetra'

  it('acusa nome próprio novo, apresentado no meio da frase, fora do ledger', () => {
    const r = detectUnledgeredName('Você entra na taverna e encontra Marcus, o taverneiro.', LEDGER, JOGADOR)
    expect(r.unledgered).toBe(true)
    expect(r.match).toBe('Marcus')
  })

  it('NÃO acusa entidade já no ledger, mesmo com grafia diferente em acento/caixa', () => {
    // "Vigia" no meio da frase — mesma grafia, testa o match direto.
    expect(detectUnledgeredName('Você observa a Vigia parada na soleira.', LEDGER, JOGADOR).unledgered).toBe(false)
    // "Tobias" sem acento no meio da frase — ledger tem "Tobías"; mesma tolerância do mergeEntities.
    expect(detectUnledgeredName('O velho ri e chama Tobias para perto.', LEDGER, JOGADOR).unledgered).toBe(false)
  })

  it('NÃO acusa o nome da personagem-jogadora', () => {
    expect(detectUnledgeredName('Anetra avança pelo corredor escuro.', LEDGER, JOGADOR).unledgered).toBe(false)
  })

  it('NÃO acusa palavra capitalizada só por iniciar frase', () => {
    // "Marcus" aqui é início de frase — ruído dominante em PT-BR, não deve disparar.
    const r = detectUnledgeredName('Marcus observa a chuva cair.', LEDGER, JOGADOR)
    expect(r.unledgered).toBe(false)
  })

  it('acusa mesmo quando o nome novo aparece após travessão de diálogo', () => {
    // "— Selene sabe do que fala" — Selene não é o 1º token da fala (fica logo após o
    // travessão), então conta como início de segmento e é ignorada por design; o teste
    // documenta esse limite conhecido (ver Notas de implementação / Questões em aberto).
    const r = detectUnledgeredName('O velho ri. — Pergunte à Selene, ela sabe.', LEDGER, JOGADOR)
    expect(r.unledgered).toBe(true)
    expect(r.match).toBe('Selene')
  })

  it('passa quando não há nenhum nome próprio fora do ledger', () => {
    expect(detectUnledgeredName('A Vigia cumprimenta Tobias com um aceno.', LEDGER, JOGADOR).unledgered).toBe(false)
  })

  it('sem ledger (aventura nova), ainda acusa nome próprio não sabido', () => {
    const r = detectUnledgeredName('Você cruza com Rogerio no mercado.', null, JOGADOR)
    expect(r.unledgered).toBe(true)
    expect(r.match).toBe('Rogerio')
  })
})
