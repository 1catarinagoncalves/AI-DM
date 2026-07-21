import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

// Era anônima (US-61): o wizard criava contas com email `guest_xxxx@aidm.local`
// (randomGuestId). Todo email de convidado termina neste sufixo; um login Google
// real nunca. É por ele que distinguimos órfãos de contas reais.
const GUEST_EMAIL_SUFFIX = '@aidm.local'

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
  async sync(email: string, name: string): Promise<{ id: string; email: string; name: string }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } })
      const user = existing
        ? await tx.user.update({ where: { email }, data: { name } })
        : await tx.user.create({ data: { email, name } })

      // Conta real = email que NÃO é de convidado. Se, após o upsert, só existe
      // uma conta real e ela acabou de nascer, é o primeiro login → reivindica.
      const realUserCount = await tx.user.count({
        where: { NOT: { email: { endsWith: GUEST_EMAIL_SUFFIX } } },
      })
      const isFirstRealLogin = !existing && realUserCount === 1

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

      return { id: user.id, email: user.email, name: user.name }
    })
  }
}
