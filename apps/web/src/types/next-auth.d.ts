import 'next-auth'
import 'next-auth/jwt'

// US-61: campos que adicionamos à sessão/JWT do Auth.js.
declare module 'next-auth' {
  interface Session {
    // userId real (do Postgres, via /auth/sync). Presença = autenticado.
    userId?: string
    // JWT HS256 que o cliente anexa como Bearer para a API.
    accessToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    email?: string
    name?: string
  }
}
