# US-198 — Um resumo de uma frase para a aventura, não a premissa inteira

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-192](./US-192-premissa-elaborada-com-vinculo-pessoal.md) (`generatePremissa`/`PREMISSA_SCHEMA` — este story estende o mesmo schema/chamada) · [US-144](./US-144-schema-aventura-shared.md) (`GeneratedAdventureSchema` ganha campo novo)
**Relacionado:** [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (é onde `Quest` primária passou a nascer do artefato gerado) · [US-169](./US-169-quest-gerada-ganha-objetivo-e-conclusao-acionavel.md) (`objective`, que já cobre o alvo concreto da quest — este story não mexe nele)
**Criada em:** 2026-08-24 — a pedido da mantenedora, ao ver a tela do hub (`HomeHero`) mostrando o parágrafo inteiro da premissa como se fosse um título.

---

## História

> **Como** jogadora,
> **quero** ver uma frase curta identificando a aventura em andamento — não o parágrafo inteiro da premissa —,
> **para que** a tela do hub (e qualquer outro lugar que mostre o "nome" da aventura) seja escaneável, não um bloco de texto para ler antes de decidir "continuar jogando".

---

## Contexto e motivação

### O problema observado

Na tela do hub (`HomeHero`), o rótulo "Aventura:" é seguido do texto inteiro da premissa elaborada — várias frases, com vírgulas e reticências, no lugar de um título:

> Aventura: *O ar na clareira de Folhassombra está denso e frio, carregado de um sussurro que apenas você ouve — não a sua voz interior, mas outra, mais antiga e corrupta. No centro, o elfo ancião Kaelen está ajoelhado, segurando um medalhão de obsidiana que pulsa com energia infernal, enquanto os espíritos da floresta gritam em silêncio ao redor. [...]*

Isso acontece porque **não existe campo de título curto** no artefato gerado. `Adventure.title` e `Quest.title` (`Quest` primária) são os dois preenchidos com `generated.summary` ([adventure.service.ts:542](../../../apps/api/src/adventure/adventure.service.ts), [:575](../../../apps/api/src/adventure/adventure.service.ts)), e `generated.summary` é literalmente a `premissa` sem edição nenhuma ([adventure.service.ts:375](../../../apps/api/src/adventure/adventure.service.ts): `summary: premissa`). O campo se chama "summary" mas carrega um parágrafo de scene-setting, não um resumo.

### Por que a solução atual não basta

`GeneratedAdventureSchema.summary` ([adventure-generation.ts:95](../../../packages/shared/src/types/adventure-generation.ts)) não tem `.describe()` nem comentário — nada no schema diz que deveria ser curto, e nada no `system` de `generatePremissa` pede uma frase enxuta. `PREMISSA_SCHEMA` ([ai.service.ts:172](../../../apps/api/src/ai/ai.service.ts)) só devolve `premissa: z.string().min(1)`; o campo é criado justamente para ser elaborado (US-192), não para virar título.

Truncar `summary` no código (ex.: primeiras N palavras, ou até o primeiro `.`) foi considerado e descartado — ver *Fora do escopo*.

### A proposta

`generatePremissa` passa a devolver, na mesma chamada, uma frase curta ao lado da premissa elaborada. `Adventure.title`/`Quest.title` passam a usar essa frase; `generated.summary` (a premissa completa) continua existindo sem mudança, porque outro consumidor depende do texto longo — ver abaixo.

---

## Escopo

### Dentro do escopo

- `PREMISSA_SCHEMA` ([ai.service.ts:172](../../../apps/api/src/ai/ai.service.ts)) ganha `title: z.string().min(1)` — uma frase (não a premissa truncada, um RESUMO: nomeia o gancho central — quem, o quê, o que está em jogo — sem a atmosfera).
- `system`/prompt de `generatePremissa` ganha instrução explícita: depois de elaborar a premissa, escrever essa frase à parte. Guarda-corpo negativo — nunca copiar/truncar a premissa, nunca terminar em reticências.
- `GeneratedAdventureSchema` ([adventure-generation.ts:91](../../../packages/shared/src/types/adventure-generation.ts)) ganha `title: z.string().min(1)`, paralelo a `summary` (que fica como está).
- `adventure.service.ts`: `Adventure.title` ([:542](../../../apps/api/src/adventure/adventure.service.ts)) e `Quest.title` da quest primária ([:575](../../../apps/api/src/adventure/adventure.service.ts)) passam a usar `generated.title`, não `generated.summary`.
- `generatePremissa` retorna `{ premissa, title }`; o chamador em `adventure.service.ts` passa os dois adiante — `premissa` continua alimentando `buildLocationsAndNpcsPrompt`, `buildOpeningBeatPrompt` etc. sem mudança nenhuma.
- Teste de regressão: `PREMISSA_SCHEMA.safeParse(...).success === false` quando falta `title`; fixture de `adventure.service.test.ts` (linha ~307, que hoje só confere `typeof adventure.title === 'string'`) passa a existir com um `title` mockado DIFERENTE do `summary` mockado, provando que o código lê o campo certo.

### Fora do escopo

- **Truncar `summary` em vez de gerar `title` novo.** Cortar por tamanho de caractere ou pelo primeiro `.` corta no meio de uma vírgula ou de um nome próprio na metade da frase (a premissa é escrita como prosa corrida, não como manchete + corpo) — sem controle de onde a frase "faz sentido" sozinha. Pedir ao modelo pra escrever a frase curta como campo próprio é mais barato que pós-processar texto e mais confiável.
- **Nova chamada de IA só para o título.** `generatePremissa` já roda uma vez por aventura — acrescentar `title` ao mesmo schema não custa round-trip novo (mesmo raciocínio da nota *"Um campo, uma chamada"* da [US-193](./US-193-encontros-sem-cadeia-causal-entre-si.md)).
- **Limite de caracteres validado no schema (`.max()`).** É prosa de modelo, não formulário — limite rígido reprovaria uma frase boa por sobrar 3 caracteres. A instrução de tamanho ("uma frase, curta") vai no `system`, não no Zod. Se a eval mostrar frases sistematicamente longas, ajusta-se o prompt, não se acrescenta gate.
- **Mudar `generated.summary`/`mainQuest` do lado de `adventure.service.ts` ([:469](../../../apps/api/src/adventure/adventure.service.ts)).** Esse `mainQuest` alimenta `generateOpeningNarration` — é insumo para o MODELO escrever a abertura, não rótulo de UI. A premissa inteira continua sendo o contexto certo ali; só a UI e o título da quest precisavam de um resumo.
- **Backfill de aventuras já persistidas.** `Adventure.title`/`Quest.title` de aventuras criadas antes desta story continuam com o parágrafo inteiro gravado — sem migração de dados, sem re-geração. Mesmo padrão da [US-193](./US-193-encontros-sem-cadeia-causal-entre-si.md) (*Fora do escopo*, backfill).
- **Editar o título depois de gerado.** Nenhuma UI de renomear aventura nesta story — só a geração passa a produzir um título curto por padrão.

---

## Modelo de dados proposto

```ts
// apps/api/src/ai/ai.service.ts
const PREMISSA_SCHEMA = z.object({
  premissa: z.string().min(1),
  // US-198: frase curta (resumo do gancho — quem, o quê, o que está em jogo), para
  // exibir como título da aventura. NÃO é a premissa truncada; é escrita à parte.
  title: z.string().min(1),
})
```

```ts
// packages/shared/src/types/adventure-generation.ts
export const GeneratedAdventureSchema = z.object({
  id: z.string().min(1),
  levelRange: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  registry: AdventureRegistrySchema,
  summary: z.string().min(1),
  // US-198: resumo de uma frase — usado como Adventure.title/Quest.title. `summary`
  // continua sendo a premissa elaborada inteira, consumida por generateOpeningNarration
  // via `mainQuest` (adventure.service.ts) — os dois campos servem leitores diferentes.
  title: z.string().min(1),
  // ...resto sem mudança
})
```

**Persistência:** mesma coluna `Adventure.title` (`String`) e `Quest.title` (`String`) que já existem — só muda o valor gravado nelas, de `generated.summary` para `generated.title`.

---

## Critérios de aceite

- [ ] `PREMISSA_SCHEMA` rejeita objeto sem `title` (`.safeParse(...).success === false`).
- [ ] `generatePremissa` devolve `title` além de `premissa`; teste com mock do `generateObject` confere que o `system`/prompt pede a frase curta (assert de substring, mesmo padrão dos outros guards de prompt no arquivo).
- [ ] `GeneratedAdventureSchema.parse()` falha quando `title` está ausente — sem `.optional()`.
- [ ] `Adventure.title` gravado na criação é `generated.title`, não `generated.summary` (teste em `adventure.service.test.ts`, mock com os dois campos diferentes, assert no valor persistido).
- [ ] `Quest.title` da quest primária também é `generated.title` (mesmo teste, mesma asserção na tabela `Quest`).
- [ ] `generated.summary` e `mainQuest` (`adventure.service.ts:469`, insumo de `generateOpeningNarration`) continuam usando a premissa inteira — teste de regressão confere que `mainQuest` ainda contém o texto de `summary`, não o de `title`.
- [ ] Tela do hub (`HomeHero`): sob "Aventura:", aparece a frase curta — atualizar `HomeHero.test.tsx` (linha ~27, hoje usa `'A Mina Perdida'` como mock de `title`, que já era curto; acrescentar um teste/asserção de que o texto renderizado é o `title` mockado, não um `summary` mockado longo, para travar a leitura do campo certo).
- [ ] `pnpm typecheck` e testes dos módulos tocados passam.
- [ ] Seed jogado à mão (ou leitura manual de uma aventura real gerada): `title` é de fato curto e faz sentido como rótulo — sem gate automático de tamanho, essa é a checagem que fica.

---

## Notas de implementação

- **`Quest.title` também alimenta o prompt de TURNO, não só a UI.** `ai.service.ts:628`, dentro do `streamChat`: `mainQuest = ${primary.title}\n${primary.description}${primary.objective ...}` — isso vai para o Mestre todo turno via `## Main quest` (US-28). Encurtar `Quest.title` encurta esse bloco, mas `description` (a abertura, `generated.start`) e `objective` (US-169) continuam presentes e já carregam o contexto concreto — o parágrafo inteiro da premissa duplicado em `title` era redundância, não informação exclusiva. Não é regressão esperada, mas vale conferir no `pnpm eval` se algum caso sente falta do texto perdido.
- **Guarda-corpo do prompt: nomear o gancho, não descrever a atmosfera.** Frase como *"Uma clareira amaldiçoada esconde segredos antigos"* ainda é vaga demais para funcionar como título de lista (toda aventura tem "segredos antigos"). Preferir algo como *"Kaelen se recusa a soltar um medalhão infernal que está apodrecendo a floresta"* — nomeia quem, o quê, o que está em risco, do jeito que `PREMISSA_SCHEMA.premissa` já faz em prosa longa.
- **Arquivos principais:** `apps/api/src/ai/ai.service.ts` (`PREMISSA_SCHEMA`, `buildPremissaPrompt`, `generatePremissa`), `packages/shared/src/types/adventure-generation.ts` (`GeneratedAdventureSchema`), `apps/api/src/adventure/adventure.service.ts` (linhas 375, 542, 575 — onde `summary`/`title` são lidos e gravados), `apps/web/src/components/HomeHero.tsx` (consumidor final, já lê `adventure.title` — não muda, só o dado que chega nele muda).

---

## Questões em aberto

1. Vale limitar o `title` a um tamanho alvo no PROMPT (ex.: "até 12 palavras") ou deixar o modelo calibrar sozinho e revisar depois de ver exemplos reais? Proposta: começar sem número fixo no prompt, medir em ~10 gerações, só then decidir se precisa de instrução de tamanho mais dura (mesma disciplina de "medir antes de otimizar" da US-193).
2. `Quest.title` de quests SECUNDÁRIAS (não-primárias, se/quando existirem) usa o quê? Hoje só a quest primária nasce do artefato gerado — fora do escopo até existir uma segunda fonte.

---

## Referências no código

- [`apps/api/src/ai/ai.service.ts`](../../../apps/api/src/ai/ai.service.ts) — `PREMISSA_SCHEMA`, `buildPremissaPrompt`, `generatePremissa` (a chamada que ganha o campo novo); `streamChat` (`mainQuest`, linha ~628, consumidor de `Quest.title` todo turno).
- [`packages/shared/src/types/adventure-generation.ts`](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema`.
- [`apps/api/src/adventure/adventure.service.ts`](../../../apps/api/src/adventure/adventure.service.ts) — `summary: premissa` (linha 375, não muda), `title: generated.summary` em `Adventure`/`Quest` (linhas 542/575, muda para `generated.title`), `mainQuest` (linha 469, não muda).
- [`apps/web/src/components/HomeHero.tsx`](../../../apps/web/src/components/HomeHero.tsx) — linha 119, onde `adventure.title` é renderizado sob "Aventura:".
- [US-192](./US-192-premissa-elaborada-com-vinculo-pessoal.md) — origem de `generatePremissa`/`PREMISSA_SCHEMA`.
