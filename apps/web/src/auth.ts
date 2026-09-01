import NextAuth from 'next-auth'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { isLocale } from '@ai-dm/shared'
// US-97: mesmo nome da chave do localStorage (LOCALE_STORAGE_KEY, LocaleProvider) —
// é o mesmo valor, espelhado em cookie só para o servidor conseguir lê-lo.
// US-98: a constante saiu daqui para lib/locale-cookie.ts quando o layout.tsx passou
// a precisar dela também (eram duas cópias literais; agora é uma).
import { LOCALE_COOKIE } from '@/lib/locale-cookie'
// US-201: array de providers isolado num módulo próprio — ver o comentário lá para
// o porquê (importar `next-auth` aqui puxa `next/server`, que quebra sob Vitest).
import { providers } from '@/lib/auth-providers'

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
  providers,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    // Guarda das rotas (via middleware): sem `userId` na sessão → manda para /login.
    authorized({ auth: session }) {
      return !!session?.userId
    },

    // Primeiro toque de uma identidade nova: chama o /auth/sync da API para fazer
    // upsert do User (por email @unique) e, no primeiro login, absorver órfãos
    // da era anônima (D1). Guarda o `userId` real devolvido no token.
    async jwt({ token, user, profile, trigger, session }) {
      // US-97: `update({ locale })` do cliente (LocaleProvider) sincroniza o token
      // logo após o PATCH /auth/locale — sem isto, o JWT (cookie, 30 dias) fica preso
      // no idioma do login e o reload reverte a troca feita depois dele.
      if (trigger === 'update' && isLocale(session?.locale)) {
        token.locale = session.locale
        return token
      }
      // US-201: `profile` só existe no fluxo OAuth (Google); um sign-in por
      // Credentials (login de dev) só traz `user`. `profile ?? user` deixa o
      // caminho do Google idêntico (quando há `profile`, ele ganha) e alarga a
      // fonte para as duas — sem isto o login de dev nunca povoa `token.userId`
      // e o `authorized()` reprova em loop.
      const identity = profile ?? user
      if (identity?.email && !token.userId) {
        // Token de bootstrap: prova (via AUTH_SECRET) que a chamada veio do nosso
        // web. Ainda sem `sub` — só email/name. Com o provider de dev ligado, o
        // email deixa de ser um Google verificado: é uma constante que o próprio
        // web escolheu (dev@ai-dm.invalid) — a garantia cai de "email verificado"
        // para "veio do nosso web". Aceitável só em dev (é por isto que a porta
        // dupla acima não é opcional).
        const bootstrap = await signApiToken({ email: identity.email, name: identity.name ?? 'Jogador' })
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
            // US-201: nome próprio (não `user`) — o parâmetro do callback já usa
            // esse nome para o resultado do `authorize()` do provider de dev.
            const synced = (await res.json()) as { id: string; email: string; name: string; locale?: string }
            token.userId = synced.id
            token.email = synced.email
            token.name = synced.name
            // US-97: idioma da conta. Guardado no token para o cliente saber a
            // preferência do SERVIDOR (e não só a do localStorage deste aparelho).
            token.locale = synced.locale
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
