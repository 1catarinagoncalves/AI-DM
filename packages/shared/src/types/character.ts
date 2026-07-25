export interface Attributes {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

export interface CharacterState {
  id: string
  characterId: string
  adventureId: string
  hp: number
  maxHp: number
  attributes: Attributes
  inventory: InventoryItem[]
  conditions: string[]
  updatedAt: string
}

export interface InventoryItem {
  name: string
  qty: number
}

// Estado de cena estruturado (US-03): fonte de verdade da continuidade
// espacial, reinjetada no prompt a cada turno e atualizada deterministicamente.
export interface SceneState {
  local: string
  ambiente: 'externo' | 'interno'
  periodo: string
  presentes: string[]
  objetos_em_cena: string[]
  atualizadoEm: string
}

// Entidade durável da campanha: um NPC, local, objeto ou facção que o mundo trata
// como canon permanente. Ao contrário da cena (só o AGORA) e do resumo (prosa
// lossy, comprimível), este registro vive no Adventure e é reinjetado no prompt a
// cada turno SEM nunca ser comprimido — assim um callback a uma entidade de muitos
// turnos atrás (ex.: "a Vigia na sala secreta") não depende de sorte do compressor.
// Chave lógica = `nome` (match tolerante a acento/caixa no merge).
export interface WorldEntity {
  nome: string
  tipo?: 'npc' | 'local' | 'objeto' | 'faccao' | 'outro'
  /** Onde a entidade está agora (para NPC/objeto móvel). Local em si não tem `local`. */
  local?: string
  /** Condição/relação corrente: "inconsciente", "acordado", "morto", "aliada", "hostil". */
  estado?: string
  /** Fato durável curto que o mestre não pode esquecer. */
  nota?: string
  /**
   * Eixo A — proveniência no mundo (US-75): quem, no mundo, pode saber disto.
   * `publico` = conhecimento comum (qualquer NPC local pode referenciar).
   * `privado` = só o jogador e quem testemunhou; um NPC só menciona se o
   * jogador lhe contou em cena. Ausente ⇒ `publico` (retrocompat).
   */
  sabido?: 'publico' | 'privado'
  /**
   * Eixo B — descoberta do jogador (US-75): o personagem-jogador já sabe disto?
   * `true` (default) = já descobriu; o Mestre narra livremente.
   * `false` = verdade do mundo que o Mestre mantém só para não se contradizer,
   * mas NÃO revela ao jogador até a ficção merecer (então re-registra `true`).
   * Ausente ⇒ `true` (retrocompat).
   */
  revelado?: boolean
  atualizadoEm: string
}
