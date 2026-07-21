import { auth } from '@/auth'

// US-61: header de autorização para chamadas à API feitas no servidor (server
// components e o proxy SSE). Lê o token fresco da sessão via `auth()`.
export async function apiAuthHeader(): Promise<Record<string, string>> {
  const session = await auth()
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}
}
