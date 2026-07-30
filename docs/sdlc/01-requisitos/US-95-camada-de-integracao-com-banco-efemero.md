# US-95 — O loop `ação → tool → persistir → estado` ganha teste de integração

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-93](./US-93-gates-baratos-de-migracao-dependencia-e-smoke.md) — o serviço Postgres no job de CI nasce lá; esta story o reusa em vez de criar outro.
**Criada em:** 2026-07-30

---

## História

> **Como** mantenedora do AI DM,
> **quero** um punhado de testes que atravessem HTTP → serviço → Prisma → Postgres de verdade,
> **para que** a costura entre as camadas — a parte que nenhum unitário toca — pare de ser verificada só jogando.

---

## Contexto e motivação

### O problema observado

A [estratégia de testes](../04-testes/estrategia-de-testes.md) declara a lacuna sem eufemismo, na seção *2. Testes de integração — não existem ainda*: o loop `ação → tool → persistir → estado` é coberto hoje só por unitário com Prisma falso.

Isso não é descuido, é consequência de uma decisão consciente e bem documentada. A [US-80](./US-80-ci-typecheck-testes-e-evals.md) (*Questão em aberto* #2) mediu e registrou: **nenhum teste do repo toca banco**, os 4 arquivos de teste da API que mencionam Prisma usam `import type` + `as unknown as PrismaService`, e o client real nunca é instanciado. 253 testes verdes sem `DATABASE_URL`. Esse é o desenho, e ele é rápido, determinístico e barato.

O preço dele é preciso: **os test doubles concordam com o código, não com o Postgres.** Um `fakePrisma()` nunca viola uma constraint, nunca falha um `@unique`, nunca devolve `null` num relacionamento que a migração deixou opcional, nunca reprova um `JSON` malformado numa coluna `Json`, e nunca revela que a transação que deveria envolver "aplicar dano + registrar entidade" na verdade não existe. Todo bug dessa família passa pelo `pnpm test` verde e chega no jogo.

A US-80 também deixou um aviso que envelhece sozinho: a disciplina do `import type` *"é uma disciplina, não uma garantia do compilador"* — trocar um deles por import de valor põe o client real no grafo e passa a exigir banco, sem nenhum teste ou typecheck reclamando.

### Por que a solução atual não basta

Não há solução parcial a melhorar: a camada é ausente por escolha. O que mudou desde a US-80 é o custo de fechá-la. A [US-93](./US-93-gates-baratos-de-migracao-dependencia-e-smoke.md) traz um Postgres para dentro do job de CI por outro motivo (drift de migração), e com ele em pé a objeção "banco no runner é peso" já foi paga por outra story.

### A proposta

Um projeto de teste separado, com Postgres efêmero do runner, migrações aplicadas de verdade e o app Nest de pé, cobrindo **poucos** fluxos — os que quebram silencioso.

---

## Escopo

### Dentro do escopo

- Projeto de teste à parte (config Vitest própria, como `vitest.eval.config.ts` é à parte do `vitest.config.ts`), para que `pnpm test` continue rápido e sem banco.
- Preparo: `prisma migrate deploy` + seed no banco do runner, uma vez por job.
- Nest de pé em memória (`Test.createTestingModule` + `app.init()`), request HTTP por cima.
- **Três fluxos**, não mais:
  1. **Rolagem ancorada na ficha** — um turno em que o Mestre chama `rollDice`; o modificador aplicado tem que vir da ficha no banco, não do LLM ([US-38](./US-38-rolagens-ancoradas-na-ficha.md)).
  2. **Dano persiste** — `updateCharacterHp` reduz o HP e o `GET` seguinte devolve o valor novo, do Postgres.
  3. **Entidade sobrevive** — `recordEntity` grava em `Adventure.entities` e o ledger reaparece no turno seguinte, incluindo o caso vazio ([US-87](./US-87-bloco-de-entidades-ausente-citado-no-prompt.md)).
- Passo próprio no `ci.yml`, separado do `pnpm test`, para a aba de checks dizer qual camada caiu.

### Fora do escopo

- **Chamar LLM de verdade.** O que está sob teste é a costura, não a narração — a qualidade da narração é a [US-94](./US-94-eval-vivo-noturno-com-chaves.md). O modelo é substituído por um dublê que emite tool calls determinísticas (ver *Questões em aberto* #1).
- **Cobrir todos os endpoints.** Três fluxos. A tentação de virar suíte de contrato completa é como esta camada fica lenta e depois é desligada.
- **Migrar os unitários existentes para banco real.** Eles ficam como estão, com `fakePrisma()`. A pirâmide não inverte.
- **Testcontainers / Docker Compose no runner.** O `services:` nativo do GitHub Actions já dá um Postgres; a estratégia de testes registra Docker Compose como desenho que nunca foi construído, e esta story não o ressuscita.
- **Banco de teste hospedado (branch da Neon).** Ver *Alternativas rejeitadas*.

---

## Critérios de aceite

- [ ] Existe um comando próprio (ex.: `pnpm test:int`) que sobe o app, aplica migrações e roda os três fluxos contra Postgres.
- [ ] O `pnpm test` continua **sem tocar banco** e sem exigir `DATABASE_URL` — a medição da US-80 (*Questão* #2) continua valendo depois desta story. Repetir a medição e colar o resultado.
- [ ] O CI roda `test:int` num passo separado, reusando o serviço Postgres da US-93.
- [ ] **Teste de regressão (a camada morde onde o unitário não morde):** introduzir um bug que **só** o banco pega — por exemplo, gravar em `Adventure.entities` um valor que viola a forma esperada, ou remover a leitura da ficha no cálculo do modificador — e mostrar `pnpm test` **verde** e `pnpm test:int` **vermelho**. Este critério é a razão de ser da story; sem ele ela não fecha.
- [ ] Cada teste limpa o que criou (ou roda em transação revertida): rodar a suíte duas vezes seguidas dá o mesmo resultado.
- [ ] Tempo total do passo registrado. Se passar de ~2 min, cortar fluxo em vez de aceitar.

---

## Alternativas consideradas e rejeitadas

1. **Branch efêmera da Neon por execução de CI** ([US-58](./US-58-banco-postgres-neon.md) já dá o projeto, e o MCP da Neon já está acessível). Rejeitada como primeira escolha: exige secret no job (a US-80 manteve o `ci` sem nenhum), depende de rede e de ciclo de vida (criar/apagar branch, e branch órfã em falha de job), e paga latência de internet em cada query. Um `services: postgres` no runner é local, grátis e some sozinho. Reabrir se algum dia o teste precisar de uma extensão ou de um comportamento específico da Neon que o Postgres cru não reproduz.
2. **SQLite em memória.** Rejeitada: o provider do Prisma é `postgresql`; testar contra outro dialeto verifica um banco que não existe em produção — exatamente o defeito do `fakePrisma()`, com mais cerimônia.

---

## Notas de implementação

- **`AiService` é `@Injectable` e monta a lista de tools inline** (`apps/api/src/ai/ai.service.ts`, tools em `:349-585`, `streamChat` em `:233`). O ponto de substituição do LLM tem que ser escolhido com cuidado: substituir o serviço inteiro apaga justamente o código sob teste.
- **Já existe precedente de teste no nível do controller** (`apps/api/src/ai/ai.controller.test.ts`) — olhar como ele monta o módulo antes de inventar um jeito novo.
- **A seed importa.** Os três fluxos dependem de dados de sistema (SRD, [US-47](./US-47-ingestao-srd-como-dado.md)); rodar `db:seed` no preparo, não fabricar personagem à mão com dados que a seed contradiz.
- **Não usar MSW.** A estratégia de testes registra que ele não é usado no repo; o dublê do modelo é local.

---

## Questões em aberto

1. **Onde entra o dublê do modelo?** Provavelmente um provider Nest sobrescrito no `TestingModule`, mas isso depende de o modelo ser resolvido por injeção ou construído dentro do método. Se for construído dentro, esta story precisa de uma pequena mudança de produção (extrair a construção para algo injetável) — o que muda o "nenhum código de produção alterado" e deve ser dito no PR, não escondido.
2. **Transação por teste ou truncate entre testes?** Truncate é mais simples e mais lento; transação revertida é rápida e briga com código que abre transação própria. Decidir olhando se algum dos três fluxos transaciona.
3. **O passo entra no caminho crítico do CI ou num job paralelo?** Mesma pergunta que a US-93 deixou aberta sobre o Postgres; as duas devem ser respondidas juntas, já que compartilham o serviço.

---

## Referências no código

- `apps/api/src/ai/ai.service.ts` — `streamChat` (`:233`), objeto `tools` (`:349-585`), o loop sob teste.
- `apps/api/src/ai/ai.controller.test.ts` — precedente de montagem de módulo de teste.
- `apps/api/src/ai/ai.service.test.ts` — o `fakePrisma()` que esta story **não** substitui.
- `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/` — o que o banco efêmero materializa.
- [Estratégia de testes](../04-testes/estrategia-de-testes.md), seção *2. Testes de integração* — a lacuna declarada que esta story fecha.
