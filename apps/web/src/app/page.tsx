import { HomeHero } from '@/components/HomeHero'
import { SceneFrame } from '@/components/ui/dm'

export default function Home() {
  return (
    <SceneFrame scene="/scenes/tavern.png" dim="medium">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <HomeHero />
      </div>
    </SceneFrame>
  )
}
