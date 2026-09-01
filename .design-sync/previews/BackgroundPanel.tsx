import { Panel } from '@/components/ui/dm'
import { BackgroundPanel } from '@/components/character/BackgroundPanel'

// Sweeps the two real states: fully populated (every optional block renders)
// and the empty state (game.background.empty) - the panel never disappears,
// only its content changes (US-45).
export function Complete() {
  return (
    <Panel className="max-w-md p-5">
      <BackgroundPanel
        originName="Herói do Povo"
        connection="Um ferreiro da vila natal, que a ensinou o ofício antes de partir."
        memento="Um martelo de ferreiro gasto, herdado do mestre."
        adventures="Seraphine busca notícias da vila que deixou para trás, temendo pelo que a guerra fez a ela."
        background={{
          story: 'Nascida entre o fumo da forja, Seraphine sempre soube que o destino lhe reservava algo além do martelo e da bigorna.',
          ideals: ['O conhecimento tem um preço — eu pago o meu.'],
          bonds: ['Devo tudo ao ferreiro que me criou.'],
          flaws: ['Confio demais em quem promete respostas.'],
          deity: { name: 'Gond', portfolio: 'Artesania e invenção' },
        }}
      />
    </Panel>
  )
}

export function Empty() {
  return (
    <Panel className="max-w-md p-5">
      <BackgroundPanel />
    </Panel>
  )
}
