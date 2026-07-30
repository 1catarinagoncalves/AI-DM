import { stripReasoningLeak, type Locale } from '@ai-dm/shared'

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
 * A narração derivou do idioma-alvo do turno? `drift = true` quando os marcadores
 * da OUTRA língua superam os do alvo por margem e passam de um piso — o piso evita
 * acusar um texto curto por causa de um "the" (ou de um "você") solto.
 *
 * US-97: o alvo era cravado em PT-BR, o que reprovava qualquer mesa em inglês
 * ("EN não estava ausente, estava proibido" — ADR 005 D4). Agora vem por parâmetro,
 * com `pt-BR` como default para os chamadores que ainda medem só a mesa PT. A
 * heurística já contava os dois lados; o alvo só escolhe qual placar é o "certo".
 */
export function detectLanguageDrift(
  narration: string,
  target: Locale = 'pt-BR',
): { drift: boolean; ptScore: number; enScore: number } {
  const ptScore = (narration.match(PT_MARKERS)?.length ?? 0) + (narration.match(PT_DIACRITICS)?.length ?? 0)
  const enScore = narration.match(EN_MARKERS)?.length ?? 0
  const [targetScore, otherScore] = target === 'pt-BR' ? [ptScore, enScore] : [enScore, ptScore]
  const drift = otherScore > targetScore && otherScore >= 3
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

// ─── Guardrail 5: nome de slop (onomástica) ──────────────────────────────────

// Lista FECHADA de nomes clichê de AI-fantasy que a barra de ofício (US-34) manda
// EVITAR. Investigação da US-36: o modelo emite "Elara" mesmo com o prompt mandando
// não usar — instrução negativa não segura contra prior forte, e o prompt PRIMAVA o
// token ao nomeá-lo (por isso a barra deixou de listá-los: ver NARRATIVE_CRAFT_SECTION,
// que agora só faz steering positivo). Lista fechada = regex determinístico, não
// esperança no prompt — e este detector é agora a ÚNICA fonte da lista (o prompt não
// a nomeia mais, de propósito). NÃO inclui "Seraphine" (personagem-jogador) — só "Seraphina".
const SLOP_NAMES = ['elara', 'kael', 'lyra', 'aria', 'zephyr', 'seraphina', 'thorne'] as const
const SLOP_RE = new RegExp(`\\b(${SLOP_NAMES.join('|')})\\b`, 'i')

/**
 * A prosa usa um nome de slop da lista fechada? Match whole-word,
 * insensível a caixa/acento (normaliza a narração antes). Custo zero — enforce
 * mecânico do blocklist que o prompt não consegue garantir sozinho.
 *
 * ponytail: lista fechada dos 7 nomes que o prompt cita. Se aparecer um clichê
 * novo recorrente nos relatórios (ex.: "Aldric"), some à lista aqui — não é o
 * juiz que decide isto, é uma regra dura.
 */
export function detectSlopName(narration: string): { slop: boolean; match: string } {
  const norm = narration.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  const m = norm.match(SLOP_RE)
  return m ? { slop: true, match: m[1]! } : { slop: false, match: '' }
}

// ─── Guardrail 4: negação de canon (amnésia de entidade) ─────────────────────

// Frases de NEGAÇÃO-DE-EXISTÊNCIA / ignorância que caracterizam o bug da "Vigia":
// o mestre trata como inexistente/desconhecida uma entidade que está no registro.
// De propósito ESPECÍFICAS (existência/ter-ouvido-falar), não "não sei um fato":
// "a Vigia não faz ideia de quem enviou" (NPC não sabe algo) NÃO deve reprovar;
// "você não faz ideia do que falam" + "nunca ouvi falar de nenhum Vigia" DEVE.
const DENIAL_PATTERNS: RegExp[] = [
  /n[ãa]o faz ideia do que\b[^.]{0,40}\b(?:fal(?:a|am|ando)|diz(?:em)?)\b/i,
  /nunca ouvi falar\b/i,
  /n[ãa]o (?:h[áa]|existe|existiu)\b[^.]{0,20}\b(?:nenhum[ao]?|tal|essa|esse|aqui)\b/i,
  /n[ãa]o conhe[çc]o\b[^.]{0,15}\bnenhum[ao]?\b/i,
  /n[ãa]o me lembr[oa] de\b[^.]{0,15}\b(?:nenhum[ao]?|ter visto|ter ouvido)\b/i,
]

/**
 * Amnésia de canon: o mestre NEGA ou finge ignorância de uma entidade que está no
 * registro do mundo (o bug da "Vigia" — um NPC/local que existia foi apagado do
 * resumo e o mestre o tratou como inexistente). Recebe a narração + os NOMES das
 * entidades do ledger daquele estado. `denied = true` quando uma frase de
 * negação-de-existência aparece E alguma entidade cadastrada é mencionada no texto
 * (senão não há canon a negar). Heurística de frase, custo zero — mede o sintoma
 * exato sem juiz LLM. Escopo: BAKE-OFF/regressão, não porteiro de produção (um NPC
 * pode legitimamente negar um FATO em cena; aqui o cenário é controlado).
 */
export function detectCanonDenial(
  narration: string,
  entityNames: string[],
): { denied: boolean; match: string } {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  const hay = norm(narration)
  const names = entityNames.map((n) => n.trim()).filter(Boolean)
  // Nenhuma entidade do ledger sequer mencionada → não há canon a negar.
  if (names.length === 0 || !names.some((n) => hay.includes(norm(n)))) {
    return { denied: false, match: '' }
  }
  for (const re of DENIAL_PATTERNS) {
    const m = narration.match(re)
    if (m) return { denied: true, match: m[0].trim() }
  }
  return { denied: false, match: '' }
}
