import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@ai-dm/shared'],
  // As cenas de fundo são pixel art de ~2 MB em PNG: a 60 o artefacto não é
  // visível e o payload cai muito (ADR 006, custo zero). A lista `qualities`
  // passa a ser obrigatória no Next 16 — declarada já.
  images: { qualities: [60] },
}

export default nextConfig
