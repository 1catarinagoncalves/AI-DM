'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Dices, Minus, Plus } from 'lucide-react'
import {
  abilityModifier, buildSkillSheet, formatModifier, getClassFeatures, getClassSpells,
  getStartingInventory, getBackgroundEquipment, getBackgroundFeatures, getRaceFeatures,
  getRaceToolEquipment, MEMENTO_ITEM_LABEL, resolveSheetEntries, resolveCharacterFeatures,
  DRACONIC_ANCESTRY_TABLE, DWARF_TOOL_PROFICIENCY_CHOICES, RACE_LANGUAGES, RACE_EXTRA_LANGUAGE_CHOICE,
  RACE_WEAPON_PROFICIENCIES, RACE_TOOL_PROFICIENCIES, RACE_SKILL_PROFICIENCIES, RACE_SKILL_PROFICIENCY_CHOICES,
  type SystemConfig, type SystemTool, type DraconicDamageType, type InitialAdventureHook,
} from '@ai-dm/shared'
import { api } from '@/lib/api'
import { parseD10Tables } from '@/lib/parseD10Tables'
import { DmButton, FieldLabel, Panel, SceneFrame, SectionTitle, SheetHeading, cn, dmButtonClass, fieldClass, optionCardClass } from '@/components/ui/dm'
import { useT, useLocale } from '@/components/LocaleProvider'
import type { MessageKey } from '@/messages'
import { BackgroundPanel, type CharacterBackground } from '@/components/character/BackgroundPanel'
import { FeaturesPanel } from '@/components/character/FeaturesPanel'
import { CatalogCardGroup } from './CatalogCardGroup'
import { AdventureLoadingScreen } from './AdventureLoadingScreen'

// US-123: `background` passou para ANTES de `attributes`/`skills` — mesma ordem do PHB 2024
// (a origem decide o bônus de atributo antes de você alocar pontos). `goTo`/`canAdvance`/
// `next`/`back` operam por índice (ver abaixo), então reordenar este array já reordena a
// trilha e a navegação sem tocar nessas funções.
// US-157: `world` entra ao FINAL, depois de `review` — o registro da aventura (tom, US-173)
// tem ciclo de decisão distinto do personagem, que `review` já fecha.
// US-205 (decisão de 2026-09-02): `race-class` virou `class` + `race` — nome e gênero ficavam
// na primeira (`class`), junto da grade de classe (e a subgrade de subclasse aninhada, quando
// a classe escolhida tem mais de uma); `race` só tem a grade de raça. Etapas seguintes só
// deslocam uma posição, sem mudar de conteúdo. SUPERADO pela US-210 logo abaixo: nome/gênero
// saíram de `class` e moram em `identity` desde então — `class` ficou só com a grade.
// US-213: `spells` entra entre `skills` e `review` — prévia das magias da classe + escolha do
// truque bônus do Alto-elfo (a única escolha real que o sistema de magia awareness-only tem).
// US-210: `identity` entra entre `spells` e `review` — última etapa antes da revisão da ficha,
// com nome, gênero (que saem de `class`, ver parágrafo do US-205 acima) e alinhamento (novo,
// dado de catálogo); ver bloco JSX do `step === 'identity'` mais abaixo.
type Step = 'system' | 'class' | 'race' | 'background' | 'attributes' | 'skills' | 'spells' | 'identity' | 'review' | 'world'
const steps: Step[] = ['system', 'class', 'race', 'background', 'attributes', 'skills', 'spells', 'identity', 'review', 'world']

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

// US-211: as duas entradas de raceFeatures['dragonborn'] que a grade de ancestralidade
// substitui — a tabela crua em markdown e o texto "escolha um tipo de dragão…" ficam
// redundantes assim que a escolha vira card. `breath-weapon`/`damage-resistance` continuam
// no painel (fórmula de dano/CD e a existência da resistência não são explicadas em outro lugar).
const HIDDEN_DRAGONBORN_FEATURE_KEYS = new Set(['draconic-ancestry-table', 'draconic-ancestry'])

// US-211: DRACONIC_ANCESTRY_TABLE (@ai-dm/shared) não tem rótulo embutido — não é conteúdo do
// SRD ingerido, é regra fixa do PHB 2014 (ver draconic-ancestry.ts). Nome e sopro de cada
// dragão viram chave de tradução da UI, mesmo padrão de SOURCE_TYPE_HINT/TOOL_CATEGORY_LABEL.
const DRACONIC_ANCESTRY_COPY: Record<string, { name: MessageKey; blurb: MessageKey }> = {
  black: { name: 'setup.race.draconicAncestry.black.name', blurb: 'setup.race.draconicAncestry.black.blurb' },
  blue: { name: 'setup.race.draconicAncestry.blue.name', blurb: 'setup.race.draconicAncestry.blue.blurb' },
  brass: { name: 'setup.race.draconicAncestry.brass.name', blurb: 'setup.race.draconicAncestry.brass.blurb' },
  bronze: { name: 'setup.race.draconicAncestry.bronze.name', blurb: 'setup.race.draconicAncestry.bronze.blurb' },
  copper: { name: 'setup.race.draconicAncestry.copper.name', blurb: 'setup.race.draconicAncestry.copper.blurb' },
  gold: { name: 'setup.race.draconicAncestry.gold.name', blurb: 'setup.race.draconicAncestry.gold.blurb' },
  green: { name: 'setup.race.draconicAncestry.green.name', blurb: 'setup.race.draconicAncestry.green.blurb' },
  red: { name: 'setup.race.draconicAncestry.red.name', blurb: 'setup.race.draconicAncestry.red.blurb' },
  silver: { name: 'setup.race.draconicAncestry.silver.name', blurb: 'setup.race.draconicAncestry.silver.blurb' },
  white: { name: 'setup.race.draconicAncestry.white.name', blurb: 'setup.race.draconicAncestry.white.blurb' },
}
const DRACONIC_DAMAGE_TYPE_LABEL: Record<DraconicDamageType, MessageKey> = {
  acid: 'setup.race.draconicAncestry.damageType.acid',
  cold: 'setup.race.draconicAncestry.damageType.cold',
  fire: 'setup.race.draconicAncestry.damageType.fire',
  lightning: 'setup.race.draconicAncestry.damageType.lightning',
  poison: 'setup.race.draconicAncestry.damageType.poison',
}

// US-124: sorteia uma linha da tabela d10 e devolve o `roll` (não o `text`) — o <select>
// é controlado pelo roll, o texto persistido é derivado dele na hora de enviar. Texto de
// flavor sem efeito de regra: Math.random() no cliente basta, não é dado de mecânica.
function rollRandom(rows: { roll: string; text: string }[], setRoll: (roll: string) => void) {
  if (rows.length === 0) return
  setRoll(rows[Math.floor(Math.random() * rows.length)]!.roll)
}

// US-123: selo do bônus de atributo do background — sólido na linha fixa e na linha escolhida,
// fantasma tracejado nas demais linhas elegíveis enquanto nada estiver escolhido. Mesmo texto
// (`+1 origem`) nas duas variantes (US-212 unificou com o mesmo padrão do selo de raça) — só a
// borda/preenchimento muda.
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

// US-165: grupo de rádio do passo `world` pro risco de combate (US-161) — 2 valores fixos,
// não catálogo (`challenge` é constante de domínio, não `SystemCatalogEntry`, ver notas de
// implementação da US-165). Cada opção mostra um hint da diferença mecânica (combate
// garantido ou não), não só rótulo — WorldOptionGroup não serve porque sempre acrescenta
// "Aleatório" (fora de escopo aqui) e não tem hint.
function ChallengeOptionGroup({ name, legend, value, onChange, options }: {
  name: string; legend: string; value: string; onChange: (key: string) => void
  options: { key: string; label: string; hint: string }[]
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-parchment">{legend}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map(entry => (
          <label key={entry.key} className={optionCardClass(value === entry.key)}>
            <input type="radio" name={name} value={entry.key} checked={value === entry.key}
              onChange={() => onChange(entry.key)} className="sr-only" />
            <span className="block font-medium">{entry.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{entry.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// US-216: duplicado de apps/api/src/character/starting-inventory.ts (`resolveInitialHook`/
// `resolveHookTemplate`) — web não importa de apps/api (mesma fronteira que impede
// `getStartingInventory` de morar lá, US-127). Função pequena e estável desde a US-54;
// risco de drift aceito, ver *Notas de implementação* da US-216.
function resolveInitialHookLocal(config: SystemConfig, classKey: string): InitialAdventureHook | null {
  const hooks = config.initialAdventures?.hooks
  if (!hooks || hooks.length === 0) return null
  return hooks.find(h => h.classKey === classKey) ?? hooks.find(h => h.classKey === 'default') ?? null
}

function resolveHookTemplateLocal(text: string, vars: { characterName: string; characterClass: string }): string {
  return text
    .replace(/\{characterName\}/g, vars.characterName)
    .replace(/\{characterClass\}/g, vars.characterClass)
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

  // US-210: `alignment`/`appearance`/`personality` somam a `charData` (não estado próprio) —
  // o mesmo spread `...charData` de handleConfirm já os leva ao DTO, sem campo novo lá.
  const [charData, setCharData] = useState({ name: '', gender: '', race: '', class: '', alignment: '', appearance: '', personality: '' })
  // US-205: subclasse escolhida no cartão — só existe estado pra classe com MAIS de uma
  // subclasse (marshal); as outras 12 preenchem sozinhas no service, sem passar por aqui
  // (ver `resolvedSubclass` abaixo). Resetada junto de `class` (subclasse velha não sobrevive
  // à troca de classe) e no reset de sistema (mesmo motivo de race/class).
  const [subclass, setSubclass] = useState<string | undefined>(undefined)
  // US-211: ancestralidade dracônica escolhida — só existe estado pra `dragonborn` (mesmo
  // padrão condicional de `subclass`). Resetada ao trocar de raça/raiz (selectRootCard) e de
  // sistema (mesmo motivo de subclass/race).
  const [draconicAncestry, setDraconicAncestry] = useState<string | undefined>(undefined)
  // Traço "Tool Proficiency" do anão — ferramenta de artesão escolhida, só existe estado pra
  // `hill-dwarf` (mesmo padrão condicional de draconicAncestry acima). Resetada ao trocar de
  // raça/raiz (selectRootCard) e de sistema, mesmo motivo de draconicAncestry.
  const [raceToolChoice, setRaceToolChoice] = useState<string | undefined>(undefined)
  // Traço "Extra Language" do alto-elfo — idioma extra escolhido, só existe estado pra
  // `high-elf` (mesmo padrão condicional de raceToolChoice acima). Resetada ao trocar de
  // raça/raiz (selectRootCard) e de sistema, mesmo motivo de raceToolChoice.
  const [raceLanguageChoice, setRaceLanguageChoice] = useState<string | undefined>(undefined)
  // US-213: truque de mago bônus do traço "cantrip" do Alto-elfo — só existe estado pra
  // `high-elf` (mesmo padrão condicional de raceLanguageChoice acima). Resetada ao trocar de
  // raça/raiz (selectRootCard) e de sistema, mesmo motivo dos campos irmãos.
  const [raceCantripChoice, setRaceCantripChoice] = useState<string | undefined>(undefined)
  // US-212: atributo(s) escolhido(s) para o `choice` do `grant` de RAÇA — array (não string
  // única, como `abilityChoice` de origem) porque `choice.count` pode ser 2 (Meio-Elfo hoje).
  // Resetado ao trocar de raça/variante e de sistema, mesmo motivo de draconicAncestry acima.
  const [raceAbilityChoice, setRaceAbilityChoice] = useState<string[]>([])
  // US-220: perícia(s) escolhida(s) do traço "Skill Versatility" do Meio-elfo — só existe
  // estado pra raça em RACE_SKILL_PROFICIENCY_CHOICES (mesmo padrão condicional de
  // raceToolChoice/raceLanguageChoice acima, mas array: a contagem hoje é 2). Resetada ao
  // trocar de raça/raiz (selectRootCard) e de sistema, mesmo motivo dos campos irmãos.
  const [raceSkillChoice, setRaceSkillChoice] = useState<string[]>([])
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
  // (ver createWorldAdventure). Estado inicial: Aleatório. `setting`/`areaType` voltaram
  // ao registro na US-184, mesmo padrão de `tone`.
  const [setting, setSetting] = useState('random')
  const [tone, setTone] = useState('random')
  const [areaType, setAreaType] = useState('random')
  // US-165: sem sentinela 'random' — Modo aventura é o default real (US-161), não sorteio.
  const [challenge, setChallenge] = useState<'adventure' | 'challenge'>('adventure')
  // US-216: bifurcação do passo `world` — "pronta" pula os grupos abaixo (fica tudo em
  // Aleatório/`adventure`), "criar" é a tela de sempre. `null` até a jogadora escolher: nenhum
  // padrão pré-selecionado (ao contrário de `setting`/`tone`/`areaType`, que defendem 'random').
  const [worldMode, setWorldMode] = useState<'ready' | 'custom' | null>(null)

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
  // US-142 (correção de 2026-09-02): a grade principal só lista RAÍZES — raiz-com-subespécie
  // deixou de ser cabeçalho fixo e virou cartão selecionável (como qualquer outra), com o
  // PRÓPRIO bônus de atributo (`race-bonus.mjs` agora emite isso à parte do total da folha).
  // A escolha da variante vira uma segunda grade condicional, logo abaixo — reverte a decisão
  // original da US-142/US-205 nesse ponto específico (ver backlog do redesenho §Correção de
  // 2026-09-02); `charData.race` continua sempre a chave JOGÁVEL (folha quando há subespécie,
  // raiz quando não — nunca a raiz-com-subespécie, ver validateCatalogKey em character.service.ts).
  const raceRoots = raceCatalog.filter(r => !r.parentKey)
  const selectedRootKey = raceCatalog.find(r => r.key === charData.race)?.parentKey ?? charData.race
  const raceVariants = raceCatalog.filter(r => r.parentKey === selectedRootKey)
  // US-211: cartões da grade de ancestralidade dracônica — mesmos 3 campos que
  // CatalogCardEntry já aceita (label/bonus/blurb), sem mudança no componente.
  const draconicAncestryCards = DRACONIC_ANCESTRY_TABLE.map(d => ({
    key: d.key,
    label: t(DRACONIC_ANCESTRY_COPY[d.key]!.name),
    bonus: t('setup.race.draconicAncestry.resistance', { damageType: t(DRACONIC_DAMAGE_TYPE_LABEL[d.damageType]) }),
    blurb: t(DRACONIC_ANCESTRY_COPY[d.key]!.blurb),
  }))
  const classCatalog = system?.config?.classes ?? []
  // US-210: catálogo de alinhamento (config.alignments, SRD via ingest) — mesmo padrão de
  // raceCatalog/classCatalog acima, consumido só na etapa `identity`.
  const alignmentCatalog = system?.config?.alignments ?? []
  // US-205: subclasses da classe ESCOLHIDA (config.subclasses é por chave de classe, US-141).
  // 0 ou 1 entrada → sem grade (a única, se houver, preenche sozinha); 2+ → grade obrigatória.
  const subclassCatalog = system?.config?.subclasses?.[charData.class]
  // Chave resolvida pra EXIBIÇÃO (painel de detalhe) — espelha a regra do service
  // (character.service.ts): catálogo com 1 entrada só preenche sozinho, sem interação da
  // jogadora; com 2+, é o `subclass` que ela escolheu no cartão.
  const resolvedSubclass = subclassCatalog?.length === 1 ? subclassCatalog[0]!.key : subclass
  const resolvedSubclassEntry = subclassCatalog?.find(s => s.key === resolvedSubclass)
  // US-122: catálogo de origens (backgrounds do A5E, US-121). Ausente → seção "Origem" não
  // aparece e a etapa `background` segue livre, mesmo padrão condicional de skillCatalog acima.
  const backgroundCatalog = system?.config?.backgrounds ?? []
  // US-157: catálogo do registro da aventura (US-156; `settings`/`areaTypes` voltaram na
  // US-184) — mesmo padrão de raceCatalog/classCatalog acima, consumido só no passo `world`.
  const toneCatalog = system?.config?.tones ?? []
  const settingCatalog = system?.config?.settings ?? []
  const areaTypeCatalog = system?.config?.areaTypes ?? []
  // Rótulo da escolha atual, para a revisão e para o subtítulo do gancho — a chave nunca
  // aparece na tela.
  const raceLabel = raceCatalog.find(r => r.key === charData.race)?.label ?? ''
  const classLabel = classCatalog.find(c => c.key === charData.class)?.label ?? ''
  // US-210: rótulo do alinhamento escolhido, mesma disciplina de raceLabel/classLabel acima —
  // a chave (`lawful-good`) nunca aparece na tela, só na revisão como texto no locale ativo.
  const alignmentLabel = alignmentCatalog.find(a => a.key === charData.alignment)?.label ?? ''
  // US-216: gancho da classe do personagem para o cartão de prévia do ramo "pronta" — mesma
  // regra que `resolveInitialHook(config, character.class)` resolveria no backend
  // (buildAdventureProfile, adventure.service.ts), placeholders já resolvidos com o nome e a
  // classe (rótulo, não chave — mesma variável que o backend usa em `resolveHook`).
  const initialHook = system?.config ? resolveInitialHookLocal(system.config, charData.class) : null
  const hookVars = { characterName: charData.name, characterClass: classLabel }
  const initialHookTitle = initialHook ? resolveHookTemplateLocal(initialHook.title, hookVars) : ''
  const initialHookPitch = initialHook ? resolveHookTemplateLocal(initialHook.pitch, hookVars) : ''
  // US-205: rótulo da subclasse resolvida (automática ou escolhida) — mesma disciplina de
  // raceLabel/classLabel acima: a chave nunca aparece na tela.
  const subclassLabel = resolvedSubclassEntry?.label ?? ''
  // US-211: rótulo + resistência da ancestralidade dracônica escolhida, para a revisão e a
  // ficha — a chave (`red`) nunca aparece na tela, mesma disciplina de raceLabel/classLabel.
  const draconicAncestryEntry = DRACONIC_ANCESTRY_TABLE.find(d => d.key === draconicAncestry)
  const draconicAncestryLabel = draconicAncestryEntry ? t(DRACONIC_ANCESTRY_COPY[draconicAncestryEntry.key]!.name) : ''
  const draconicAncestryResistance = draconicAncestryEntry
    ? t('setup.race.draconicAncestry.resistance', { damageType: t(DRACONIC_DAMAGE_TYPE_LABEL[draconicAncestryEntry.damageType]) })
    : ''
  // Background usa `name`, não `label` (SystemBackgroundSchema, US-121) — catalogLabel não serve.
  const originLabel = backgroundCatalog.find(o => o.key === origin)?.name ?? ''
  // US-124: benefícios narrativos da origem escolhida — `adventures_and_advancement` (parágrafo)
  // e `connection_and_memento` (tabelas d10, parseadas só quando o benefício existe).
  const originBenefits = backgroundCatalog.find(o => o.key === origin)?.benefits ?? []
  // US-123: bônus de atributo do background, se o ingest reconheceu o padrão de `ability_score`.
  const abilityGrant = originBenefits.find(b => b.grant?.kind === 'ability')?.grant
  // US-212: bônus de atributo da RAÇA escolhida, se o ingest reconheceu o traço
  // `ability-score-increase` para ela — segunda fonte independente do bônus de origem acima.
  const raceGrant = raceCatalog.find(r => r.key === charData.race)?.grant
  // `bonus` é a MESMA frase já mostrada no cartão da etapa `race` (race-bonus.mjs) — reaproveitada
  // aqui pro banner da etapa `attributes` em vez de reconstruir o texto a partir de `raceGrant`.
  const raceBonusText = raceCatalog.find(r => r.key === charData.race)?.bonus
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
  // US-220: perícia FIXA de raça (Alto-elfo/Meio-orc) — RACE_SKILL_PROFICIENCIES é regra fixa
  // do PHB 2014 (@ai-dm/shared), mesmo raciocínio de raceLanguages/raceTools. `raceSkillChoiceCount`
  // é `undefined` pra qualquer raça fora de RACE_SKILL_PROFICIENCY_CHOICES (as 8 outras).
  const raceSkillsFixed = RACE_SKILL_PROFICIENCIES[charData.race] ?? []
  // Sistema sem config.skills (catálogo vazio) não tem de onde a raça escolher — mesmo corte
  // do service (character.service.ts, "sistema sem perícias no config"), não erro/bloqueio.
  const raceSkillChoiceCount = skillCatalog.length > 0 ? RACE_SKILL_PROFICIENCY_CHOICES[charData.race] : undefined
  // US-220 §Colisão: fixa de raça que também é fixa do background (Meio-orc + Guard, único
  // par medido no dataset) concede +1 perícia substituta no orçamento da etapa `skills` da
  // classe — mesmo cálculo do service (character.service.ts), aqui só pra dimensionar a UI.
  const raceSkillCollisions = raceSkillsFixed.filter(k => (skillGrant?.fixed ?? []).includes(k)).length
  const effectiveSkillChoices = skillChoices + raceSkillCollisions
  // US-132: ferramenta/veículo do background, se o ingest reconheceu o padrão de
  // `tool_proficiency` (US-132 §Modelo de dados). Mesmo par benefit/grant de skillBenefit
  // acima, mas a escolha acontece NESTA etapa (background) — não existe etapa `tools` própria.
  const toolBenefit = originBenefits.find(b => b.grant?.kind === 'tools')
  const toolGrant = toolBenefit?.grant?.kind === 'tools' ? toolBenefit.grant : undefined
  const toolCatalog = system?.config?.tools ?? []
  const toolLabel = Object.fromEntries(toolCatalog.map(tl => [tl.key, tl.label]))
  // Traço "Tool Proficiency" do anão: cartões da grade de escolha — rótulo vem do catálogo de
  // ferramentas (toolLabel acima), a chave nunca aparece na tela.
  const dwarfToolCards = DWARF_TOOL_PROFICIENCY_CHOICES.map(key => ({ key, label: toolLabel[key] ?? key }))
  // US-214: Traço "Extra Language" (Alto-elfo/Humano/Meio-elfo, RACE_EXTRA_LANGUAGE_CHOICE) —
  // cartões da grade de escolha, catálogo do SISTEMA (config.languages, US-133), não regra fixa
  // do PHB como DWARF_TOOL_PROFICIENCY_CHOICES. Pool exclui `secret` (Druidic/Thieves' Cant,
  // mesmo motivo de US-129 §Modelo de dados) e os idiomas que RACE_LANGUAGES já concede de
  // graça pra ESTA raça — cada raça exclui só o que ela já sabe.
  const languageCatalog = system?.config?.languages ?? []
  // US-215: catálogo de arma (config.weapons) — rótulo pro traço de arma fixa de raça
  // (RACE_WEAPON_PROFICIENCIES), mesma forma de toolLabel/languageLabel acima.
  const weaponLabel = Object.fromEntries((system?.config?.weapons ?? []).map(w => [w.key, w.label]))
  const extraLanguageCards = languageCatalog.filter(l => !l.secret && !(RACE_LANGUAGES[charData.race] ?? []).includes(l.key))
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
  // Traço "Tool Proficiency" do anão: mesma regra de AdventureService.createForCharacter — a
  // ferramenta escolhida também é item físico do kit, não só proficiência.
  const previewRaceEquipment = system?.config ? getRaceToolEquipment(system.config, charData.race, raceToolChoice) : []
  const previewFullKit = [
    ...previewKit,
    ...previewOriginEquipment,
    ...previewRaceEquipment,
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
  // US-213: truques de nível 0 da lista do MAGO — fonte do <select> do bônus racial do
  // Alto-elfo, mesma validação que o service faz (`wizard` é a chave CANÔNICA de classe,
  // US-54; 'mago' é só o rótulo pt-BR). Vazio para sistema sem essa entrada em classSpells.
  const wizardCantrips = (system?.config?.classSpells?.['wizard'] ?? []).filter(s => s.level === 0)
  // US-205: painel de detalhe da etapa `class` — só as features DA CLASSE (US-41), sem origem
  // (ainda não escolhida nesta etapa do wizard). `resolveCharacterFeatures` com `originKey`
  // undefined devolve só o que `getClassFeatures` já resolve, mas com o campo `origin: 'class'`
  // que o FeaturesPanel usa pro selo — reaproveitado em vez de montar `{name,description}` à mão.
  const classStepFeatures = system?.config
    ? resolveCharacterFeatures(system.config, charData.class, undefined, getClassFeatures(system.config, charData.class))
    : []
  // US-205: painel de detalhe da etapa `race` — traços raciais (US-142), já resolvidos pro
  // locale ativo. Sem FeaturesPanel aqui: aquele componente FILTRA origin 'race' de propósito
  // (US-142, é a aba Features/ficha, só classe/origem) — lista própria, mesmo formato de item.
  // US-211: dragonborn esconde as 2 entradas que a grade de ancestralidade substitui (a
  // tabela crua e o texto "escolha um tipo de dragão…") — redundantes assim que a escolha
  // vira card. `breath-weapon`/`damage-resistance` continuam (não explicadas em outro lugar).
  // US-212: `ability-score-increase` some do painel para TODA raça (não só dragonborn) — vira
  // redundante assim que o selo `+N raça` já mostra o mesmo bônus na etapa `attributes`. O
  // traço continua em `config.raceFeatures` (não é removido do ingest); só sai desta exibição.
  // `age` (idade) some do painel para TODA raça — flavor text sem efeito mecânico,
  // mesma lógica de remoção de exibição do ability-score-increase acima.
  const raceStepFeatures = system?.config && charData.race
    ? resolveSheetEntries(system.config.raceFeatures, system.config.retiredFeatures, charData.race, getRaceFeatures(system.config, charData.race))
      .filter(f => f.key !== 'ability-score-increase' && f.key !== 'age')
      .filter(f => charData.race !== 'dragonborn' || !HIDDEN_DRAGONBORN_FEATURE_KEYS.has(f.key))
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
  // US-220: perícias de raça (fixas + escolhidas) entram na revisão junto das de origem/classe
  // — a revisão espelha a ficha (US-127), sem código de exibição novo.
  const reviewSkills = buildSkillSheet(skillCatalog, attrs, [...raceSkillsFixed, ...raceSkillChoice, ...originSkillKeys, ...skills], system?.config?.proficiency?.bonus ?? 2)
    .filter(sk => sk.proficient)
  // US-132: ferramenta(s) fixa(s) + escolhida(s) da origem, já resolvidas pro rótulo — mesma
  // forma que a API vai persistir (Character.tools), pro preview não divergir do salvo.
  // Traço "Tool Proficiency" do anão soma à mesma lista — outra fonte independente de
  // proficiência de ferramenta, mesmo raciocínio cumulativo do service (character.service.ts).
  // US-215: Tinker do gnomo das rochas soma à mesma lista — ferramenta FIXA de raça, mesma
  // fonte independente cumulativa de raceToolChoice (traço de ESCOLHA do anão) acima.
  const reviewToolKeys = [
    ...(toolGrant ? [...toolGrant.fixed, ...toolChoice] : []),
    ...(charData.race === 'hill-dwarf' && raceToolChoice ? [raceToolChoice] : []),
    ...(RACE_TOOL_PROFICIENCIES[charData.race] ?? []),
  ]
  const reviewTools = reviewToolKeys.map(k => toolLabel[k] ?? k)
  // US-215: arma(s) fixa(s) de raça (combate do anão / armas do elfo) — mesma verdade completa
  // que a API vai persistir (Character.weapons), pro preview não divergir do salvo.
  const reviewWeaponKeys = RACE_WEAPON_PROFICIENCIES[charData.race] ?? []
  const reviewWeapons = reviewWeaponKeys.map(k => weaponLabel[k] ?? k)
  // US-214: idioma(s) fixo(s) de RACE_LANGUAGES + escolha extra (quando a raça exige) — mesma
  // verdade completa que a ficha (GameView) mostra depois de criado, pra revisão nunca divergir
  // do que vai ser salvo.
  const languageLabel = Object.fromEntries(languageCatalog.map(l => [l.key, l.label]))
  const reviewLanguageKeys = [
    ...(RACE_LANGUAGES[charData.race] ?? []),
    ...(RACE_EXTRA_LANGUAGE_CHOICE.includes(charData.race) && raceLanguageChoice ? [raceLanguageChoice] : []),
  ]
  const reviewLanguages = reviewLanguageKeys.map(k => languageLabel[k] ?? k)
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
    // US-210: alinhamento é o mesmo caso — catálogo de config.alignments, mesmo motivo do reset.
    setCharData(p => ({ ...p, race: '', class: '', alignment: '' }))
    // US-205: subclasse depende da classe — mesmo motivo do reset acima.
    setSubclass(undefined)
    // US-211: ancestralidade dracônica depende da raça — mesmo motivo do reset acima.
    setDraconicAncestry(undefined)
    // Traço "Tool Proficiency" do anão depende da raça — mesmo motivo do reset acima.
    setRaceToolChoice(undefined)
    // US-214: escolha de idioma extra depende da raça — mesmo motivo do reset acima.
    setRaceLanguageChoice(undefined)
    // US-213: truque bônus do Alto-elfo depende da raça — mesmo motivo do reset acima.
    setRaceCantripChoice(undefined)
    // US-212: bônus de atributo de raça depende do catálogo de raça — mesmo motivo do reset acima.
    setRaceAbilityChoice([])
    // US-220: perícia(s) à escolha de raça depende do catálogo de raça — mesmo motivo do reset acima.
    setRaceSkillChoice([])
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
    setStep('class')
  }

  // US-205: troca de classe invalida a subclasse escolhida (chave de outra classe não pode
  // sobreviver, ex.: trocar Guerreiro→Bárbaro não pode deixar `champion` gravado).
  function selectClassCard(key: string) {
    setCharData(p => ({ ...p, class: key }))
    setSubclass(undefined)
  }

  // US-142 (correção de 2026-09-02): clicar a raiz não é a escolha final quando ela tem
  // subespécie — a raiz sozinha não é chave jogável (ver validateCatalogKey), então preenche a
  // PRIMEIRA variante do catálogo (ordem alfabética por raiz já vem do ingest) até a jogadora
  // trocar na grade de variante. Raiz sem subespécie grava a própria chave, como sempre foi.
  function selectRootCard(key: string) {
    const variants = raceCatalog.filter(r => r.parentKey === key)
    setCharData(p => ({ ...p, race: variants[0]?.key ?? key }))
    // US-211: ancestralidade dracônica é escolha da RAIZ dragonborn — trocar de raiz (mesmo pra
    // outra que também seja dragonborn, clique repetido) invalida a escolha, mesmo espírito do
    // reset de subclass em selectClassCard.
    setDraconicAncestry(undefined)
    // Traço "Tool Proficiency" do anão é escolha da raça — mesmo motivo do reset acima.
    setRaceToolChoice(undefined)
    // US-214: escolha de idioma extra é escolha da raça — mesmo motivo do reset acima.
    setRaceLanguageChoice(undefined)
    // US-213: truque bônus do Alto-elfo é escolha da raça — mesmo motivo do reset acima.
    setRaceCantripChoice(undefined)
    // US-212: o `grant` muda de raça pra raça (e de variante pra variante) — uma escolha feita
    // pra uma raça pode colidir com o `fixed` de outra, mesmo motivo do reset acima.
    setRaceAbilityChoice([])
    // US-220: Skill Versatility é escolha da raça — mesmo motivo do reset acima.
    setRaceSkillChoice([])
  }

  function canAdvance(s: Step): boolean {
    switch (s) {
      case 'system': return !!system
      // US-210: nome e gênero saíram daqui — moraram na etapa `class` até a US-205, agora
      // vivem na etapa `identity` (ver caso abaixo). Sobra só a classe — mais subclasse quando
      // a classe escolhida tem mais de uma opção (marshal, hoje). Classe com 0 ou 1 subclasse
      // não exige nada aqui: sem catálogo não há o que escolher, com 1 entrada só ela preenche
      // sozinha no service.
      case 'class':
        return classCatalog.some(c => c.key === charData.class)
          && (!subclassCatalog || subclassCatalog.length <= 1 || !!subclass)
      // US-211: dragonborn exige a ancestralidade dracônica escolhida — mesmo espírito da
      // checagem de subclass em canAdvance('class').
      case 'race':
        return raceCatalog.some(r => r.key === charData.race)
          && (charData.race !== 'dragonborn' || !!draconicAncestry)
          // Traço "Tool Proficiency" do anão: mesmo espírito da checagem de draconicAncestry acima.
          && (charData.race !== 'hill-dwarf' || !!raceToolChoice)
          // US-214: mesmo espírito das duas checagens acima, generalizado às 3 raças de
          // RACE_EXTRA_LANGUAGE_CHOICE — nunca bloqueia as outras 6.
          && (!RACE_EXTRA_LANGUAGE_CHOICE.includes(charData.race) || !!raceLanguageChoice)
      // US-123: além do point-buy fechado, background com grant.kind === 'ability' exige
      // uma linha escolhida para o +1 livre (a linha fixa não conta, é automática).
      // US-212: além do point-buy e do grant de origem, raça com grant.choice exige o número
      // certo de escolhas feitas — mesmo espírito das duas checagens acima, terceira fonte.
      case 'attributes':
        return (budget === undefined || remaining === 0)
          && (abilityGrant?.kind !== 'ability' || !!abilityChoice)
          && (!raceGrant?.choice || raceAbilityChoice.length === raceGrant.choice.count)
      // Sem perícias no config → etapa livre; senão exige exatamente `skillChoices`. US-131:
      // além disso, background com grant.kind === 'skills' exige as `chooseCount` chaves da
      // origem (mesmo espírito do bônus de atributo, mas aqui a escolha acontece nesta etapa,
      // não na `background` — perícia de origem e perícia de classe ficam na mesma tela).
      // US-220: Meio-elfo (Skill Versatility) exige as `raceSkillChoiceCount` escolhas próprias,
      // além das da classe/origem já checadas acima — `effectiveSkillChoices` já soma a
      // substituta da colisão fixa×fixa (ver §Colisão) ao orçamento da classe.
      case 'skills':
        return (effectiveSkillChoices === 0 || skills.length === effectiveSkillChoices)
          && (!skillGrant || skillGrant.chooseCount === 0 || skillChoice.length === skillGrant.chooseCount)
          && (raceSkillChoiceCount === undefined || raceSkillChoice.length === raceSkillChoiceCount)
      // US-213: só bloqueia quando o Alto-elfo TEM truque de mago pra escolher — nos demais
      // casos (não é Alto-elfo, ou catálogo do Mago vazio) a etapa nunca bloqueia o avanço.
      case 'spells':
        return charData.race !== 'high-elf' || wizardCantrips.length === 0 || !!raceCantripChoice
      // US-210: nome, gênero e alinhamento — a condição composta que morava em
      // canAdvance('class') antes da US-205 reabrir a posição (ver Contexto da US-210).
      // `appearance`/`personality` são opcionais, não entram aqui.
      case 'identity':
        return charData.name.trim() !== ''
          && (GENDERS as readonly string[]).includes(charData.gender)
          && alignmentCatalog.some(a => a.key === charData.alignment)
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
      // US-205: subclasse só viaja quando a classe tem MAIS de uma opção (marshal) — é a única
      // situação em que `subclass` é escolha real da jogadora. Classe com 0 ou 1 entrada nunca
      // manda o campo; o service resolve sozinho (ver character.service.ts).
      const subclassPayload = subclassCatalog && subclassCatalog.length > 1 ? subclass : undefined
      // US-211: só viaja quando a raça é dragonborn — qualquer outra raça nem tem a grade
      // no wizard (canAdvance('race') já bloqueia o avanço sem a escolha, quando dragonborn).
      const draconicAncestryPayload = charData.race === 'dragonborn' ? draconicAncestry : undefined
      // Traço "Tool Proficiency" do anão: só viaja quando a raça é hill-dwarf — mesmo espírito
      // de draconicAncestryPayload acima.
      const raceToolChoicePayload = charData.race === 'hill-dwarf' ? raceToolChoice : undefined
      // US-214: só viaja quando a raça está em RACE_EXTRA_LANGUAGE_CHOICE — mesmo espírito de
      // raceToolChoicePayload acima.
      const raceLanguageChoicePayload = RACE_EXTRA_LANGUAGE_CHOICE.includes(charData.race) ? raceLanguageChoice : undefined
      // US-213: só viaja quando a raça é high-elf — mesmo espírito de raceToolChoicePayload acima.
      const raceCantripChoicePayload = charData.race === 'high-elf' ? raceCantripChoice : undefined
      // US-212: só viaja quando o grant da raça exige escolha — [] vira undefined (nada a validar).
      const raceAbilityChoicePayload = raceAbilityChoice.length > 0 ? raceAbilityChoice : undefined
      // US-220: só viaja quando a raça está em RACE_SKILL_PROFICIENCY_CHOICES (hoje só
      // half-elf) — mesmo espírito condicional de raceToolChoicePayload acima.
      const raceSkillChoicesPayload = raceSkillChoiceCount !== undefined ? raceSkillChoice : undefined
      // US-61: `userId` não vai no corpo — a API deriva o dono do token.
      const char = await api.createCharacter({
        systemId: system.id, ...charData, draconicAncestry: draconicAncestryPayload, subclass: subclassPayload,
        raceToolChoice: raceToolChoicePayload,
        raceLanguageChoice: raceLanguageChoicePayload,
        raceCantripChoice: raceCantripChoicePayload,
        raceAbilityChoice: raceAbilityChoicePayload, raceSkillChoices: raceSkillChoicesPayload,
        attributes: attrs, skills, background, origin: originPayload,
      })
      // Personagem já está salvo: guardamos o id e avançamos ao passo `world` (US-157).
      setCharId(char.id)
      setStep('world')
    } catch { setError(t('setup.error.create')) }
    finally { setLoading(false) }
  }

  // US-157: Aleatório OMITE o campo — nunca envia a chave "random" (mesma disciplina de
  // ausência = aleatório da US-156). US-184: mesma regra para `setting`/`areaType`.
  // US-217: ramo "pronta" manda só `preset: true` — nunca toca em setting/tone/areaType/
  // challenge (esse ramo nem mostra os grupos que os preenchem, US-216).
  async function createWorldAdventure() {
    setStarting(true); setError('')
    try {
      const dto = worldMode === 'ready'
        ? { preset: true }
        : {
          ...(setting !== 'random' && { setting }),
          ...(tone !== 'random' && { tone }),
          ...(areaType !== 'random' && { areaType }),
          // US-165: Modo aventura (default) omite o campo — mesmo contrato de default da US-161.
          ...(challenge !== 'adventure' && { challenge }),
        }
      const adv = await api.createAdventure(charId, dto)
      router.push(`/play/${adv.id}?characterId=${charId}`)
    } catch { setError(t('setup.error.start')); setStarting(false) }
  }

  // US-27: marca/desmarca proficiência; bloqueia marcar além do orçamento.
  // US-220: o orçamento é `effectiveSkillChoices` (choices da classe + substituta de colisão
  // fixa×fixa de raça/background, ver §Colisão), não mais `skillChoices` cru.
  function toggleSkill(key: string) {
    setSkills(p => {
      if (p.includes(key)) return p.filter(k => k !== key)
      if (p.length >= effectiveSkillChoices) return p
      return [...p, key]
    })
  }

  // US-220: marca/desmarca perícia do traço "Skill Versatility" do Meio-elfo — mesmo padrão de
  // toggleSkillChoice (US-131), mas limitado a `raceSkillChoiceCount`, orçamento PRÓPRIO,
  // separado do da classe.
  function toggleRaceSkillChoice(key: string) {
    setRaceSkillChoice(p => {
      if (p.includes(key)) return p.filter(k => k !== key)
      if (raceSkillChoiceCount === undefined || p.length >= raceSkillChoiceCount) return p
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
    // US-197: durante a espera do passo `world`, o fundo troca pro jardim noturno —
    // ambienta "algo sendo preparado nos bastidores" sem gerar asset novo. `dim="medium"`
    // (não "heavy") só aqui: sem o Panel quase opaco por baixo (ver abaixo), o texto fica
    // direto sobre a arte de cena — mesmo contraste que app/page.tsx (home) e
    // app/login/page.tsx já usam nesse caso; "heavy" era calibrado para o Panel, que aqui
    // não existe, e escondia a cena quase por inteiro.
    <SceneFrame scene={starting ? '/scenes/arboretum-moonlit.png' : '/scenes/tavern.png'} dim={starting ? 'medium' : 'heavy'} localeToggle={false}>
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

        {/* US-197: tela de espera SEM o cartão do Panel (quase opaco, `--panel-top/bottom`
            em ~94% alfa) — dentro dele o fundo trocado (arboretum-moonlit.png) ficava
            praticamente invisível, o mesmo card que sempre cobriu o formulário. */}
        {step === 'world' && starting ? (
          <div className="flex flex-1 flex-col">
            <AdventureLoadingScreen />
          </div>
        ) : (
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

            {/* US-205: `race-class` virou `class` + `race`. Nome e gênero moravam aqui (a
                primeira das duas), acima da grade de classe — a US-210 reabre essa decisão e
                os move de volta para uma etapa "Identidade" própria, mas no FIM da trilha
                (depois de `spells`), por um motivo diferente do protótipo local que a US-205
                recusou: campos estruturados (nome/gênero/alinhamento), não texto livre de
                aparência/personalidade/história (ver US-210 §Contexto). */}
            {step === 'class' && system && (
              <div>
                {/* Cabeçalho de 3 partes (eyebrow/heading/subtítulo) — mesmo padrão da etapa
                    `race` (eyebrow em --primary, SectionTitle, subtítulo em muted-foreground),
                    pra não ler como duas telas de sistemas diferentes dentro do mesmo wizard. */}
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{t('setup.class.eyebrow')}</p>
                <SectionTitle>{t('setup.class.titulo')}</SectionTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t('setup.raceClass.system', { name: system.name })}</p>
                <div className="mt-6 space-y-4">
                  <CatalogCardGroup name="char-class" legend={t('setup.raceClass.class')}
                    items={classCatalog} value={charData.class} onChange={selectClassCard} />
                  {/* US-205: subgrade de subclasse aninhada no cartão de classe — só existe
                      fisicamente quando a classe escolhida tem MAIS de uma opção (marshal, hoje).
                      Classe com 0 ou 1 subclasse não renderiza nada aqui: sem catálogo, sem
                      escolha; com 1 entrada, ela preenche sozinha (ver resolvedSubclass acima). */}
                  {subclassCatalog && subclassCatalog.length > 1 && (
                    <CatalogCardGroup name="char-subclass" legend={t('setup.subclass.legend')}
                      items={subclassCatalog} value={subclass ?? ''} onChange={setSubclass} />
                  )}
                  {/* US-205: painel de detalhe — o que a classe escolhida concede, sem dado
                      novo (getClassFeatures/getStartingInventory já existem no arquivo). */}
                  {charData.class && (
                    <div className="space-y-4 border-t border-border pt-4">
                      {previewKit.length > 0 && (
                        <div>
                          <SheetHeading tone="primary">{t('setup.class.detail.kit')}</SheetHeading>
                          <p className="text-sm text-foreground">
                            {previewKit.map(i => i.qty > 1 ? `${i.name} (${i.qty})` : i.name).join(' · ')}
                          </p>
                        </div>
                      )}
                      {/* Subclasse resolvida — mostrada mesmo quando preenchida automaticamente
                          (12 das 13 classes): a jogadora vê o que ganhou sem ter escolhido. */}
                      {resolvedSubclassEntry && (
                        <div>
                          <SheetHeading tone="primary">{t('setup.class.detail.subclass')}</SheetHeading>
                          <p className="text-sm font-medium text-parchment">{resolvedSubclassEntry.label}</p>
                          {resolvedSubclassEntry.blurb && <p className="mt-1 text-xs text-muted-foreground">{resolvedSubclassEntry.blurb}</p>}
                        </div>
                      )}
                      {classStepFeatures.length > 0 && <FeaturesPanel features={classStepFeatures} tone="primary" />}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'race' && system && (
              <div>
                {/* Cabeçalho de 3 partes (eyebrow/heading/subtítulo) — bate com o protótipo
                    de referência em vez do titulo curto que as outras etapas usam. */}
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{t('setup.race.eyebrow')}</p>
                <SectionTitle>{t('setup.race.heading')}</SectionTitle>
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t('setup.race.subtitulo')}</p>
                <div className="mt-6">
                  <CatalogCardGroup name="char-race" legend={t('setup.raceClass.race')} hideLegend
                    items={raceRoots} value={selectedRootKey} onChange={selectRootCard} />
                </div>
                {/* US-142 (correção de 2026-09-02): segunda grade, só quando a raiz escolhida
                    tem subespécie — mostra o DELTA de cada variante (`variantBonus`), não o
                    total já visível no cartão da raiz logo acima. */}
                {raceVariants.length > 0 && (
                  <div className="mt-6">
                    <CatalogCardGroup name="char-race-variant" legend={t('setup.race.variant.legend')}
                      items={raceVariants.map(v => ({ ...v, bonus: v.variantBonus }))} value={charData.race}
                      onChange={key => { setCharData(p => ({ ...p, race: key })); setRaceAbilityChoice([]) }} />
                  </div>
                )}
                {/* US-211 (correção): grade de ancestralidade dracônica — só pra dragonborn, ANTES
                    do painel de traços raciais (mesma posição da grade de variante acima, não
                    mais abaixo dos traços). */}
                {charData.race === 'dragonborn' && (
                  <div className="mt-6">
                    <CatalogCardGroup name="char-draconic-ancestry" legend={t('setup.race.variant.legend')}
                      items={draconicAncestryCards} value={draconicAncestry ?? ''} onChange={setDraconicAncestry} />
                  </div>
                )}
                {/* Traço "Tool Proficiency" do anão: escolha subordinada dentro do traço, não um
                    eixo de decisão do nível de raça/variante/ancestralidade — CatalogCardGroup
                    (fonte serifada grande, peso de "Anão da Colina"/"Ancestral Vermelho") ficava
                    grande demais pra 3 opções de ferramenta. Mesmo <select> que o grant de
                    ferramenta da ORIGEM já usa (etapa `background`, mais abaixo) para o mesmo
                    tipo de escolha. Rótulo no MESMO estilo do `legend` do CatalogCardGroup logo
                    acima ("Escolha uma variante") — não SheetHeading (maiúsculo, cor accent):
                    as duas são a mesma instrução "Escolha X" dentro do MESMO passo, dois
                    tratamentos diferentes lado a lado destoavam. */}
                {charData.race === 'hill-dwarf' && (
                  <div className="mt-6">
                    <label htmlFor="char-dwarf-tool" className="mb-2 block text-sm font-medium text-parchment">
                      {t('setup.race.dwarfTool.legend')}
                    </label>
                    <select id="char-dwarf-tool" value={raceToolChoice ?? ''}
                      onChange={e => setRaceToolChoice(e.target.value || undefined)}
                      className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                      <option value="">{t('setup.raceClass.select')}</option>
                      {dwarfToolCards.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </div>
                )}
                {/* US-214: mesmo <select> subordinado do traço "Tool Proficiency" do anão acima
                    — mesma escolha de widget (grade grande demais pro tamanho da decisão),
                    catálogo do sistema (config.languages, US-133) em vez de regra fixa do PHB.
                    Aparece para as 3 raças de RACE_EXTRA_LANGUAGE_CHOICE. */}
                {RACE_EXTRA_LANGUAGE_CHOICE.includes(charData.race) && (
                  <div className="mt-6">
                    <label htmlFor="char-extra-language" className="mb-2 block text-sm font-medium text-parchment">
                      {t('setup.race.extraLanguage.legend')}
                    </label>
                    <select id="char-extra-language" value={raceLanguageChoice ?? ''}
                      onChange={e => setRaceLanguageChoice(e.target.value || undefined)}
                      className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                      <option value="">{t('setup.raceClass.select')}</option>
                      {extraLanguageCards.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </div>
                )}
                {/* US-205: painel de detalhe — traços raciais (US-142), sem dado novo.
                    tone="primary": única etapa com eyebrow em --primary logo acima (ver
                    SheetHeading em dm.tsx) — accent aqui liam como duas cores em conflito. */}
                {raceStepFeatures.length > 0 && (
                  <div className="mt-6 space-y-4 border-t border-border pt-4">
                    <SheetHeading tone="primary">{t('setup.race.detail.features')}</SheetHeading>
                    <ul className="flex flex-col gap-2">
                      {raceStepFeatures.map((f, i) => (
                        <li key={i} className="rounded-md border border-border bg-background/40 p-3">
                          <p className="text-sm font-semibold text-parchment">{f.name}</p>
                          {f.description?.trim() && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                {/* US-212: mesmo padrão do banner de origem acima, pra RAÇA — reforça o que o
                    cartão da etapa `race` já anunciou (`bonus`), agora com o selo mecânico ao lado. */}
                {raceGrant && raceBonusText && (
                  <p className="mt-4 flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {t('setup.attributes.raceBanner', { race: raceLabel, bonus: raceBonusText })}
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
                    const toggle = () => setAbilityChoice(c => (c === a.key ? undefined : a.key))
                    // US-212: segunda fonte independente — mesma forma fixo/escolha da origem
                    // acima, mas lendo `raceGrant` e somando ao MESMO `bonus` exibido embaixo.
                    const raceFixed = raceGrant?.fixed.find(f => f.attr === a.key)
                    const raceChosen = !!raceGrant?.choice && raceAbilityChoice.includes(a.key)
                    const raceChoiceFull = !!raceGrant?.choice && raceAbilityChoice.length >= raceGrant.choice.count
                    const raceEligible = !!raceGrant?.choice && !raceFixed
                    const toggleRace = () => setRaceAbilityChoice(prev => prev.includes(a.key) ? prev.filter(k => k !== a.key) : [...prev, a.key])
                    const bonus = (isFixed || isChosen ? 1 : 0) + (raceFixed?.amount ?? (raceChosen ? raceGrant!.choice!.amount : 0))
                    return (
                      <div key={a.key} className="flex items-center justify-between gap-3 py-3">
                        <span className="flex items-center gap-2">
                          <label className="text-sm font-medium text-foreground">{a.label}</label>
                          {isFixed && <AbilityBonusBadge variant="solid" label={t('setup.attributes.abilityBadgeFixed')} />}
                          {isChosen && <AbilityBonusBadge variant="solid" label={t('setup.attributes.abilityBadgeFixed')} onClick={toggle} />}
                          {clickable && !isChosen && !abilityChoice && <AbilityBonusBadge variant="ghost" label={t('setup.attributes.abilityBadgeFixed')} onClick={toggle} />}
                          {raceFixed && <AbilityBonusBadge variant="solid" label={t('setup.attributes.raceBadge', { amount: raceFixed.amount })} />}
                          {raceChosen && <AbilityBonusBadge variant="solid" label={t('setup.attributes.raceBadge', { amount: raceGrant!.choice!.amount })} onClick={toggleRace} />}
                          {raceEligible && !raceChosen && !raceChoiceFull && (
                            <AbilityBonusBadge variant="ghost" label={t('setup.attributes.raceBadge', { amount: raceGrant!.choice!.amount })} onClick={toggleRace} />
                          )}
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
                {/* US-220: perícia de raça (Keen Senses do Alto-elfo, Menacing do Meio-orc,
                    Skill Versatility do Meio-elfo) — mesmo padrão do bloco de origem acima:
                    `fixed` pré-marcado e não-clicável, escolha clicável até `raceSkillChoiceCount`.
                    O pool da escolha exclui o que raça FIXA e origem já concederam. */}
                {(raceSkillsFixed.length > 0 || raceSkillChoiceCount !== undefined) && (
                  <div className="mt-4">
                    <SheetHeading>{t('setup.skills.raceGrant')}</SheetHeading>
                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {raceSkillsFixed.map(key => (
                        <div key={key} className={optionCardClass(true)}>
                          <span className="block text-sm font-medium text-foreground">{skillLabel[key] ?? key}</span>
                        </div>
                      ))}
                      {raceSkillChoiceCount !== undefined && skillCatalog
                        .filter(sk => !raceSkillsFixed.includes(sk.key) && !originSkillKeys.includes(sk.key))
                        .map(sk => {
                          const on = raceSkillChoice.includes(sk.key)
                          const full = !on && raceSkillChoice.length >= raceSkillChoiceCount
                          return (
                            <button key={sk.key} type="button" onClick={() => toggleRaceSkillChoice(sk.key)}
                              disabled={full}
                              aria-pressed={on}
                              className={optionCardClass(on)}>
                              <span className="block text-sm font-medium text-foreground">{sk.label}</span>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                )}
                {/* US-98: o número deixou de ser um <span> no meio da frase (concatenação
                    que quebra noutra ordem de palavras); o destaque fica na contagem. */}
                <p className="mt-6 text-sm text-muted-foreground">
                  {t('setup.skills.instructions', { n: effectiveSkillChoices, bonus: system.config?.proficiency?.bonus ?? 2 })}{' '}
                  {t('setup.skills.selected')} <span className={`font-semibold ${skills.length === effectiveSkillChoices ? 'text-success' : 'text-primary'}`}>{skills.length}</span>/{effectiveSkillChoices}
                </p>
                <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {/* US-131/US-220: exclui as perícias já concedidas pela origem (fixas +
                      escolhida) e pela raça (fixas + escolhida) — evita duplicar; `effectiveSkillChoices`
                      (contagem) segue sendo só a parte da classe (+ substituta de colisão). */}
                  {skillCatalog.filter(sk => !originSkillKeys.includes(sk.key) && !raceSkillsFixed.includes(sk.key) && !raceSkillChoice.includes(sk.key)).map(sk => {
                    const on = skills.includes(sk.key)
                    const full = !on && skills.length >= effectiveSkillChoices
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

            {/* US-213: prévia somente-leitura das magias da classe (mesma leitura que a
                Revisão já faz, US-50) + escolha do truque bônus do Alto-elfo, quando aplicável. */}
            {step === 'spells' && system && (
              <div>
                <SectionTitle>{t('setup.spells.titulo')}</SectionTitle>
                {previewSpells.length > 0 && (
                  <div className="mt-6">
                    <FeaturesPanel spells={previewSpells} />
                  </div>
                )}
                {charData.race === 'high-elf' && wizardCantrips.length > 0 && (
                  <div className="mt-6">
                    <label htmlFor="char-race-cantrip" className="mb-2 block text-sm font-medium text-parchment">
                      {t('setup.spells.cantripChoice.legend')}
                    </label>
                    <select id="char-race-cantrip" value={raceCantripChoice ?? ''}
                      onChange={e => setRaceCantripChoice(e.target.value || undefined)}
                      className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                      <option value="">{t('setup.raceClass.select')}</option>
                      {wizardCantrips.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {previewSpells.length === 0 && !(charData.race === 'high-elf' && wizardCantrips.length > 0) && (
                  <p className="mt-6 text-sm text-muted-foreground">{t('setup.spells.empty')}</p>
                )}
              </div>
            )}

            {/* US-210: última etapa antes da revisão — nome, gênero e alinhamento (todos
                obrigatórios, ver canAdvance) + aparência/personalidade (texto livre, opcional). */}
            {step === 'identity' && system && (
              <div>
                <SectionTitle>{t('setup.identity.titulo')}</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">{t('setup.identity.subtitulo')}</p>
                <div className="mt-6 space-y-4">
                  {/* US-46: rótulo visível persistente acima de cada campo — mesmo par que
                      morava na etapa `class` antes da US-210, campos e ids idênticos. */}
                  <div>
                    <FieldLabel htmlFor="char-name">{t('setup.raceClass.name')}</FieldLabel>
                    <input id="char-name" required placeholder={t('setup.raceClass.namePlaceholder')}
                      value={charData.name} onChange={e => setCharData(p => ({ ...p, name: e.target.value }))}
                      className={fieldClass()} />
                  </div>
                  {/* US-98: `value` em pt-BR (é o que a API entende), rótulo traduzido. US-205
                      §Fora do escopo: gênero são 3 valores sem prosa, o <select> continua adequado. */}
                  <div>
                    <FieldLabel htmlFor="char-gender">{t('setup.raceClass.gender')}</FieldLabel>
                    <select id="char-gender" value={charData.gender}
                      onChange={e => setCharData(p => ({ ...p, gender: e.target.value }))}
                      className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                      <option value="">{t('setup.raceClass.select')}</option>
                      {GENDERS.map(g => <option key={g} value={g}>{t(`setup.gender.${g}`)}</option>)}
                    </select>
                  </div>
                  {/* US-210: alinhamento é dado de catálogo (config.alignments, SRD via
                      ingest) — mesmo padrão de raça/classe, não uma lista literal do componente. */}
                  <div>
                    <FieldLabel htmlFor="char-alignment">{t('setup.identity.alignment')}</FieldLabel>
                    <select id="char-alignment" value={charData.alignment}
                      onChange={e => setCharData(p => ({ ...p, alignment: e.target.value }))}
                      className={selectClass} style={{ backgroundImage: SELECT_ARROW }}>
                      <option value="">{t('setup.raceClass.select')}</option>
                      {alignmentCatalog.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                  </div>
                  {/* US-210: aparência/personalidade — texto livre, OPCIONAL (canAdvance não
                      exige nenhum dos dois). Grade 2 colunas, mesma textarea de background.story. */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="char-appearance">{t('setup.identity.appearance')}</FieldLabel>
                      <textarea id="char-appearance" rows={3} placeholder={t('setup.identity.appearancePlaceholder')}
                        value={charData.appearance} onChange={e => setCharData(p => ({ ...p, appearance: e.target.value }))}
                        className={fieldClass('resize-y')} />
                    </div>
                    <div>
                      <FieldLabel htmlFor="char-personality">{t('setup.identity.personality')}</FieldLabel>
                      <textarea id="char-personality" rows={3} placeholder={t('setup.identity.personalityPlaceholder')}
                        value={charData.personality} onChange={e => setCharData(p => ({ ...p, personality: e.target.value }))}
                        className={fieldClass('resize-y')} />
                    </div>
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
                    // US-210: alinhamento já vem rotulado do catálogo (config.alignments), mesma
                    // disciplina de raça/classe — a chave nunca aparece na tela.
                    [t('setup.review.alignment'), alignmentLabel],
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
                  {/* US-205: linha própria da subclasse — só quando a classe escolhida tem
                      catálogo (mesma condição de backgroundCatalog.length > 0 pra Origem, abaixo). */}
                  {subclassCatalog && subclassCatalog.length > 0 && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.subclass')}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">{subclassLabel || '—'}</dd>
                    </div>
                  )}
                  {/* US-211: só quando a raça é dragonborn — mostra o tipo de dragão e a
                      resistência RESOLVIDOS, não a chave crua. */}
                  {charData.race === 'dragonborn' && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.draconicAncestry')}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">
                        {draconicAncestryEntry ? `${draconicAncestryLabel} — ${draconicAncestryResistance}` : '—'}
                      </dd>
                    </div>
                  )}
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
                      abaixo (US-132 §Onde aparece na criação e na ficha). Traço "Tool
                      Proficiency" do anão soma na mesma linha (reviewToolKeys já inclui as duas
                      fontes) — sem linha própria, mesmo espírito de "Proficiências" genérico.
                      US-215: Tinker do gnomo das rochas soma na mesma linha (reviewToolKeys já
                      inclui a fonte) — condição estendida pra a linha aparecer mesmo sem
                      toolGrant/raceToolChoice de origem. */}
                  {(toolGrant || (charData.race === 'hill-dwarf' && raceToolChoice) || charData.race === 'rock-gnome') && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.tools')}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">
                        {reviewTools.length > 0 ? reviewTools.join(' · ') : '—'}
                      </dd>
                    </div>
                  )}
                  {/* US-215: linha própria — arma(s) fixa(s) de raça (combate do anão / armas do
                      elfo), só para hill-dwarf/high-elf (as únicas com traço de arma no PHB 2014). */}
                  {reviewWeapons.length > 0 && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.weapons')}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">
                        {reviewWeapons.join(' · ')}
                      </dd>
                    </div>
                  )}
                  {/* US-214: linha própria — idioma(s) fixo(s) de RACE_LANGUAGES pra qualquer
                      raça (as 9 concedem ao menos 1) + escolha extra quando a raça exige. */}
                  {reviewLanguages.length > 0 && (
                    <div className="flex items-start justify-between gap-6 py-2.5">
                      <dt className="shrink-0 text-sm text-muted-foreground">{t('setup.review.languages')}</dt>
                      <dd className="text-right text-sm font-medium text-parchment">
                        {reviewLanguages.join(' · ')}
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
                {/* US-216: bifurcação — primeiro conteúdo do passo, antes de qualquer grupo.
                    `worldMode` começa null: nenhuma prévia nem grupo aparece até a escolha. */}
                <p className="mt-2 text-sm text-muted-foreground">{t('setup.world.mode.subtitulo')}</p>
                <div className="mt-6">
                  <CatalogCardGroup name="world-mode" legend={t('setup.world.mode.subtitulo')} hideLegend
                    items={[
                      { key: 'ready', label: t('setup.world.mode.ready.title'), blurb: t('setup.world.mode.ready.hint') },
                      { key: 'custom', label: t('setup.world.mode.custom.title'), blurb: t('setup.world.mode.custom.hint') },
                    ]}
                    value={worldMode ?? ''} onChange={key => setWorldMode(key as 'ready' | 'custom')} />
                </div>

                {/* Ramo "pronta": só o cartão de prévia do gancho da classe — nenhum grupo de
                    Cenário/Tom/Área/Desafio aparece, todos ficam Aleatório/`adventure`
                    (createWorldAdventure já omite o campo nesse estado, sem mudança). */}
                {worldMode === 'ready' && initialHook && (
                  <div className={cn(optionCardClass(true), 'mt-6')}>
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('setup.world.mode.ready.title')}
                    </span>
                    <span className="mt-1 block font-serif text-base font-semibold text-parchment">{initialHookTitle}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{initialHookPitch}</span>
                  </div>
                )}

                {/* Ramo "criar": a tela `world` de sempre, sem alteração de comportamento. */}
                {worldMode === 'custom' && (
                  <div className="mt-6">
                    <p className="text-sm text-muted-foreground">{t('setup.world.subtitulo')}</p>
                    <div className="mt-6 space-y-6">
                      <WorldOptionGroup name="setting" legend={t('setup.world.setting')} randomLabel={t('setup.world.random')}
                        catalog={settingCatalog} value={setting} onChange={setSetting} />
                      <WorldOptionGroup name="tone" legend={t('setup.world.tone')} randomLabel={t('setup.world.random')}
                        catalog={toneCatalog} value={tone} onChange={setTone} />
                      <WorldOptionGroup name="areaType" legend={t('setup.world.areaType')} randomLabel={t('setup.world.random')}
                        catalog={areaTypeCatalog} value={areaType} onChange={setAreaType} />
                      <ChallengeOptionGroup name="challenge" legend={t('setup.world.challenge')} value={challenge}
                        onChange={key => setChallenge(key as 'adventure' | 'challenge')}
                        options={[
                          { key: 'adventure', label: t('setup.world.challenge.adventure.label'), hint: t('setup.world.challenge.adventure.hint') },
                          { key: 'challenge', label: t('setup.world.challenge.challenge.label'), hint: t('setup.world.challenge.challenge.hint') },
                        ]} />
                    </div>
                  </div>
                )}
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
                // US-216: sem ramo escolhido ainda, não há o que confirmar — os cartões de
                // bifurcação são a própria interação, não o botão do rodapé.
                worldMode && (
                  <DmButton type="button" onClick={createWorldAdventure} disabled={starting}>
                    <Check className="size-4" aria-hidden />
                    {starting ? t('setup.world.starting') : t('setup.world.start')}
                  </DmButton>
                )
              ) : (
                <DmButton type="button" onClick={next} disabled={!canAdvance(step)}>
                  {t('setup.next')}
                  <ArrowRight className="size-4" aria-hidden />
                </DmButton>
              )}
            </div>
          )}
        </Panel>
        )}
      </div>
    </SceneFrame>
  )
}
