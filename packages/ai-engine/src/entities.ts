import type { WorldEntity, EntityEdge } from '@ai-dm/shared'

// Registro estruturado de entidades duráveis da campanha (NPCs, locais, objetos).
// Um patch traz uma ou mais entidades; cada uma é UPSERT por `nome` (match tolerante
// a acento/caixa). Campos omitidos no patch PRESERVAM o valor anterior — o mestre
// manda só o que mudou (ex.: só `estado: "acordado"`), sem reenviar nota/local.
export type EdgePatch = Omit<EntityEdge, 'atualizadoEm'>
export type EntityPatch = Omit<WorldEntity, 'atualizadoEm' | 'relacoes'> & { relacoes?: EdgePatch[] }

// Exportado: US-171 reusa este match (accent/case tolerant) em `reconcileScene`
// (ai.service.ts) pra diffar `sceneState.presentes` contra `WorldEntity.nome`.
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()

/**
 * Funde arestas (US-113) por chave `(relacao, para)` normalizada — mesma tolerância
 * a acento/caixa do match por `nome`. Mesma semântica parcial: campo omitido no
 * patch da aresta preserva o valor anterior DAQUELA aresta. `patches` ausente ou
 * vazio devolve `existing` sem tocar (preserva `undefined` — retrocompat).
 */
function mergeEdges(
  existing: EntityEdge[] | undefined,
  patches: EdgePatch[] | undefined,
  now: string,
): EntityEdge[] | undefined {
  if (!patches || patches.length === 0) return existing
  const result = (existing ?? []).map((e) => ({ ...e }))

  for (const patch of patches) {
    const relacao = patch.relacao?.trim()
    const para = patch.para?.trim()
    if (!relacao || !para) continue
    const idx = result.findIndex((e) => norm(e.relacao) === norm(relacao) && norm(e.para) === norm(para))
    if (idx === -1) {
      result.push({ relacao, para, fonte: patch.fonte, sabido: patch.sabido, revelado: patch.revelado, atualizadoEm: now })
    } else {
      const existingEdge = result[idx]!
      result[idx] = {
        relacao: existingEdge.relacao, // grafia original preservada
        para: existingEdge.para, // grafia original preservada
        fonte: patch.fonte ?? existingEdge.fonte,
        sabido: patch.sabido ?? existingEdge.sabido,
        revelado: patch.revelado ?? existingEdge.revelado,
        atualizadoEm: now,
      }
    }
  }

  return result
}

/**
 * Funde patches de entidade no registro corrente. Upsert por `nome` normalizado:
 * entidade existente tem os campos informados sobrescritos (os omitidos ficam);
 * `nome` novo é inserido. `nome` vazio é ignorado. Preserva a ordem de 1ª aparição.
 */
export function mergeEntities(
  current: WorldEntity[] | null | undefined,
  patches: EntityPatch[],
): WorldEntity[] {
  const now = new Date().toISOString()
  const result = (current ?? []).map((e) => ({ ...e }))

  for (const patch of patches) {
    const nome = patch.nome?.trim()
    if (!nome) continue
    // US-170: patch com `tipo` desambigua nome colidindo entre tipos (ex.: local "O
    // Bruxo" e NPC "O Bruxo"). Sem `tipo` no patch, casa só por nome (retrocompat —
    // ~20 patches de teste existentes atualizam campo sem reenviar `tipo`).
    const idx = result.findIndex((e) =>
      norm(e.nome) === norm(nome) && (patch.tipo === undefined || e.tipo === patch.tipo),
    )
    if (idx === -1) {
      const { relacoes: relacoesPatch, ...rest } = patch
      result.push({ ...rest, nome, relacoes: mergeEdges(undefined, relacoesPatch, now), atualizadoEm: now })
    } else {
      // Merge parcial: só os campos presentes no patch sobrescrevem.
      const existing = result[idx]!
      result[idx] = {
        nome: existing.nome, // mantém a grafia original do cadastro
        tipo: patch.tipo ?? existing.tipo,
        local: patch.local ?? existing.local,
        estado: patch.estado ?? existing.estado,
        nota: patch.nota ?? existing.nota,
        // US-75: dois eixos de conhecimento, mesma semântica parcial (omitido preserva).
        // Assim o Mestre PROMOVE re-registrando: revelado false→true (reveal ao jogador),
        // privado→publico (segredo que se espalha).
        sabido: patch.sabido ?? existing.sabido,
        revelado: patch.revelado ?? existing.revelado,
        // US-113: vínculos são fundidos por aresta, não substituídos em bloco — ver mergeEdges.
        relacoes: mergeEdges(existing.relacoes, patch.relacoes, now),
        atualizadoEm: now,
      }
    }
  }

  return result
}

const TIPO_LABEL: Record<NonNullable<WorldEntity['tipo']>, string> = {
  npc: 'NPC',
  local: 'Local',
  objeto: 'Objeto',
  faccao: 'Facção',
  outro: 'Entidade',
}

/**
 * Bloco compacto de uma linha por entidade, para reinjeção no prompt. Vazio quando
 * não há entidade registrada — nada a injetar. Formato:
 *   - [NPC] Vigia — na sala secreta sob a capela; guardiã neutra; deu permissão a Anetra
 *
 * US-71: `local` de entidade é "última posição conhecida de quem está FORA de cena".
 * Para uma entidade que está em `presentes` (na cena AGORA), a posição dela já é o
 * `sceneState.local` — a linha "— em {local}" seria redundante e uma segunda fonte
 * sobre "onde está quem", então é SUPRIMIDA. A entidade continua listada (canon
 * durável); só o `em {local}` some enquanto ela está presente.
 */
export function formatEntities(
  entities: WorldEntity[] | null | undefined,
  presentes?: string[] | null,
): string {
  if (!entities || entities.length === 0) return ''
  const emCena = new Set((presentes ?? []).map(norm))
  return entities
    .map((e) => {
      const tipo = e.tipo ? `[${TIPO_LABEL[e.tipo]}] ` : ''
      // US-75: marcadores dos dois eixos. Só aparecem no caso não-comum — `publico` +
      // revelado (ou ausentes) renderiza como antes, sem ruído. `oculto` vem primeiro
      // e em CAIXA porque é o gate mais forte (proibido vazar ao jogador).
      const oculto = e.revelado === false ? '⚠ OCULTO — verdade do mundo, NÃO revele ao jogador ainda' : ''
      const restrito = e.sabido === 'privado' ? '(restrito — só quem viu)' : ''
      const detalhes = [
        oculto,
        restrito,
        emCena.has(norm(e.nome)) ? '' : e.local ? `em ${e.local}` : '',
        e.estado ?? '',
        e.nota ?? '',
      ]
        .map((d) => d.trim())
        .filter(Boolean)
        .join('; ')
      const linhaEntidade = `- ${tipo}${e.nome}${detalhes ? ` — ${detalhes}` : ''}`
      const linhasVinculo = (e.relacoes ?? []).map(formatEdge)
      return [linhaEntidade, ...linhasVinculo].join('\n')
    })
    .join('\n')
}

/**
 * Uma linha indentada por vínculo, sob a entidade de origem (US-113):
 *   → irmã de: Morvath (abertura)
 *   → dono de: arboreto (turno: clx4…, ⚠ OCULTO — verdade do mundo, NÃO revele ao jogador ainda)
 * `para` é texto cru — sem lookup no ledger, então uma aresta órfã (destino que não
 * está na lista de entidades) renderiza normalmente, nunca lança.
 */
function formatEdge(v: EntityEdge): string {
  const oculto = v.revelado === false ? '⚠ OCULTO — verdade do mundo, NÃO revele ao jogador ainda' : ''
  const restrito = v.sabido === 'privado' ? 'restrito — só quem viu' : ''
  const meta = [v.fonte, restrito, oculto].filter(Boolean).join(', ')
  return `    → ${v.relacao}: ${v.para} (${meta})`
}
