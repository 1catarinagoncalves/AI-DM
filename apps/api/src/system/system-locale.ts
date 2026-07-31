import { resolveLocale, type Locale, type SystemConfig } from '@ai-dm/shared'
import type { PrismaService } from '../prisma.service'

// US-99: `System.config` deixou de ser "o config" e passou a ser a BASE EN; a localização
// completa vive em `System.configLocales[locale]`. Todo leitor de config resolve por aqui —
// ler `system.config` cru volta a servir inglês a um jogador em português.
type SystemRow = { config: unknown; configLocales?: unknown }
type LocaleMap = Record<string, SystemConfig>

/** Escolhe o artefato do locale. Sem entrada (ex.: `en-US`, ou o Free) → a base. */
export function configForLocale(system: SystemRow, locale: Locale): SystemConfig | null {
  const localized = (system.configLocales as LocaleMap | null | undefined)?.[locale]
  return localized ?? (system.config as SystemConfig | null)
}

/**
 * Locale do DONO da conta, derivado no servidor — o cliente nunca manda locale (US-61).
 * Não sai do JWT: a claim não existe lá (o payload é `sub`/`email`/`name`), é leitura do
 * banco. Sem `userId` (request anônimo, ex.: health check) cai no default.
 */
export async function localeOfUser(prisma: PrismaService, userId?: string | null): Promise<Locale> {
  if (!userId) return resolveLocale(undefined)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } })
  return resolveLocale(user?.locale)
}
