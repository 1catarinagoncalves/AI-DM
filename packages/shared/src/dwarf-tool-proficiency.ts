// Traço "Tool Proficiency" do anão (hill-dwarf, único anão jogável no catálogo hoje) —
// regra fixa do PHB 2014/SRD ("You gain proficiency with the artisan's tools of your choice:
// smith's tools, brewer's supplies, or mason's tools."), mesmo raciocínio de
// draconic-ancestry.ts: é o ÚNICO raceFeature do dataset com escolha real (grep por
// "tools"/"instrument" em raceFeatures não achou segundo caso — o outro hit, Tinker do
// rock-gnome, é ferramenta FIXA, sem escolha) — não vale generalizar um parser de `grant`
// estruturado como a US-132 fez para os 13 backgrounds por um caso só. Chaves = config.tools[].key
// (US-134, já ingeridas do mesmo Item.json que resolve o benefício de ferramenta do background).
export const DWARF_TOOL_PROFICIENCY_CHOICES = ['smiths_tools', 'brewers_supplies', 'masons_tools'] as const
