import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Sistema "Free" — o AI DM narra livremente, sem seguir regras de um sistema oficial.
  // Ideal para quem quer jogar uma aventura sem se preocupar com mecânicas.
  await prisma.system.upsert({
    where: { id: 'system-free' },
    update: {},
    create: {
      id: 'system-free',
      name: 'Free',
      version: '1.0',
      sourceType: 'FREE',
    },
  })

  // Sistema D&D 5e SRD — regras abertas do Dungeons & Dragons 5ª edição.
  await prisma.system.upsert({
    where: { id: 'system-dnd5e' },
    update: {},
    create: {
      id: 'system-dnd5e',
      name: 'D&D 5e SRD',
      version: '5.1',
      sourceType: 'SRD',
    },
  })

  console.log('Sistemas criados: Free, D&D 5e SRD')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
