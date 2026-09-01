// design-sync preview shim for `next/image`.
//
// The real next/image client module reads `process.env.__NEXT_IMAGE_OPTS` at
// module top level (Next's webpack/SWC build normally replaces that with a
// literal object via DefinePlugin). design-sync's synth-entry mode bundles
// straight from src/ with esbuild — no Next compiler pass — so that reference
// stays a bare `process` global access and throws `ReferenceError: process is
// not defined` the instant the module loads in a browser preview, which kills
// the whole IIFE (window.AiDm never gets assigned; every component fails).
// This shim renders a plain <img> with the props the design system actually
// passes (SceneFrame: src/alt/fill/className/style/sizes/quality/priority) —
// visually equivalent for a static preview card, since previews never need
// next/image's real optimization/loader pipeline.
import type { CSSProperties } from 'react'

type Props = {
  src: string
  alt: string
  fill?: boolean
  className?: string
  style?: CSSProperties
  sizes?: string
  quality?: number
  priority?: boolean
  [key: string]: unknown
}

export default function Image({ src, alt, fill, className, style, ...rest }: Props) {
  delete rest.sizes
  delete rest.quality
  delete rest.priority
  const fillStyle: CSSProperties = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
    : {}
  return <img src={src} alt={alt} className={className} style={{ ...fillStyle, ...style }} {...rest} />
}
