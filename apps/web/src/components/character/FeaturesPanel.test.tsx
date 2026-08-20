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

  // US-142: traço de raça chega marcado origin: 'race' (mesmo pipeline de Character.features),
  // mas a aba Features nunca cobriu raça (US-41/US-136) — item some da lista, não vira badge novo.
  it('item com origin: race não aparece na lista', () => {
    render(
      <FeaturesPanel
        features={[
          { name: 'Impor as Mãos', description: 'Cura ao toque.', origin: 'class' },
          { name: 'Visão no Escuro', description: '18m.', origin: 'race' },
        ]}
      />,
    )

    expect(screen.getByText('Impor as Mãos')).toBeTruthy()
    expect(screen.queryByText('Visão no Escuro')).toBeNull()
  })

  it('lista só com traços de raça mostra o empty state', () => {
    render(<FeaturesPanel features={[{ name: 'Visão no Escuro', description: '18m.', origin: 'race' }]} />)

    expect(screen.queryByText('Visão no Escuro')).toBeNull()
  })
})
