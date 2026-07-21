'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import type { Session } from 'next-auth'
import { setAuthToken } from '@/lib/api'

// US-61: ponte entre a sessão do Auth.js e o cliente da API. Injeta o token Bearer
// no módulo `api` durante o render — antes de qualquer efeito de fetch das telas —
// para nenhuma chamada partir sem `Authorization`.
function AuthTokenBridge() {
  const { data } = useSession()
  setAuthToken(data?.accessToken)
  return null
}

export function Providers({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return (
    <SessionProvider session={session}>
      <AuthTokenBridge />
      {children}
    </SessionProvider>
  )
}
