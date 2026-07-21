'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { InitialAdventureHook, SystemConfig } from '@ai-dm/shared'
import { api } from '@/lib/api'

type Step = 'system' | 'race-class' | 'attributes' | 'skills' | 'background' | 'review'
const steps: Step[] = ['system', 'race-class', 'attributes', 'skills', 'background', 'review']
const STEP_LABEL: Record<Step, string> = {
  system: 'Sistema',
  'race-class': 'Raça/Classe',
  attributes: 'Atributos',
  skills: 'Perícias',
  background: 'Background',
  review: 'Revisão',
}

const GENDERS = ['Feminino', 'Masculino', 'Não-binário'] as const
const RACES = ['Anão', 'Meio-Orc', 'Elfo', 'Halfling', 'Humano', 'Dragonborn', 'Gnomo', 'Meio-Elfo', 'Tiefling'] as const
const CLASSES = ['Bárbaro', 'Bardo', 'Clérigo', 'Druida', 'Guerreiro', 'Monge', 'Paladino', 'Patrulheiro', 'Ladino', 'Feiticeiro', 'Bruxo', 'Mago'] as const

// Custo acumulado por valor (point-buy 5e). Não é linear: 13→14 e 14→15 custam 2 cada.
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9, 16: 11, 17: 13, 18: 15 }

type SystemOption = { id: string; name: string; sourceType: string; config: SystemConfig | null }

const SOURCE_TYPE_HINT: Record<string, string> = {
  FREE: 'Narração livre, sem sistema oficial',
  SRD: 'Regras oficiais de um sistema conhecido',
  UPLOAD: 'Sistema customizado enviado por um usuário',
}

// US-40: campo único "Divindade/Patrono" → {name, portfolio}. Split na PRIMEIRA
// vírgula: antes = name, depois (trim) = portfolio. Sem vírgula → só name.
// Vazio → undefined (sem objeto). Vírgulas seguintes ficam dentro do portfolio.
function parseDeity(raw: string): { name: string; portfolio?: string } | undefined {
  const text = raw.trim()
  if (!text) return undefined
  const comma = text.indexOf(',')
  if (comma === -1) return { name: text }
  const name = text.slice(0, comma).trim()
  if (!name) return undefined
  const portfolio = text.slice(comma + 1).trim()
  return portfolio ? { name, portfolio } : { name }
}

export function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('system')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [systems, setSystems] = useState<SystemOption[]>([])
  const [systemsError, setSystemsError] = useState(false)
  const [system, setSystem] = useState<SystemOption | null>(null)

  const [charData, setCharData] = useState({ name: '', gender: '', race: '', class: '' })
  const [attrs, setAttrs] = useState<Record<string, number>>({})
  // US-27: keys de perícia marcadas como proficientes (lista fechada do config).
  const [skills, setSkills] = useState<string[]>([])
  // US-39: background narrativo. Textareas em string; ideais/vínculos/fraquezas = um por linha.
  // US-40: `deity` é um campo único de texto livre ("Divindade/Patrono"), parseado na 1ª vírgula.
  const [bg, setBg] = useState({ story: '', ideals: '', bonds: '', flaws: '', deity: '' })

  // US-28: depois de confirmar o personagem, mostramos a etapa "Aventura inicial".
  const [charId, setCharId] = useState('')
  const [hook, setHook] = useState<InitialAdventureHook | null>(null)
  const [hookError, setHookError] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    // US-61: a identidade vem do login (token); o wizard só carrega o catálogo.
    // O toque cedo no banco (listSystems) segue servindo de warm-up (US-57).
    api.listSystems().then(setSystems).catch(() => setSystemsError(true))
  }, [])

  const attributes = system?.config?.attributes ?? []
  const budget = system?.config?.pointBuy?.budget
  // US-27: catálogo de perícias e nº de proficiências a escolher, vindos do config.
  const skillCatalog = system?.config?.skills ?? []
  const skillChoices = system?.config?.proficiency?.choices ?? 0
  const attrLabel = Object.fromEntries(attributes.map(a => [a.key, a.label]))
  // Custo é relativo ao default: o valor inicial de cada atributo é grátis (começa 27/27).
  const spent = attributes.reduce((s, a) => s + ((POINT_COST[attrs[a.key] ?? a.default] ?? 0) - (POINT_COST[a.default] ?? 0)), 0)
  const remaining = budget !== undefined ? budget - spent : 0

  function handleSelectSystem(s: SystemOption) {
    setSystem(s)
    setAttrs(Object.fromEntries((s.config?.attributes ?? []).map(a => [a.key, a.default])))
    setStep('race-class')
  }

  function canAdvance(s: Step): boolean {
    switch (s) {
      case 'system': return !!system
      case 'race-class':
        return charData.name.trim() !== ''
          && (GENDERS as readonly string[]).includes(charData.gender)
          && (RACES as readonly string[]).includes(charData.race)
          && (CLASSES as readonly string[]).includes(charData.class)
      case 'attributes': return budget === undefined || remaining === 0
      // Sem perícias no config → etapa livre; senão exige exatamente `skillChoices`.
      case 'skills': return skillChoices === 0 || skills.length === skillChoices
      case 'background': return true // opcional (US-39): pode seguir em branco
      case 'review': return true
    }
  }

  function goTo(target: Step) {
    // Só navega para etapas já concluídas (índice antes da atual).
    if (steps.indexOf(target) < steps.indexOf(step)) setStep(target)
  }

  function next() {
    const i = steps.indexOf(step)
    if (canAdvance(step) && i < steps.length - 1) setStep(steps[i + 1]!)
  }

  function back() {
    const i = steps.indexOf(step)
    if (i > 0) setStep(steps[i - 1]!)
  }

  async function handleConfirm() {
    if (!system) return
    setLoading(true); setError('')
    try {
      // US-39: uma linha por item em ideais/vínculos/fraquezas; vazios descartados (o backend também normaliza).
      const lines = (s: string) => s.split('\n').map(t => t.trim()).filter(Boolean)
      const background = { story: bg.story.trim() || undefined, ideals: lines(bg.ideals), bonds: lines(bg.bonds), flaws: lines(bg.flaws), deity: parseDeity(bg.deity) }
      // US-61: `userId` não vai no corpo — a API deriva o dono do token.
      const char = await api.createCharacter({ systemId: system.id, ...charData, attributes: attrs, skills, background })
      // Personagem já está salvo: guardamos o id e passamos à etapa de aventura inicial.
      setCharId(char.id)
      loadHook(char.id)
    } catch { setError('Erro ao criar personagem. Tenta novamente.') }
    finally { setLoading(false) }
  }

  function loadHook(id: string) {
    setHookError(false)
    api.getInitialAdventure(id).then(setHook).catch(() => setHookError(true))
  }

  async function startAdventure() {
    if (!hook) return
    setStarting(true); setError('')
    try {
      const adv = await api.createAdventure(charId, hook.id)
      router.push(`/play/${adv.id}?characterId=${charId}`)
    } catch { setError('Erro ao iniciar a aventura. Tenta novamente.'); setStarting(false) }
  }

  // US-27: marca/desmarca proficiência; bloqueia marcar além do orçamento.
  function toggleSkill(key: string) {
    setSkills(p => {
      if (p.includes(key)) return p.filter(k => k !== key)
      if (p.length >= skillChoices) return p
      return [...p, key]
    })
  }

  function setAttr(key: string, delta: number, min: number, max: number) {
    setAttrs(p => {
      const current = p[key] ?? min
      const nextVal = current + delta
      if (nextVal < min || nextVal > max) return p
      // Point-buy: não deixa o gasto exceder o orçamento.
      if (budget !== undefined) {
        const cost = (POINT_COST[nextVal] ?? 0) - (POINT_COST[current] ?? 0)
        if (remaining - cost < 0) return p
      }
      return { ...p, [key]: nextVal }
    })
  }

  const inputClass = 'w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-3 py-2 text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-stone-400'
  const selectClass = 'w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-3 py-2 text-stone-900 dark:text-white'
  // US-46: rótulo visível persistente (não some ao digitar; contraste AA).
  const labelClass = 'block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1'

  const idx = steps.indexOf(step)

  // US-28: etapa "Aventura inicial" — personagem já criado, escolhemos o gancho da classe.
  if (charId) {
    return (
      <div className="min-h-screen bg-amber-50 dark:bg-stone-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <p className="text-xs uppercase tracking-wide text-stone-600 dark:text-stone-400">Aventura inicial</p>
          {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 rounded p-3">{error}</p>}

          {hookError ? (
            <div className="space-y-4">
              <p className="text-stone-600 dark:text-stone-300 text-sm">Não foi possível carregar a aventura inicial de <span className="font-semibold">{charData.name}</span>.</p>
              <button type="button" onClick={() => loadHook(charId)}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded py-2 font-semibold">
                Tentar de novo
              </button>
            </div>
          ) : !hook ? (
            <p className="text-stone-600 dark:text-stone-400 text-sm animate-pulse">A preparar a tua aventura…</p>
          ) : (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">{hook.title}</h1>
              <p className="text-stone-600 dark:text-stone-400 text-sm">A primeira aventura de {charData.name}, {charData.class}.</p>
              <div className="bg-white/50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 rounded p-4 space-y-3">
                <p className="text-stone-700 dark:text-stone-300 text-sm">{hook.pitch}</p>
                <p className="text-stone-800 dark:text-stone-100 text-sm italic leading-relaxed whitespace-pre-wrap">{hook.openingNarration}</p>
              </div>
              <button type="button" onClick={startAdventure} disabled={starting}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded py-2 font-semibold">
                {starting ? 'A iniciar...' : 'Iniciar aventura'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-stone-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Trilha de progresso navegável: etapas concluídas são clicáveis. */}
        <nav className="flex gap-2 mb-8" aria-label="Progresso">
          {steps.map((s, i) => {
            const state = s === step ? 'atual' : i < idx ? 'concluída' : 'pendente'
            return (
              <button
                key={s} type="button"
                onClick={() => goTo(s)}
                disabled={state === 'pendente'}
                aria-current={state === 'atual' ? 'step' : undefined}
                data-state={state}
                className="flex-1 flex flex-col gap-1 text-left disabled:cursor-default"
              >
                <span className={`h-1 rounded-full ${state === 'atual' ? 'bg-amber-500' : state === 'concluída' ? 'bg-amber-700' : 'bg-stone-300 dark:bg-stone-700'}`} />
                <span className={`text-[10px] ${state === 'pendente' ? 'text-stone-600 dark:text-stone-400' : 'text-stone-600 dark:text-stone-300'}`}>{STEP_LABEL[s]}</span>
              </button>
            )
          })}
        </nav>

        {error && <p className="text-red-600 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 rounded p-3">{error}</p>}

        {step === 'system' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Escolha o Sistema</h1>
            <div className="space-y-3">
              {systems.map(s => (
                <button key={s.id} type="button" onClick={() => handleSelectSystem(s)}
                  className={`w-full text-left bg-white dark:bg-stone-800 border rounded px-4 py-3 hover:border-amber-500 ${system?.id === s.id ? 'border-amber-500' : 'border-stone-300 dark:border-stone-600'}`}>
                  <p className="font-semibold text-stone-900 dark:text-white">{s.name}</p>
                  <p className="text-sm text-stone-600 dark:text-stone-400">{SOURCE_TYPE_HINT[s.sourceType] ?? s.sourceType}</p>
                </button>
              ))}
              {systemsError
                ? <p className="text-red-600 dark:text-red-400 text-sm">Não foi possível carregar os sistemas. Recarrega a página.</p>
                : systems.length === 0 && <p className="text-stone-600 dark:text-stone-400 text-sm">A carregar sistemas...</p>}
            </div>
          </div>
        )}

        {step === 'race-class' && system && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Raça e Classe</h1>
            <p className="text-stone-600 dark:text-stone-400 text-sm">Sistema: {system.name}</p>
            <div className="space-y-3">
              {/* US-46: rótulo visível persistente acima de cada campo — placeholder deixa de ser o único rótulo. */}
              <div>
                <label htmlFor="char-name" className={labelClass}>Nome do personagem</label>
                <input id="char-name" required placeholder="Ex.: Lyra Silvermoon"
                  value={charData.name} onChange={e => setCharData(p => ({ ...p, name: e.target.value }))}
                  className={inputClass} />
              </div>
              <div>
                <label htmlFor="char-gender" className={labelClass}>Género</label>
                <select id="char-gender" value={charData.gender}
                  onChange={e => setCharData(p => ({ ...p, gender: e.target.value }))} className={selectClass}>
                  <option value="">Selecionar…</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="char-race" className={labelClass}>Raça</label>
                  <select id="char-race" value={charData.race}
                    onChange={e => setCharData(p => ({ ...p, race: e.target.value }))} className={selectClass}>
                    <option value="">Selecionar…</option>
                    {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="char-class" className={labelClass}>Classe</label>
                  <select id="char-class" value={charData.class}
                    onChange={e => setCharData(p => ({ ...p, class: e.target.value }))} className={selectClass}>
                    <option value="">Selecionar…</option>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'attributes' && system && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Atributos</h1>
            {budget !== undefined && (
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Pontos restantes: <span className={`font-semibold ${remaining === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{remaining}</span> / {budget}
              </p>
            )}
            <div className="space-y-2">
              {attributes.map(a => (
                <div key={a.key} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-stone-700 dark:text-stone-300">{a.label}</label>
                  {budget !== undefined ? (
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={`Diminuir ${a.label}`} onClick={() => setAttr(a.key, -1, a.min, a.max)}
                        className="w-8 h-8 rounded bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-white disabled:opacity-40"
                        disabled={(attrs[a.key] ?? a.default) <= a.min}>−</button>
                      <span className="w-8 text-center font-semibold text-stone-900 dark:text-white" data-attr={a.key}>{attrs[a.key] ?? a.default}</span>
                      <button type="button" aria-label={`Aumentar ${a.label}`} onClick={() => setAttr(a.key, 1, a.min, a.max)}
                        className="w-8 h-8 rounded bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-white disabled:opacity-40"
                        disabled={(attrs[a.key] ?? a.default) >= a.max || remaining - ((POINT_COST[(attrs[a.key] ?? a.default) + 1] ?? 0) - (POINT_COST[attrs[a.key] ?? a.default] ?? 0)) < 0}>+</button>
                    </div>
                  ) : (
                    <input type="number" min={a.min} max={a.max} aria-label={a.label}
                      value={attrs[a.key] ?? a.default}
                      onChange={e => setAttrs(p => ({ ...p, [a.key]: Number(e.target.value) }))}
                      className="w-20 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded px-2 py-1 text-center text-stone-900 dark:text-white" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'skills' && system && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Perícias</h1>
            <p className="text-stone-600 dark:text-stone-400 text-sm">
              Escolhe <span className="font-semibold">{skillChoices}</span> perícias proficientes (+{system.config?.proficiency?.bonus ?? 2} cada).
              Selecionadas: <span className={`font-semibold ${skills.length === skillChoices ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{skills.length}</span>/{skillChoices}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {skillCatalog.map(sk => {
                const on = skills.includes(sk.key)
                const full = !on && skills.length >= skillChoices
                return (
                  <button key={sk.key} type="button" onClick={() => toggleSkill(sk.key)}
                    disabled={full}
                    aria-pressed={on}
                    className={`text-left rounded px-3 py-2 border text-sm disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40' : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 hover:border-amber-500'}`}>
                    <span className="block font-medium text-stone-900 dark:text-white">{sk.label}</span>
                    <span className="block text-xs text-stone-600 dark:text-stone-400">{attrLabel[sk.ability] ?? sk.ability}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 'background' && system && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Background</h1>
            <p className="text-stone-600 dark:text-stone-400 text-sm">
              Quem é {charData.name || 'o personagem'}? O mestre usa isto para dar peso às escolhas. Tudo opcional — um item por linha em ideais, vínculos e fraquezas.
            </p>
            <div className="space-y-3">
              {/* US-46: cada textarea com rótulo visível persistente; placeholder vira só exemplo. */}
              <div>
                <label htmlFor="bg-story" className={labelClass}>História</label>
                <textarea id="bg-story" rows={3} placeholder="Ex.: nobre menor que perdeu a família para um culto demoníaco…"
                  value={bg.story} onChange={e => setBg(p => ({ ...p, story: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="bg-ideals" className={labelClass}>Ideais <span className="font-normal text-stone-600 dark:text-stone-400">— um por linha</span></label>
                <textarea id="bg-ideals" rows={2} placeholder="Ex.: Justiça acima de tudo"
                  value={bg.ideals} onChange={e => setBg(p => ({ ...p, ideals: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="bg-bonds" className={labelClass}>Vínculos <span className="font-normal text-stone-600 dark:text-stone-400">— um por linha</span></label>
                <textarea id="bg-bonds" rows={2} placeholder="Ex.: Jurou vingança contra o culto que matou sua família"
                  value={bg.bonds} onChange={e => setBg(p => ({ ...p, bonds: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="bg-flaws" className={labelClass}>Fraquezas <span className="font-normal text-stone-600 dark:text-stone-400">— uma por linha</span></label>
                <textarea id="bg-flaws" rows={2} placeholder="Ex.: Código de honra rígido: não mente, não abandona inocentes"
                  value={bg.flaws} onChange={e => setBg(p => ({ ...p, flaws: e.target.value }))} className={inputClass} />
              </div>
              {/* US-40: divindade/patrono — campo único, opcional para todas as classes.
                  Nome antes da vírgula, portfólio depois (parseado ao confirmar). */}
              <div>
                <label htmlFor="bg-deity" className={labelClass}>Divindade/Patrono <span className="font-normal text-stone-600 dark:text-stone-400">— nome, e o que representa</span></label>
                <input id="bg-deity" placeholder="Ex.: Auril, deusa do inverno"
                  value={bg.deity} onChange={e => setBg(p => ({ ...p, deity: e.target.value }))} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {step === 'review' && system && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Revisão</h1>
            <dl className="space-y-2 bg-white/50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 rounded p-4 text-sm">
              {[
                ['Nome', charData.name],
                ['Género', charData.gender],
                ['Raça', charData.race],
                ['Classe', charData.class],
                ['Nível', '1'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-stone-600 dark:text-stone-400">{k}</dt>
                  <dd className="text-stone-900 dark:text-white font-medium">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between">
                <dt className="text-stone-600 dark:text-stone-400">Atributos</dt>
                <dd className="text-stone-900 dark:text-white font-medium text-right">
                  {attributes.map(a => `${a.label} ${attrs[a.key] ?? a.default}`).join(' · ')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-600 dark:text-stone-400">Perícias</dt>
                <dd className="text-stone-900 dark:text-white font-medium text-right">
                  {skills.length > 0
                    ? skills.map(k => skillCatalog.find(s => s.key === k)?.label ?? k).join(' · ')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-600 dark:text-stone-400">Background</dt>
                <dd className="text-stone-900 dark:text-white font-medium text-right">
                  {[bg.story, bg.ideals, bg.bonds, bg.flaws, bg.deity].some(s => s.trim()) ? 'Preenchido' : '—'}
                </dd>
              </div>
              {/* US-40: mostra o nome da divindade na revisão quando preenchida. */}
              {parseDeity(bg.deity) && (
                <div className="flex justify-between">
                  <dt className="text-stone-600 dark:text-stone-400">Divindade/Patrono</dt>
                  <dd className="text-stone-900 dark:text-white font-medium text-right">
                    {parseDeity(bg.deity)!.name}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Voltar / Próximo / Confirmar */}
        {step !== 'system' && (
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={back}
              className="flex-1 border border-stone-400 dark:border-stone-600 text-stone-600 dark:text-stone-300 rounded py-2 font-semibold hover:border-stone-600 dark:hover:border-stone-400">
              ← Voltar
            </button>
            {step === 'review' ? (
              <button type="button" onClick={handleConfirm} disabled={loading}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded py-2 font-semibold">
                {loading ? 'A criar...' : 'Confirmar personagem'}
              </button>
            ) : (
              <button type="button" onClick={next} disabled={!canAdvance(step)}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded py-2 font-semibold">
                Próximo →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
