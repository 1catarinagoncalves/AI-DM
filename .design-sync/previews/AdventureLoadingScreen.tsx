import { AdventureLoadingScreen } from '@/components/setup/AdventureLoadingScreen'

// US-197 carousel: shuffles its 6 loading messages once per mount and rotates
// every 3s. A static capture just shows whichever message the shuffle picked
// first - real behavior, not a fixed fixture. One story is the whole surface.
export function Default() {
  return <AdventureLoadingScreen />
}
