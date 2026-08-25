import type { DiceResult } from './types/game'

/**
 * US-29: rede de segurança determinística sobre a narração do DM.
 *
 * Contrato: números de rolagem NUNCA pertencem à prosa. O breakdown legítimo
 * (US-09) é exibido pelo bloco de rolagem, vindo do evento DICE_ROLL do Game
 * Server — nunca do texto do modelo. Logo, qualquer frase que declare um
 * resultado numérico de teste/rolagem é ruído duplicado ou alucinação e é
 * removida. Isto dispensa casar o número da prosa com a rolagem real: nenhum
 * número de teste deveria estar na prosa.
 */

// Vocabulário de rolagem/teste PERTO de um número. A distância é limitada
// ({0,40}) para não engolir números legítimos (HP, contagens) nem causar
// backtracking catastrófico.
const NUM = String.raw`\d+`
const ROLL_CUES = [
  String.raw`total\s+(?:de|of)\s+${NUM}`, // "total de 20", "total of 20"
  String.raw`(?:tira|tirou|rola|rolou|rolando|rolagem|roll|rolls|rolled)\b[^.!?\n]{0,40}?${NUM}`, // "rola ... 17", "you roll a 17"
  String.raw`${NUM}[^.!?\n]{0,20}?\b(?:no|na|on|of)\s+(?:teste|test|check|rolagem|roll)`, // "17 no teste", "17 on your check"
  String.raw`\b(?:teste|test|check)\b[^.!?\n]{0,40}?${NUM}`, // "teste de Percepção ... 20"
  String.raw`\d+d\d+(?:[+-]\d+)?\s*[:=]`, // breakdown na prosa: "1d20+5:" ou "2d6 ="
  String.raw`(?:resultado|result)\s*[:=]?\s*${NUM}`, // "resultado: 8", "result 8"
  // ANÚNCIO do teste SEM número: o mestre não pode narrar que VAI testar/rolar —
  // a mecânica é invisível (o bloco de rolagem já mostra tudo). Ex.: "Vou testar
  // sua Furtividade...", "faça um teste de Percepção", "let me roll for Stealth".
  // ponytail: "testar/rolar" tem sentido físico raro ("rolar morro abaixo"); o
  // gatilho exige verbo de anúncio (vou/deixe/preciso) OU um substantivo de dado,
  // o que descarta a esmagadora maioria dos usos físicos. Se aparecer falso
  // positivo, prender ao contexto de perícia é o próximo passo.
  String.raw`(?:vou|irei|vamos|deixa(?:-me| eu)?|deixe(?:-me)?|preciso)\b[^.!?\n]{0,20}?\b(?:testar|rolar)\b`, // "vou testar", "deixe-me rolar"
  String.raw`\b(?:faça|faz|role|rola|tire|tira|rolar|rolando)\b[^.!?\n]{0,15}?\b(?:teste|rolagem|dado|dados|perícia|d\d+)\b`, // "faça um teste", "role os dados"
  String.raw`\b(?:let'?s|let\s+me|i'?ll|i\s+will|we'?ll)\b[^.!?\n]{0,15}?\broll\b`, // "let me roll", "I'll roll"
  String.raw`\broll\s+(?:for|a|an|your)\b`, // "roll for Stealth", "roll a check"
  String.raw`\bmake\s+(?:a|an|your)\b[^.!?\n]{0,20}?\bcheck\b`, // "make a Perception check"
]

// A frase INTEIRA que contém uma pista é removida (do início da sentença até o
// delimitador), não só o trecho numérico — remover só o número deixa gramática
// quebrada. `[^.!?\n]*` guloso à esquerda ancora no início da sentença.
const ROLL_SENTENCE = new RegExp(
  String.raw`[^.!?\n]*(?:${ROLL_CUES.join('|')})[^.!?\n]*[.!?]?`,
  'gi',
)

export function stripFabricatedRolls(text: string): { clean: string; removed: string[] } {
  const removed: string[] = []
  const clean = text
    .replace(ROLL_SENTENCE, (match) => {
      const trimmed = match.trim()
      if (trimmed.length === 0) return match
      removed.push(trimmed)
      return ''
    })
    // Colapsa os buracos deixados pela remoção.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { clean, removed }
}

/**
 * Rede de segurança determinística nº 1b: tags de control-plane vazadas na prosa.
 *
 * Contrato: mudança de estado viaja por TOOL CALL (`updateScene`/`updateInventory`/
 * `updateCharacterHp`), nunca pelo texto. O tag `[WORLD_STATE_UPDATE: {...}]` é um
 * sink LEGADO que nenhum código lê — se o modelo o emite (a prompt já proíbe), ele
 * não atualiza nada e vaza como texto quebrado pro jogador. Aqui ele é removido.
 *
 * Cobre duas formas: o tag FECHADO (`[WORLD_STATE_UPDATE: {...}]`) e o tag ABERTO
 * no fim do texto — durante o stream ao vivo o `]` de fechamento ainda não chegou,
 * então um `[WORLD_STATE_UPDATE:` pendente no fim também é cortado, para nunca piscar
 * na tela. O terminador do tag fechado é `}` seguido de `]` (não um `]` qualquer):
 * o payload é JSON e contém `]` de arrays (`["Tomas"]`), então um `*?` até o primeiro
 * `]` pararia cedo. Escopo estreito de propósito: só este token literal, para não
 * comer colchetes legítimos ("[1]", uma nota, um item entre colchetes na prosa).
 */
const WORLD_STATE_TAG_CLOSED = /\[WORLD_STATE_UPDATE:[\s\S]*?\}\s*\]/gi
const WORLD_STATE_TAG_OPEN = /\[WORLD_STATE_UPDATE:[\s\S]*$/i

export function stripWorldStateTags(text: string): { clean: string; removed: string[] } {
  const removed: string[] = []
  let clean = text.replace(WORLD_STATE_TAG_CLOSED, (m) => {
    removed.push(m.trim())
    return ''
  })
  clean = clean.replace(WORLD_STATE_TAG_OPEN, (m) => {
    removed.push(m.trim())
    return ''
  })
  if (removed.length === 0) return { clean: text, removed }
  clean = clean
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { clean, removed }
}

/**
 * Rede de segurança determinística nº 2: canais de raciocínio na prosa.
 *
 * Modelos de raciocínio (gpt-oss, qwen, deepseek) separam o pensamento da
 * resposta por canais. Quem parseia os canais é o PROVIDER, não o modelo — e um
 * provider mal configurado entrega tudo no `content`. Aqui só reconhecemos os
 * marcadores ESTRUTURAIS: são inequívocos, e o corte é cirúrgico. Estilo de
 * narração (voz de assistente, meta-abertura) NÃO é problema deste saneador —
 * quem julga isso é o guardrail do bake-off, que reprova o candidato inteiro.
 */

// Fronteira analysis→final. Greedy à esquerda: agarra a ÚLTIMA fronteira, então
// só a resposta final sobrevive mesmo com vários ciclos de raciocínio.
// Duas formas: tokens crus, e a degradada (tokens já removidos, marcador colado
// à primeira letra da narração — "…final answer.assistantfinalA lâmina reluz").
const HARMONY_BOUNDARY = /^[\s\S]*(?:<\|channel\|>final<\|message\|>|\bassistantfinal)/i
// Bloco de raciocínio fechado; e a variante truncada (stream cortado no meio do
// pensamento) — daí até o fim é raciocínio, não há narração a salvar.
const THINK_BLOCK = /<think>[\s\S]*?<\/think>|<think>[\s\S]*$/gi
// Tokens especiais restantes de canais que não são a fronteira final.
const HARMONY_TOKEN = /<\|[^|]*\|>/g

export function stripReasoningLeak(text: string): { clean: string; removed: string[] } {
  const removed: string[] = []
  let clean = text.replace(HARMONY_BOUNDARY, (match) => {
    removed.push(match.trim())
    return ''
  })
  clean = clean.replace(THINK_BLOCK, (match) => {
    removed.push(match.trim())
    return ''
  })
  clean = clean.replace(HARMONY_TOKEN, (match) => {
    removed.push(match.trim())
    return ''
  })
  if (removed.length === 0) return { clean: text, removed }
  clean = clean
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { clean, removed }
}

/**
 * US-69: detector determinístico de degeneração por repetição, para rodar
 * mid-stream — o guard corta o turno e re-amostra ANTES da parede chegar inteira
 * ao jogador. Função PURA: o teste de regressão a exercita sem stream real (mesmo
 * padrão dos saneadores acima).
 *
 * Alvo = o loop patológico da decodificação autorregressiva em região OOD (visto
 * em prod ao inventar nomes originais — US-68). Dois formatos:
 *  - token único repetido em sequência: "cra cra cra…" (com espaço) ou
 *    "cracracra…" (colado);
 *  - n-grama (bigrama/trigrama) repetido: "ela olha, ela olha…".
 *
 * Só olha a CAUDA (janela fixa) e ancora a contagem no FIM — onde um loop ao vivo
 * se manifesta —, então o custo é ~zero por delta. Limiares altos de propósito: o
 * falso-positivo descarta narração boa, então ênfase legítima ("não, não, não!",
 * 2-3×) fica MUITO abaixo do gatilho. NÃO cobre o embaralhamento de whitespace
 * (2º modo, `finishReason=stop`) — esse não tem repetição e a US o deixa fora até
 * reincidir.
 */
const DEGEN_TAIL_CHARS = 240
const DEGEN_SINGLE_TOKEN_RUN = 8 // N: "cra cra cra…" ≥ 8× seguidas
const DEGEN_NGRAM_RUN = 5 // M: bigrama/trigrama repetido ≥ 5×
const DEGEN_NGRAM_MAX = 3
// Loop colado sem espaço ("cracracra…"): unidade ≤10 chars repetida ≥ 7× seguidas.
// Lazy para evitar backtracking pesado; cauda limitada a 240 chars de qualquer forma.
const DEGEN_GLUED = /(\S{1,10}?)\1{6,}/i

function windowEq(tokens: string[], i: number, j: number, k: number): boolean {
  for (let x = 0; x < k; x++) if (tokens[i + x] !== tokens[j + x]) return false
  return true
}

export function detectDegeneration(text: string): boolean {
  const tail = text.length > DEGEN_TAIL_CHARS ? text.slice(-DEGEN_TAIL_CHARS) : text
  if (DEGEN_GLUED.test(tail)) return true
  const tokens = tail.toLowerCase().split(/\s+/).filter(Boolean)
  // Repetições consecutivas de um bloco de k tokens, ancoradas no FIM da cauda.
  for (let k = 1; k <= DEGEN_NGRAM_MAX; k++) {
    if (tokens.length < k * 2) break
    let repeats = 1
    let i = tokens.length - k
    while (i - k >= 0 && windowEq(tokens, i, i - k, k)) {
      repeats++
      i -= k
    }
    if (repeats >= (k === 1 ? DEGEN_SINGLE_TOKEN_RUN : DEGEN_NGRAM_RUN)) return true
  }
  return false
}

/**
 * US-74: contrato de fecho — toda narração completa TERMINA com a lista de opções
 * (`- 🗡️ ...`, regra §4 do prompt). Detecta a PRESENÇA dessa lista. Ausência = turno
 * truncado: o modelo parou num cliffhanger (`finishReason=stop`) sem emitir as opções,
 * deixando o jogador sem saída — confirmado nos logs de prod (100% dos turnos param por
 * `stop`, tokens/steps longe dos tetos, i.e. NÃO é `length` nem `tool-calls`).
 *
 * Puro/testável, mesmo padrão dos saneadores acima. É a MESMA regex que o controller e o
 * serviço já usavam inline para dedupe de narração dupla — agora fonte única. Um bullet é
 * uma linha começando por hífen + espaço (`- `); o travessão (`—`) do diálogo NÃO conta
 * (é fala de personagem, não opção).
 *
 * Desde 25/08/2026 verifica também que a lista está FECHADA — ver o comentário no corpo.
 */
const OPTIONS_LIST = /(^|\n)\s*-\s/
const BULLET_LINE = /^\s*-\s/
export function hasOptionsList(text: string): boolean {
  if (!OPTIONS_LIST.test(text)) return false
  // Correção de 25/08/2026: a PRESENÇA de um bullet não bastava. Um turno de prod parou
  // dentro da 2ª opção (`- 🗡️ **Tentar que`) — a 1ª opção, completa, já fazia a regex
  // casar, o gate do `onFinish` dava passagem e o beco-sem-saída era persistido do mesmo
  // jeito que a US-74 queria impedir. O corte no meio do bullet deixa a ênfase markdown
  // ABERTA: `**` ímpar na última opção é o sinal determinístico disso, e não depende de
  // idioma nem de pontuação final (as opções de prod terminam sem ponto legitimamente).
  // ponytail: só pega corte que abriu `**`. Corte em bullet sem markdown (`- 🗡️ Tentar
  // que`) ainda passa; se aparecer em prod, o próximo degrau é exigir >= 2 bullets.
  const lastBullet = text.split('\n').filter((line) => BULLET_LINE.test(line)).pop() ?? ''
  return (lastBullet.match(/\*\*/g)?.length ?? 0) % 2 === 0
}

/**
 * Breakdown de uma rolagem para o bloco de rolagem (US-09/US-29), ex.:
 * `1d20+5: [14] +5 = 19`. Lê o DiceResult do Game Server — nunca a prosa.
 */
export function formatDiceBreakdown(r: DiceResult): string {
  const mod = r.modifier === 0 ? '' : ` ${r.modifier > 0 ? '+' : '-'}${Math.abs(r.modifier)}`
  return `${r.formula}: [${r.rolls.join(', ')}]${mod} = ${r.total}`
}
