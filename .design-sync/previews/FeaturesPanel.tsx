import { Panel } from '@/components/ui/dm'
import { FeaturesPanel } from '@/components/character/FeaturesPanel'

// Sweeps: a spellcaster (both sections render) vs. a martial class (features
// only, no spells section) vs. empty (game.features.empty).
export function Spellcaster() {
  return (
    <Panel className="max-w-md p-5">
      <FeaturesPanel
        features={[
          { name: 'Pacto da Lâmina', description: 'Você pode usar sua ação para criar uma arma de pacto na mão vazia.', origin: 'class' },
          { name: 'Sortudo', description: 'Você tem sorte incomum. Quando tirar 1 num d20, pode rolar novamente.', origin: 'background' },
        ]}
        spells={[
          { key: 'eldritch-blast', name: 'Rajada Mística', level: 0, source: 'warlock', description: 'Um feixe de energia crepitante.' },
          { key: 'hex', name: 'Praga', level: 1, source: 'warlock', description: 'Amaldiçoa uma criatura por até 1 hora.' },
        ]}
      />
    </Panel>
  )
}

export function MartialNoSpells() {
  return (
    <Panel className="max-w-md p-5">
      <FeaturesPanel
        features={[
          { name: 'Segundo Fôlego', description: 'Recupera 1d10 + nível de pontos de vida como ação bônus.', origin: 'class' },
        ]}
      />
    </Panel>
  )
}

export function Empty() {
  return (
    <Panel className="max-w-md p-5">
      <FeaturesPanel />
    </Panel>
  )
}
