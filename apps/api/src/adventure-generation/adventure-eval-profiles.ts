import type { AdventureExpectation } from './adventure-eval'
import type { EncounterChallenge } from './monster-roles'
import { rollFactionCount, type AdventureRegistryOverrides } from './roll-registry'

// US-238: o conjunto PINADO de perfis de entrada do eval da aventura gerada. "Pinado" = o que o
// motor rola é função pura de (characterId, order, attempt) — US-146 — então estes perfis sempre
// pedem a MESMA contagem de facções, registro de nomenclatura e semente de gancho. Variedade de
// produção vem de `attempt = Date.now()` no create; aqui `attempt` é fixo (0) de propósito.
// Três níveis/dials cobrem os dois ramos do orçamento de combate: nível 1 em modo 'adventure'
// tem orçamento 0 (combate PROIBIDO no prompt, US-250), nível 3 em 'challenge' tem orçamento > 0
// mesmo baixo (US-161) e nível 5 em 'adventure' tem o orçamento normal.

export interface AdventureEvalProfile {
  id: string
  /** Sub-seed de `rollFactionCount`/`rollRegistry`/`rollNamingRegister`/`rollQuestSeed`. Não precisa existir no banco. */
  characterId: string
  level: number
  classKey: string
  /** `Character.story` — entra na autoria só como TOM, nunca como fato de plot (US-232). */
  story: string
  /** Eixos de mundo fixados; os três pinados dão ao prompt um `Restrições de mundo` estável. */
  registry: AdventureRegistryOverrides
  challenge: EncounterChallenge
}

// Sentinela de "não é aventura persistida" — mesmo `order` de scripts/run-authoring.ts, nunca colide com um real.
export const ADVENTURE_EVAL_ORDER = 999
export const ADVENTURE_EVAL_ATTEMPT = 0

export const ADVENTURE_EVAL_PROFILES: readonly AdventureEvalProfile[] = [
  {
    id: 'paladino-nivel-1',
    characterId: 'eval-pin-paladino-1',
    level: 1,
    classKey: 'paladin',
    story: 'Cresceu num mosteiro de fronteira, guardando um juramento que ainda não entende.',
    registry: { setting: 'dark-fantasy', tone: 'mystery', areaType: 'ruins' },
    challenge: 'adventure',
  },
  {
    id: 'mago-nivel-3-desafio',
    characterId: 'eval-pin-mago-3',
    level: 3,
    classKey: 'wizard',
    story: 'Estudou anos numa biblioteca que o expulsou por perguntas demais.',
    registry: { setting: 'high-fantasy', tone: 'heroic', areaType: 'forest' },
    challenge: 'challenge',
  },
  {
    id: 'ladino-nivel-5',
    characterId: 'eval-pin-ladino-5',
    level: 5,
    classKey: 'rogue',
    story: 'Vive de pequenos golpes nas docas e evita olhar para trás.',
    registry: { setting: 'urban-fantasy', tone: 'political-intrigue', areaType: 'city' },
    challenge: 'adventure',
  },
]

/** O que o eval espera do artefato deste perfil: contagem de facções pinada pelo sorteio, `minChallenges` vem da autoria. */
export function expectationFor(profile: AdventureEvalProfile, minChallenges: number): AdventureExpectation {
  return {
    challenge: profile.challenge,
    factionCount: rollFactionCount(profile.characterId, ADVENTURE_EVAL_ORDER, ADVENTURE_EVAL_ATTEMPT),
    minChallenges,
  }
}
