import type { WorldEntity } from '@ai-dm/shared'

// Registro estruturado de entidades duráveis da campanha (NPCs, locais, objetos).
// Um patch traz uma ou mais entidades; cada uma é UPSERT por `nome` (match tolerante
// a acento/caixa). Campos omitidos no patch PRESERVAM o valor anterior — o mestre
// manda só o que mudou (ex.: só `estado: "acordado"`), sem reenviar nota/local.
export type EntityPatch = Omit<WorldEntity, 'atualizadoEm'>

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()

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
    const idx = result.findIndex((e) => norm(e.nome) === norm(nome))
    if (idx === -1) {
      result.push({ ...patch, nome, atualizadoEm: now })
    } else {
      // Merge parcial: só os campos presentes no patch sobrescrevem.
      const existing = result[idx]!
      result[idx] = {
        nome: existing.nome, // mantém a grafia original do cadastro
        tipo: patch.tipo ?? existing.tipo,
        local: patch.local ?? existing.local,
        estado: patch.estado ?? existing.estado,
        nota: patch.nota ?? existing.nota,
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
 */
export function formatEntities(entities: WorldEntity[] | null | undefined): string {
  if (!entities || entities.length === 0) return ''
  return entities
    .map((e) => {
      const tipo = e.tipo ? `[${TIPO_LABEL[e.tipo]}] ` : ''
      const detalhes = [
        e.local ? `em ${e.local}` : '',
        e.estado ?? '',
        e.nota ?? '',
      ]
        .map((d) => d.trim())
        .filter(Boolean)
        .join('; ')
      return `- ${tipo}${e.nome}${detalhes ? ` — ${detalhes}` : ''}`
    })
    .join('\n')
}
