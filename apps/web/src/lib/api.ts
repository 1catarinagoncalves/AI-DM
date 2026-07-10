import type { InitialAdventureHook, SystemConfig, ChatTurn } from '@ai-dm/shared'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export const api = {
  createUser: (email: string, name: string) =>
    post<{ id: string; name: string }>('/users', { email, name }),

  createCharacter: (data: {
    userId: string; systemId: string; name: string; gender: string; race: string; class: string
    attributes: Record<string, number>
    skills?: string[]
    background?: { story?: string; ideals?: string[]; bonds?: string[]; flaws?: string[]; deity?: { name: string; portfolio?: string } }
  }) => post<{ id: string; name: string }>('/characters', data),

  listSystems: () =>
    get<{ id: string; name: string; sourceType: string; config: SystemConfig | null }[]>('/systems'),

  getInitialAdventure: (characterId: string) =>
    get<InitialAdventureHook>(`/characters/${characterId}/adventures/initial`),

  createAdventure: (characterId: string, initialHookId: string) =>
    post<{ id: string; title: string }>(`/characters/${characterId}/adventures`, { initialHookId }),

  listCharacters: (userId: string) =>
    get<{ id: string; name: string; race: string; class: string; level: number; currentAdventure: { id: string; title: string } | null }[]>(`/characters/user/${userId}`),

  getCharacter: (id: string) =>
    get<{ id: string; name: string; gender: string; race: string; class: string; level: number; baseAttributes: Record<string, number>; features: { name: string; description: string }[]; states: { hp: number; maxHp: number; inventory: { name: string; qty: number }[] }[] }>(`/characters/${id}`),

  deleteCharacter: (id: string) => del(`/characters/${id}`),

  getTurns: (characterId: string, adventureId: string) =>
    get<ChatTurn[]>(`/characters/${characterId}/adventures/${adventureId}/turns`),
}
