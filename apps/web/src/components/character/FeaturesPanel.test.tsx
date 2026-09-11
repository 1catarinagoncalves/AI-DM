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

// US-231: origin: 'subclass' é o OPOSTO de 'race' — aparece na lista, com badge próprio.
describe('FeaturesPanel — tag de subclasse e nível de desbloqueio (US-231)', () => {
  it('item com origin: subclass aparece na lista com badge "Subclasse"', () => {
    render(
      <FeaturesPanel
        features={[
          { name: 'Discípulo da Vida', description: 'Cura reforçada.', origin: 'subclass', level: 1 },
        ]}
      />,
    )

    expect(screen.getByText('Discípulo da Vida')).toBeTruthy()
    expect(screen.getByText('Subclasse')).toBeTruthy()
  })

  it('feature com level mostra o badge "Nível N"; sem level, nenhum badge de nível', () => {
    render(
      <FeaturesPanel
        features={[
          { name: 'Ataque Extra', description: 'Ataca duas vezes.', origin: 'class', level: 5 },
          { name: 'Sentido Divino', description: 'Sente o mal por perto.', origin: 'class' },
        ]}
      />,
    )

    expect(screen.getByText('Nível 5')).toBeTruthy()
    expect(screen.getAllByText('Classe')).toHaveLength(2)
  })

  it('lista com classe, subclasse e origem mostra os três badges de origem, cada um só onde tem nível', () => {
    render(
      <FeaturesPanel
        features={[
          { name: 'Fúria', description: 'x', origin: 'class', level: 1 },
          { name: 'Discípulo da Vida', description: 'x', origin: 'subclass', level: 1 },
          { name: "Thieves' Cant", description: 'x', origin: 'background' },
        ]}
      />,
    )

    expect(screen.getByText('Classe')).toBeTruthy()
    expect(screen.getByText('Subclasse')).toBeTruthy()
    expect(screen.getByText('Origem')).toBeTruthy()
    expect(screen.getAllByText('Nível 1')).toHaveLength(2) // Fúria e Discípulo da Vida
  })
})
