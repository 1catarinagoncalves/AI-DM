import { Injectable } from '@nestjs/common'
import type { DiceResult } from '@ai-dm/shared'

// Parses formulas like "2d6+3", "1d20", "4d6-1"
const DICE_FORMULA_RE = /^(\d+)d(\d+)([+-]\d+)?$/i

@Injectable()
export class DiceService {
  roll(formula: string): DiceResult {
    const match = DICE_FORMULA_RE.exec(formula.replace(/\s/g, ''))
    if (!match) throw new Error(`Invalid dice formula: ${formula}`)

    const count = parseInt(match[1]!, 10)
    const sides = parseInt(match[2]!, 10)
    const modifier = match[3] ? parseInt(match[3], 10) : 0

    const rolls = Array.from({ length: count }, () => this.secureRoll(sides))
    const total = rolls.reduce((sum, n) => sum + n, 0) + modifier

    return { formula, rolls, modifier, total }
  }

  private secureRoll(sides: number): number {
    // Cryptographically secure RNG — never use Math.random() for game mechanics
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    return (array[0]! % sides) + 1
  }
}
