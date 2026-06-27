import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Dungeon Master',
  description: 'Your AI-powered RPG narrator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
