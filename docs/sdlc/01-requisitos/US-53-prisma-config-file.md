# US-53 — Migrar a configuração do Prisma de `package.json` para `prisma.config.ts`

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player (dívida técnica; sem impacto de produto)
**Status:** ✅ Implementada
**Depende de:** nenhuma
**Relacionado:** [US-47](./US-47-ingestao-srd-como-dado.md) (o `ingest` escreve no banco via seed) · [US-51](./US-51-kits-iniciais-do-srd.md) (também toca o `seed.ts`)
**Criada em:** 2026-07-16

---

## História

> **Como** desenvolvedora,
> **quero** que a configuração do Prisma viva num `prisma.config.ts` em vez da chave `package.json#prisma`,
> **para que** os comandos de banco parem de emitir aviso de depreciação e o projeto não quebre no Prisma 7.

---

## Contexto e motivação

### O problema observado

Todo comando de banco (`pnpm db:migrate`, `db:studio`, `db:seed`) abre com:

```
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config
```

Não é ruído cosmético: é prazo. No Prisma 7 a chave **deixa de ser lida**. Hoje ela carrega o comando de seed:

```json
// apps/api/package.json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

Sem ela, `prisma migrate dev` e `prisma migrate reset` param de semear o banco — silenciosamente, porque o Prisma 7 simplesmente não vai procurar ali. O sintoma seria "banco migrado, catálogo de sistemas vazio", não um erro.

### Por que a solução atual não basta

Não há alternativa no estado atual: a chave `package.json#prisma` é a única forma de declarar o seed hoje no repo. A versão instalada é **prisma 6.19.3**, onde `prisma.config.ts` já é estável (`schema` e `migrations.seed` sem *feature gate* experimental). Ou seja: a migração está disponível agora e o custo de adiar é fazer isso sob pressão de um upgrade major.

### A proposta

Criar `apps/api/prisma.config.ts` declarando o caminho do schema e o comando de seed, e remover a chave `prisma` do `apps/api/package.json`.

---

## Escopo

### Dentro do escopo

- Criar **`apps/api/prisma.config.ts`** com `schema` + `migrations.seed`.
- Remover a chave **`"prisma"`** de `apps/api/package.json`.
- Registrar o arquivo no **`include` do `tsconfig.json`** e no **`exclude` do `tsconfig.build.json`** (ver Decidido).
- Verificar que `db:migrate`, `db:studio` e `db:seed` seguem funcionando **sem o aviso**.
- Confirmar que o seed automático do `migrate dev` / `migrate reset` continua rodando.

### Fora do escopo

- **Atualizar para o Prisma 7.** Esta story é o pré-requisito, não o upgrade. O upgrade tem outras quebras (client, engines) e merece story própria.
- **Adotar `driver adapters`, `typedSql` ou `externalTables`** — o `prisma.config.ts` abre essas portas, mas nenhuma tem consumidor aqui.
- **Mexer no conteúdo do `seed.ts`** — muda quem invoca, não o que ele faz.

---

## Configuração proposta

```ts
// apps/api/prisma.config.ts
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
```

| Campo | Equivalente hoje | Observação |
|---|---|---|
| `schema` | descoberta automática (`prisma/schema.prisma`) | Explícito. O caminho é relativo ao diretório do config. |
| `migrations.seed` | `package.json#prisma.seed` | Mesmo comando, mesma string. |

**Localização:** o Prisma procura o config **a partir do diretório de trabalho**. Todos os scripts de banco rodam via `pnpm --filter api`, ou seja, com cwd = `apps/api` — o arquivo tem que ficar em `apps/api/prisma.config.ts`, **não** na raiz do monorepo.

---

## Critérios de aceite

- [x] Existe `apps/api/prisma.config.ts` exportando `defineConfig({ schema, migrations.seed })`.
- [x] A chave `"prisma"` **não existe mais** em `apps/api/package.json`.
- [x] `pnpm db:migrate`, `pnpm db:studio` e `pnpm db:seed` rodam **sem** a linha `warn The configuration property `package.json#prisma` is deprecated`.
- [x] `prisma migrate dev` / `prisma migrate reset` **ainda executam o seed** — verificado por `prisma db seed`, que resolve o comando pelo `migrations.seed` do config (mesmo caminho do reset, sem descartar o banco): saída `Running seed command 'ts-node prisma/seed.ts'` → `Sistemas criados: Free, D&D 5e SRD`.
- [x] `pnpm --filter api build` segue passando e o `dist` mantém o formato de hoje: **`dist/main.js`**, não `dist/src/main.js`. O `prisma.config.ts` não é emitido.
- [x] `pnpm --filter api start` sobe a API a partir do build (prova de que o `rootDir` não mudou).
- [x] **Teste de regressão:** o aviso de depreciação não reaparece na saída de nenhum script de banco.

---

## Notas de implementação

> *Dicas para quem implementar. O implementador pode divergir com boa justificativa.*

- **Armadilha nº 1 — o `.env` deixa de ser carregado automaticamente.** Com um config file presente, o CLI do Prisma **para de auto-carregar `.env`**. Aqui isso **já está neutralizado**: não existe `apps/api/.env` (o `.env` é só na raiz) e os scripts da raiz já embrulham tudo em `dotenv -e .env --`. O `apps/api` → `db:migrate:deploy` não tem embrulho nenhum e depende de `DATABASE_URL` já estar no ambiente — antes e depois desta story. **Fica assim de propósito**, ver Questões em aberto.
- **Armadilha nº 2 — mexer no `include` sozinho quebra o `start`.** O `include` e o `exclude` andam juntos aqui, pelo motivo de `rootDir` explicado em Decidido. Se fizer uma edição só, o sintoma é `pnpm --filter api start` falhando com *cannot find module* — o `main.js` foi para `dist/src/`. Não confie no `exclude` atual: `"prisma"` casa com o diretório, não com `prisma.config.ts`.
- O Prisma carrega o `.ts` do config sozinho — **não precisa** de `tsx`/`ts-node` para *ler* o config. O `ts-node` segue necessário para *executar* o `seed.ts`, e por isso continua em `devDependencies`.
- A string do seed é relativa ao cwd (`apps/api`), igual à de hoje. Copie literal.

---

## Questões em aberto

Nenhuma. As duas que existiam estão decididas abaixo.

### Decidido — `prisma.config.ts` entra no `include`, **e** no `exclude` do build

Sim ao type-check, mas são **duas** edições, não uma — a segunda é obrigatória:

```jsonc
// apps/api/tsconfig.json       → type-check no editor
"include": ["src", "prisma", "prisma.config.ts"]

// apps/api/tsconfig.build.json → preserva o formato do dist
"exclude": ["node_modules", "dist", "prisma", "prisma.config.ts", "**/*.test.ts"]
```

**Por que o `exclude` não é opcional:** o `tsconfig` não declara `rootDir`, então o TypeScript o infere do diretório comum dos arquivos do programa. Hoje sobra só `src/**` (o `prisma/` é excluído) → raiz comum `src` → saída `dist/main.js`, que é o que `"start": "node dist/main"` espera. Pôr `prisma.config.ts` (na raiz de `apps/api`) no programa sobe a raiz comum para `apps/api` e a saída vira **`dist/src/main.js`** — o `start` quebra. O `exclude` de hoje **não** cobre o arquivo: o padrão `"prisma"` casa com o diretório `prisma/`, não com `prisma.config.ts`.

Medido com um arquivo-sonda na raiz de `apps/api` e `tsc --listEmittedFiles`:

| Cenário | Saída |
|---|---|
| `include` com o arquivo, `exclude` sem | `dist/src/main.js` + `dist/<sonda>.js` — **quebra o `start`** |
| `include` **e** `exclude` com o arquivo | `dist/main.js`, sonda não emitida — **igual ao baseline** |

**Ressalva sobre o retorno:** `apps/api` não tem script de typecheck (`lint` é `eslint src`, `test` é vitest). O ganho fica no editor — pega `defineConfig` mal digitado na hora, mas não é rede de CI.

### Decidido — `db:migrate:deploy` fica como está

Cogitou-se embrulhar `apps/api` → `db:migrate:deploy` em `dotenv-cli`, já que o config file desliga o auto-load do `.env` (ver armadilha nº 1). **Não.** O `migrate deploy` é comando de produção, e o [checklist de deploy](../05-deploy/checklist.md) já define de onde vem a credencial dele: *"Migration aplicada em staging: `pnpm db:migrate` com `DATABASE_URL` de staging"* — variável do ambiente, não `.env` de repositório. Embrulhar ensinaria o hábito errado.

Além disso o script hoje **não tem chamador**: a única ocorrência de `migrate deploy` no repo é a própria definição em [apps/api/package.json](../../../apps/api/package.json). Não há `.github/`, Dockerfile nem pipeline — o `docker-compose.yml` da raiz sobe Postgres e Redis de desenvolvimento local, nada mais. Quem decide como `DATABASE_URL` chega em produção é o trabalho de deploy, ainda não escrito como story. Fora do escopo daqui.

---

## Referências no código

- [apps/api/package.json](../../../apps/api/package.json) — chave `"prisma".seed`, origem do aviso; a remover.
- [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — schema a declarar em `schema`.
- [apps/api/prisma/seed.ts](../../../apps/api/prisma/seed.ts) — alvo de `migrations.seed`; inalterado.
- [package.json](../../../package.json) — scripts `db:migrate` / `db:studio` / `db:seed`, todos já com `dotenv -e .env --`.
- [apps/api/tsconfig.build.json](../../../apps/api/tsconfig.build.json) — `exclude` do build; relevante para a armadilha nº 2.
