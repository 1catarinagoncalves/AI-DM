'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Minus, Plus, Sparkles } from 'lucide-react'
import type { InitialAdventureHook, SystemConfig } from '@ai-dm/shared'
import { api } from '@/lib/api'
import { DmButton, FieldLabel, Panel, SceneFrame, SectionTitle, cn, fieldClass } from '@/components/ui/dm'

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

// Seta do select desenhada no próprio campo: `appearance-none` mata a nativa (que
// vinha na cor do sistema operativo e destoava do painel).
const SELECT_ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23b58a5a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

// Cartão de opção (sistema, perícia): a mesma materialidade em toda a escolha
// múltipla do wizard. `selected` acende a borda de acento, `disabled` esmaece.
function optionCardClass(selected: boolean) {
  return cn(
    'w-full rounded-md border px-4 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40',
    selected
      ? 'border-primary bg-primary/10 shadow-[inset_0_0_0_1px_var(--primary)]'
      : 'border-border bg-background/40 hover:border-primary/60 hover:bg-background/70',
  )
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

  const selectClass = fieldClass('appearance-none bg-[right_0.75rem_center] bg-no-repeat pr-9')
  const errorBox = 'rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive'
  // US-46: rótulo visível persistente (não some ao digitar; contraste AA) — o
  // FieldLabel do design system carrega essa regra.

  const idx = steps.indexOf(step)

  // US-28: etapa "Aventura inicial" — personagem já criado, escolhemos o gancho da classe.
  if (charId) {
    return (
      <SceneFrame scene="/scenes/arboretum-moonlit.png" dim="heavy">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
          <Panel className="p-6 sm:p-9">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-accent">
              <Sparkles className="size-3.5" aria-hidden />
              Aventura inicial
            </p>
            {error && <p className={cn(errorBox, 'mt-4')}>{error}</p>}

            {hookError ? (
              <div className="mt-4 space-y-5">
                <p className="text-sm text-muted-foreground">Não foi possível carregar a aventura inicial de <span className="font-semibold text-parchment">{charData.name}</span>.</p>
                <DmButton type="button" onClick={() => loadHook(charId)} className="w-full py-3 text-base">
                  Tentar de novo
                </DmButton>
              </div>
            ) : !hook ? (
              <p className="mt-4 animate-pulse text-sm text-muted-foreground">A preparar a tua aventura…</p>
            ) : (
              <>
                <SectionTitle className="mt-3 sm:text-4xl">{hook.title}</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">A primeira aventura de {charData.name}, {charData.class}.</p>
                <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground">
                  <p>{hook.pitch}</p>
                  <p className="whitespace-pre-wrap italic text-muted-foreground">{hook.openingNarration}</p>
                </div>
                <DmButton type="button" onClick={startAdventure} disabled={starting} className="mt-8 w-full py-3 text-base">
                  {starting ? 'A iniciar...' : 'Iniciar aventura'}
                </DmButton>
              </>
            )}
          </Panel>
        </div>
      </SceneFrame>
    )
  }

  return (
    <SceneFrame scene="/scenes/tavern.png" dim="heavy">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6">

        {/* Trilha de progresso navegável: etapas concluídas são clicáveis.
            US-66: no mobile as 7 barras ficam, mas os rótulos escondem (`hidden sm:block`)
            e um rótulo único "Etapa X de N — Label" resume a etapa atual — sem espremer
            rótulos de 10px lado a lado. A partir de `sm:` volta a trilha completa. */}
        <nav className="mb-6" aria-label="Progresso">
          <p className="mb-2 text-sm font-medium text-parchment sm:hidden">
            Etapa {idx + 1} de {steps.length} — {STEP_LABEL[step]}
          </p>
          <div className="flex gap-2">
            {steps.map((s, i) => {
              const state = s === step ? 'atual' : i < idx ? 'concluída' : 'pendente'
              return (
                <button
                  key={s} type="button"
                  onClick={() => goTo(s)}
                  disabled={state === 'pendente'}
                  aria-current={state === 'atual' ? 'step' : undefined}
                  data-state={state}
                  className="flex flex-1 flex-col gap-1 text-left disabled:cursor-default"
                >
                  <span className={`h-0.5 rounded-full ${state === 'atual' ? 'bg-primary' : state === 'concluída' ? 'bg-primary/40' : 'bg-border'}`} />
                  <span className={`hidden sm:block text-xs ${state === 'atual' ? 'font-semibold text-primary' : state === 'concluída' ? 'text-parchment' : 'text-muted-foreground'}`}>{STEP_LABEL[s]}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <Panel className="flex flex-1 flex-col p-6 sm:p-8">
          {error && <p className={cn(errorBox, 'mb-4')}>{error}</p>}

          <div className="flex-1">
            {step === 'system' && (
              <div>
                <SectionTitle>Escolha o Sistema</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">Define as regras que guiarão a sua jornada.</p>
                <div className="mt-6 flex flex-col gap-3">
                  {systems.map(s => (
                    <button key={s.id} type="button" onClick={() => handleSelectSystem(s)} className={optionCardClass(system?.id === s.id)}>
                      <p className="font-serif text-base font-semibold text-parchment">{s.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{SOURCE_TYPE_HINT[s.sourceType] ?? s.sourceType}</p>
                    </button>
                  ))}
                  {systemsError
                    ? <p className="text-sm text-destructive">Não foi possível carregar os sistemas. Recarrega a página.</p>
                    : systems.length === 0 && <p className="text-sm text-muted-foreground">A carregar sistemas...</p>}
                </div>
              </div>
            )}

            {step === 'race-class' && system && (
              <div>
                <SectionTitle>Raça e Classe</SectionTitle>
                <p className="mt-1 text-sm text-muted-foreground">Sistema: {system.name}</p>
                <div className="mt-6 space-y-4">
                  {/* US-46: rótulo visível persistente acima de cada campo — placeholder deixa de ser o único rótulo. */}
                  <div>
                    <FieldLabel htmlFor="char-name">Nome do personagem</FieldLabel>
                    <input id="char-name" required placeholder="Ex.: Lyra Silvermoon"
                      value={charData.name} onChange={e => setCharData(p => ({ ...p, name: e.target.value }))}
                      className={fieldClass()} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="char-gender">Género</FieldLabel>
                    <select id="char-gender" value={charData.gender}
                      onChange={e => setCharData(p => ({ ...p, gender: e.target.value }))}
                      className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                      <option value="">Selecionar…</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="char-race">Raça</FieldLabel>
                      <select id="char-race" value={charData.race}
                        onChange={e => setCharData(p => ({ ...p, race: e.target.value }))}
                        className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                        <option value="">Selecionar…</option>
                        {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="char-class">Classe</FieldLabel>
                      <select id="char-class" value={charData.class}
                        onChange={e => setCharData(p => ({ ...p, class: e.target.value }))}
                        className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                        <option value="">Selecionar…</option>
                        {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 'attributes' && system && (
              <div>
                <SectionTitle>Atributos</SectionTitle>
                {budget !== undefined && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pontos restantes: <span className={`font-semibold ${remaining === 0 ? 'text-success' : 'text-primary'}`}>{remaining}</span> / {budget}
                  </p>
                )}
                {/* Agrupado por `divide` em vez de card por linha (direção §4: menos box-in-box). */}
                <div className="mt-6 divide-y divide-border">
                  {attributes.map(a => (
                    <div key={a.key} className="flex items-center justify-between gap-3 py-3">
                      <label className="text-sm font-medium text-foreground">{a.label}</label>
                      {budget !== undefined ? (
                        <div className="flex items-center gap-2">
                          <button type="button" aria-label={`Diminuir ${a.label}`} onClick={() => setAttr(a.key, -1, a.min, a.max)}
                            className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-background/60 text-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-35"
                            disabled={(attrs[a.key] ?? a.default) <= a.min}><Minus className="size-4" aria-hidden /></button>
                          <span className="w-8 text-center font-serif text-lg font-bold tabular-nums text-parchment" data-attr={a.key}>{attrs[a.key] ?? a.default}</span>
                          <button type="button" aria-label={`Aumentar ${a.label}`} onClick={() => setAttr(a.key, 1, a.min, a.max)}
                            className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-background/60 text-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-35"
                            disabled={(attrs[a.key] ?? a.default) >= a.max || remaining - ((POINT_COST[(attrs[a.key] ?? a.default) + 1] ?? 0) - (POINT_COST[attrs[a.key] ?? a.default] ?? 0)) < 0}><Plus className="size-4" aria-hidden /></button>
                        </div>
                      ) : (
                        <input type="number" min={a.min} max={a.max} aria-label={a.label}
                          value={attrs[a.key] ?? a.default}
                          onChange={e => setAttrs(p => ({ ...p, [a.key]: Number(e.target.value) }))}
                          className={fieldClass('w-20 text-center')} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'skills' && system && (
              <div>
                <SectionTitle>Perícias</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Escolhe <span className="font-semibold text-parchment">{skillChoices}</span> perícias proficientes (+{system.config?.proficiency?.bonus ?? 2} cada).
                  Selecionadas: <span className={`font-semibold ${skills.length === skillChoices ? 'text-success' : 'text-primary'}`}>{skills.length}</span>/{skillChoices}
                </p>
                <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {skillCatalog.map(sk => {
                    const on = skills.includes(sk.key)
                    const full = !on && skills.length >= skillChoices
                    return (
                      <button key={sk.key} type="button" onClick={() => toggleSkill(sk.key)}
                        disabled={full}
                        aria-pressed={on}
                        className={optionCardClass(on)}>
                        <span className="block text-sm font-medium text-foreground">{sk.label}</span>
                        <span className="block text-xs text-muted-foreground">{attrLabel[sk.ability] ?? sk.ability}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {step === 'background' && system && (
              <div>
                <SectionTitle>Background</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Quem é {charData.name || 'o personagem'}? O mestre usa isto para dar peso às escolhas. Tudo opcional — um item por linha em ideais, vínculos e fraquezas.
                </p>
                <div className="mt-6 space-y-4">
                  {/* US-46: cada textarea com rótulo visível persistente; placeholder vira só exemplo. */}
                  <div>
                    <FieldLabel htmlFor="bg-story">História</FieldLabel>
                    <textarea id="bg-story" rows={3} placeholder="Ex.: nobre menor que perdeu a família para um culto demoníaco…"
                      value={bg.story} onChange={e => setBg(p => ({ ...p, story: e.target.value }))} className={fieldClass('resize-y')} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="bg-ideals">Ideais — um por linha</FieldLabel>
                    <textarea id="bg-ideals" rows={2} placeholder="Ex.: Justiça acima de tudo"
                      value={bg.ideals} onChange={e => setBg(p => ({ ...p, ideals: e.target.value }))} className={fieldClass('resize-y')} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="bg-bonds">Vínculos — um por linha</FieldLabel>
                    <textarea id="bg-bonds" rows={2} placeholder="Ex.: Jurou vingança contra o culto que matou sua família"
                      value={bg.bonds} onChange={e => setBg(p => ({ ...p, bonds: e.target.value }))} className={fieldClass('resize-y')} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="bg-flaws">Fraquezas — uma por linha</FieldLabel>
                    <textarea id="bg-flaws" rows={2} placeholder="Ex.: Código de honra rígido: não mente, não abandona inocentes"
                      value={bg.flaws} onChange={e => setBg(p => ({ ...p, flaws: e.target.value }))} className={fieldClass('resize-y')} />
                  </div>
                  {/* US-40: divindade/patrono — campo único, opcional para todas as classes.
                      Nome antes da vírgula, portfólio depois (parseado ao confirmar). */}
                  <div>
                    <FieldLabel htmlFor="bg-deity">Divindade/Patrono — nome, e o que representa</FieldLabel>
                    <input id="bg-deity" placeholder="Ex.: Auril, deusa do inverno"
                      value={bg.deity} onChange={e => setBg(p => ({ ...p, deity: e.target.value }))} className={fieldClass()} />
                  </div>
                </div>
              </div>
            )}

            {step === 'review' && system && (
              <div>
                <SectionTitle>Revisão</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">Confere a tua ficha antes de embarcar na aventura.</p>
                <dl className="mt-6 divide-y divide-border">
                  {[
                    ['Nome', charData.name],
                    ['Género', charData.gender],
                    ['Raça', charData.race],
                    ['Classe', charData.class],
                    ['Nível', '1'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{k}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">{v}</dd>
                    </div>
                  ))}
                  <div className="flex items-start justify-between gap-6 py-2.5">
                    <dt className="shrink-0 text-sm text-muted-foreground">Atributos</dt>
                    <dd className="text-right text-sm font-medium text-parchment">
                      {attributes.map(a => `${a.label} ${attrs[a.key] ?? a.default}`).join(' · ')}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-6 py-2.5">
                    <dt className="shrink-0 text-sm text-muted-foreground">Perícias</dt>
                    <dd className="text-right text-sm font-medium text-parchment">
                      {skills.length > 0
                        ? skills.map(k => skillCatalog.find(s => s.key === k)?.label ?? k).join(' · ')
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-6 py-2.5">
                    <dt className="shrink-0 text-sm text-muted-foreground">Background</dt>
                    <dd className="text-right text-sm font-medium text-parchment">
                      {[bg.story, bg.ideals, bg.bonds, bg.flaws, bg.deity].some(s => s.trim()) ? 'Preenchido' : '—'}
                    </dd>
                  </div>
                  {/* US-40: mostra o nome da divindade na revisão quando preenchida. */}
                  {parseDeity(bg.deity) && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">Divindade/Patrono</dt>
                      <dd className="text-right text-sm font-medium text-parchment">
                        {parseDeity(bg.deity)!.name}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>

          {/* Voltar / Próximo / Confirmar */}
          {step !== 'system' && (
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
              <DmButton variant="ghost" type="button" onClick={back}>
                <ArrowLeft className="size-4" aria-hidden />
                Voltar
              </DmButton>
              {step === 'review' ? (
                <DmButton type="button" onClick={handleConfirm} disabled={loading}>
                  <Check className="size-4" aria-hidden />
                  {loading ? 'A criar...' : 'Confirmar personagem'}
                </DmButton>
              ) : (
                <DmButton type="button" onClick={next} disabled={!canAdvance(step)}>
                  Próximo
                  <ArrowRight className="size-4" aria-hidden />
                </DmButton>
              )}
            </div>
          )}
        </Panel>
      </div>
    </SceneFrame>
  )
}
