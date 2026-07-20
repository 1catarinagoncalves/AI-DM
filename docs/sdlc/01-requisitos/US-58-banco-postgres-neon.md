# US-58 — Banco Postgres gerenciado na Neon (schema migrado + SRD semeado)

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [ADR 006](../../adr/006-deploy-custo-zero.md) (D3: Postgres na Neon) · [US-47](./US-47-ingestao-srd-como-dado.md) (pipeline SRD que popula o banco) · [US-53](./US-53-prisma-config-file.md) (Prisma 7 / adapter pg)
**Criada em:** 2026-07-19

---

## História

> **Como** operador do AI DM,
> **quero** um Postgres gerenciado e gratuito na nuvem, com o schema aplicado e o SRD já semeado,
> **para que** a API em produção tenha onde persistir e um sistema jogável (D&D 5e) no primeiro acesso.

---

## Contexto e motivação

### O problema observado

O [ADR 006](../../adr/006-deploy-custo-zero.md) escolhe a **Neon** (Postgres serverless, free tier) como banco de produção (D3). Hoje o Postgres só existe em `localhost`; não há instância na nuvem, nem `DATABASE_URL` pública, nem dados semeados. Sem isso a API não sobe e o `listSystems` volta vazio — o jogador não consegue nem criar personagem.

### Por que a solução atual não basta

O schema e o seed existem no repo ([schema.prisma](../../apps/api/prisma/schema.prisma), [seed.ts](../../apps/api/prisma/seed.ts), pipeline SRD da US-47), mas nunca correram contra um banco gerenciado. O adapter `pg` do Prisma 7 já fala com qualquer Postgres via connection string — falta a string e o banco do outro lado.

### A proposta

Provisionar um projeto Postgres na Neon, aplicar as migrações e rodar o seed (Free + D&D 5e via SRD), deixando a `DATABASE_URL` pronta para a API (US-59) consumir.

---

## Escopo

### Dentro do escopo

- **Projeto Postgres na Neon** (free tier), região próxima ao host da API (US-59) para reduzir latência de query.
- **`DATABASE_URL` com `sslmode=require`** capturada como segredo (não commitada); é a mesma string que a US-59 injeta no Render.
- **Migração inicial:** `prisma migrate deploy` contra a Neon (aplica todas as migrações do repo).
- **`prisma generate`** antes de qualquer script Node que use o client (o client é gitignored — memória do projeto).
- **Seed:** rodar o pipeline que popula os sistemas — `db:seed` (Free) e a ingestão SRD da [US-47](./US-47-ingestao-srd-como-dado.md) (`srd:sync` + `srd:ingest`) para o D&D 5e.
- **Verificação:** `listSystems` (via `SELECT` ou pela API local apontada à Neon) retorna Free + D&D 5e.

### Fora do escopo

- **Deploy da API** — US-59 (esta US só entrega o banco pronto e a string).
- **Backups / réplicas / plano pago** — não é produção com SLA (ADR 006). O free tier basta para o MVP.
- **Redis / pgvector** — não fazem parte do MVP (ADR 001/006); Neon é só o Postgres relacional.
- **Re-seed automatizado a cada deploy** — o seed é uma operação pontual; a US-59 só re-roda `migrate deploy` (idempotente), não o seed.

---

## Critérios de aceite

- [ ] Existe um projeto Postgres na Neon (free tier) e uma `DATABASE_URL` (`sslmode=require`) guardada como segredo.
- [ ] `prisma migrate deploy` aplica com sucesso todas as migrações do repo contra a Neon (schema completo).
- [ ] Após o seed, o banco tem os sistemas Free **e** D&D 5e (SRD) com sua configuração de atributos/perícias.
- [ ] A API local, apontada à `DATABASE_URL` da Neon, sobe e `GET /api/v1/systems` retorna os dois sistemas.
- [ ] **Regressão:** criar um personagem contra a Neon persiste e é lido de volta (o adapter `pg` fala com o banco gerenciado sem mudança de código).

---

## Notas de implementação

- **Autossuspend da Neon:** a compute dorme por ociosidade e leva alguns segundos para religar — é o cold start do lado do banco que a [US-57](./US-57-warmup-do-servidor-na-entrada.md) ajuda a esconder. Esperado, não é bug.
- **Ordem do seed:** `prisma generate` → `migrate deploy` → `db:seed`/ingest SRD. O client tem de existir antes dos scripts Node.
- **Uma string, dois consumidores:** a `DATABASE_URL` é a mesma no seed (aqui) e no runtime da API (US-59). Guardar num gerenciador de segredos, não no repo.
- **Região:** casar com a região do Render (US-59) — query cross-region soma latência a cada turno.

---

## Questões em aberto

1. O seed do SRD roda da máquina do operador (contra a Neon) ou como job pontual na nuvem? Para o MVP, rodar local contra a string remota é o caminho mais curto.

---

## Referências no código

- `apps/api/prisma/schema.prisma` — schema aplicado via `migrate deploy`.
- `apps/api/prisma/seed.ts` — seed do sistema Free.
- `scripts/srd/` — pipeline SRD (US-47) que popula o D&D 5e.
- `apps/api/src/prisma.service.ts` — o adapter `pg` que consome a `DATABASE_URL` em runtime.
- `docs/adr/006-deploy-custo-zero.md` — D3 (Neon) e D5 (migração no release).
