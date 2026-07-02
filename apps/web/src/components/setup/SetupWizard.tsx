'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SystemConfig } from '@ai-dm/shared'
import { api } from '@/lib/api'
import { loadSession, saveSession } from '@/lib/session'

type Step = 'system' | 'character' | 'adventure'

type SystemOption = { id: string; name: string; sourceType: string; config: SystemConfig | null }

const SOURCE_TYPE_HINT: Record<string, string> = {
  FREE: 'Narração livre, sem sistema oficial',
  SRD: 'Regras oficiais de um sistema conhecido',
  UPLOAD: 'Sistema customizado enviado por um usuário',
}

function randomGuestId() {
  return `guest_${Math.random().toString(36).slice(2, 10)}@aidm.local`
}

export function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('system')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [userId, setUserId] = useState('')
  const [characterId, setCharacterId] = useState('')

  const [systems, setSystems] = useState<SystemOption[]>([])
  const [systemsError, setSystemsError] = useState(false)
  const [system, setSystem] = useState<SystemOption | null>(null)

  const [charData, setCharData] = useState({ name: '', gender: '', race: '', class: '' })
  const [attrs, setAttrs] = useState<Record<string, number>>({})
  const [adventureTitle, setAdventureTitle] = useState('')

  useEffect(() => {
    const session = loadSession()
    if (session?.userId) {
      setUserId(session.userId)
    } else {
      const email = randomGuestId()
      api.createUser(email, 'Jogador').then(user => {
        setUserId(user.id)
        saveSession({ userId: user.id, userName: 'Jogador', characterId: '', characterName: '', adventureId: '' })
      })
    }
    api.listSystems().then(setSystems).catch(() => setSystemsError(true))
  }, [])

  function handleSelectSystem(s: SystemOption) {
    setSystem(s)
    setAttrs(Object.fromEntries((s.config?.attributes ?? []).map(a => [a.key, a.default])))
    setStep('character')
  }

  async function handleCharacter(e: React.FormEvent) {
    e.preventDefault()
    if (!system) return
    setLoading(true); setError('')
    try {
      const char = await api.createCharacter({ userId, systemId: system.id, ...charData, attributes: attrs })
      setCharacterId(char.id)
      setStep('adventure')
    } catch { setError('Erro ao criar personagem. Tenta novamente.') }
    finally { setLoading(false) }
  }

  async function handleAdventure(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const adv = await api.createAdventure(characterId, adventureTitle || 'Primeira Aventura')
      saveSession({
        userId,
        userName: charData.name,
        characterId,
        characterName: charData.name,
        adventureId: adv.id,
      })
      router.push(`/play/${adv.id}?characterId=${characterId}`)
    } catch { setError('Erro ao criar aventura.') }
    finally { setLoading(false) }
  }

  const inputClass = 'w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-3 py-2 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500'

  const attrInput = (attr: NonNullable<SystemConfig['attributes']>[number]) => (
    <div key={attr.key} className="flex flex-col gap-1">
      <label className="text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wider">{attr.label}</label>
      <input
        type="number" min={attr.min} max={attr.max}
        value={attrs[attr.key] ?? attr.default}
        onChange={e => setAttrs(p => ({ ...p, [attr.key]: Number(e.target.value) }))}
        className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-2 py-1 text-center text-stone-900 dark:text-white"
      />
    </div>
  )

  const steps: Step[] = ['system', 'character', 'adventure']

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-stone-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${step === s ? 'bg-amber-500' : i < steps.indexOf(step) ? 'bg-amber-700' : 'bg-stone-300 dark:bg-stone-700'}`} />
          ))}
        </div>

        {error && <p className="text-red-600 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 rounded p-3">{error}</p>}

        {step === 'system' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Escolha o Sistema</h1>
            <div className="space-y-3">
              {systems.map(s => (
                <button key={s.id} type="button" onClick={() => handleSelectSystem(s)}
                  className="w-full text-left bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-4 py-3 hover:border-amber-500">
                  <p className="font-semibold text-stone-900 dark:text-white">{s.name}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{SOURCE_TYPE_HINT[s.sourceType] ?? s.sourceType}</p>
                </button>
              ))}
              {systemsError
                ? <p className="text-red-600 dark:text-red-400 text-sm">Não foi possível carregar os sistemas. Recarrega a página.</p>
                : systems.length === 0 && <p className="text-stone-500 dark:text-stone-400 text-sm">A carregar sistemas...</p>}
            </div>
          </div>
        )}

        {step === 'character' && system && (
          <form onSubmit={handleCharacter} className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Crie o seu Personagem</h1>
            <p className="text-stone-500 dark:text-stone-400 text-sm">Sistema: {system.name}</p>
            <div className="space-y-3">
              <input required placeholder="Nome do personagem"
                value={charData.name} onChange={e => setCharData(p => ({...p, name: e.target.value}))}
                className={inputClass} />
              <div className="grid grid-cols-2 gap-3">
                <input required placeholder="Género (ex: Feminino)"
                  value={charData.gender} onChange={e => setCharData(p => ({...p, gender: e.target.value}))}
                  className="bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-3 py-2 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500" />
                <input required placeholder="Raça (ex: Elfa)"
                  value={charData.race} onChange={e => setCharData(p => ({...p, race: e.target.value}))}
                  className="bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-3 py-2 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500" />
              </div>
              <input required placeholder="Classe (ex: Maga, Guerreiro)"
                value={charData.class} onChange={e => setCharData(p => ({...p, class: e.target.value}))}
                className={inputClass} />
            </div>
            <p className="text-stone-500 dark:text-stone-400 text-sm">Atributos:</p>
            <div className="grid grid-cols-3 gap-3">
              {(system.config?.attributes ?? []).map(attrInput)}
            </div>
            <button type="submit" disabled={loading || !userId}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded py-2 font-semibold">
              {loading ? 'A criar...' : 'Continuar →'}
            </button>
          </form>
        )}

        {step === 'adventure' && system && (
          <form onSubmit={handleAdventure} className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Inicie a sua Aventura</h1>
            <div className="space-y-3">
              <input placeholder="Título da primeira aventura (opcional)"
                value={adventureTitle} onChange={e => setAdventureTitle(e.target.value)}
                className={inputClass} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded py-2 font-semibold">
              {loading ? 'A iniciar...' : '⚔ Começar a jogar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
