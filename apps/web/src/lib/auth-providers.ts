import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'

// US-201: array extraído de auth.ts para o teste de regressão (auth-providers.test.ts)
// poder importar SÓ isto, sem passar pelo `next-auth` principal — `import NextAuth
// from 'next-auth'` puxa `next-auth/lib/env.js`, que importa `next/server`. Isso só
// resolve dentro de um build do Next; sob Vitest quebra com "Cannot find module
// .../next/server" porque o Node não aplica as condições de export que o Next usa
// para aquele subpath. As duas submódulos de provider aqui não têm essa dependência.

// Porta dupla, NÃO alternativa — as duas condições são exigidas juntas. `NODE_ENV`
// sozinho não bastaria (um preview mal configurado pode rodar sem 'production');
// `DEV_LOGIN` sozinho vazaria se alguém copiasse `.env` de dev para produção.
const devLoginEnabled = process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN === '1'

// Exportado para o teste de regressão afirmar contra o array real, não contra uma
// cópia da condição — um teste que reimplementa a condição continua passando
// depois de alguém apagá-la do código (US-201, decisão 3).
export const providers = [
  Google,
  ...(devLoginEnabled
    ? [
        // Login de dev sem Google (US-201): autoriza sempre a MESMA conta de bancada
        // que `pnpm dev:token` usa. Sem fetch aqui — o `id` é descartado pelo
        // callback `jwt` de auth.ts, que sobrescreve com o `userId` real da API.
        Credentials({
          id: 'dev',
          name: 'Dev',
          credentials: {},
          async authorize() {
            return { id: 'dev', email: 'dev@ai-dm.invalid', name: 'Agente de desenvolvimento' }
          },
        }),
      ]
    : []),
]
