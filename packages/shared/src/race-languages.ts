// US-214: idiomas fixos concedidos por raça (PHB 2014) — mesmo raciocínio de
// draconic-ancestry.ts: raceFeatures['<raça>'] traz a entrada `languages` só como PROSA em
// inglês, sem chave de config.languages. Tabela fixa, fora do pipeline sync/ingest, porque é
// regra do livro, não conteúdo que muda com um re-ingest do SRD.
export const RACE_LANGUAGES: Record<string, readonly string[]> = {
  dragonborn: ['common', 'draconic'],
  'half-elf': ['common', 'elvish'],
  'half-orc': ['common', 'orc'],
  'high-elf': ['common', 'elvish'],
  'hill-dwarf': ['common', 'dwarvish'],
  human: ['common'],
  lightfoot: ['common', 'halfling'],
  'rock-gnome': ['common', 'gnomish'],
  tiefling: ['common', 'infernal'],
}

// Raças cujo traço de idioma inclui "um extra à sua escolha" (PHB 2014) — as 3 concedem
// exatamente 1. Generaliza o raceLanguageChoice/<select> que antes só ligava para 'high-elf'.
export const RACE_EXTRA_LANGUAGE_CHOICE: readonly string[] = ['high-elf', 'human', 'half-elf']
