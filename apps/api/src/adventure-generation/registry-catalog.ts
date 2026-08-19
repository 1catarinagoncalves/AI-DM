// US-147 — lista provisória de chaves de registro, até a US-156 (catálogo real + DTO)
// existir. Chaves em inglês canônico (mesmo padrão da US-54: `paladin`/`wizard`, não rótulo
// pt-BR) — rótulo/tradução é problema do catálogo (US-156), não desta rolagem.
//
// Trivialmente substituível: `rollRegistry` recebe a lista por parâmetro (default aqui), nunca
// hardcoded inline no algoritmo de sorteio. Quando a US-156 chegar, troca-se só a fonte da
// lista (esta constante → `SystemConfig.tones`), sem tocar roll-registry.ts.
//
// US-173: `SETTINGS`/`AREA_TYPES` removidos — o registro só tem `tone`.
export const TONES = ['heroic', 'grimdark', 'comedic', 'mystery', 'horror', 'political'] as const
