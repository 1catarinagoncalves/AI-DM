// design-sync preview shim for `next/link`. Same root cause as next-image.tsx
// in this directory: next/link eagerly requires next/dist/client/add-base-path
// and friends, which read `process.env.__NEXT_ROUTER_BASEPATH` at module top
// level — fine inside a real Next build (DefinePlugin replaces it), fatal in
// design-sync's plain-esbuild synth-entry bundle (no `process` global in the
// browser). Previews never navigate, so a plain <a> is behaviorally identical
// for a static card.
import type { AnchorHTMLAttributes, ReactNode } from 'react'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  children?: ReactNode
  [key: string]: unknown
}

export default function Link({ href, children, ...rest }: Props) {
  delete rest.prefetch
  delete rest.replace
  delete rest.scroll
  delete rest.shallow
  delete rest.passHref
  delete rest.locale
  return <a href={href} {...rest}>{children}</a>
}
