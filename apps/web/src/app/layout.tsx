import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'AI Dungeon Master',
  description: 'Your AI-powered RPG narrator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-amber-50 dark:bg-stone-950 text-stone-900 dark:text-white antialiased">
        {/* Applies saved theme before React hydrates — prevents white flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('ai-dm-theme');if(t!=='light')document.documentElement.classList.add('dark');})()`
          }}
        />
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
