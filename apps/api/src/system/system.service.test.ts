import { describe, it, expect } from 'vitest'
import { SystemService } from './system.service'
import type { PrismaService } from '../prisma.service'

// Base EN + localização pt-BR do mesmo sistema, no formato que o seed grava (US-99).
// Os dois artefatos são COMPLETOS: o fallback por chave já foi resolvido no ingest
// (`resolve()`), então `investigation` existe nos dois — em pt-BR com o texto EN,
// porque o overlay não o traduz. Nada é mesclado na leitura.
const enBase = {
  attributes: [{ key: 'strength', label: 'Strength', min: 10, max: 18, default: 10 }],
  skills: [
    { key: 'athletics', label: 'Athletics', ability: 'strength' },
    { key: 'investigation', label: 'Investigation', ability: 'intelligence' },
  ],
}
const ptBR = {
  attributes: [{ key: 'strength', label: 'Força', min: 10, max: 18, default: 10 }],
  skills: [
    { key: 'athletics', label: 'Atletismo', ability: 'strength' },
    { key: 'investigation', label: 'Investigation', ability: 'intelligence' },
  ],
}

// Test double do PrismaService: só `user.findUnique` e `system.findMany`, os dois
// métodos que findAll chama. `as unknown as` porque o double não implementa o client.
function fakePrisma(locale?: string): PrismaService {
  return {
    user: { findUnique: async () => (locale ? { locale } : null) },
    system: {
      findMany: async () => [
        { id: 'system-dnd5e', name: 'D&D 5e SRD', version: '5.2', sourceType: 'SRD', config: enBase, configLocales: { 'pt-BR': ptBR } },
      ],
    },
  } as unknown as PrismaService
}

describe('SystemService.findAll (US-99)', () => {
  it('serve a base EN crua para quem está em en-US', async () => {
    const [system] = await new SystemService(fakePrisma('en-US')).findAll('u1')
    expect(system!.config).toEqual(enBase)
  })

  it('serve a localização pt-BR para quem está em pt-BR', async () => {
    const [system] = await new SystemService(fakePrisma('pt-BR')).findAll('u1')
    expect(system!.config).toEqual(ptBR)
  })

  // O par que falha se o overlay voltar a ser achatado num artefato só, ou se a
  // resolução ignorar o locale (critério de aceite da US-99).
  it('o MESMO sistema devolve Strength/Força conforme o locale', async () => {
    const [en] = await new SystemService(fakePrisma('en-US')).findAll('u1')
    const [pt] = await new SystemService(fakePrisma('pt-BR')).findAll('u1')
    const labelOf = (s: typeof en) => s!.config!.attributes[0]!.label
    expect([labelOf(en), labelOf(pt)]).toEqual(['Strength', 'Força'])
  })

  it('sem userId (health check do Render) cai no locale default, sem erro', async () => {
    const [system] = await new SystemService(fakePrisma()).findAll()
    expect(system!.config).toEqual(ptBR) // DEFAULT_LOCALE
  })

  it('chave sem tradução no overlay chega em pt-BR com o texto EN, sem sumir nem vir vazia', async () => {
    const [pt] = await new SystemService(fakePrisma('pt-BR')).findAll('u1')
    const investigation = pt!.config!.skills!.find((s) => s.key === 'investigation')
    expect(investigation!.label).toBe('Investigation')
  })

  it('sistema sem localização nenhuma (Free) cai na base, sem quebrar', async () => {
    const prisma = {
      user: { findUnique: async () => ({ locale: 'en-US' }) },
      system: { findMany: async () => [{ id: 'system-free', name: 'Free', version: '1.0', sourceType: 'FREE', config: enBase, configLocales: {} }] },
    } as unknown as PrismaService
    const [system] = await new SystemService(prisma).findAll('u1')
    expect(system!.config).toEqual(enBase)
  })

  it('não vaza o mapa de locales no payload — sai UM config, não os dois', async () => {
    const [system] = await new SystemService(fakePrisma('en-US')).findAll('u1')
    expect('configLocales' in system!).toBe(false)
  })

  it('não vaza ragIndexId nem outra coluna nova do model no payload', async () => {
    const prisma = {
      user: { findUnique: async () => ({ locale: 'en-US' }) },
      system: { findMany: async () => [{ id: 'system-free', name: 'Free', version: '1.0', sourceType: 'FREE', ragIndexId: 'idx-1', config: enBase, configLocales: {} }] },
    } as unknown as PrismaService
    const [system] = await new SystemService(prisma).findAll('u1')
    expect(Object.keys(system!).sort()).toEqual(['config', 'id', 'name', 'sourceType', 'version'])
  })

  // Regressão: esta rota é o healthCheckPath do Render (render.yaml), batida em loop.
  // Sem cache, cada ping arrastava as 2 linhas de System (~375KB) pela rede — sozinho
  // estourou a cota mensal de network transfer da Neon (5GB) antes do fim do mês.
  it('health check em loop não repete a query — o blob do SRD viaja UMA vez', async () => {
    let calls = 0
    const prisma = {
      user: { findUnique: async () => null },
      system: {
        findMany: async () => {
          calls++
          return [{ id: 'system-free', name: 'Free', version: '1.0', sourceType: 'FREE', config: enBase, configLocales: {} }]
        },
      },
    } as unknown as PrismaService
    const service = new SystemService(prisma)

    await service.findAll()
    await service.findAll()
    await service.findAll()

    expect(calls).toBe(1)
  })
})
