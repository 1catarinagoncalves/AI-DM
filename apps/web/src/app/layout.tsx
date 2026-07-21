import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'AI Dungeon Master',
  description: 'Your AI-powered RPG narrator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <ThemeProvider>
          <ThemeToggle />
          {/* US-46: um único landmark <main> por página; tabindex=-1 para receber foco do skip link. */}
          <main id="conteudo" tabIndex={-1}>
            {children}
          </main>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
