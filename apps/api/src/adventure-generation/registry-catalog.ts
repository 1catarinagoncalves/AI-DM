// US-147 — chaves de registro pro sorteio (fallback quando não há override). Chaves em
// inglês canônico (mesmo padrão da US-54: `paladin`/`wizard`, não rótulo pt-BR) — rótulo/
// tradução é problema do catálogo (US-156), não desta rolagem.
//
// Trivialmente substituível: `rollRegistry` recebe a lista por parâmetro (default aqui), nunca
// hardcoded inline no algoritmo de sorteio. `SETTINGS`/`AREA_TYPES` sincronizados com o
// catálogo real da US-156 (`SystemConfig.settings/areaTypes`, `dhorions/DnDGenerate`,
// MPL-2.0 — ver seed.ts) em 21/08/2026; `TONES` ainda é o subconjunto provisório anterior
// à US-156 (ver `registryTones` em seed.ts para as dez chaves reais).
export const SETTINGS = [
  'high-fantasy', 'dark-fantasy', 'steampunk', 'urban-fantasy', 'post-apocalyptic',
  'historical-fiction', 'sci-fi-space-opera', 'mythological', 'alternate-reality', 'cyberpunk',
] as const

export const TONES = ['heroic', 'grimdark', 'comedic', 'mystery', 'horror', 'political'] as const

export const AREA_TYPES = [
  'city', 'forest', 'mountain-range', 'underground-caves', 'desert',
  'coastal-area', 'swamp', 'plains', 'magical-realm', 'ruins',
] as const
