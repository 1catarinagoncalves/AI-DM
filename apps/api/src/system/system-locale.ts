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
// blob pela rede em TODO turno/ficha, e `GET /systems` (healthCheckPath do Render) arrastava
// as DUAS linhas em todo ping — sozinho estourou os 5GB/mês de network transfer da Neon.
// Cache por instância de PrismaService: WeakMap isola testes (double novo por teste) e ainda
// assim é uma cache global única em produção (PrismaService é singleton do Nest).
// ponytail: uma cache da tabela inteira, não por id — são 2 linhas, buscar uma não paga menos.
// ponytail: sem TTL — reingest exige reiniciar a API pra pegar o dado novo.
const systemCache = new WeakMap<PrismaService, Promise<System[]>>()

/** Todos os `System` ordenados por nome, buscados UMA vez por processo. Ver nota acima. */
export function getSystemsCached(prisma: PrismaService): Promise<System[]> {
  const cached = systemCache.get(prisma)
  if (cached) return cached

  // Guarda a promessa, não o resultado: pings de health check concorrentes no boot
  // compartilham a mesma busca em vez de disparar uma cada.
  const systems = prisma.system.findMany({ orderBy: { name: 'asc' } })
  // Falha transitória (compute da Neon acordando do scale-to-zero, US-58) não pode ficar
  // cacheada pro resto da vida do processo — descarta e deixa a próxima chamada tentar.
  systems.catch(() => systemCache.delete(prisma))
  systemCache.set(prisma, systems)
  return systems
}

/** Busca `System` por id na cache acima. */
export async function getSystemCached(prisma: PrismaService, systemId: string): Promise<System> {
  const systems = await getSystemsCached(prisma)
  const system = systems.find((candidate) => candidate.id === systemId)
  if (!system) throw new Error(`System "${systemId}" não encontrado (FK deveria garantir existência)`)

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
