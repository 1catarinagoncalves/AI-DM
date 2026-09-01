import { SessionProvider } from 'next-auth/react'
import { AuthNav } from '@/components/AuthNav'

// AuthNav renders nothing (`if (status !== 'authenticated') return null`)
// under the global provider wrap (cfg.provider passes session: null, so the
// whole scoped set previews logged-out by default). A nested SessionProvider
// with a real session overrides useSession() for just this subtree - real
// composition, not a reimplementation: AuthNav and SessionProvider are both
// the actual exported components, this only supplies the account state the
// button is conditioned on. `fixed` positioned in the app - cfg.overrides
// pins a small single-card viewport, same as ThemeToggle.
export function Authenticated() {
  return (
    <SessionProvider session={{ user: { name: 'Seraphine' }, expires: '2099-01-01T00:00:00.000Z' }}>
      <AuthNav />
    </SessionProvider>
  )
}
