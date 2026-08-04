import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Cinzel, Geist } from 'next/font/google'
import './globals.css'
import { LOCALE_COOKIE, localeFromCookie } from '@/lib/locale-cookie'
import { messagesFor } from '@/messages'
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

// US-98: idioma do lado do SERVIDOR. O estado do LocaleProvider não existe aqui, mas
// o cookie que ele espelha (US-97) sim — é por ele que o `metadata` e o `lang` do
// <html> saem no idioma certo já no primeiro paint, sem esperar a hidratação.
async function activeLocale() {
  return localeFromCookie((await cookies()).get(LOCALE_COOKIE)?.value)
}

// Dinâmico (e não mais `export const metadata`): título e descrição são texto de
// interface como qualquer outro, e o idioma só se conhece em tempo de requisição.
export async function generateMetadata(): Promise<Metadata> {
  const t = messagesFor(await activeLocale())
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    icons: {
      // Só o SVG, e é o mesmo desenho de espadas do <Logo>. Os PNG 32x32 eram
      // a marca do scaffold. O nome não é `icon.svg` de propósito: o Chrome
      // guarda favicon num banco à parte do cache HTTP e não revalida por
      // ETag, então quem já visitou o site continuaria vendo o ícone velho.
      // URL nova = sem histórico. Renomeie de novo se o desenho mudar.
      icon: [{ url: '/icon-swords.svg', type: 'image/svg+xml' }],
      apple: '/apple-icon.png',
    },
  }
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
  // US-98: `lang` já correto no HTML SERVIDO. O LocaleProvider corrige no cliente
  // (US-97), mas o leitor de tela escolhe a voz pelo primeiro paint — e o HTML que
  // vai para crawler ou para uma hidratação que falha nunca chega a ser corrigido.
  const locale = await activeLocale()
  const t = messagesFor(locale)
  return (
    <html lang={locale} suppressHydrationWarning className={`${cinzel.variable} ${geist.variable}`}>
      <body suppressHydrationWarning className="bg-background text-foreground font-sans antialiased">
        {/* US-46: skip link — primeiro elemento tabável do body, some até receber foco. */}
        <a href="#conteudo" className="skip-link" suppressHydrationWarning>
          {t('common.skipLink')}
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
