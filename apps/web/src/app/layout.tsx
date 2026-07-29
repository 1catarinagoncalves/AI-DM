import type { Metadata, Viewport } from 'next'
import { Cinzel, Geist } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Providers } from '@/components/Providers'
import { AuthNav } from '@/components/AuthNav'
import { auth } from '@/auth'

// Design system: a fonte-sistema era a maior parcela do "cheiro de template"
// (direcao-visual-anti-slop.md §1). Cinzel carrega a voz de grimório nos títulos;
// Geist é o corpo/UI. Auto-hospedadas pelo next/font — nunca <link> do Google.
const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', weight: ['400', '600', '700'] })
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'AI Dungeon Master',
  description: 'Your AI-powered RPG narrator',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
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
    <html lang="pt-BR" suppressHydrationWarning className={`${cinzel.variable} ${geist.variable}`}>
      <body suppressHydrationWarning className="bg-background text-foreground font-sans antialiased">
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
