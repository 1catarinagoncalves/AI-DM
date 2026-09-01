import { SectionTitle } from '@/components/ui/dm'

// Text-heavy calibration piece: font (Cinzel serif + text-shadow-fantasy) and
// wrapping behavior at very different string lengths — pt-BR and en-US
// (Fase 1 is bilingual, ADR 005) render noticeably different lengths for the
// same string, and the title is the one place `text-shadow-fantasy` is used.
export function Short() {
  return <SectionTitle>Aventura</SectionTitle>
}

export function Long() {
  return <SectionTitle>Criação de Personagem</SectionTitle>
}

export function English() {
  return <SectionTitle>Preparing your adventure</SectionTitle>
}
