import { HomeHero } from '@/components/HomeHero'

// HomeHero fetches its own data (api.listCharacters(), no props) - there's
// nothing to compose it WITH except its data source. A real network call
// always fails in a static preview, landing on the error state (a legitimate
// but visually thin state - one heading + one button). Patching window.fetch
// at module scope (before mount) shows the actually interesting composed
// state instead: HomeHero -> Panel(hero summary) -> action list -> the
// "show all" Panel with divide-y rows (US-127's shared BackgroundPanel /
// FeaturesPanel composition pattern, one level up). Not a component
// reimplementation - the real HomeHero renders, only its fetch is stubbed.
const REAL_FETCH = window.fetch.bind(window)
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/characters/mine')) {
    return Promise.resolve(
      new Response(
        JSON.stringify([
          { id: '1', name: 'Seraphine', race: 'Tiefling', class: 'Warlock', level: 4, currentAdventure: { id: 'a1', title: 'A Vigília do Arboreto' } },
          { id: '2', name: 'Rhogar', race: 'Anão da Colina', class: 'Guerreiro', level: 2, currentAdventure: null },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
  }
  return REAL_FETCH(input, init)
}) as typeof window.fetch

export function WithCharacters() {
  return <HomeHero />
}
