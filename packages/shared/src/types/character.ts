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
// Vínculo dirigido entre duas entidades do ledger (US-113), ancorado em quem o
// estabeleceu. Fecha a lacuna que a US-75 deixou aberta: um fato como "Marta é irmã
// de Morvath" não é atributo de uma entidade, é a relação ENTRE duas — e vivia
// espalhado (e divergindo) em `nota`. Mora na entidade de ORIGEM (não em coluna
// própria): o ledger é pequeno e reexibido inteiro todo turno, então não há índice
// a pagar por "quem aponta para B" ser uma varredura.
export interface EntityEdge {
  /** Verbo do vínculo, legível na prosa: "irmã de", "deve dinheiro a", "serve", "fica dentro de". */
  relacao: string
  /** `nome` da entidade de destino. Texto cru — sem lookup no ledger; aresta órfã não é erro. */
  para: string
  /**
   * ONDE este vínculo foi estabelecido. É o que separa canon de improviso:
   * "abertura" = semeado da prosa de gênese; "turno: <eventLogId>" = estabelecido
   * na ficção jogada. Sem esta âncora a aresta seria só uma `nota` com mais passos.
   */
  fonte: string
  /** Eixo A da US-75, aplicado AO VÍNCULO — independente do das pontas. Ausente ⇒ `publico`. */
  sabido?: 'publico' | 'privado'
  /** Eixo B da US-75, aplicado AO VÍNCULO. Ausente ⇒ `true`. Duas pontas reveladas podem ter vínculo oculto. */
  revelado?: boolean
  atualizadoEm: string
}

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
  /** Vínculos DIRIGIDOS desta entidade para outras do ledger (US-113). Ausente ⇒ sem vínculo (retrocompat). */
  relacoes?: EntityEdge[]
  atualizadoEm: string
}
