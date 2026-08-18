'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Dices, Minus, Plus } from 'lucide-react'
import {
  abilityModifier, buildSkillSheet, formatModifier, getClassFeatures, getClassSpells,
  getStartingInventory, getBackgroundEquipment, getBackgroundFeatures, MEMENTO_ITEM_LABEL,
  resolveSheetEntries, resolveCharacterFeatures,
  type SystemConfig, type SystemTool,
} from '@ai-dm/shared'
import { api } from '@/lib/api'
import { parseD10Tables } from '@/lib/parseD10Tables'
import { DmButton, FieldLabel, Panel, SceneFrame, SectionTitle, SheetHeading, cn, dmButtonClass, fieldClass } from '@/components/ui/dm'
import { useT, useLocale } from '@/components/LocaleProvider'
import type { MessageKey } from '@/messages'
import { BackgroundPanel, type CharacterBackground } from '@/components/character/BackgroundPanel'
import { FeaturesPanel } from '@/components/character/FeaturesPanel'

// US-123: `background` passou para ANTES de `attributes`/`skills` — mesma ordem do PHB 2024
// (a origem decide o bônus de atributo antes de você alocar pontos). `goTo`/`canAdvance`/
// `next`/`back` operam por índice (ver abaixo), então reordenar este array já reordena a
// trilha e a navegação sem tocar nessas funções.
// US-157: `world` entra ao FINAL, depois de `review` — o registro da aventura (setting/
// tone/areaType) tem ciclo de decisão distinto do personagem, que `review` já fecha.
type Step = 'system' | 'race-class' | 'background' | 'attributes' | 'skills' | 'review' | 'world'
const steps: Step[] = ['system', 'race-class', 'background', 'attributes', 'skills', 'review', 'world']

// US-98: os rótulos de gênero saíram desta lista para o dicionário, mas a lista FICA em
// pt-BR — ela é o `value` que viaja para a API, não o texto da tela.
//
// US-105: raça e classe saíram daqui de vez. Eram listas literais em PT pelo mesmo motivo
// (o CLASS_SYNONYMS da API casava palavra portuguesa), e agora vêm do catálogo do SRD no
// `config` do sistema, já no locale ativo: o `value` é a CHAVE, o texto é o `label`.
// Gênero fica porque não é dado de SRD — não tem catálogo de onde vir.
const GENDERS = ['Feminino', 'Masculino', 'Não-binário'] as const

// Custo acumulado por valor (point-buy 5e). Não é linear: 13→14 e 14→15 custam 2 cada.
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9, 16: 11, 17: 13, 18: 15 }

type SystemOption = { id: string; name: string; sourceType: string; config: SystemConfig | null }

// `sourceType` vem da API como string livre: mapa explícito para MessageKey (e não
// `t(\`setup.system.hint.${x}\`)`) porque um valor novo do backend não pode virar
// chave inexistente em tempo de execução — sem entrada, mostra-se o valor cru.
const SOURCE_TYPE_HINT: Record<string, MessageKey> = {
  FREE: 'setup.system.hint.FREE',
  SRD: 'setup.system.hint.SRD',
  UPLOAD: 'setup.system.hint.UPLOAD',
}

// Seta do select desenhada no próprio campo: `appearance-none` mata a nativa (que
// vinha na cor do sistema operativo e destoava do painel).
const SELECT_ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23b58a5a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

// US-124: exceção pontual do Sailor — bloco único do dataset é semanticamente "Mementos"
// (duplicado, ver US-124 §Contexto), não "Connections". O mapeamento normal é por POSIÇÃO
// (tables[0]=connection, tables[1]=memento) porque o heading não é extraído do Markdown
// (frágil a tradução automática); sem heading, não dá pra corrigir por texto — só por chave
// da origem, que não é traduzida. Curadoria manual pontual, mesmo espírito do overlay
// `kitItems` (US-51): sem entrada aqui, cai no default posicional.
const SINGLE_BLOCK_IS_MEMENTO = new Set(['a5e-ag_sailor'])

// US-124: sorteia uma linha da tabela d10 e devolve o `roll` (não o `text`) — o <select>
// é controlado pelo roll, o texto persistido é derivado dele na hora de enviar. Texto de
// flavor sem efeito de regra: Math.random() no cliente basta, não é dado de mecânica.
function rollRandom(rows: { roll: string; text: string }[], setRoll: (roll: string) => void) {
  if (rows.length === 0) return
  setRoll(rows[Math.floor(Math.random() * rows.length)]!.roll)
}

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

// US-123: selo do bônus de atributo do background — sólido (`+1 origem`) na linha fixa e na
// linha escolhida, fantasma tracejado (`+1 bônus`) nas demais linhas elegíveis enquanto nada
// estiver escolhido. Mesma forma/posição nas duas variantes, só a borda/preenchimento muda.
// `onClick` presente → o SELO em si é o alvo de clique (não a linha inteira): vira <button>.
function AbilityBonusBadge({ variant, label, onClick }: { variant: 'solid' | 'ghost'; label: string; onClick?: () => void }) {
  const className = cn(
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
    variant === 'solid' ? 'border-success/50 bg-success/15 text-success' : 'border-dashed border-border text-muted-foreground',
    onClick && 'cursor-pointer transition-colors hover:border-success/80 hover:bg-success/25',
  )
  if (!onClick) return <span className={className}>{label}</span>
  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  )
}

// US-157: um grupo de rádio do passo `world` (Cenário/Tom/Tipo de Área) — catálogo do
// sistema + "Aleatório". <label> envolve o <input> (rótulo associado, não `div`
// clicável, US-46); `optionCardClass` dá a mesma materialidade de cartão do resto do
// wizard. `sr-only` no input: o cartão inteiro é o alvo de clique/foco visível.
function WorldOptionGroup({ name, legend, randomLabel, catalog, value, onChange }: {
  name: string; legend: string; randomLabel: string
  catalog: { key: string; label: string }[]; value: string; onChange: (key: string) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-parchment">{legend}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[...catalog, { key: 'random', label: randomLabel }].map(entry => (
          <label key={entry.key} className={optionCardClass(value === entry.key)}>
            <input type="radio" name={name} value={entry.key} checked={value === entry.key}
              onChange={() => onChange(entry.key)} className="sr-only" />
            {entry.label}
          </label>
        ))}
      </div>
    </fieldset>
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

// US-39: uma linha por item em ideais/vínculos/fraquezas; vazios descartados (o backend
// também normaliza). Módulo (não local a `handleConfirm`) porque o preview da revisão
// (US-127) precisa do mesmo split para montar o `CharacterBackground` do `BackgroundPanel`.
function lines(s: string): string[] {
  return s.split('\n').map(t => t.trim()).filter(Boolean)
}

// US-132 (design critique 2026-08-14): `grant.chooseFrom` de ferramenta mistura categorias
// (artisan/vehicle/musical-instrument/gaming-set) numa lista só, às vezes 37 chaves em ordem
// alfabética (Guildmember) — agrupar por categoria antes de listar poupa o jogador de ler tudo
// pra achar o tipo que quer. Ordem fixa (não a ordem de `chooseFrom`) pra grupo sair sempre na
// mesma posição entre origens diferentes. `kit`/`navigators_tools`/`thieves_tools` nunca
// aparecem dentro de um `chooseFrom` hoje (só como `fixed`, item já concreto) — sem rótulo
// aqui de propósito, cai no fallback de categoria crua se isso mudar.
const TOOL_CATEGORY_ORDER = ['artisan', 'musical-instrument', 'gaming-set', 'vehicle']
const TOOL_CATEGORY_LABEL: Record<string, MessageKey> = {
  artisan: 'setup.tools.category.artisan',
  'musical-instrument': 'setup.tools.category.musical-instrument',
  'gaming-set': 'setup.tools.category.gaming-set',
  vehicle: 'setup.tools.category.vehicle',
}

function groupToolsByCategory(keys: string[], catalog: SystemTool[]): [string, SystemTool[]][] {
  const byKey = new Map(catalog.map(tl => [tl.key, tl]))
  const groups = new Map<string, SystemTool[]>()
  for (const key of keys) {
    const entry = byKey.get(key)
    if (!entry) continue
    const list = groups.get(entry.category) ?? []
    list.push(entry)
    groups.set(entry.category, list)
  }
  return TOOL_CATEGORY_ORDER
    .filter(cat => groups.has(cat))
    .map((cat): [string, SystemTool[]] => [cat, groups.get(cat)!])
}

export function SetupWizard() {
  const t = useT()
  const { locale } = useLocale()
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
  // US-122: origem escolhida do catálogo (US-121) — estado PRÓPRIO, distinto de `bg`. Os
  // dois não compartilham objeto de propósito (US-122 §Nomenclatura: campos que não se tocam).
  const [origin, setOrigin] = useState<string | undefined>(undefined)
  // US-124: linha escolhida (o `roll`, "1".."10") em cada bloco de connection_and_memento —
  // o <select> é controlado pelo roll; o TEXTO persistido é derivado dele (connectionText/
  // mementoText abaixo), não guardado aqui. Resetados junto com `origin` (mesmo motivo:
  // dependem da origem escolhida) e ao trocar de sistema.
  const [connectionRoll, setConnectionRoll] = useState<string | undefined>(undefined)
  const [mementoRoll, setMementoRoll] = useState<string | undefined>(undefined)
  // US-123: atributo escolhido para o `+1` livre do `grant.kind === 'ability'` da origem —
  // resetado junto com `origin` (mesmo motivo de connectionRoll/mementoRoll acima).
  const [abilityChoice, setAbilityChoice] = useState<string | undefined>(undefined)
  // US-131: perícia(s) escolhida(s) do `grant.chooseFrom` do `grant.kind === 'skills'` da
  // origem — ARRAY (não uma string), porque `chooseCount` pode ser > 1 (Guildmember real,
  // "Two of your choice"). Resetado junto com `origin`, mesmo motivo de abilityChoice acima.
  const [skillChoice, setSkillChoice] = useState<string[]>([])
  // US-132: ferramenta(s) escolhida(s) do `grant.chooseFrom` do `grant.kind === 'tools'` da
  // origem — mesmo padrão de skillChoice, mas a ESCOLHA acontece nesta MESMA etapa
  // (`background`), não numa etapa própria (não existe etapa `tools`/`equipment` no wizard).
  const [toolChoice, setToolChoice] = useState<string[]>([])

  // US-28/US-157: depois de confirmar o personagem, o wizard avança para o passo `world`.
  const [charId, setCharId] = useState('')
  const [starting, setStarting] = useState(false)
  // US-157: sentinela 'random' só no estado do componente — nunca serializado no DTO
  // (ver createWorldAdventure). Estado inicial: os três em Aleatório.
  const [setting, setSetting] = useState('random')
  const [tone, setTone] = useState('random')
  const [areaType, setAreaType] = useState('random')

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
  // US-105: catálogos de raça e classe do sistema escolhido, no locale ativo. O `value` do
  // select é `key`; o texto é `label`. Catálogo fechado: sem opção "outra" e sem campo livre.
  const raceCatalog = system?.config?.races ?? []
  const classCatalog = system?.config?.classes ?? []
  // US-122: catálogo de origens (backgrounds do A5E, US-121). Ausente → seção "Origem" não
  // aparece e a etapa `background` segue livre, mesmo padrão condicional de skillCatalog acima.
  const backgroundCatalog = system?.config?.backgrounds ?? []
  // US-157: catálogos do registro da aventura (US-156) — mesmo padrão de raceCatalog/
  // classCatalog acima, consumidos só no passo `world`.
  const settingCatalog = system?.config?.settings ?? []
  const toneCatalog = system?.config?.tones ?? []
  const areaTypeCatalog = system?.config?.areaTypes ?? []
  // Rótulo da escolha atual, para a revisão e para o subtítulo do gancho — a chave nunca
  // aparece na tela.
  const raceLabel = raceCatalog.find(r => r.key === charData.race)?.label ?? ''
  const classLabel = classCatalog.find(c => c.key === charData.class)?.label ?? ''
  // Background usa `name`, não `label` (SystemBackgroundSchema, US-121) — catalogLabel não serve.
  const originLabel = backgroundCatalog.find(o => o.key === origin)?.name ?? ''
  // US-124: benefícios narrativos da origem escolhida — `adventures_and_advancement` (parágrafo)
  // e `connection_and_memento` (tabelas d10, parseadas só quando o benefício existe).
  const originBenefits = backgroundCatalog.find(o => o.key === origin)?.benefits ?? []
  // US-123: bônus de atributo do background, se o ingest reconheceu o padrão de `ability_score`.
  const abilityGrant = originBenefits.find(b => b.grant?.kind === 'ability')?.grant
  // US-131: perícias do background, se o ingest reconheceu o padrão de `skill_proficiency`.
  // `skillBenefit` guarda name/description JÁ resolvidos (texto do dataset, ex. "Skill
  // Proficiencies: Deception, and either Culture, Insight, or Sleight of Hand.") — o aviso na
  // etapa `background` reaproveita esse texto em vez de reconstruir a frase a partir do grant.
  const skillBenefit = originBenefits.find(b => b.grant?.kind === 'skills')
  const skillGrant = skillBenefit?.grant?.kind === 'skills' ? skillBenefit.grant : undefined
  // Chaves que a origem já concede (fixas + escolhidas) — excluídas do catálogo da etapa
  // `skills` (evita duplicar) e somadas às `choices` da classe na revisão.
  const originSkillKeys = skillGrant ? [...skillGrant.fixed, ...skillChoice] : []
  const skillLabel = Object.fromEntries(skillCatalog.map(sk => [sk.key, sk.label]))
  // US-132: ferramenta/veículo do background, se o ingest reconheceu o padrão de
  // `tool_proficiency` (US-132 §Modelo de dados). Mesmo par benefit/grant de skillBenefit
  // acima, mas a escolha acontece NESTA etapa (background) — não existe etapa `tools` própria.
  const toolBenefit = originBenefits.find(b => b.grant?.kind === 'tools')
  const toolGrant = toolBenefit?.grant?.kind === 'tools' ? toolBenefit.grant : undefined
  const toolCatalog = system?.config?.tools ?? []
  const toolLabel = Object.fromEntries(toolCatalog.map(tl => [tl.key, tl.label]))
  const adventuresBenefit = originBenefits.find(b => b.type === 'adventures_and_advancement')
  const camBenefit = originBenefits.find(b => b.type === 'connection_and_memento')
  const camTables = camBenefit ? parseD10Tables(camBenefit.description).tables : []
  // Mapeamento bloco→campo por POSIÇÃO (heading não é extraído do Markdown, ver acima);
  // exceção do Sailor via SINGLE_BLOCK_IS_MEMENTO, não por texto.
  const singleIsMemento = camTables.length === 1 && !!origin && SINGLE_BLOCK_IS_MEMENTO.has(origin)
  const connectionTable = camTables.length === 1 ? (singleIsMemento ? undefined : camTables[0]) : camTables[0]
  const mementoTable = camTables.length === 1 ? (singleIsMemento ? camTables[0] : undefined) : camTables[1]
  const connectionText = connectionTable?.rows.find(r => r.roll === connectionRoll)?.text
  const mementoText = mementoTable?.rows.find(r => r.roll === mementoRoll)?.text
  const attrLabel = Object.fromEntries(attributes.map(a => [a.key, a.label]))
  // Custo é relativo ao default: o valor inicial de cada atributo é grátis (começa 27/27).
  const spent = attributes.reduce((s, a) => s + ((POINT_COST[attrs[a.key] ?? a.default] ?? 0) - (POINT_COST[a.default] ?? 0)), 0)
  const remaining = budget !== undefined ? budget - spent : 0

  // US-127: preview do que a ficha vai mostrar depois de confirmar — as MESMAS funções de
  // @ai-dm/shared que a criação usa para persistir (`getStartingInventory`/`getClassFeatures`/
  // `getClassSpells`) e que a leitura usa para resolver (`resolveSheetEntries`), para o preview
  // nunca divergir do que a API salva e do que a GameView mostra depois (US-45/US-41).
  const previewKit = system?.config ? getStartingInventory(system.config, charData.class) : []
  // US-128: equipamento da origem + memento somados ao kit da classe, mesma regra de
  // AdventureService.createForCharacter — o preview não pode divergir do que a API grava.
  // Memento aqui é o RÓTULO FIXO (MEMENTO_ITEM_LABEL), não o mementoText (texto completo,
  // que já tem linha própria mais abaixo); gate é `mementoText` truthy, mesma condição do
  // `originPayload.memento` que handleConfirm envia.
  const previewOriginEquipment = system?.config && origin ? getBackgroundEquipment(system.config, origin) : []
  const previewFullKit = [
    ...previewKit,
    ...previewOriginEquipment,
    ...(mementoText ? [{ name: MEMENTO_ITEM_LABEL[locale], qty: 1 }] : []),
  ]
  // US-135: as chaves de origem (getBackgroundFeatures) somam às de classe assim que `origin.key`
  // está preenchido — resolveCharacterFeatures resolve as duas contra a união dos catálogos,
  // mesma função que a criação/ficha/prompt usam (ver US-135 §Notas de implementação).
  const previewFeatureKeys = system?.config
    ? [...getClassFeatures(system.config, charData.class), ...getBackgroundFeatures(system.config, origin)]
    : []
  const previewFeatures = system?.config
    ? resolveCharacterFeatures(system.config, charData.class, origin, previewFeatureKeys)
    : []
  const previewSpellKeys = system?.config ? getClassSpells(system.config, charData.class) : []
  const previewSpells = system?.config
    ? resolveSheetEntries(system.config.classSpells, system.config.retiredSpells, charData.class, previewSpellKeys)
    : []
  // Bloco "Features e magias" só existe se o config modela esse eixo — mesmo padrão
  // condicional de `backgroundCatalog.length > 0` para a linha "Origem".
  const hasClassAwareness = Boolean(system?.config?.classFeatures || system?.config?.classSpells)
  // PV inicial: mesma conta de adventure.service.ts (10 + mod de Constituição) — a Fase 1 não
  // tem dado de vida por classe, então a fórmula é igual para qualquer classe.
  const conMod = abilityModifier(attrs['constitution'] ?? 10)
  const previewHp = 10 + conMod
  // Só as perícias ESCOLHIDAS, com modificador já resolvido — mesmo `buildSkillSheet` da
  // ficha, filtrado ao que o jogador marcou (a revisão não lista o catálogo inteiro).
  // US-131: soma as da origem (`originSkillKeys`) às da etapa `skills` — a revisão espelha a
  // ficha completa que a API vai persistir (US-127), não só a parte escolhida na última etapa.
  const reviewSkills = buildSkillSheet(skillCatalog, attrs, [...originSkillKeys, ...skills], system?.config?.proficiency?.bonus ?? 2)
    .filter(sk => sk.proficient)
  // US-132: ferramenta(s) fixa(s) + escolhida(s) da origem, já resolvidas pro rótulo — mesma
  // forma que a API vai persistir (Character.tools), pro preview não divergir do salvo.
  const reviewToolKeys = toolGrant ? [...toolGrant.fixed, ...toolChoice] : []
  const reviewTools = reviewToolKeys.map(k => toolLabel[k] ?? k)
  // Mesma forma que `handleConfirm` envia à API — reaproveitada aqui para o `BackgroundPanel`
  // (US-45) mostrar por extenso o que vai ser salvo, em vez de "Preenchido"/"—".
  const reviewBackground: CharacterBackground = {
    story: bg.story.trim() || undefined,
    ideals: lines(bg.ideals),
    bonds: lines(bg.bonds),
    flaws: lines(bg.flaws),
    deity: parseDeity(bg.deity),
  }

  function handleSelectSystem(s: SystemOption) {
    setSystem(s)
    setAttrs(Object.fromEntries((s.config?.attributes ?? []).map(a => [a.key, a.default])))
    // US-105: raça e classe passaram a depender do sistema (o catálogo vem do config dele).
    // Voltar e trocar de sistema tem de limpá-las, senão fica selecionada uma chave que o
    // catálogo novo não tem — e o `canAdvance` deixaria passar o que a API vai rejeitar.
    setCharData(p => ({ ...p, race: '', class: '' }))
    // US-122: origem também depende do catálogo do sistema — mesmo motivo do reset acima.
    setOrigin(undefined)
    // US-124: conexão/memento dependem da origem — mesmo motivo.
    setConnectionRoll(undefined)
    setMementoRoll(undefined)
    // US-123: bônus de atributo depende da origem — mesmo motivo.
    setAbilityChoice(undefined)
    // US-131: perícia(s) da origem dependem da origem — mesmo motivo.
    setSkillChoice([])
    // US-132: ferramenta(s) da origem dependem da origem — mesmo motivo.
    setToolChoice([])
    setStep('race-class')
  }

  function canAdvance(s: Step): boolean {
    switch (s) {
      case 'system': return !!system
      case 'race-class':
        return charData.name.trim() !== ''
          && (GENDERS as readonly string[]).includes(charData.gender)
          && raceCatalog.some(r => r.key === charData.race)
          && classCatalog.some(c => c.key === charData.class)
      // US-123: além do point-buy fechado, background com grant.kind === 'ability' exige
      // uma linha escolhida para o +1 livre (a linha fixa não conta, é automática).
      case 'attributes':
        return (budget === undefined || remaining === 0) && (abilityGrant?.kind !== 'ability' || !!abilityChoice)
      // Sem perícias no config → etapa livre; senão exige exatamente `skillChoices`. US-131:
      // além disso, background com grant.kind === 'skills' exige as `chooseCount` chaves da
      // origem (mesmo espírito do bônus de atributo, mas aqui a escolha acontece nesta etapa,
      // não na `background` — perícia de origem e perícia de classe ficam na mesma tela).
      case 'skills':
        return (skillChoices === 0 || skills.length === skillChoices)
          && (!skillGrant || skillGrant.chooseCount === 0 || skillChoice.length === skillGrant.chooseCount)
      // Origem, conexão e memento são opcionais — etapa `background` não bloqueia o avanço por
      // causa deles (mesmo espírito de US-39: texto livre também é opcional). A escolha do
      // grant de PERÍCIA acontece na etapa `skills` (ver acima), não aqui — mesmo padrão do
      // bônus de atributo, cujo aviso também é só informativo nesta etapa.
      // US-132: a escolha do grant de FERRAMENTA é diferente — acontece NESTA etapa (não há
      // etapa `tools` própria pra adiar, ver §Onde aparece na criação e na ficha), por isso
      // bloqueia o avanço até `toolChoice` ter exatamente `chooseCount` chaves.
      case 'background':
        return !toolGrant || toolGrant.chooseCount === 0 || toolChoice.length === toolGrant.chooseCount
      case 'review': return true
      // US-157: Cenário/Tom/Tipo de Área são opcionais (Aleatório é uma escolha válida) —
      // o passo `world` nunca bloqueia; o footer usa `createWorldAdventure`, não `next()`.
      case 'world': return true
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
      const background = { story: bg.story.trim() || undefined, ideals: lines(bg.ideals), bonds: lines(bg.bonds), flaws: lines(bg.flaws), deity: parseDeity(bg.deity) }
      // US-122: origem é campo IRMÃO de background, nunca aninhado nele — a chave viaja sozinha.
      // US-124: connection/memento viajam junto (mesmo objeto), texto derivado do roll escolhido.
      // US-123: abilityChoice viaja junto — undefined quando a origem não tem grant.kind 'ability'.
      // US-131: skillChoice idem, para grant.kind 'skills' — [] vira undefined (nada a validar).
      // US-132: toolChoice idem, para grant.kind 'tools' — [] vira undefined (nada a validar).
      const originPayload = origin
        ? { key: origin, connection: connectionText, memento: mementoText, abilityChoice, skillChoice: skillChoice.length > 0 ? skillChoice : undefined, toolChoice: toolChoice.length > 0 ? toolChoice : undefined }
        : undefined
      // US-61: `userId` não vai no corpo — a API deriva o dono do token.
      const char = await api.createCharacter({ systemId: system.id, ...charData, attributes: attrs, skills, background, origin: originPayload })
      // Personagem já está salvo: guardamos o id e avançamos ao passo `world` (US-157).
      setCharId(char.id)
      setStep('world')
    } catch { setError(t('setup.error.create')) }
    finally { setLoading(false) }
  }

  // US-157: cada grupo em Aleatório OMITE o campo — nunca envia a chave "random" (mesma
  // disciplina de ausência = aleatório da US-156).
  async function createWorldAdventure() {
    setStarting(true); setError('')
    try {
      const dto = {
        ...(setting !== 'random' && { setting }),
        ...(tone !== 'random' && { tone }),
        ...(areaType !== 'random' && { areaType }),
      }
      const adv = await api.createAdventure(charId, dto)
      router.push(`/play/${adv.id}?characterId=${charId}`)
    } catch { setError(t('setup.error.start')); setStarting(false) }
  }

  // US-27: marca/desmarca proficiência; bloqueia marcar além do orçamento.
  function toggleSkill(key: string) {
    setSkills(p => {
      if (p.includes(key)) return p.filter(k => k !== key)
      if (p.length >= skillChoices) return p
      return [...p, key]
    })
  }

  // US-131: marca/desmarca perícia do grant.chooseFrom da origem — mesmo padrão de
  // toggleSkill, mas limitado a grant.chooseCount (não a skillChoices da classe).
  function toggleSkillChoice(key: string) {
    setSkillChoice(p => {
      if (p.includes(key)) return p.filter(k => k !== key)
      if (!skillGrant || p.length >= skillGrant.chooseCount) return p
      return [...p, key]
    })
  }

  // US-132 (design critique 2026-08-14): grant de ferramenta virou 1 <select> por slot de
  // `chooseCount` (0..chooseCount-1) em vez de cartão clicável — substitui toggleToolChoice.
  // `filter(Boolean)` compacta buracos; limpar um slot do meio quando chooseCount é 2 (só Folk
  // Hero hoje) pode reindexar o valor do slot seguinte — sem perda de dado, teto aceito pro
  // chooseCount máximo observado (2). Revisitar se algum background pedir 3+.
  function setToolChoiceAt(index: number, key: string) {
    setToolChoice(p => {
      const next = [...p]
      next[index] = key
      return next.filter(Boolean)
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

  // US-107: saída da criação, em TODAS as etapas — inclusive a primeira, onde o
  // rodapé "Voltar" nem existe. Fica acima da trilha e não no slot esquerdo do
  // rodapé de propósito: lá o mesmo pixel alternaria entre "voltar uma etapa" e
  // "sair da tela", que são destinos diferentes. `<Link>` e não `router.push` — dá
  // meio-clique, abrir noutro separador e foco de teclado sem código. Nada por
  // gravar se perde: o wizard só cria no `handleConfirm`.
  const exitToHub = (
    <Link href="/" className={dmButtonClass('ghost', 'mb-4 self-start px-3 text-xs')}>
      <ArrowLeft className="size-4" aria-hidden />
      {t('setup.exit')}
    </Link>
  )

  // Sem seletor de idioma: a criação herda o idioma já ativo no hub de personagens.
  return (
    <SceneFrame scene="/scenes/tavern.png" dim="heavy" localeToggle={false}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6">

        {exitToHub}

        {/* Trilha de progresso navegável: etapas concluídas são clicáveis.
            US-66: no mobile as 7 barras ficam, mas os rótulos escondem (`hidden sm:block`)
            e um rótulo único "Etapa X de N — Label" resume a etapa atual — sem espremer
            rótulos de 10px lado a lado. A partir de `sm:` volta a trilha completa. */}
        <nav className="mb-6" aria-label={t('setup.progress')}>
          <p className="mb-2 text-sm font-medium text-parchment sm:hidden">
            {t('setup.stepOf', { n: idx + 1, total: steps.length, label: t(`setup.step.${step}`) })}
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
                  <span className={`hidden sm:block text-xs ${state === 'atual' ? 'font-semibold text-primary' : state === 'concluída' ? 'text-parchment' : 'text-muted-foreground'}`}>{t(`setup.step.${s}`)}</span>
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
                <SectionTitle>{t('setup.system.titulo')}</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">{t('setup.system.subtitulo')}</p>
                <div className="mt-6 flex flex-col gap-3">
                  {systems.map(s => {
                    const hint = SOURCE_TYPE_HINT[s.sourceType]
                    return (
                    <button key={s.id} type="button" onClick={() => handleSelectSystem(s)} className={optionCardClass(system?.id === s.id)}>
                      <p className="font-serif text-base font-semibold text-parchment">{s.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{hint ? t(hint) : s.sourceType}</p>
                    </button>
                    )
                  })}
                  {systemsError
                    ? <p className="text-sm text-destructive">{t('setup.system.error')}</p>
                    : systems.length === 0 && <p className="text-sm text-muted-foreground">{t('setup.system.loading')}</p>}
                </div>
              </div>
            )}

            {step === 'race-class' && system && (
              <div>
                <SectionTitle>{t('setup.raceClass.titulo')}</SectionTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t('setup.raceClass.system', { name: system.name })}</p>
                <div className="mt-6 space-y-4">
                  {/* US-46: rótulo visível persistente acima de cada campo — placeholder deixa de ser o único rótulo. */}
                  <div>
                    <FieldLabel htmlFor="char-name">{t('setup.raceClass.name')}</FieldLabel>
                    <input id="char-name" required placeholder={t('setup.raceClass.namePlaceholder')}
                      value={charData.name} onChange={e => setCharData(p => ({ ...p, name: e.target.value }))}
                      className={fieldClass()} />
                  </div>
                  {/* US-98: `value` em pt-BR (é o que a API entende), rótulo traduzido. */}
                  <div>
                    <FieldLabel htmlFor="char-gender">{t('setup.raceClass.gender')}</FieldLabel>
                    <select id="char-gender" value={charData.gender}
                      onChange={e => setCharData(p => ({ ...p, gender: e.target.value }))}
                      className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                      <option value="">{t('setup.raceClass.select')}</option>
                      {GENDERS.map(g => <option key={g} value={g}>{t(`setup.gender.${g}`)}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="char-race">{t('setup.raceClass.race')}</FieldLabel>
                      <select id="char-race" value={charData.race}
                        onChange={e => setCharData(p => ({ ...p, race: e.target.value }))}
                        className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                        <option value="">{t('setup.raceClass.select')}</option>
                        {/* US-142: raiz COM subespécie deixa de ser <option> solta — o SRD já
                            documenta a variante, então "só a raiz" some e vira só o <optgroup>
                            com a(s) subespécie(s) dentro (resolve também a duplicação visual
                            "raiz" solta + "raiz" repetida no heading do grupo, US-140). Raiz SEM
                            subespécie continua <option> solta normal, sem grupo. */}
                        {raceCatalog.filter(r => !r.parentKey).map(root => {
                          const subspecies = raceCatalog.filter(r => r.parentKey === root.key)
                          if (subspecies.length === 0) {
                            return <option key={root.key} value={root.key}>{root.label}</option>
                          }
                          return (
                            <optgroup key={root.key} label={root.label}>
                              {subspecies.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </optgroup>
                          )
                        })}
                      </select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="char-class">{t('setup.raceClass.class')}</FieldLabel>
                      <select id="char-class" value={charData.class}
                        onChange={e => setCharData(p => ({ ...p, class: e.target.value }))}
                        className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                        <option value="">{t('setup.raceClass.select')}</option>
                        {classCatalog.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 'attributes' && system && (
              <div>
                <SectionTitle>{t('setup.attributes.titulo')}</SectionTitle>
                {budget !== undefined && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('setup.attributes.remaining')} <span className={`font-semibold ${remaining === 0 ? 'text-success' : 'text-primary'}`}>{remaining}</span> / {budget}
                  </p>
                )}
                {/* US-123: banner reforça o que a etapa `background` já anunciou — só quando a
                    origem tem grant.kind === 'ability'. Mesmo padrão visual dos avisos do wizard. */}
                {abilityGrant?.kind === 'ability' && (
                  <p className="mt-4 flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {t('setup.attributes.abilityBanner', { origin: originLabel, attr: attrLabel[abilityGrant.fixed] ?? abilityGrant.fixed })}
                  </p>
                )}
                {/* Agrupado por `divide` em vez de card por linha (direção §4: menos box-in-box). */}
                <div className="mt-6 divide-y divide-border">
                  {attributes.map(a => {
                    // US-123: a linha fixa (grant.fixed) é sempre sólida e nunca clicável. A
                    // linha escolhida também é sólida, mas clicável (clique de novo desmarca).
                    // As demais permanecem clicáveis mesmo sem selo — troca direta entre linhas
                    // sem precisar desmarcar antes (ver critério de aceite da US-123).
                    const isFixed = abilityGrant?.kind === 'ability' && a.key === abilityGrant.fixed
                    const isChosen = abilityGrant?.kind === 'ability' && a.key === abilityChoice
                    const clickable = abilityGrant?.kind === 'ability' && !isFixed
                    const bonus = isFixed || isChosen ? 1 : 0
                    const toggle = () => setAbilityChoice(c => (c === a.key ? undefined : a.key))
                    return (
                      <div key={a.key} className="flex items-center justify-between gap-3 py-3">
                        <span className="flex items-center gap-2">
                          <label className="text-sm font-medium text-foreground">{a.label}</label>
                          {isFixed && <AbilityBonusBadge variant="solid" label={t('setup.attributes.abilityBadgeFixed')} />}
                          {isChosen && <AbilityBonusBadge variant="solid" label={t('setup.attributes.abilityBadgeFixed')} onClick={toggle} />}
                          {clickable && !isChosen && !abilityChoice && <AbilityBonusBadge variant="ghost" label={t('setup.attributes.abilityBadgeGhost')} onClick={toggle} />}
                        </span>
                        {budget !== undefined ? (
                          <div className="flex items-center gap-2">
                            <button type="button" aria-label={t('setup.attributes.decrease', { label: a.label })} onClick={() => setAttr(a.key, -1, a.min, a.max)}
                              className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-background/60 text-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-35"
                              disabled={(attrs[a.key] ?? a.default) <= a.min}><Minus className="size-4" aria-hidden /></button>
                            <span className="w-8 text-center font-serif text-lg font-bold tabular-nums text-parchment" data-attr={a.key}>{(attrs[a.key] ?? a.default) + bonus}</span>
                            <button type="button" aria-label={t('setup.attributes.increase', { label: a.label })} onClick={() => setAttr(a.key, 1, a.min, a.max)}
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
                    )
                  })}
                </div>
              </div>
            )}

            {step === 'skills' && system && (
              <div>
                <SectionTitle>{t('setup.skills.titulo')}</SectionTitle>
                {/* US-131: perícias do background — a origem já avisou (etapa `background`,
                    texto informativo) o que ela concede; a ESCOLHA em si acontece aqui, mesmo
                    padrão do bônus de atributo (aviso na `background`, escolha na `attributes`).
                    `fixed` pré-marcado e não-clicável, `chooseFrom` clicável até `chooseCount`. */}
                {skillGrant && (
                  <div className="mt-4">
                    <SheetHeading>{t('setup.skills.originGrant', { origin: originLabel })}</SheetHeading>
                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {skillGrant.fixed.map(key => (
                        <div key={key} className={optionCardClass(true)}>
                          <span className="block text-sm font-medium text-foreground">{skillLabel[key] ?? key}</span>
                        </div>
                      ))}
                      {skillGrant.chooseCount > 0 && skillGrant.chooseFrom.map(key => {
                        const on = skillChoice.includes(key)
                        const full = !on && skillChoice.length >= skillGrant.chooseCount
                        return (
                          <button key={key} type="button" onClick={() => toggleSkillChoice(key)}
                            disabled={full}
                            aria-pressed={on}
                            className={optionCardClass(on)}>
                            <span className="block text-sm font-medium text-foreground">{skillLabel[key] ?? key}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* US-98: o número deixou de ser um <span> no meio da frase (concatenação
                    que quebra noutra ordem de palavras); o destaque fica na contagem. */}
                <p className="mt-6 text-sm text-muted-foreground">
                  {t('setup.skills.instructions', { n: skillChoices, bonus: system.config?.proficiency?.bonus ?? 2 })}{' '}
                  {t('setup.skills.selected')} <span className={`font-semibold ${skills.length === skillChoices ? 'text-success' : 'text-primary'}`}>{skills.length}</span>/{skillChoices}
                </p>
                <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {/* US-131: exclui as perícias já concedidas pela origem (fixas + escolhida) —
                      evita duplicar; `skillChoices` (contagem) segue sendo só a parte da classe. */}
                  {skillCatalog.filter(sk => !originSkillKeys.includes(sk.key)).map(sk => {
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
                <SectionTitle>{t('setup.background.titulo')}</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('setup.background.subtitulo', { name: charData.name || t('setup.background.defaultName') })}
                </p>
                {/* US-122: select de origem do catálogo (US-121) — só o nome, mesmo padrão de
                    Raça/Classe (US-105). Acima dos campos de texto livre. Sem catálogo no
                    config, o campo nem renderiza. */}
                {backgroundCatalog.length > 0 && (
                  <div className="mt-6">
                    <FieldLabel htmlFor="char-origin">{t('setup.origin.titulo')}</FieldLabel>
                    <select id="char-origin" value={origin ?? ''}
                      onChange={e => {
                        setOrigin(e.target.value || undefined)
                        // US-124: conexão/memento são da origem ANTERIOR — trocar de origem invalida a escolha.
                        setConnectionRoll(undefined)
                        setMementoRoll(undefined)
                        // US-123: o bônus de atributo também é da origem ANTERIOR — mesmo motivo.
                        setAbilityChoice(undefined)
                        // US-131: as perícias escolhidas também são da origem ANTERIOR — mesmo motivo.
                        setSkillChoice([])
                        // US-132: a(s) ferramenta(s) escolhida(s) também são da origem ANTERIOR — mesmo motivo.
                        setToolChoice([])
                      }}
                      className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                      <option value="">{t('setup.raceClass.select')}</option>
                      {backgroundCatalog.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
                    </select>
                  </div>
                )}
                {/* US-123: aviso do bônus de atributo — só informativo, a escolha do +1 livre
                    acontece na etapa `attributes` (o jogador ainda não alocou point-buy aqui). */}
                {abilityGrant?.kind === 'ability' && (
                  <p className="mt-4 text-sm text-foreground">
                    {t('setup.origin.abilityGrant', { attr: attrLabel[abilityGrant.fixed] ?? abilityGrant.fixed })}
                  </p>
                )}
                {/* US-131: perícias do background — só o AVISO aqui, texto CRU do dataset já
                    resolvido (`skillBenefit.name`/`description`, ex. "Skill Proficiencies:
                    Deception, and either Culture, Insight, or Sleight of Hand."), mesmo padrão
                    do aviso de abilityGrant acima. A ESCOLHA em si acontece na etapa `skills`. */}
                {skillBenefit && (
                  <p className="mt-4 text-sm text-foreground">
                    {skillBenefit.name}: {skillBenefit.description}
                  </p>
                )}
                {/* US-132: ferramenta/veículo do background — ao contrário do bônus de atributo
                    e de perícia (só aviso aqui, escolha adiada pra outra etapa), a ESCOLHA
                    acontece NESTA MESMA etapa: não existe etapa `tools`/`equipment` própria pra
                    adiar (US-132 §Onde aparece na criação e na ficha). `fixed` é só texto (nada
                    a escolher); `chooseFrom` vira <select> agrupado por categoria — design
                    critique 2026-08-14: cartão clicável não escala pros grants com dezenas de
                    opções (Guildmember chega a 37), e a ordem alfabética crua embaralhava
                    categoria (veículo entre ferramenta de artesão). Um <select> por slot de
                    `chooseCount` (Folk Hero é o único caso com 2 hoje), cada slot excluindo a
                    chave já usada nos outros pra não deixar repetir. */}
                {toolGrant && (
                  <div className="mt-4">
                    <SheetHeading>{t('setup.origin.toolGrant', { origin: originLabel })}</SheetHeading>
                    {toolGrant.fixed.length > 0 && (
                      <ul className="space-y-0.5 text-sm text-foreground">
                        {toolGrant.fixed.map(key => <li key={key}>{toolLabel[key] ?? key}</li>)}
                      </ul>
                    )}
                    {Array.from({ length: toolGrant.chooseCount }, (_, slotIndex) => {
                      const chosenElsewhere = toolChoice.filter((_, j) => j !== slotIndex)
                      const groups = groupToolsByCategory(
                        toolGrant.chooseFrom.filter(key => !chosenElsewhere.includes(key)),
                        toolCatalog,
                      )
                      const selectLabel = toolGrant.chooseCount > 1
                        ? `${t('setup.origin.toolGrant', { origin: originLabel })} (${slotIndex + 1}/${toolGrant.chooseCount})`
                        : t('setup.origin.toolGrant', { origin: originLabel })
                      return (
                        <select key={slotIndex} aria-label={selectLabel} value={toolChoice[slotIndex] ?? ''}
                          onChange={e => setToolChoiceAt(slotIndex, e.target.value)}
                          className={cn(selectClass, 'mt-3')} style={{ backgroundImage: SELECT_ARROW }}>
                          <option value="">{t('setup.raceClass.select')}</option>
                          {groups.map(([category, entries]) => (
                            <optgroup key={category} label={TOOL_CATEGORY_LABEL[category] ? t(TOOL_CATEGORY_LABEL[category]) : category}>
                              {entries.map(entry => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      )
                    })}
                  </div>
                )}
                {/* US-124: benefícios narrativos da origem — adventures_and_advancement como
                    parágrafo (mesmo padrão de hook.openingNarration) e connection_and_memento
                    como seleção por bloco. Título/subtítulo da seleção são FIXOS (i18n), não
                    vêm do heading/preâmbulo do dataset (frágil a tradução automática). */}
                {adventuresBenefit && (
                  <div className="mt-6">
                    <SheetHeading>{adventuresBenefit.name}</SheetHeading>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{adventuresBenefit.description}</p>
                  </div>
                )}
                {(connectionTable || mementoTable) && (
                  <div className="mt-6 space-y-4">
                    {connectionTable && (
                      <div>
                        <FieldLabel htmlFor="char-connection">{t('setup.origin.connection')}</FieldLabel>
                        <p className="mb-1.5 text-xs text-muted-foreground">{t('setup.origin.pickHint')}</p>
                        <div className="flex gap-2">
                          <select id="char-connection" value={connectionRoll ?? ''}
                            onChange={e => setConnectionRoll(e.target.value || undefined)}
                            className={cn(selectClass, 'flex-1')} style={{ backgroundImage: SELECT_ARROW }}>
                            <option value="">{t('setup.raceClass.select')}</option>
                            {connectionTable.rows.map(r => <option key={r.roll} value={r.roll}>{r.text}</option>)}
                          </select>
                          <DmButton type="button" variant="ghost" onClick={() => rollRandom(connectionTable.rows, setConnectionRoll)}>
                            <Dices className="size-4" aria-hidden />
                            {t('setup.origin.random')}
                          </DmButton>
                        </div>
                      </div>
                    )}
                    {mementoTable && (
                      <div>
                        <FieldLabel htmlFor="char-memento">{t('setup.origin.memento')}</FieldLabel>
                        <p className="mb-1.5 text-xs text-muted-foreground">{t('setup.origin.pickHint')}</p>
                        <div className="flex gap-2">
                          <select id="char-memento" value={mementoRoll ?? ''}
                            onChange={e => setMementoRoll(e.target.value || undefined)}
                            className={cn(selectClass, 'flex-1')} style={{ backgroundImage: SELECT_ARROW }}>
                            <option value="">{t('setup.raceClass.select')}</option>
                            {mementoTable.rows.map(r => <option key={r.roll} value={r.roll}>{r.text}</option>)}
                          </select>
                          <DmButton type="button" variant="ghost" onClick={() => rollRandom(mementoTable.rows, setMementoRoll)}>
                            <Dices className="size-4" aria-hidden />
                            {t('setup.origin.random')}
                          </DmButton>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-6 space-y-4">
                  {/* US-46: cada textarea com rótulo visível persistente; placeholder vira só exemplo. */}
                  <div>
                    <FieldLabel htmlFor="bg-story">{t('setup.background.story')}</FieldLabel>
                    <textarea id="bg-story" rows={3} placeholder={t('setup.background.storyPlaceholder')}
                      value={bg.story} onChange={e => setBg(p => ({ ...p, story: e.target.value }))} className={fieldClass('resize-y')} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="bg-ideals">{t('setup.background.ideals')}</FieldLabel>
                    <textarea id="bg-ideals" rows={2} placeholder={t('setup.background.idealsPlaceholder')}
                      value={bg.ideals} onChange={e => setBg(p => ({ ...p, ideals: e.target.value }))} className={fieldClass('resize-y')} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="bg-bonds">{t('setup.background.bonds')}</FieldLabel>
                    <textarea id="bg-bonds" rows={2} placeholder={t('setup.background.bondsPlaceholder')}
                      value={bg.bonds} onChange={e => setBg(p => ({ ...p, bonds: e.target.value }))} className={fieldClass('resize-y')} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="bg-flaws">{t('setup.background.flaws')}</FieldLabel>
                    <textarea id="bg-flaws" rows={2} placeholder={t('setup.background.flawsPlaceholder')}
                      value={bg.flaws} onChange={e => setBg(p => ({ ...p, flaws: e.target.value }))} className={fieldClass('resize-y')} />
                  </div>
                  {/* US-40: divindade/patrono — campo único, opcional para todas as classes.
                      Nome antes da vírgula, portfólio depois (parseado ao confirmar). */}
                  <div>
                    <FieldLabel htmlFor="bg-deity">{t('setup.background.deity')}</FieldLabel>
                    <input id="bg-deity" placeholder={t('setup.background.deityPlaceholder')}
                      value={bg.deity} onChange={e => setBg(p => ({ ...p, deity: e.target.value }))} className={fieldClass()} />
                  </div>
                </div>
              </div>
            )}

            {step === 'review' && system && (
              <div>
                <SectionTitle>{t('setup.review.titulo')}</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">{t('setup.review.subtitulo')}</p>
                <dl className="mt-6 divide-y divide-border">
                  {/* US-98: o VALOR de gênero é a chave PT guardada no estado, então a revisão
                      o traduz para exibir — sem tocar no que vai à API.
                      US-105: raça e classe já vêm rotuladas do catálogo, no locale ativo. */}
                  {[
                    [t('setup.review.name'), charData.name],
                    [t('setup.review.gender'), charData.gender && t(`setup.gender.${charData.gender as typeof GENDERS[number]}`)],
                    [t('setup.review.race'), raceLabel],
                    [t('setup.review.class'), classLabel],
                    [t('setup.review.level'), '1'],
                    [t('setup.review.hp'), String(previewHp)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{k}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">{v}</dd>
                    </div>
                  ))}
                  <div className="flex items-start justify-between gap-6 py-2.5">
                    <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.attributes')}</dt>
                    <dd className="text-right text-sm font-medium text-parchment">
                      {attributes.map(a => `${a.label} ${attrs[a.key] ?? a.default} (${formatModifier(abilityModifier(attrs[a.key] ?? a.default))})`).join(' · ')}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-6 py-2.5">
                    <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.skills')}</dt>
                    <dd className="text-right text-sm font-medium text-parchment">
                      {reviewSkills.length > 0
                        ? reviewSkills.map(sk => `${sk.label} (${formatModifier(sk.modifier)})`).join(' · ')
                        : '—'}
                    </dd>
                  </div>
                  {/* US-132: linha própria, condicionada a haver grant.kind 'tools' na origem
                      escolhida — mesma condição de escopo do backgroundCatalog/connectionTable
                      abaixo (US-132 §Onde aparece na criação e na ficha). */}
                  {toolGrant && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.tools')}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">
                        {reviewTools.length > 0 ? reviewTools.join(' · ') : '—'}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-6 py-2.5">
                    <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.kit')}</dt>
                    <dd className="text-right text-sm font-medium text-parchment">
                      {previewFullKit.map(i => i.qty > 1 ? `${i.name} (${i.qty})` : i.name).join(' · ')}
                    </dd>
                  </div>
                  {/* US-122: linha própria da origem — só aparece quando o sistema tem catálogo
                      (mesma condição da seção na etapa). O `BackgroundPanel` abaixo não repete
                      a origem: ela já tem casa aqui. */}
                  {backgroundCatalog.length > 0 && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.origin')}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">{originLabel || '—'}</dd>
                    </div>
                  )}
                  {/* US-124: conexão/memento escolhidos — só quando a origem tem esses blocos
                      (mesma condição da seção na etapa `background`); "—" sem seleção. */}
                  {connectionTable && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.connection')}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">{connectionText || '—'}</dd>
                    </div>
                  )}
                  {mementoTable && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.memento')}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">{mementoText || '—'}</dd>
                    </div>
                  )}
                </dl>

                {/* US-127: background por extenso — mesmo `BackgroundPanel` que a ficha em jogo
                    usa (US-45), com o mesmo dado que `handleConfirm` vai enviar. Substitui o
                    antigo "Preenchido"/"—": o jogador lê a história antes de confirmar. */}
                <div className="mt-6">
                  <SheetHeading>{t('setup.review.background')}</SheetHeading>
                  <BackgroundPanel background={reviewBackground} />
                </div>

                {/* US-127: features de classe e magias conhecidas da classe escolhida — só
                    quando o sistema modela esse eixo (mesmo padrão condicional das outras
                    seções opcionais acima). */}
                {hasClassAwareness && (
                  <div className="mt-6">
                    <FeaturesPanel features={previewFeatures} spells={previewSpells} />
                  </div>
                )}
              </div>
            )}

            {/* US-157: sétimo passo, depois de `review` — substitui a antiga etapa
                "Aventura inicial" (US-28), aposentada junto do gancho fixo por classe. */}
            {step === 'world' && (
              <div>
                <SectionTitle>{t('setup.world.titulo')}</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">{t('setup.world.subtitulo')}</p>
                <div className="mt-6 space-y-6">
                  <WorldOptionGroup name="setting" legend={t('setup.world.setting')} randomLabel={t('setup.world.random')}
                    catalog={settingCatalog} value={setting} onChange={setSetting} />
                  <WorldOptionGroup name="tone" legend={t('setup.world.tone')} randomLabel={t('setup.world.random')}
                    catalog={toneCatalog} value={tone} onChange={setTone} />
                  <WorldOptionGroup name="areaType" legend={t('setup.world.areaType')} randomLabel={t('setup.world.random')}
                    catalog={areaTypeCatalog} value={areaType} onChange={setAreaType} />
                </div>
              </div>
            )}
          </div>

          {/* Voltar / Próximo / Confirmar / Criar aventura */}
          {step !== 'system' && (
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
              <DmButton variant="ghost" type="button" onClick={back}>
                <ArrowLeft className="size-4" aria-hidden />
                {t('setup.back')}
              </DmButton>
              {step === 'review' ? (
                <DmButton type="button" onClick={handleConfirm} disabled={loading}>
                  {loading ? t('setup.confirming') : t('setup.next')}
                  <ArrowRight className="size-4" aria-hidden />
                </DmButton>
              ) : step === 'world' ? (
                <DmButton type="button" onClick={createWorldAdventure} disabled={starting}>
                  <Check className="size-4" aria-hidden />
                  {starting ? t('setup.world.starting') : t('setup.world.start')}
                </DmButton>
              ) : (
                <DmButton type="button" onClick={next} disabled={!canAdvance(step)}>
                  {t('setup.next')}
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
