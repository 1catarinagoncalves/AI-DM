'use client'

export interface GameSession {
  userId: string
  userName: string
  characterId: string
  characterName: string
  adventureId: string
}

const KEY = 'ai-dm-session'

export function saveSession(session: GameSession) {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function loadSession(): GameSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(KEY)
}
