# US-244 — Script extrai aventuras geradas persistidas em prod para evals/reports

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-239](./US-239-motor-em-createforcharacter-ledger-e-aposenta-gancho.md) (`Adventure.generatedAdventure` é preenchido pelo motor no fluxo real)
**Relacionado:** [US-243](./US-243-dump-aventura-gerada-na-interface-em-dev.md) (mesmo objetivo em dev, caminho diferente — dump no momento da geração) · [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (`run-authoring.ts`, formato de arquivo reaproveitado)
**Criada em:** 2026-09-15

---

## História

> **Como** mantenedora,
> **quero** um script que puxa aventuras já geradas e persistidas em prod e grava cada uma como JSON em `evals/reports/`,
> **para que** eu tenha artefatos reais de jogadores pra inspecionar/alimentar eval sem gerar de novo nem expor rota HTTP nova.

---

## Contexto e motivação

### O problema observado

US-243 resolveu o dump automático em **dev** (grava no momento da geração, dentro do handler). Em **prod** essa mesma abordagem não serve: Render Free (`render.yaml`) não tem disco persistente — qualquer `writeFileSync` no container some no próximo deploy/restart — e mesmo com disco, o arquivo nunca sincronizaria de volta pro repo sozinho.

### Por que a solução atual não basta

O dado que se quer capturar **já existe**: `Adventure.generatedAdventure` (coluna `Json?`, US-144/US-239) persiste o artefato completo (`GeneratedAdventureSchema`) de toda aventura gerada pelo motor, dev ou prod, sem depender de dump em disco nenhum. Construir infraestrutura de storage pra prod (disco pago, bucket, rota de export) seria duplicar um dado que o Postgres já guarda — falta só um jeito de puxar de lá pra um JSON local.

### A proposta

Script standalone (mesmo espírito de `run-authoring.ts`, US-232) que conecta no Postgres, faz `SELECT` em `Adventure` filtrando por `generatedAdventure IS NOT NULL`, e grava um arquivo por linha em `evals/reports/` — sem chamar IA, sem endpoint novo, sem mudar o runtime da API.

---

## Escopo

### Dentro do escopo

- Script novo em `apps/api/scripts/` (ex.: `extract-generated-adventures.ts`) que roda à mão, fora do CI, mesmo padrão de invocação de `run-authoring.ts` (`ts-node`, `DATABASE_URL` explícita na chamada).
- `SELECT` via Prisma em `Adventure` com `generatedAdventure` não nulo, **join em `creator` (`User`) filtrando `email` numa allowlist fixa no topo do script** — `ALLOWED_EMAILS`, hoje só `catarinagoncalves2005@gmail.com`. Nenhuma chamada de IA — é leitura pura.
- A allowlist é uma constante no código do script, editada à mão por quem roda (a mantenedora) — não é argumento de CLI, não tem flag pra "extrai todo mundo". Adicionar um usuário à lista é uma decisão explícita de quem edita o script, não algo passado por parâmetro na hora.
- Um arquivo JSON **completo** (sem truncar) por `Adventure` encontrada, mesmo diretório/formato de nome de `run-authoring.ts`/US-243 (`evals/reports/`, `authoring-<characterId>-<timestamp>.json`).
- Validação com `GeneratedAdventureSchema.parse()` antes de gravar (mesmo padrão de `run-authoring.ts:54`) — artefato antigo/fora de forma não deve gravar silenciosamente.

### Fora do escopo

- Automatizar a extração (cron, job, endpoint) — é script manual, rodado sob demanda, igual `run-authoring.ts`.
- Provisionar disco/bucket pra dump automático em prod no momento da geração — descartado em favor desta rota (ver "Contexto").
- UI/CLI de gestão da allowlist (adicionar usuário sem editar código) — hoje é uma constante no script; vira story própria se a lista crescer o suficiente pra doer.
- Mudar `US-243` (dump em dev) — scripts independentes, não compartilham runtime, só o formato de arquivo.

---

## Critérios de aceite

- [ ] Rodar o script grava um JSON **completo** (sem truncar nenhum campo) por `Adventure` cujo `creator.email` está em `ALLOWED_EMAILS` e tem `generatedAdventure` preenchido, no formato `evals/reports/authoring-<characterId>-<timestamp>.json`.
- [ ] `ALLOWED_EMAILS` por padrão contém só `catarinagoncalves2005@gmail.com`. `Adventure` de qualquer outro `creator.email` não é extraída, mesmo que passe todos os outros critérios.
- [ ] Não existe argumento de CLI que amplie ou substitua `ALLOWED_EMAILS` em runtime — a única forma de mudar quem entra é editar a constante no script.
- [ ] `Adventure` sem `generatedAdventure` (ramo `dto.preset`, US-217) é ignorada — não gera arquivo vazio nem lança.
- [ ] Um artefato que falha `GeneratedAdventureSchema.parse()` é reportado no console (id da aventura) e **não** é gravado — os demais do lote continuam.
- [ ] Nenhuma chamada às APIs de IA (OpenRouter/Groq) acontece rodando o script — só leitura do Postgres.
- [ ] **Eval / teste de regressão:** teste cobrindo (a) `Adventure` de e-mail fora da allowlist não é gravada; (b) `Adventure` de e-mail na allowlist grava o arquivo certo, completo; (c) artefato inválido é pulado sem derrubar o lote.

---

## Notas de implementação

- Reaproveitar o helper de nome de arquivo/`mkdirSync`/`writeFileSync` já extraído (ou a extrair) em US-243 — não duplicar a lógica de `run-authoring.ts:56-60` uma terceira vez.
- Query: `prisma.adventure.findMany({ where: { generatedAdventure: { not: null }, creator: { email: { in: ALLOWED_EMAILS } } }, include: { creator: true } })` — `Adventure.creator` é a relação `AdventureCreator` já existente ([schema.prisma:110-111](../../../apps/api/prisma/schema.prisma)), não precisa de campo novo.
- `ALLOWED_EMAILS` como `const` no topo do script (`['catarinagoncalves2005@gmail.com']`) — lista curta, editar é um diff de uma linha quando precisar crescer; não vira config/env var enquanto for só isso.
- `DATABASE_URL` de prod **não vem do `.env` da raiz** (esse é o de dev, ver `CLAUDE.md` → Env em dev) — passar explícito na invocação (`DATABASE_URL=... pnpm --filter api exec ts-node scripts/extract-generated-adventures.ts`), nunca commitado.
- Recomendado: role Postgres **read-only** dedicada no Neon (`mcp__Neon__create_postgres_role` ou painel) pra rodar este script contra prod, em vez de reusar a credencial de escrita da API — o script nunca precisa escrever no banco.
- `evals/reports/` está no `.gitignore` (confirmado) — os artefatos extraídos ficam só locais, não vazam pro repo remoto.

---

## Questões em aberto

Nenhuma. Allowlist fixa (`catarinagoncalves2005@gmail.com`, hoje) resolve a questão de privacidade — só extrai o que a própria mantenedora gerou. Dump é completo, sem truncar, mesmo padrão de `run-authoring.ts`.

---

## Referências no código

- [apps/api/prisma/schema.prisma:128](../../../apps/api/prisma/schema.prisma) — `Adventure.generatedAdventure`, a fonte dos dados.
- [apps/api/scripts/run-authoring.ts](../../../apps/api/scripts/run-authoring.ts) — formato de arquivo/diretório reaproveitado (US-232).
- [US-243](./US-243-dump-aventura-gerada-na-interface-em-dev.md) — mesmo objetivo em dev, caminho diferente (dump no momento da geração vs. extração posterior do banco).
- [US-239](./US-239-motor-em-createforcharacter-ledger-e-aposenta-gancho.md) — motor que preenche `generatedAdventure` no fluxo real.
