# US-62 — Acesso do Claude à Neon via MCP (Postgres operável pelo agente)

**Épico:** Deploy e operação (custo zero) — [ADR 006](../../adr/006-deploy-custo-zero.md)
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-58](./US-58-banco-postgres-neon.md) (projeto Neon provisionado, `project_id purple-wave-53471231`, `DATABASE_URL`)
**Criada em:** 2026-07-21

---

## História

> **Como** operador do AI DM que usa o Claude Code,
> **quero** que o Claude tenha acesso ao meu projeto Neon via MCP (listar projetos/branches, rodar SQL, inspecionar schema, ver queries lentas),
> **para que** eu possa pedir diagnóstico de banco, migração assistida e consultas ad-hoc sem sair do agente nem copiar credenciais na mão.

---

## Contexto e motivação

### O problema observado

Hoje o Claude só toca a Neon indiretamente: eu colo `DATABASE_URL` no `.env`, rodo `prisma migrate` no terminal e o agente não enxerga o estado real do banco. Para qualquer diagnóstico ("a tabela `Character` tem a coluna nova?", "por que essa query está lenta?") preciso abrir o Neon console ou o Prisma Studio manualmente e transcrever o resultado de volta para o chat.

### Por que a solução atual não basta

O `DATABASE_URL` no `.env` serve para a **aplicação** rodar migrações e queries de runtime — não dá ao **agente** capacidade de inspeção. O Prisma Studio (`pnpm db:studio`) é humano-no-loop. Sem o MCP da Neon conectado, o Claude não consegue `list_projects`, `run_sql`, `describe_table_schema`, `list_slow_queries` etc.

### A proposta

Configurar o **Neon MCP server** no Claude Code, autenticado contra a conta que é dona do projeto `purple-wave-53471231`, de forma que o agente ganhe as ferramentas `mcp__Neon__*` de leitura e operação assistida do banco.

---

## Escopo

### Dentro do escopo

- Neon MCP server registrado e conectando na sessão do Claude Code.
- Autenticação da conta Neon dona do projeto do AI DM.
- Verificação de que o agente enxerga o projeto (`list_projects` retorna `purple-wave-53471231`) e consegue rodar SQL de leitura.
- Documentar o comando de setup no repo (não o segredo — só o procedimento).

### Fora do escopo

- **Provisionar o banco** — US-58 (esta US só conecta o agente ao que já existe).
- **Migrações de produção automáticas** — continuam via `prisma migrate deploy` no release do Render (US-59). O MCP é para diagnóstico/assistência, não para virar caminho oficial de deploy de schema.
- **Neon Auth / Data API** — capacidades extras da plataforma, não necessárias na Fase 1.

---

## Passo a passo (procedimento)

> Rodar numa sessão **interativa** do Claude (`claude` no terminal) — o registro de MCP e qualquer fluxo OAuth não acontecem em sessão não-interativa.

### Comando pronto (script)

Script versionado: [`scripts/mcp/setup-mcp.ps1`](../../../scripts/mcp/setup-mcp.ps1) (Windows) / [`.sh`](../../../scripts/mcp/setup-mcp.sh) (bash). Registra só a Neon:

```powershell
# Caminho A (OAuth remoto): sem key, o script registra o server remoto e pede /mcp Authenticate
./scripts/mcp/setup-mcp.ps1 -Service neon

# Caminho B (key local): defina a key só na sessão atual, depois rode
$env:NEON_API_KEY = "napi_xxxxxxxxxxxxxxxx"
./scripts/mcp/setup-mcp.ps1 -Service neon
```

Equivale, na mão, a:

```bash
# A — remoto/OAuth
claude mcp add --transport http neon https://mcp.neon.tech/mcp
# B — local/key
claude mcp add neon --env NEON_API_KEY=napi_xxxxxxxxxxxxxxxx -- npx -y @neondatabase/mcp-server-neon start
```

### Caminho A — MCP remoto com OAuth (recomendado)

1. Obter uma **Neon API key** (só se for usar o caminho B; o OAuth remoto dispensa key). Para o OAuth remoto, pular para o passo 2.
2. No terminal, registrar o server remoto:
   ```bash
   claude mcp add --transport http neon https://mcp.neon.tech/mcp
   ```
3. Abrir o Claude interativo e rodar `/mcp` → selecionar **neon** → **Authenticate**. Isso abre o navegador para login na conta Neon e autoriza o Claude.
4. Confirmar: pedir ao Claude "liste meus projetos Neon". Deve retornar `purple-wave-53471231` (us-east-2).

### Caminho B — MCP local com API key (alternativa, sem navegador)

1. Neon Console → **Account settings → API keys → Create API key**. Copiar o valor (mostrado uma única vez).
2. Registrar o server local passando a key no ambiente:
   ```bash
   claude mcp add neon \
     --env NEON_API_KEY=napi_xxxxxxxxxxxxxxxx \
     -- npx -y @neondatabase/mcp-server-neon start
   ```
3. Reabrir o Claude; rodar `/mcp` e confirmar que **neon** aparece como *connected*.
4. Verificar com "liste meus projetos Neon".

> **Segurança:** a API key da Neon é um segredo de conta inteira. Não commitar. Se registrada via `--env`, ela vai para a config local do Claude (`~/.claude`), não para o repo. Preferir o Caminho A (OAuth) quando possível, pois não deixa key em texto.

### Caminho C — Fallback sem MCP (Neon CLI / psql)

Se o MCP não for viável, o mesmo diagnóstico sai por CLI, com o Claude gerando os comandos e eu colando a saída:
- `neonctl projects list` (após `neonctl auth`).
- `psql "$DATABASE_URL" -c '\d "Character"'` para inspecionar schema.
- `prisma db pull` / `prisma studio` para o humano-no-loop.

---

## Critérios de aceite

- [ ] O Neon MCP aparece como *connected* no `/mcp` de uma sessão interativa do Claude.
- [ ] O agente executa `list_projects` e retorna o projeto `purple-wave-53471231` (us-east-2).
- [ ] O agente executa um `run_sql` de leitura (ex.: `SELECT count(*) FROM "Character"`) e devolve o resultado sem eu tocar no console da Neon.
- [ ] O agente lê o schema de uma tabela (`describe_table_schema` em `Character`) e bate com o `schema.prisma`.
- [ ] Nenhuma API key da Neon foi commitada no repo; o procedimento de setup está documentado, o segredo não.
- [ ] **Regressão:** pedir ao Claude "a Neon está com o schema da última migração?" resulta em resposta baseada em consulta real ao banco, não em suposição a partir dos arquivos de migração.

---

## Notas de implementação

- **Já pode estar conectado:** em algumas sessões o Neon MCP já sobe automaticamente (tools `mcp__Neon__*` disponíveis). Nesse caso, esta US vira só *verificar + documentar*.
- **Só leitura como padrão de trabalho:** tratar `run_sql`/`run_sql_transaction` de escrita com cuidado — para mudança de schema, o caminho oficial continua sendo migração Prisma versionada (US-59), não SQL solto pelo agente. Ver memória `prisma-7-upgrade`.
- **`DATABASE_URL` direct vs pooled:** a US-58 usa a connection string **direct** (não pooled) para migração. O MCP usa a API da Neon, não a `DATABASE_URL` — são caminhos independentes.
- **Reconexão:** se o MCP cair (token expirado), refazer `/mcp → Authenticate` (Caminho A) ou revalidar a `NEON_API_KEY` (Caminho B).

---

## Questões em aberto

1. OAuth remoto (Caminho A) ou key local (Caminho B) como padrão do projeto? OAuth é mais seguro; key local funciona sem navegador (útil em ambiente headless/CI).
2. Vale restringir o escopo da API key (se a Neon suportar keys por projeto) para não dar acesso à conta inteira ao agente?

---

## Referências no código

- `prisma/schema.prisma` — schema que o `describe_table_schema` do MCP deve refletir.
- `prisma.config.ts` — onde vive a `url` do banco (memória `prisma-7-upgrade`).
- `docs/sdlc/01-requisitos/US-58-banco-postgres-neon.md` — provisionamento do projeto Neon consumido aqui.
- `.env` (não versionado) — `DATABASE_URL` direct da Neon.
