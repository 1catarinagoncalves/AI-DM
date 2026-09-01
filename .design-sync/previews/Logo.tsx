import { Logo } from '@/components/ui/dm'

// The two real sizes in the app: size-8 (SceneFrame header) and size-14
// (HomeHero heading, HubHeading).
export function Small() {
  return <Logo className="size-8" />
}

export function Large() {
  return <Logo className="size-14" />
}
