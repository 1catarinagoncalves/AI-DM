import 'next-auth'
import 'next-auth/jwt'

// US-61: campos que adicionamos à sessão/JWT do Auth.js.
declare module 'next-auth' {
  interface Session {
    // userId real (do Postgres, via /auth/sync). Presença = autenticado.
    userId?: string
    // JWT HS256 que o cliente anexa como Bearer para a API.
    accessToken?: string
    // US-97: idioma da CONTA, devolvido pelo /auth/sync. É por ele que a preferência
    // segue o jogador para outro dispositivo — o localStorage é só o palpite local.
    locale?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    email?: string
    name?: string
    locale?: string
  }
}
