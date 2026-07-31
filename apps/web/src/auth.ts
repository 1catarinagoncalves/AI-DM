import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { isLocale } from '@ai-dm/shared'
// US-97: mesmo nome da chave do localStorage (LOCALE_STORAGE_KEY, LocaleProvider) —
// é o mesmo valor, espelhado em cookie só para o servidor conseguir lê-lo.
// US-98: a constante saiu daqui para lib/locale-cookie.ts quando o layout.tsx passou
// a precisar dela também (eram duas cópias literais; agora é uma).
import { LOCALE_COOKIE } from '@/lib/locale-cookie'

// US-61: login por Google via Auth.js (NextAuth v5), dentro do próprio apps/web
// (ADR 006 — custo zero, sem fornecedor de auth extra). A sessão é JWT (sem
// adapter de banco): quem é dono do Postgres é a API, que faz o upsert do User.

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// D2: o mesmo AUTH_SECRET vive na Vercel e no Render. O web assina HS256; o guard
// da API verifica com o segredo compartilhado. Chave derivada uma vez por processo.
function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET ausente no web')
  return new TextEncoder().encode(secret)
}

async function signApiToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey())
}

// US-89: `signIn`/`signOut` não são desestruturados de propósito — a UI usa os
// homônimos de 'next-auth/react' (login/page.tsx, AuthNav.tsx), que são client-side.
export const { handlers, auth } = NextAuth({
  // Render/Vercel ficam atrás de proxy; confia no host da requisição.
  trustHost: true,
  providers: [Google],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    // Guarda das rotas (via middleware): sem `userId` na sessão → manda para /login.
    authorized({ auth: session }) {
      return !!session?.userId
    },

    // Primeiro toque do Google verificado: chama o /auth/sync da API para fazer
    // upsert do User (por email @unique) e, no primeiro login, absorver órfãos
    // da era anônima (D1). Guarda o `userId` real devolvido no token.
    async jwt({ token, profile }) {
      if (profile?.email && !token.userId) {
        // Token de bootstrap: prova (via AUTH_SECRET) que a chamada veio do nosso
        // web com um email Google verificado. Ainda sem `sub` — só email/name.
        const bootstrap = await signApiToken({ email: profile.email, name: profile.name ?? 'Jogador' })
        // US-97: idioma que o visitante escolheu ANTES de entrar. Vem por cookie
        // (o LocaleProvider espelha o localStorage lá) porque aqui é servidor —
        // sem ele, quem escolheu English veria a conta nascer em pt-BR.
        const chosenLocale = (await cookies()).get(LOCALE_COOKIE)?.value
        try {
          const res = await fetch(`${API}/api/v1/auth/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bootstrap}` },
            body: JSON.stringify(isLocale(chosenLocale) ? { locale: chosenLocale } : {}),
          })
          if (res.ok) {
            const user = (await res.json()) as { id: string; email: string; name: string; locale?: string }
            token.userId = user.id
            token.email = user.email
            token.name = user.name
            // US-97: idioma da conta. Guardado no token para o cliente saber a
            // preferência do SERVIDOR (e não só a do localStorage deste aparelho).
            token.locale = user.locale
          }
        } catch {
          // Sem userId → authorized() barra e o jogador é levado a tentar de novo.
        }
      }
      return token
    },

    // Expõe a identidade e um token de API fresco para a sessão. `accessToken` é o
    // JWT que o cliente anexa como Bearer (ponte em AuthTokenBridge) e que os
    // callers server-side leem por `auth()`.
    async session({ session, token }) {
      if (token.userId) {
        session.userId = token.userId
        session.accessToken = await signApiToken({ sub: token.userId, email: token.email })
        session.locale = token.locale
      }
      return session
    },
  },
})
