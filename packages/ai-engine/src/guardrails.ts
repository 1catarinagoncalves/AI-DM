import { stripReasoningLeak } from '@ai-dm/shared'

// Guardrails determinísticos do bake-off narrativo (US-17, slice 2).
//
// São o filtro barato ANTES do juiz LLM: cortam um candidato por 0 token de juiz
// quando ele viola uma regra dura (auto-rolagem, idioma errado, vazamento de
// reasoning). Funções PURAS — sem API, sem custo — então os testes rodam no
// `pnpm test`/CI normal; só a orquestração do bake-off (que bate no NVIDIA) é gated.
//
// Escopo por cenário (doc US-17, tabela de guardrails):
//   - deriva de idioma + vazamento de reasoning: QUALQUER cenário.
//   - não rola dados sozinho: o cenário de Combate ("ataco o goblin").

export interface GuardrailResult {
  passed: boolean
  /** Motivo curto quando `passed === false`; vazio quando passa. */
  reason: string
}

// ─── Guardrail 1: não rola dados sozinho ─────────────────────────────────────

/**
 * A prosa contém um número de rolagem inventado? Sinais: notação de dado
 * (`d20`, `1d20`, `2d6`) ou verbo de rolagem próximo de um número. Conservador
 * de propósito — NÃO trata HP/quantidade/distância como rolagem, para não
 * acusar "44 de vida" ou "três goblins a 10 metros".
 */
export function detectInventedRoll(narration: string): { invented: boolean; match: string } {
  const patterns: RegExp[] = [
    // notação de dado: d20, 1d20, 2d6+3
    /\b\d*d\d+\b/i,
    // verbo de rolagem + número num raio curto: "rolo um 17", "rolei 15", "rolagem de 8"
    /\brol(?:o|ei|a|ando|agem)\b[^.]{0,25}\d+/i,
    /\d+[^.]{0,25}\brol(?:o|ei|a|ando|agem)\b/i,
    // "no dado ... N" / "resultado ... N" / "total ... N" (perto de um número)
    /\bno dado\b[^.]{0,20}\d+/i,
    /\bresultad[oa]\b[^.]{0,20}\d+/i,
    /\d+\s*(?:no|para|de|no teste de)\s*(?:ataque|acerto|dano)\b/i,
  ]
  for (const re of patterns) {
    const m = narration.match(re)
    if (m) return { invented: true, match: m[0] }
  }
  return { invented: false, match: '' }
}

/**
 * Guardrail "não rola dados sozinho". O sinal robusto é a chamada da tool
 * `rollDice` (verificada pelo `toolCalls` do stream), NÃO a prosa. Falha só
 * quando o modelo NÃO chamou a tool E mesmo assim cravou um número de rolagem
 * na prosa — ou seja, inventou o resultado. Se chamou a tool, passa (o número
 * na prosa reflete o resultado real). Se não chamou e não resolveu nada, passa
 * (narrou a aproximação, escolha legítima).
 */
export function checkNoSelfRoll(params: { calledRollDice: boolean; narration: string }): GuardrailResult {
  if (params.calledRollDice) return { passed: true, reason: '' }
  const { invented, match } = detectInventedRoll(params.narration)
  if (invented) {
    return { passed: false, reason: `inventou rolagem na prosa ("${match}") sem chamar rollDice` }
  }
  return { passed: true, reason: '' }
}

// ─── Guardrail 2: deriva de idioma ───────────────────────────────────────────

// Heurística de wordlist: conta marcadores de função de cada idioma. PT ganha
// reforço dos diacríticos (ã/õ/ç/ê...), raros em inglês. Sem dependência de
// lib de detecção — o alvo é grosso (PT vs EN), um contador basta e roda offline.
const PT_MARKERS = /\b(não|você|está|com|uma|seu|sua|para|mais|quando|então|enquanto|sobre|dele|dela|isso|aqui|ele|ela|dos|das|pelo|pela)\b/gi
const PT_DIACRITICS = /[áàâãéêíóôõúüç]/gi
const EN_MARKERS = /\b(the|you|your|with|and|is|are|of|to|into|while|from|what|do|as|this|that|there|his|her)\b/gi

/**
 * A narração derivou do PT-BR? `drift = true` quando os marcadores de inglês
 * superam os de PT-BR (marcadores + diacríticos) por margem e passam de um piso
 * — o piso evita acusar um texto PT curto por causa de um "the" solto.
 */
export function detectLanguageDrift(narration: string): { drift: boolean; ptScore: number; enScore: number } {
  const ptScore = (narration.match(PT_MARKERS)?.length ?? 0) + (narration.match(PT_DIACRITICS)?.length ?? 0)
  const enScore = narration.match(EN_MARKERS)?.length ?? 0
  const drift = enScore > ptScore && enScore >= 3
  return { drift, ptScore, enScore }
}

// ─── Guardrail 3: vazamento de reasoning / voz de assistente ──────────────────

const LEAK_PATTERNS: RegExp[] = [
  // tag de raciocínio sem saneador correspondente (o <think> é coberto pelo
  // stripReasoningLeak, abaixo).
  /<\/?reasoning>/i,
  // voz de assistente (EN)
  /\bas an? (?:ai|language model|assistant)\b/i,
  /\bhere(?:'s| is) (?:the|your) (?:scene|narration|response)\b/i,
  // voz de assistente / meta-abertura (PT)
  /aqui está a (?:cena|narração|resposta)/i,
  /^\s*(?:claro|certo|com certeza|ok)[!,.:]/i,
  /\bvou narrar\b/i,
]

/**
 * A prosa contém vazamento de reasoning ou voz de assistente? Cobre o vazamento
 * estrutural (canais Harmony do gpt-oss, bloco `<think>`), auto-referência ("As
 * an AI"), moldura de meta-abertura ("Aqui está a cena:", "Claro! Vou narrar...")
 * e abertura em bullet de meta-comentário. NÃO confunde diálogo com travessão (—)
 * com bullet: bullet é hífen/asterisco.
 *
 * Escopo: BAKE-OFF, não produção. Os padrões estilísticos são gate de qualidade
 * (reprovam o candidato inteiro) e dariam falso-positivo como porteiro de
 * persistência — a narração do mestre termina em bullets. Em produção, o
 * `onFinish` usa o stripReasoningLeak, que corta só o estrutural.
 */
export function detectReasoningLeak(narration: string): { leak: boolean; match: string } {
  // Vazamento ESTRUTURAL (canais Harmony, bloco <think>): reusa o saneador de
  // produção, para que "o que é marcador de canal" tenha uma definição só. Aqui
  // basta saber que havia algo a cortar — no bake-off isso reprova o candidato.
  const { removed } = stripReasoningLeak(narration)
  if (removed.length > 0) return { leak: true, match: removed[0]!.trim().slice(0, 60) }

  for (const re of LEAK_PATTERNS) {
    const m = narration.match(re)
    if (m) return { leak: true, match: m[0].trim() }
  }
  // abertura em lista markdown (bullet de meta-comentário): primeira linha
  // não-vazia começa com "- " ou "* " (hífen/asterisco), não travessão "—".
  const firstLine = narration.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? ''
  if (/^[-*]\s/.test(firstLine)) return { leak: true, match: firstLine }
  return { leak: false, match: '' }
}
