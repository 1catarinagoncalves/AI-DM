/**
 * US-146: seed determinístico do motor de geração de aventuras. Nenhum
 * sorteio do motor usa `Math.random` — tudo passa por `createSeededRandom`,
 * seedado por `deriveAdventureSeed`, pra mesma ficha regenerar mesma aventura.
 */

/**
 * FNV-1a 32-bit sobre `${characterId}:${order}` — estável, sem colisão óbvia entre vizinhos.
 * `attempt` (US-150, reseed): default `0` produz o MESMO input de sempre (nenhum teste de
 * determinismo já verde quebra); só `attempt > 0` muda o hash, um reseed real por tentativa.
 */
export function deriveAdventureSeed(characterId: string, order: number, attempt = 0): number {
  const input = attempt === 0 ? `${characterId}:${order}` : `${characterId}:${order}:${attempt}`
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32: PRNG puro, sem dependência nova. Cada chamada avança o estado e devolve um float em [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
