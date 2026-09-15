import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { AdventureErrorScreen } from './AdventureErrorScreen'

describe('AdventureErrorScreen (US-235)', () => {
  afterEach(() => cleanup())

  it('mostra a mensagem de erro e o botão de retry', () => {
    render(<AdventureErrorScreen onRetry={() => {}} />)
    expect(screen.getByText('A geração deu errado')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Criar aventura de novo/ })).toBeTruthy()
  })

  it('clicar no botão chama onRetry', () => {
    const onRetry = vi.fn()
    render(<AdventureErrorScreen onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /Criar aventura de novo/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
