// US-215: ferramenta FIXA concedida por raça (traço "Tinker" do gnomo das rochas, PHB 2014) —
// distinto de DWARF_TOOL_PROFICIENCY_CHOICES: aquela é escolha do jogador (raceToolChoice,
// validada no DTO); esta é concessão sem escolha, mesmo formato de RACE_LANGUAGES. Chave já
// existe em config.tools (US-134) — sem catálogo novo, só soma direta em Character.tools.
export const RACE_TOOL_PROFICIENCIES: Record<string, readonly string[]> = {
  'rock-gnome': ['tinkers_tools'],
}
