// US-211: ancestralidade dracônica do dragonborn — regra FIXA do PHB 2014, não conteúdo do
// SRD ingerido (verificado: todo trait de `raceFeatures['dragonborn']` tem `type: null` na
// fonte Open5e, a tabela existe só como prosa dentro de um `desc`). Por isso vive aqui como
// dado de código, fora do pipeline sync/ingest, e não em `System.config` — se um sistema
// diferente de D&D 5e algum dia tiver dragonborn próprio, esta tabela precisaria virar dado
// de sistema (fora de escopo hoje, Fase 1 é só SRD D&D 5e).
export type DraconicDamageType = 'acid' | 'cold' | 'fire' | 'lightning' | 'poison'
export type DraconicBreathShape = 'line' | 'cone'

export type DraconicAncestryEntry = {
  key: string // 'black' | 'blue' | 'brass' | 'bronze' | 'copper' | 'gold' | 'green' | 'red' | 'silver' | 'white'
  damageType: DraconicDamageType
  breathShape: DraconicBreathShape
  saveAttribute: string // chave de config.attributes, ex. 'dex' | 'con' (mesmo formato de US-209 saving_throws)
}

export const DRACONIC_ANCESTRY_TABLE: DraconicAncestryEntry[] = [
  { key: 'black', damageType: 'acid', breathShape: 'line', saveAttribute: 'dex' },
  { key: 'blue', damageType: 'lightning', breathShape: 'line', saveAttribute: 'dex' },
  { key: 'brass', damageType: 'fire', breathShape: 'line', saveAttribute: 'dex' },
  { key: 'bronze', damageType: 'lightning', breathShape: 'line', saveAttribute: 'dex' },
  { key: 'copper', damageType: 'acid', breathShape: 'line', saveAttribute: 'dex' },
  { key: 'gold', damageType: 'fire', breathShape: 'cone', saveAttribute: 'dex' },
  { key: 'green', damageType: 'poison', breathShape: 'cone', saveAttribute: 'con' },
  { key: 'red', damageType: 'fire', breathShape: 'cone', saveAttribute: 'dex' },
  { key: 'silver', damageType: 'cold', breathShape: 'cone', saveAttribute: 'con' },
  { key: 'white', damageType: 'cold', breathShape: 'cone', saveAttribute: 'con' },
]
