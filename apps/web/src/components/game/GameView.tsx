'use client'

import { useState, useRef, useEffect } from 'react'
import { loadSession, saveSession } from '@/lib/session'

interface Message {
  role: 'user' | 'dm'
  content: string
}

interface Props {
  adventureId: string
  characterId: string
  characterName: string
  characterClass: string
  characterRace: string
  hp: number
  maxHp: number
}

function historyKey(adventureId: string) {
  return `ai-dm-history-${adventureId}`
}

function loadHistory(adventureId: string): Message[] {
  try {
    const raw = localStorage.getItem(historyKey(adventureId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(adventureId: string, messages: Message[]) {
  localStorage.setItem(historyKey(adventureId), JSON.stringify(messages))
}

export function GameView({ adventureId, characterId, characterName, characterClass, characterRace, hp, maxHp }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [currentHp, setCurrentHp] = useState(hp)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const history = loadHistory(adventureId)
    setMessages(history)
  }, [adventureId])

  useEffect(() => {
    const session = loadSession()
    if (session) {
      saveSession({ ...session, adventureId, characterId, characterName })
    }
  }, [adventureId, characterId, characterName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || streaming) return

    const userMessage = input.trim()
    setInput('')

    const withUser: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(withUser)
    setStreaming(true)

    let dmText = ''
    const withDmPlaceholder: Message[] = [...withUser, { role: 'dm', content: '' }]
    setMessages(withDmPlaceholder)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adventureId, characterId, message: userMessage }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const handleLine = (line: string) => {
        // Sinal de reset: um novo step do modelo vai substituir a narração
        // anterior (evita a resposta duplicada em turnos multi-step).
        if (line === 'R') {
          dmText = ''
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'dm', content: '' }
            return next
          })
          return
        }
        if (!line.startsWith('0:"')) return
        const token = line.slice(3, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
        dmText += token
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'dm', content: dmText }
          return next
        })
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Acumula no buffer e só processa linhas completas; a última linha
        // (possivelmente parcial) fica retida até chegar o resto no próximo read.
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          handleLine(line)
        }
      }

      // Processa qualquer linha completa remanescente no buffer.
      if (buffer.length > 0) handleLine(buffer)

      const finalMessages: Message[] = [...withUser, { role: 'dm', content: dmText }]
      saveHistory(adventureId, finalMessages)

    } catch {
      const errorMessages: Message[] = [...withUser, { role: 'dm', content: 'Erro ao conectar com o Mestre. Tenta novamente.' }]
      setMessages(errorMessages)
      saveHistory(adventureId, errorMessages)
    } finally {
      setStreaming(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e as unknown as React.FormEvent)
    }
  }

  const hpPercent = Math.max(0, (currentHp / maxHp) * 100)
  const hpColor = hpPercent > 60 ? 'bg-green-500' : hpPercent > 30 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-stone-950 text-stone-900 dark:text-white flex flex-col md:flex-row">

      {/* Ficha do personagem — sidebar */}
      <aside className="md:w-64 bg-stone-100 dark:bg-stone-900 border-b md:border-b-0 md:border-r border-stone-300 dark:border-stone-800 p-4 flex md:flex-col gap-4 items-start overflow-x-auto md:overflow-x-visible">
        <div>
          <p className="text-amber-600 dark:text-amber-400 font-bold text-lg">{characterName}</p>
          <p className="text-stone-500 dark:text-stone-400 text-sm">{characterRace} · {characterClass}</p>
        </div>

        <div className="md:w-full">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-stone-500 dark:text-stone-400">HP</span>
            <span className={hpPercent > 30 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{currentHp}/{maxHp}</span>
          </div>
          <div className="h-2 bg-stone-300 dark:bg-stone-700 rounded-full overflow-hidden">
            <div className={`h-full ${hpColor} rounded-full transition-all`} style={{ width: `${hpPercent}%` }} />
          </div>
        </div>
      </aside>

      {/* Área de jogo */}
      <main className="flex-1 flex flex-col">

        {/* Histórico de mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {messages.length === 0 && (
            <div className="text-center text-stone-400 dark:text-stone-500 pt-16">
              <p className="text-4xl mb-4">⚔</p>
              <p className="text-lg">A tua aventura começa aqui.</p>
              <p className="text-sm mt-1">Diz ao Mestre o que queres fazer.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'dm' && (
                <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900 border border-amber-500 dark:border-amber-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0 text-sm text-amber-700 dark:text-amber-300">
                  ✦
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-white rounded-br-sm'
                  : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-100 rounded-bl-sm'
              }`}>
                {msg.content}
                {streaming && i === messages.length - 1 && msg.role === 'dm' && (
                  <span className="inline-block w-2 h-4 bg-amber-500 dark:bg-amber-400 ml-1 animate-pulse align-text-bottom" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-4 border-t border-stone-200 dark:border-stone-800 flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="O que fazes? (Enter para enviar, Shift+Enter para nova linha)"
            disabled={streaming}
            className="flex-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 resize-none disabled:opacity-50 focus:outline-none focus:border-amber-500 dark:focus:border-amber-600"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 font-semibold transition-colors"
          >
            {streaming ? '...' : '➤'}
          </button>
        </form>
      </main>
    </div>
  )
}
