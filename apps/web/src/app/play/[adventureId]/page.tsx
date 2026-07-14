import { GameView } from '@/components/game/GameView'
import { buildSkillSheet, type SystemConfig } from '@ai-dm/shared'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  params: Promise<{ adventureId: string }>
  searchParams: Promise<{ characterId?: string }>
}

export default async function PlayPage({ params, searchParams }: Props) {
  const { adventureId } = await params
  const { characterId } = await searchParams

  if (!characterId) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center">
        <p className="text-stone-400">Personagem não encontrado. <a href="/setup" className="text-amber-400 underline">Recomeçar</a></p>
      </div>
    )
  }

  const res = await fetch(`${API}/api/v1/characters/${characterId}`, { cache: 'no-store' })
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

  return (
    <GameView
      adventureId={adventureId}
      characterId={characterId}
      characterName={character.name}
      characterClass={character.class}
      characterRace={character.race}
      hp={state?.hp ?? 10}
      maxHp={state?.maxHp ?? 10}
      attributes={character.baseAttributes}
      inventory={state?.inventory ?? []}
      conditions={state?.conditions ?? []}
      skills={skills}
      background={character.background}
      features={character.features}
      spells={character.spells}
    />
  )
}
