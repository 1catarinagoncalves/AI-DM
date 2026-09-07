// US-220: perícia FIXA concedida por raça (Keen Senses do Alto-elfo, Menacing do Meio-orc) —
// mesmo formato de RACE_TOOL_PROFICIENCIES/RACE_LANGUAGES: soma direta em Character.skills,
// chaves já existentes em config.skills (US-27), sem catálogo novo.
export const RACE_SKILL_PROFICIENCIES: Record<string, readonly string[]> = {
  'high-elf': ['perception'],
  'half-orc': ['intimidation'],
}

// US-220: quantas perícias À ESCOLHA a raça concede (Skill Versatility do Meio-elfo). Mapa
// (não constante) para o caso de um bump trazer outra raça versátil — o pool de escolha é
// config.skills inteiro, ao contrário de DWARF_TOOL_PROFICIENCY_CHOICES (tabela fixa).
export const RACE_SKILL_PROFICIENCY_CHOICES: Record<string, number> = {
  'half-elf': 2,
}
