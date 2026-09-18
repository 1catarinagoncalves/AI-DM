import type { AdventureStatus } from '../generated/prisma/client'

// US-256: "aventura em andamento" = ACTIVE ou OPENING_READY (abertura já no chat, resto ainda
// gerando). Sem OPENING_READY aqui o hub esconderia o "continuar" da jogadora que saiu do chat antes
// do fim, e criar outra aventura não fecharia a anterior (`updateMany` em `AdventureService`).
export const IN_PROGRESS_ADVENTURE_STATUSES: AdventureStatus[] = ['ACTIVE', 'OPENING_READY']
