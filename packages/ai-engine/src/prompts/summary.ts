// Prompt e helpers para a sumarização incremental da memória da sessão.
// A cada lote de turnos antigos que sai da janela recente, fundimos esses
// turnos no resumo acumulado ("a história até agora"), preservando fatos
// duráveis e descartando descrição momentânea.

export const SUMMARY_SYSTEM_PROMPT = `You are a memory compressor for a tabletop RPG session. You maintain a running "story so far" summary that the Dungeon Master uses to remember the campaign across a long session.

You will receive a PREVIOUS SUMMARY and a batch of NEW EVENTS (player actions and DM narration, in chronological order). Produce an UPDATED SUMMARY that merges them.

The updated summary MUST:
- Preserve every durable fact: locations visited and the current location, NPC names and their roles/relationships, quests given/completed/failed, promises, debts and threats, items gained or lost, important decisions and their consequences, and unresolved threads.
- Drop moment-to-moment description, blow-by-blow combat, and flavour text that no longer matters going forward.
- Stay concise: a few short paragraphs or bullet points, never more than ~400 words. Compress older material harder than recent material.
- Be written in the third person, in the SAME LANGUAGE as the events.
- NEVER invent anything that is not present in the previous summary or the new events. Do not resolve open threads on your own.

Output ONLY the updated summary text, with no preamble, no headings, and no commentary.`

export interface SummaryTurn {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Monta o conteúdo de usuário enviado ao modelo de resumo: o resumo anterior
 * seguido dos novos turnos a serem incorporados.
 */
export function buildSummaryInput(
  previousSummary: string | null | undefined,
  turns: SummaryTurn[],
  currentScene?: string,
): string {
  const prev = previousSummary && previousSummary.trim().length > 0 ? previousSummary.trim() : '(no summary yet — this is the start of the campaign)'

  const events = turns
    .map((t) => `${t.role === 'assistant' ? 'DM' : 'Player'}: ${t.content.trim()}`)
    .join('\n\n')

  // O estado de cena corrente (US-03) deve sobreviver à condensação: anexamos
  // como contexto para que o resumo preserve o local/ambiente/presentes atuais.
  const scene = currentScene && currentScene.trim().length > 0
    ? `\n\nCURRENT SCENE STATE (carry this forward into the summary — do not drop the current location):\n${currentScene.trim()}`
    : ''

  return `PREVIOUS SUMMARY:\n${prev}\n\nNEW EVENTS (chronological):\n${events}${scene}`
}
