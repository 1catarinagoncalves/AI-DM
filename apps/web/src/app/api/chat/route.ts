import { NextRequest } from 'next/server'

// US-60 (D1): Node runtime + sem coleta estática — garante streaming SSE do proxy
// sem bufferizar e dá folga de tempo para o upstream (Render) acordar do cold start.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Narração streama por dezenas de segundos; Hobby corta função em 10s por padrão.
// 60s é o teto do Hobby e cobre o turno completo + cold start do Render.
export const maxDuration = 60

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function POST(req: NextRequest) {
  const { adventureId, characterId, message } = await req.json()

  const upstream = await fetch(`${API}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adventureId, characterId, message }),
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      // Impede bufferização em proxies intermediários (Nginx/Vercel) — o efeito
      // "digitação" do Mestre depende de os tokens saírem incrementalmente.
      'X-Accel-Buffering': 'no',
    },
  })
}
