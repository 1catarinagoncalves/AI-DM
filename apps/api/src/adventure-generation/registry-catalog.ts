// US-147 — chaves de registro pro sorteio (fallback quando não há override). Chaves em
// inglês canônico (mesmo padrão da US-54: `paladin`/`wizard`, não rótulo pt-BR) — rótulo/
// tradução é problema do catálogo (US-156), não desta rolagem.
//
// Trivialmente substituível: `rollRegistry` recebe a lista por parâmetro (default aqui), nunca
// hardcoded inline no algoritmo de sorteio. `SETTINGS`/`TONES`/`AREA_TYPES` sincronizados com
// o catálogo real da US-156 (`SystemConfig.settings/tones/areaTypes`, `dhorions/DnDGenerate`,
// MPL-2.0 — ver `registryTones`/`registrySettings`/`registryAreaTypes` em seed.ts) em 21/08/2026.
export const SETTINGS = [
  'high-fantasy', 'dark-fantasy', 'steampunk', 'urban-fantasy', 'post-apocalyptic',
  'historical-fiction', 'sci-fi-space-opera', 'mythological', 'alternate-reality', 'cyberpunk',
] as const

export const TONES = [
  'heroic', 'grimdark', 'mystery', 'comedic', 'epic',
  'romantic', 'horror', 'political-intrigue', 'survival', 'slice-of-life',
] as const

export const AREA_TYPES = [
  'city', 'forest', 'mountain-range', 'underground-caves', 'desert',
  'coastal-area', 'swamp', 'plains', 'magical-realm', 'ruins',
] as const

// US-240: as mesmas 10 categorias do cheat-sheet da Onomástica (ai-engine, dm-system.ts
// ONOMASTICS_SECTION) — sincronizar as duas listas manualmente se uma mudar, mesma disciplina
// do comentário acima pra SETTINGS/TONES/AREA_TYPES. Nunca escolhido pelo jogador (sem toggle
// "Aleatório", sempre sorteado por `rollNamingRegister`), então SEM tratamento catalogLabel —
// o valor vai pro prompt de autoria como a categoria em inglês, texto do próprio cheat-sheet
// (não kebab-case como os arrays acima), pra casar 1:1 com o que o modelo já lê ali.
export const NAMING_REGISTERS = [
  'Greco-classical', 'Celtic', 'Norse/Germanic', 'Latin/Roman', 'Arabic/Persian',
  'Slavic/folkloric', 'Elvish', 'Guttural/brute', 'Infernal/exotic', 'Rustic',
] as const
