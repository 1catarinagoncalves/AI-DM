import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const { listSystems } = vi.hoisted(() => ({ listSystems: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { listSystems, createUser: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/session', () => ({
  loadSession: () => ({ userId: 'u1' }),
  saveSession: vi.fn(),
}))

import { SetupWizard } from './SetupWizard'

describe('SetupWizard — catálogo de sistemas via API (US-20)', () => {
  beforeEach(() => listSystems.mockReset())
  afterEach(() => cleanup())

  it('renderiza exatamente uma opção por sistema devolvido pela API, com o name da API', async () => {
    listSystems.mockResolvedValue([
      { id: 'system-free', name: 'Free', sourceType: 'FREE', config: null },
      { id: 'system-dnd5e', name: 'D&D 5e SRD', sourceType: 'SRD', config: null },
    ])

    render(<SetupWizard />)

    // um <button> de sistema por item — nada hardcoded a mais/menos
    const options = await screen.findAllByRole('button')
    expect(options).toHaveLength(2)
    expect(screen.getByText('Free')).toBeTruthy()
    expect(screen.getByText('D&D 5e SRD')).toBeTruthy()
  })

  // nota: a UI de erro (busca falhada → mensagem em vez de lista vazia) é verificada
  // no preview; um teste unitário aqui esbarra no tracking de rejeições do vitest.
})
