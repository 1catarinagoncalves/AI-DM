import { cookies } from 'next/headers'
import { GameView } from '@/components/game/GameView'
import { buildSkillSheet, catalogLabel, resolveSheetEntries, type SystemConfig } from '@ai-dm/shared'
import { apiAuthHeader } from '@/lib/server-auth'
import { LOCALE_COOKIE, localeFromCookie } from '@/lib/locale-cookie'
import { messagesFor } from '@/messages'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  params: Promise<{ adventureId: string }>
  searchParams: Promise<{ characterId?: string }>
}

export default async function PlayPage({ params, searchParams }: Props) {
  const { adventureId } = await params
  const { characterId } = await searchParams

  if (!characterId) {
    // Componente de SERVIDOR: sem hook, o locale vem do cookie que a US-97 espelha.
    const t = messagesFor(localeFromCookie((await cookies()).get(LOCALE_COOKIE)?.value))
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">{t('game.notFound')} <a href="/setup" className="text-primary underline underline-offset-4">{t('game.restart')}</a></p>
      </div>
    )
  }

  // US-61: chamada server-side autenticada — a API valida a posse da ficha.
  const res = await fetch(`${API}/api/v1/characters/${characterId}`, {
    cache: 'no-store',
    headers: await apiAuthHeader(),
  })
  const character = await res.json()
  const state = character.states?.[0]

  // US-27: todas as perícias com modificador, derivadas do config do sistema + proficiências da ficha.
  // ponytail: bônus de proficiência FIXO em config.proficiency.bonus (+2, nível 1). Quando houver
  // level-up (Fase futura), o bônus 5e escala com o nível (+2→+6) — derivar de character.level aqui
  // (ex.: 2 + floor((level-1)/4)) em vez do valor fixo do config, senão o modificador defasa a partir do nível 5.
  const config = character.system?.config as SystemConfig | undefined
  const attrs = (state?.attributes ?? character.baseAttributes ?? {}) as Record<string, number>
  const skills = config?.skills
    ? buildSkillSheet(config.skills, attrs, (character.skills ?? []) as string[], config.proficiency?.bonus ?? 2)
    : []

  // US-105: a ficha guarda a CHAVE (`dwarf`); o rótulo sai do catálogo do config, que a API já
  // serve no locale do dono — a mesma ficha diz "Anão" ou "Dwarf" sem tocar no banco.
  const className = catalogLabel(config?.classes, character.class)
  const raceName = catalogLabel(config?.races, character.race)
  // US-122: origem do catálogo de backgrounds (US-121) — campo IRMÃO de `background`.
  // `catalogLabel` não serve (backgrounds usam `name`, não `label`); resolve-se aqui.
  const originKey = character.origin?.key as string | undefined
  const originName = originKey ? config?.backgrounds?.find((b) => b.key === originKey)?.name : undefined
  // US-124: conexão/memento escolhidos na criação — texto já persistido em Character.origin,
  // sem resolução contra catálogo nenhuma (não é chave, é o texto da linha escolhida).
  const originConnection = character.origin?.connection as string | undefined
  const originMemento = character.origin?.memento as string | undefined

  // US-100: feature e magia também são chave — o mesmo padrão das perícias, agora na aba
  // Features. A ficha do banco não muda ao trocar de idioma; muda o config que chega aqui.
  const charClass = character.class as string
  const features = resolveSheetEntries(config?.classFeatures, config?.retiredFeatures, charClass, (character.features ?? []) as string[])
  const spells = resolveSheetEntries(config?.classSpells, config?.retiredSpells, charClass, (character.spells ?? []) as string[])

  return (
    <GameView
      adventureId={adventureId}
      characterId={characterId}
      characterName={character.name}
      characterClass={className}
      characterRace={raceName}
      hp={state?.hp ?? 10}
      maxHp={state?.maxHp ?? 10}
      attributes={character.baseAttributes}
      inventory={state?.inventory ?? []}
      conditions={state?.conditions ?? []}
      skills={skills}
      background={character.background}
      characterOrigin={originName}
      characterConnection={originConnection}
      characterMemento={originMemento}
      features={features}
      spells={spells}
    />
  )
}
