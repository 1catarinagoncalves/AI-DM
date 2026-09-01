import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MODULE_METADATA } from '@nestjs/common/constants'

// US-202, critério de aceite (b): registro condicional. `NODE_ENV === 'production'` a rota
// não entra no controller — e o teste lê o REGISTRO DE VERDADE (`Reflect.getMetadata` sobre
// a classe do módulo, o mesmo lugar de onde o Nest lê para montar as rotas), não uma cópia
// da condição — continua passando depois de alguém apagar a porta dupla do código.
//
// `devExportEnabled` é calculado no TOPO de `adventure.module.ts`, na primeira importação —
// por isso cada caso muda `process.env` e reimporta o módulo com `vi.resetModules()` (mesmo
// padrão de "subir o módulo de teste com cada valor de env" que as Notas de implementação
// da US sugerem).
const ORIGINAL_ENV = { ...process.env }

async function loadControllerNames(): Promise<string[]> {
  vi.resetModules()
  const mod = await import('./adventure.module')
  const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, mod.AdventureModule) as Array<{ name: string }>
  return controllers.map((c) => c.name)
}

describe('US-202 — registro condicional do AdventureExportController', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('NODE_ENV=production com DEV_EXPORT=1: controller NÃO entra — as duas condições são exigidas, não alternativas', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DEV_EXPORT'] = '1'
    expect(await loadControllerNames()).not.toContain('AdventureExportController')
  })

  it('NODE_ENV!==production e DEV_EXPORT=1: controller entra no array', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['DEV_EXPORT'] = '1'
    expect(await loadControllerNames()).toContain('AdventureExportController')
  })

  it('DEV_EXPORT ausente, mesmo fora de produção: controller NÃO entra', async () => {
    process.env['NODE_ENV'] = 'development'
    delete process.env['DEV_EXPORT']
    expect(await loadControllerNames()).not.toContain('AdventureExportController')
  })

  it('AdventureController (rota de turnos) entra sempre, independente das duas flags', async () => {
    process.env['NODE_ENV'] = 'production'
    delete process.env['DEV_EXPORT']
    expect(await loadControllerNames()).toContain('AdventureController')
  })
})
