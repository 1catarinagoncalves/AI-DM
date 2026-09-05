// US-215: proficiência de arma concedida por raça (PHB 2014) — mesmo raciocínio de
// race-languages.ts: raceFeatures['<raça>'] traz a entrada como PROSA em inglês, sem chave de
// config.weapons. Tabela fixa, fora do pipeline sync/ingest, porque é regra do livro. As duas
// raças abaixo são as únicas do catálogo jogável com traço de arma no PHB 2014 — nenhuma tem escolha.
export const RACE_WEAPON_PROFICIENCIES: Record<string, readonly string[]> = {
  'hill-dwarf': ['battleaxe', 'handaxe', 'light_hammer', 'warhammer'],
  'high-elf': ['longsword', 'shortsword', 'shortbow', 'longbow'],
}
