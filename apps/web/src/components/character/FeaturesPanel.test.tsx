import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FeaturesPanel } from './FeaturesPanel'

afterEach(() => cleanup())

// US-136: badge de origem por item, sem quebrar chamador que não passa `origin`.
describe('FeaturesPanel — tag de origem (US-136)', () => {
  it('lista mista renderiza os dois badges (Classe/Origem)', () => {
    render(
      <FeaturesPanel
        features={[
          { name: 'Impor as Mãos', description: 'Cura ao toque.', origin: 'class' },
          { name: "Thieves' Cant", description: 'Código secreto.', origin: 'background' },
        ]}
      />,
    )

    expect(screen.getByText('Impor as Mãos')).toBeTruthy()
    expect(screen.getByText('Classe')).toBeTruthy()
    expect(screen.getByText("Thieves' Cant")).toBeTruthy()
    expect(screen.getByText('Origem')).toBeTruthy()
  })

  it('item sem origin não quebra e não mostra badge', () => {
    render(<FeaturesPanel features={[{ name: 'Sentido Divino', description: 'Sente o mal por perto.' }]} />)

    expect(screen.getByText('Sentido Divino')).toBeTruthy()
    expect(screen.queryByText('Classe')).toBeNull()
    expect(screen.queryByText('Origem')).toBeNull()
  })
})
