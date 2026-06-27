'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { loadSession, saveSession } from '@/lib/session'

type Step = 'character' | 'campaign'

function randomGuestId() {
  return `guest_${Math.random().toString(36).slice(2, 10)}@aidm.local`
}

export function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('character')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [userId, setUserId] = useState('')
  const [characterId, setCharacterId] = useState('')

  const [charData, setCharData] = useState({
    name: '', gender: '', race: '', class: '',
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  })
  const [campData, setCampData] = useState({ name: '', systemId: 'system-free' })
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
  }, [])

  async function handleCharacter(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const char = await api.createCharacter({ userId, ...charData })
      setCharacterId(char.id)
      setStep('campaign')
    } catch { setError('Erro ao criar personagem. Tenta novamente.') }
    finally { setLoading(false) }
  }

  async function handleCampaign(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const camp = await api.createCampaign(userId, campData.name, campData.systemId)
      await api.joinCampaign(camp.id, characterId)
      const adv = await api.createAdventure(camp.id, adventureTitle || 'Primeira Aventura')
      saveSession({
        userId,
        userName: charData.name,
        characterId,
        characterName: charData.name,
        adventureId: adv.id,
      })
      router.push(`/play/${adv.id}?characterId=${characterId}`)
    } catch { setError('Erro ao criar campanha.') }
    finally { setLoading(false) }
  }

  const inputClass = 'w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-3 py-2 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500'

  const attr = (label: string, key: keyof typeof charData) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wider">{label}</label>
      <input
        type="number" min={3} max={20}
        value={charData[key] as number}
        onChange={e => setCharData(p => ({ ...p, [key]: Number(e.target.value) }))}
        className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-2 py-1 text-center text-stone-900 dark:text-white"
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-stone-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="flex gap-2 mb-8">
          {(['character', 'campaign'] as Step[]).map((s, i) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${step === s ? 'bg-amber-500' : i < (['character', 'campaign'] as Step[]).indexOf(step) ? 'bg-amber-700' : 'bg-stone-300 dark:bg-stone-700'}`} />
          ))}
        </div>

        {error && <p className="text-red-600 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 rounded p-3">{error}</p>}

        {step === 'character' && (
          <form onSubmit={handleCharacter} className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Crie o seu Personagem</h1>
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
            <p className="text-stone-500 dark:text-stone-400 text-sm">Atributos (1–20):</p>
            <div className="grid grid-cols-3 gap-3">
              {attr('Força', 'strength')}
              {attr('Destreza', 'dexterity')}
              {attr('Constituição', 'constitution')}
              {attr('Inteligência', 'intelligence')}
              {attr('Sabedoria', 'wisdom')}
              {attr('Carisma', 'charisma')}
            </div>
            <button type="submit" disabled={loading || !userId}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded py-2 font-semibold">
              {loading ? 'A criar...' : 'Continuar →'}
            </button>
          </form>
        )}

        {step === 'campaign' && (
          <form onSubmit={handleCampaign} className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Inicie a sua Aventura</h1>
            <div className="space-y-3">
              <input required placeholder="Nome da campanha (ex: A Floresta Esquecida)"
                value={campData.name} onChange={e => setCampData(p => ({...p, name: e.target.value}))}
                className={inputClass} />
              <select value={campData.systemId} onChange={e => setCampData(p => ({...p, systemId: e.target.value}))}
                className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-3 py-2 text-stone-900 dark:text-white">
                <option value="system-free">Free — narração livre, sem sistema oficial</option>
                <option value="system-dnd5e">D&D 5e SRD — regras do Dungeons & Dragons</option>
              </select>
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
