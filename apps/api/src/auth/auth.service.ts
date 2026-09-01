import { Injectable } from '@nestjs/common'
import { resolveLocale, type Locale } from '@ai-dm/shared'
import { PrismaService } from '../prisma.service'

// Era anônima (US-61): o wizard criava contas com email `guest_xxxx@aidm.local`
// (randomGuestId). Todo email de convidado termina neste sufixo; um login Google
// real nunca. É por ele que distinguimos órfãos de contas reais.
const GUEST_EMAIL_SUFFIX = '@aidm.local'
// US-201: sufixo da conta de bancada do `pnpm dev:token`. Não é conta de jogador.
const DEV_EMAIL_SUFFIX = '@ai-dm.invalid'
const RESERVED_EMAIL_SUFFIXES = [GUEST_EMAIL_SUFFIX, DEV_EMAIL_SUFFIX]

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Primeiro toque de uma identidade Google verificada (US-61): faz upsert do
   * User por `email @unique` e, se este for o PRIMEIRO login real, absorve todos
   * os personagens/aventuras órfãos (da era anônima) para a nova conta (D1).
   *
   * A reivindicação só dispara quando (a) a conta foi recém-criada e (b) é a
   * única conta real no banco — a flag anti-roubo do D1: um segundo login (conta
   * diferente) começa vazio, não herda o que era do primeiro. Tudo numa transação.
   */
  async sync(
    email: string,
    name: string,
    locale?: string | null,
  ): Promise<{ id: string; email: string; name: string; locale: Locale }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } })
      // US-97: a preferência do visitante (localStorage/browser) só semeia a conta NOVA.
      // No re-login ela é um palpite do dispositivo da vez — sobrescrever com ele apagaria
      // a escolha que o jogador fez de propósito noutra sessão.
      const user = existing
        ? await tx.user.update({ where: { email }, data: { name } })
        : await tx.user.create({ data: { email, name, locale: resolveLocale(locale) } })

      // Conta real = email que NÃO é de convidado nem de bancada (US-201). Se, após
      // o upsert, só existe uma conta real e ela acabou de nascer, é o primeiro
      // login → reivindica.
      //
      // (a) a conta de dev não INFLA a contagem: senão, a mantenedora logando depois
      //     dela veria realUserCount === 2 e perderia a reivindicação que é dela.
      const realUserCount = await tx.user.count({
        where: { NOT: { OR: RESERVED_EMAIL_SUFFIXES.map((s) => ({ email: { endsWith: s } })) } },
      })
      // (b) a conta de dev nunca REIVINDICA: sem isto ela leva os órfãos no cenário
      //     em que nasce depois de já existir uma conta real.
      const isDevAccount = user.email.endsWith(DEV_EMAIL_SUFFIX)
      const isFirstRealLogin = !existing && !isDevAccount && realUserCount === 1

      if (isFirstRealLogin) {
        const guests = await tx.user.findMany({
          where: { email: { endsWith: GUEST_EMAIL_SUFFIX } },
          select: { id: true },
        })
        const guestIds = guests.map((g) => g.id)
        if (guestIds.length > 0) {
          // Reatribui a posse: personagens e aventuras dos convidados passam à conta real.
          await tx.character.updateMany({ where: { userId: { in: guestIds } }, data: { userId: user.id } })
          await tx.adventure.updateMany({ where: { creatorId: { in: guestIds } }, data: { creatorId: user.id } })
          // Contas de convidado esvaziadas: apaga para não sobrarem órfãos reivindicáveis.
          await tx.user.deleteMany({ where: { id: { in: guestIds } } })
        }
      }

      return { id: user.id, email: user.email, name: user.name, locale: resolveLocale(user.locale) }
    })
  }

  /**
   * US-97: troca o idioma ativo da conta. Aplica ao conteúdo FUTURO (UI, narração
   * nova, abertura); nada já gravado é reescrito — o `EventLog` e o texto autoral
   * ficam na língua em que nasceram (ADR 005 D2).
   */
  async setLocale(userId: string, locale: Locale): Promise<{ id: string; locale: Locale }> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { locale } })
    return { id: user.id, locale: resolveLocale(user.locale) }
  }
}
