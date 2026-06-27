# Checklist de Deploy — AI Dungeon Master

**Atualizado em:** 2026-06-27

---

## Antes de abrir PR

- [ ] `pnpm lint` passa sem erros
- [ ] `pnpm test` passa (100% dos testes unitários e integração)
- [ ] `pnpm eval` passa acima do threshold de qualidade
- [ ] Migration Prisma incluída se o schema foi alterado
- [ ] Variáveis de ambiente documentadas em `.env.example` se novas foram adicionadas
- [ ] PR referencia o user story implementado (ex: "Implementa US-08")

## Antes de merge para main

- [ ] Revisão humana aprovada (obrigatório para PRs que tocam `packages/ai-engine`)
- [ ] CI verde (GitHub Actions: lint + test + eval)
- [ ] Sem segredos commitados (checado pelo hook de pre-commit)

## Deploy para staging

- [ ] Migration aplicada em staging: `pnpm db:migrate` com `DATABASE_URL` de staging
- [ ] Smoke test manual: criar personagem → iniciar aventura → enviar ação → verificar rolagem e narração
- [ ] Verificar logs de erro no observability (sem erros inesperados no DM Agent)

## Deploy para produção

- [ ] Aprovação do responsável pelo produto
- [ ] Migration aplicada em produção em janela de baixo tráfego
- [ ] Monitorar métricas por 30 minutos após deploy:
  - Taxa de erro do DM Agent
  - Latência do endpoint `/api/v1/ai/chat`
  - Custo de tokens (não deve exceder baseline em >20%)
- [ ] Rollback disponível: versão anterior do container tagueada e pronta para subir

---

## Guardrails automáticos (Harness)

Os seguintes hooks rodam automaticamente no pipeline e bloqueiam se falharem:

| Hook | Trigger | Ação |
|------|---------|------|
| `pre-commit` | Antes de cada commit | Bloqueia se encontrar segredos (API keys, senhas) |
| `pre-push` | Antes de push para main | Roda `pnpm lint` + `pnpm test` |
| CI eval | PR aberto/atualizado | Roda `pnpm eval --ci`; bloqueia se abaixo do threshold |
| Migration safety | PR com mudança em `prisma/schema.prisma` | Verifica se migration foi incluída |

---

## Observability em produção

- Logs estruturados (JSON) em todas as tools do DM Agent
- Cada turno do DM Agent tem um `traceId` que conecta: ação do jogador → tools chamadas → narração gerada → state persistido
- Alertas configurados para:
  - Taxa de erro do AI Engine > 1%
  - Latência p95 do chat > 10s
  - Custo de tokens por sessão > 2x da média dos últimos 7 dias
