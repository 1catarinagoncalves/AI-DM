import { rollRegistry, type AdventureRegistry, type AdventureRegistryOverrides } from './roll-registry'
import { rollContent, type RolledAdventureContent } from './roll-content'

export interface RolledAdventure {
  registry: AdventureRegistry
  content: RolledAdventureContent
}

/**
 * Ponto de entrada do motor de rolagem (US-147): registro primeiro, conteúdo depois — a
 * ordem é o próprio critério de aceite (backlog: "tom decidido depois não retroage no que já
 * foi escrito"). `registry` deve ser passado a toda chamada de modelo subsequente na mesma
 * execução (US-149 em diante).
 *
 * Os dois sorteios usam sub-seeds independentes (ver roll-registry/roll-content) — a ordem
 * aqui é garantia de USO, não de uma sequência de PRNG compartilhada entre os dois.
 *
 * `attempt` (US-150, reseed): default `0`, repassado aos dois sorteios — a tentativa seguinte
 * do gate rola registro e conteúdo NOVOS, não só reamostra o modelo por cima do mesmo material.
 */
export function rollAdventure(
  characterId: string,
  order: number,
  registryOverrides: AdventureRegistryOverrides = {},
  attempt = 0,
): RolledAdventure {
  const registry = rollRegistry(characterId, order, registryOverrides, attempt)
  const content = rollContent(characterId, order, undefined, attempt)
  return { registry, content }
}
