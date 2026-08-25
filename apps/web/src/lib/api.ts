import { signOut } from 'next-auth/react'
import type { Locale, SystemConfig, ChatTurn } from '@ai-dm/shared'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// US-61: token HS256 emitido pelo Auth.js e injetado pela ponte de sessão
// (AuthTokenBridge) antes de qualquer chamada. A API deriva o `userId` deste
// token — o `userId` deixou de viajar no corpo. Chamadas no cliente anexam-no
// como `Authorization: Bearer`.
let authToken: string | undefined
export function setAuthToken(token?: string) {
  authToken = token
}

function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  return authToken ? { ...base, Authorization: `Bearer ${authToken}` } : base
}

// 25/08/2026: 401 = a API não reconhece a identidade do token (AuthGuard: `sub` sem linha
// em `User`). O cookie de sessão vive 30 dias e o `/auth/sync` só corre no PRIMEIRO login,
// então sem deslogar aqui o jogador ficaria preso no erro até o cookie expirar sozinho.
async function assertOk(res: Response): Promise<void> {
  if (res.ok) return
  const body = await res.text()
  if (res.status === 401) await signOut({ callbackUrl: '/login' })
  throw new Error(body)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  await assertOk(res)
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, { headers: authHeaders() })
  await assertOk(res)
  return res.json()
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  await assertOk(res)
  return res.json()
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1${path}`, { method: 'DELETE', headers: authHeaders() })
  await assertOk(res)
}

export const api = {
  createCharacter: (data: {
    systemId: string; name: string; gender: string; race: string; class: string
    attributes: Record<string, number>
    skills?: string[]
    background?: { story?: string; ideals?: string[]; bonds?: string[]; flaws?: string[]; deity?: { name: string; portfolio?: string } }
    // US-122: origem do catálogo de backgrounds (US-121) — campo IRMÃO de `background`.
    // US-124: `connection`/`memento` são o texto da linha escolhida no <select> de cada
    // bloco de connection_and_memento — não vêm do catálogo, texto livre do ponto de vista da API.
    // US-123: `abilityChoice` é a chave do atributo escolhido para o +1 livre do
    // grant.kind === 'ability' da origem.
    // US-131: `skillChoice` são as chaves de perícia escolhidas do grant.chooseFrom do
    // grant.kind === 'skills' da origem — array, `chooseCount` pode ser > 1.
    // US-132: `toolChoice` é o mesmo formato, para grant.kind === 'tools' (Folk Hero real
    // exige 2 — chooseCount pode ser > 1 aqui também).
    origin?: { key?: string; connection?: string; memento?: string; abilityChoice?: string; skillChoice?: string[]; toolChoice?: string[] }
  }) => post<{ id: string; name: string }>('/characters', data),

  listSystems: () =>
    get<{ id: string; name: string; sourceType: string; config: SystemConfig | null }[]>('/systems'),

  // US-157: dto omite o campo quando o jogador deixa o grupo em Aleatório — nunca envia
  // uma chave "random" (mesma disciplina de ausência = aleatório da US-156).
  createAdventure: (characterId: string, dto: { tone?: string; setting?: string; areaType?: string; challenge?: 'adventure' | 'challenge' }) =>
    post<{ id: string; title: string }>(`/characters/${characterId}/adventures`, dto),

  // US-61: as fichas do próprio utilizador, derivadas do token (sem userId no caminho).
  listCharacters: () =>
    get<{ id: string; name: string; race: string; class: string; level: number; currentAdventure: { id: string; title: string } | null }[]>(`/characters/mine`),

  getCharacter: (id: string) =>
    get<{ id: string; name: string; gender: string; race: string; class: string; level: number; baseAttributes: Record<string, number>; features: { name: string; description: string }[]; spells: { name: string; level?: number; description?: string }[]; states: { hp: number; maxHp: number; inventory: { name: string; qty: number; origin?: 'memento' | 'equipment' }[] }[] }>(`/characters/${id}`),

  deleteCharacter: (id: string) => del(`/characters/${id}`),

  // US-97: troca o idioma ativo da conta. O turno não manda locale — a API o deriva
  // do token —, então esta é a única rota por onde a preferência viaja.
  setLocale: (locale: Locale) => patch<{ id: string; locale: Locale }>('/auth/locale', { locale }),

  getTurns: (characterId: string, adventureId: string) =>
    get<ChatTurn[]>(`/characters/${characterId}/adventures/${adventureId}/turns`),
}
