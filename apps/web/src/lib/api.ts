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

export const api = {
  createUser: (email: string, name: string) =>
    post<{ id: string; name: string }>('/users', { email, name }),

  createCharacter: (data: {
    userId: string; name: string; gender: string; race: string; class: string
    strength: number; dexterity: number; constitution: number
    intelligence: number; wisdom: number; charisma: number
  }) => post<{ id: string; name: string }>('/characters', data),

  listSystems: () =>
    get<{ id: string; name: string; sourceType: string }[]>('/campaigns/systems'),

  createCampaign: (userId: string, name: string, systemId: string) =>
    post<{ id: string; name: string }>('/campaigns', { userId, name, systemId }),

  joinCampaign: (campaignId: string, characterId: string) =>
    post(`/campaigns/${campaignId}/join`, { characterId }),

  createAdventure: (campaignId: string, title: string) =>
    post<{ id: string; title: string }>(`/campaigns/${campaignId}/adventures`, { title }),

  getCharacter: (id: string) =>
    get<{ id: string; name: string; gender: string; race: string; class: string; level: number; baseAttributes: Record<string, number>; states: { hp: number; maxHp: number; inventory: { name: string; qty: number }[] }[] }>(`/characters/${id}`),
}
