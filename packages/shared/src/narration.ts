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
 * Breakdown de uma rolagem para o bloco de rolagem (US-09/US-29), ex.:
 * `1d20+5: [14] +5 = 19`. Lê o DiceResult do Game Server — nunca a prosa.
 */
export function formatDiceBreakdown(r: DiceResult): string {
  const mod = r.modifier === 0 ? '' : ` ${r.modifier > 0 ? '+' : '-'}${Math.abs(r.modifier)}`
  return `${r.formula}: [${r.rolls.join(', ')}]${mod} = ${r.total}`
}
