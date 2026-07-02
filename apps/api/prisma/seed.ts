import { PrismaClient } from '@prisma/client'
import type { SystemConfig } from '@ai-dm/shared'

const prisma = new PrismaClient()

const dnd5eAttributes: SystemConfig['attributes'] = [
  { key: 'strength', label: 'Força', min: 3, max: 20, default: 10 },
  { key: 'dexterity', label: 'Destreza', min: 3, max: 20, default: 10 },
  { key: 'constitution', label: 'Constituição', min: 3, max: 20, default: 10 },
  { key: 'intelligence', label: 'Inteligência', min: 3, max: 20, default: 10 },
  { key: 'wisdom', label: 'Sabedoria', min: 3, max: 20, default: 10 },
  { key: 'charisma', label: 'Carisma', min: 3, max: 20, default: 10 },
]

// Transportada de starting-inventory.ts (era a constante KITS hardcoded).
const dnd5eKits: SystemConfig['startingKits'] = {
  guerreiro: [
    { name: 'Espada longa', qty: 1 },
    { name: 'Escudo', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Mochila', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  mago: [
    { name: 'Cajado arcano', qty: 1 },
    { name: 'Grimório', qty: 1 },
    { name: 'Vestes de mago', qty: 1 },
    { name: 'Poção de mana', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  arqueiro: [
    { name: 'Arco longo', qty: 1 },
    { name: 'Aljava (20 flechas)', qty: 1 },
    { name: 'Adaga', qty: 1 },
    { name: 'Armadura de couro leve', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  ladino: [
    { name: 'Adaga', qty: 2 },
    { name: 'Ferramentas de ladrão', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Corda', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  clerigo: [
    { name: 'Martelo', qty: 1 },
    { name: 'Símbolo sagrado', qty: 1 },
    { name: 'Armadura de malha', qty: 1 },
    { name: 'Kit de primeiros socorros', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  paladino: [
    { name: 'Espada longa', qty: 1 },
    { name: 'Escudo', qty: 1 },
    { name: 'Armadura de malha', qty: 1 },
    { name: 'Símbolo sagrado', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  barbaro: [
    { name: 'Machado grande', qty: 1 },
    { name: 'Pele de urso (armadura)', qty: 1 },
    { name: 'Adaga', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  druida: [
    { name: 'Cajado de carvalho', qty: 1 },
    { name: 'Símbolo druídico', qty: 1 },
    { name: 'Túnica de couro', qty: 1 },
    { name: 'Kit de ervas', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  bardo: [
    { name: 'Espada curta', qty: 1 },
    { name: 'Instrumento musical', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  feiticeiro: [
    { name: 'Cajado', qty: 1 },
    { name: 'Foco arcano (cristal)', qty: 1 },
    { name: 'Vestes ornamentadas', qty: 1 },
    { name: 'Poção de mana', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  // Fallback: aventureiro genérico para classes fora da tabela. Nunca devolvemos inventário vazio.
  default: [
    { name: 'Adaga', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Mochila', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
}

const freeConfig: SystemConfig = {
  attributes: [{ key: 'sorte', label: 'Sorte', min: 1, max: 20, default: 10 }],
  startingKits: {
    default: [
      { name: 'Mochila', qty: 1 },
      { name: 'Cantil', qty: 1 },
    ],
  },
}

const dnd5eConfig: SystemConfig = { attributes: dnd5eAttributes, startingKits: dnd5eKits }

async function main() {
  // Sistema "Free" — o AI DM narra livremente, sem seguir regras de um sistema oficial.
  // Ideal para quem quer jogar uma aventura sem se preocupar com mecânicas.
  await prisma.system.upsert({
    where: { id: 'system-free' },
    update: { config: freeConfig },
    create: {
      id: 'system-free',
      name: 'Free',
      version: '1.0',
      sourceType: 'FREE',
      config: freeConfig,
    },
  })

  // Sistema D&D 5e SRD — regras abertas do Dungeons & Dragons 5ª edição.
  await prisma.system.upsert({
    where: { id: 'system-dnd5e' },
    update: { config: dnd5eConfig },
    create: {
      id: 'system-dnd5e',
      name: 'D&D 5e SRD',
      version: '5.1',
      sourceType: 'SRD',
      config: dnd5eConfig,
    },
  })

  console.log('Sistemas criados: Free, D&D 5e SRD')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
