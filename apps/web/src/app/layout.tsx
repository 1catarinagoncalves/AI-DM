import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Providers } from '@/components/Providers'
import { AuthNav } from '@/components/AuthNav'
import { auth } from '@/auth'

export const metadata: Metadata = {
  title: 'AI Dungeon Master',
  description: 'Your AI-powered RPG narrator',
}

// US-66: viewport explícito — não depender só do default do Next. Garante que o
// mobile renderiza na largura do aparelho (sem zoom-out) e escala inicial 1.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // US-61: sessão resolvida no servidor e passada ao SessionProvider — o token de
  // API já existe no primeiro render do cliente (sem janela de 401 na entrada).
  const session = await auth()
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-amber-50 dark:bg-stone-950 text-stone-900 dark:text-white antialiased">
        {/* US-46: skip link — primeiro elemento tabável do body, some até receber foco. */}
        <a href="#conteudo" className="skip-link" suppressHydrationWarning>
          Pular para o conteúdo
        </a>
        {/* US-46: aplica o tema antes do React hidratar — sem escolha salva, respeita o prefers-color-scheme do sistema. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('ai-dm-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');})()`
          }}
        />
        <Providers session={session}>
          <ThemeProvider>
            <ThemeToggle />
            {/* US-61: controlo de sessão (Sair) — só visível autenticado. */}
            <AuthNav />
            {/* US-46: um único landmark <main> por página; tabindex=-1 para receber foco do skip link. */}
            <main id="conteudo" tabIndex={-1}>
              {children}
            </main>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
