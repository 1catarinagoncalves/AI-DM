import { resolveLocale, type Locale, type SystemConfig } from '@ai-dm/shared'
import type { PrismaService } from '../prisma.service'
import type { System } from '../generated/prisma/client'

// US-99: `System.config` deixou de ser "o config" e passou a ser a BASE EN; a localização
// completa vive em `System.configLocales[locale]`. Todo leitor de config resolve por aqui —
// ler `system.config` cru volta a servir inglês a um jogador em português.
type SystemRow = { config: unknown; configLocales?: unknown }
type LocaleMap = Record<string, SystemConfig>

// `System.config`+`configLocales` é o SRD inteiro (~200KB/linha, US-47) e não muda em
// runtime — só o script de ingest escreve nele. `include: { system: true }` reenviava esse
// blob pela rede em TODO turno/ficha (achado investigando consumo do Neon, 94% da cota
// mensal). Cache por instância de PrismaService: WeakMap isola testes (double novo por
// teste) e ainda assim é uma cache global única em produção (PrismaService é singleton do Nest).
// ponytail: sem TTL — reingest exige reiniciar a API pra pegar o dado novo.
const systemCache = new WeakMap<PrismaService, Map<string, System>>()

/** Busca `System` por id, cacheado pro resto da vida do processo. Ver nota acima. */
export async function getSystemCached(prisma: PrismaService, systemId: string): Promise<System> {
  let cache = systemCache.get(prisma)
  if (!cache) {
    cache = new Map()
    systemCache.set(prisma, cache)
  }
  const cached = cache.get(systemId)
  if (cached) return cached

  const system = await prisma.system.findUnique({ where: { id: systemId } })
  if (!system) throw new Error(`System "${systemId}" não encontrado (FK deveria garantir existência)`)

  cache.set(systemId, system)
  return system
}

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
