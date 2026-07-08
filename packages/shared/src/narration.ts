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
 * Breakdown de uma rolagem para o bloco de rolagem (US-09/US-29), ex.:
 * `1d20+5: [14] +5 = 19`. Lê o DiceResult do Game Server — nunca a prosa.
 */
export function formatDiceBreakdown(r: DiceResult): string {
  const mod = r.modifier === 0 ? '' : ` ${r.modifier > 0 ? '+' : '-'}${Math.abs(r.modifier)}`
  return `${r.formula}: [${r.rolls.join(', ')}]${mod} = ${r.total}`
}
