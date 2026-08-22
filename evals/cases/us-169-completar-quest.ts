import { describe, it, expect } from 'vitest'
import { buildTurnStateBlock, type DmCharacterSheet } from '@ai-dm/ai-engine'

// Eval US-169 — objetivo concreto + `completeQuest`. Determinístico, sem chamar o modelo
// (mesma disciplina do US-38: "a obediência do modelo depende do LLM e não roda aqui" —
// não há harness de N turnos contra Mestre real, US-94 ainda em backlog). Os dois cenários
// "Eval" do critério de aceite (ação cumpre objective → completeQuest chamado; objective
// não cumprido → NÃO chamado) exigem um Mestre REAL decidindo — o que dá pra medir aqui,
// sem gastar uma chamada de API, é que o PROMPT instrui a ação certa e nunca vaza o
// desfecho antes da hora.

const sheet: Pick<DmCharacterSheet, 'hp' | 'maxHp' | 'conditions'> = { hp: 10, maxHp: 10, conditions: [] }

// Mesma concatenação que `ai.service.ts` (`mainQuest`) monta a partir de
// `Quest.title`/`description`/`objective` — reimplementada aqui pela mesma razão dos
// outros casos desta pasta: `evals/cases` só linka `@ai-dm/ai-engine`/`@ai-dm/shared`.
const title = 'Uma ameaça desperta na Enseada Cinzenta'
const description = 'Investigar os desaparecimentos na vila costeira.'
const objective = 'Impedir que Malvora drene a vila para alimentar seu ritual.'
const conclusionHint = 'Malvora é confrontada na Enseada e o ritual é interrompido a tempo.'

function block(withObjective: boolean): string {
  const mainQuest = `${title}\n${description}${withObjective ? `\n${objective}` : ''}`
  return buildTurnStateBlock({ sheet, activeQuests: [], inventory: [], mainQuest })
}

describe('US-169 — prompt instrui completeQuest quando a quest primária está presente', () => {
  it('main quest com objective: mostra o objective e instrui chamar completeQuest ao resolvê-lo', () => {
    const b = block(true)
    expect(b).toContain(objective)
    expect(b).toMatch(/completeQuest/)
    expect(b).toMatch(/success.*failure|success\/failure/)
    expect(b.toLowerCase()).toMatch(/never quoting it verbatim/)
  })

  it('sem quest primária nenhuma: NÃO instrui completeQuest (nada pra concluir)', () => {
    const noQuest = buildTurnStateBlock({ sheet, activeQuests: [], inventory: [] })
    expect(noQuest).not.toMatch(/completeQuest/)
    expect(noQuest).toMatch(/No main quest set yet/)
  })

  // US-153 Questões em aberto #4 / US-169 Notas de implementação: `conclusionHint` é o
  // desfecho pré-escrito — só pode chegar ao modelo DEPOIS de `completeQuest` (o tool),
  // nunca num bloco passivo como este. `buildTurnStateBlock` nem recebe o campo — a
  // ausência de vazamento é estrutural (a assinatura não aceita `conclusionHint`), não uma
  // checagem de conteúdo que pode regredir.
  it('conclusionHint nunca aparece no bloco passivo do turno (vaza só via completeQuest)', () => {
    const b = block(true)
    expect(b).not.toContain(conclusionHint)
  })
})
