# US-243 — Aventura gerada pela interface, em dev, é salva como JSON em evals/reports

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-239](./US-239-motor-em-createforcharacter-ledger-e-aposenta-gancho.md) (motor gera o artefato) · [US-235](./US-235-gatilho-assincrono-tela-de-espera-erro-retry.md) (gatilho assíncrono — é este fluxo, não mais `createForCharacter` direto, que hoje detém `gateResult.adventure`)
**Relacionado:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (`run-authoring.ts` já faz este dump, mas só via script manual) · [US-202](./US-202-export-da-aventura-para-analise-manual.md) (mesmo padrão de porta dev-only por `NODE_ENV`)
**Criada em:** 2026-09-15

---

## História

> **Como** mantenedora rodando a API em dev,
> **quero** que toda aventura gerada pelo motor através do fluxo real da interface (wizard de criação de personagem) seja também salva como JSON em `evals/reports/`,
> **para que** eu tenha artefatos reais de uso pra inspecionar, comparar e alimentar eval sem depender de rodar `run-authoring.ts` à mão.

---

## Contexto e motivação

### O problema observado

`evals/reports/` já tem arquivos `authoring-<characterId>-<timestamp>.json` — mas todos nascem de `apps/api/scripts/run-authoring.ts` (US-232), um script que se roda manualmente no terminal contra um personagem já existente no banco. Aventuras geradas pelo fluxo real — alguém abre a interface, cria um personagem, escolhe "Criar minha história" — passam pelo mesmo motor (`generateGatedAdventure`, dentro de `createForCharacter`, US-239) mas o artefato (`generated`, já validado pelo gate) só é persistido em `Adventure.generatedAdventure` no banco. Não sobra arquivo solto pra abrir, diffar ou colar num eval.

### Por que a solução atual não basta

`run-authoring.ts` gera uma aventura **isolada**, desacoplada do fluxo real (não passa pelo `AdventureController`, não reflete o `dto` que a interface manda, não pega os bugs de integração do caminho HTTP real). Puxar o artefato do banco funciona, mas exige um passo manual (`db:studio` ou query) toda vez que se quer inspecionar a última geração — não é o hábito rápido de "gerei, já abro o JSON".

### A proposta

Quando `createForCharacter` gera uma aventura pelo motor (ramo "Criar minha história", não o ramo `dto.preset`) e o ambiente é dev, grava o artefato aprovado pelo gate como JSON em `evals/reports/`, no mesmo formato que `run-authoring.ts` já usa.

---

## Escopo

### Dentro do escopo

- Depois de `generateGatedAdventure` retornar `ok` em `createForCharacter` (ramo gerado, não `dto.preset`), grava `generated` (o artefato já validado) como JSON em `evals/reports/`.
- Gate por ambiente: mesmo padrão de `adventure.module.ts` (`NODE_ENV !== 'production'`, US-202) — em produção o dump nunca acontece, não é feature-flag condicional em runtime dentro do handler.
- Nome de arquivo no mesmo formato de `run-authoring.ts`: `authoring-<characterId>-<timestamp ISO sem : .>.json`, mesmo diretório (`evals/reports/`, `mkdirSync(..., { recursive: true })`).
- Falha ao escrever o arquivo (disco cheio, permissão) **não pode derrubar a criação de personagem** — é dump de debug, best-effort, nunca bloqueante.

### Fora do escopo

- Trocar `run-authoring.ts` por esta rota — o script continua existindo pra gerar aventura pra um personagem específico sem passar pela UI (US-232).
- Dump do ramo `dto.preset` ("Aventura pronta") — esse ramo não passa pelo motor, não tem `GeneratedAdventure` pra salvar.
- Expor este artefato por alguma rota HTTP (isso já existe, é dev-only, US-202/`AdventureExportController`) — aqui é só escrita em disco no momento da geração.
- Rotacionar/limpar `evals/reports/` — fica pra quem sentir a dor (já tem acúmulo de arquivos de spikes anteriores).

---

## Critérios de aceite

- [ ] Em `NODE_ENV !== 'production'`, criar um personagem e escolher "Criar minha história" grava um `evals/reports/authoring-<characterId>-<timestamp>.json` com o mesmo `generated` que foi persistido em `Adventure.generatedAdventure`.
- [ ] Em `NODE_ENV === 'production'`, nenhum arquivo é escrito — mesma disciplina de porta dupla do `adventure.module.ts` (US-202), não um `if` solto dentro do handler.
- [ ] O ramo `dto.preset` ("Aventura pronta") não tenta escrever nada (não tem artefato do motor).
- [ ] Uma falha de escrita (mock de `writeFileSync` lançando) não impede a criação do personagem nem derruba a resposta da API — erro no máximo logado.
- [ ] **Eval / teste de regressão:** teste em `adventure.service.test.ts` (exercitando `runAdventureGeneration`/`finalizeGeneratedAdventure`, não `createForCharacter` — ver "Notas de implementação") cobrindo (a) dev grava o arquivo com o conteúdo certo; (b) produção não grava; (c) falha de escrita não propaga.

---

## Notas de implementação

- **Ponto de entrada real (pós US-235, não mais `createForCharacter`):** `createForCharacter` só dispara `void this.runAdventureGeneration(...)` ([adventure.service.ts:589](../../../apps/api/src/adventure/adventure.service.ts)) e retorna (`Adventure` fica `GENERATING`). Quem detém `gateResult.adventure` é `runAdventureGeneration` ([linha 612-617](../../../apps/api/src/adventure/adventure.service.ts)), que repassa como parâmetro `generated` para `finalizeGeneratedAdventure` ([linha 630](../../../apps/api/src/adventure/adventure.service.ts)).
- **Grava DEPOIS da transação confirmar**, não logo após o gate: `finalizeGeneratedAdventure` só persiste `generated` em `Adventure.generatedAdventure` dentro do `tx.$transaction` ([linha 687-695](../../../apps/api/src/adventure/adventure.service.ts)). Dump precisa ficar depois desse `await this.prisma.$transaction(...)` resolver com sucesso — se escrever o arquivo antes e a transação falhar, o JSON em disco não corresponde a nada persistido (viola o critério de aceite "mesmo `generated` que foi persistido").
- Reaproveitar a lógica de nome de arquivo/diretório de [apps/api/scripts/run-authoring.ts:56](../../../apps/api/scripts/run-authoring.ts) em vez de duplicar — extrair pra função pequena compartilhada se o service e o script forem os dois consumidores.
- Condição de ambiente: mesmo `process.env.NODE_ENV !== 'production'` de [apps/api/src/adventure/adventure.module.ts:14](../../../apps/api/src/adventure/adventure.module.ts) (US-202) — não inventar variável nova sem checar se esta já resolve.
- Caminho do diretório a partir de `adventure.service.ts` (`apps/api/src/adventure/`) tem 1 nível a mais de profundidade que `scripts/run-authoring.ts` (`apps/api/scripts/`): o script sobe 3 `../` até a raiz, o service precisa de 4 `../` — conferir antes de copiar o literal.
- **Teste alvo muda:** critério de aceite fala em cobrir `createForCharacter`, mas quem roda a geração é `runAdventureGeneration` (promise solta) → `finalizeGeneratedAdventure`. Teste em `adventure.service.test.ts` precisa exercitar (ou esperar) `runAdventureGeneration`/`finalizeGeneratedAdventure`, não só chamar `createForCharacter` e checar retorno síncrono.

---

## Questões em aberto

Nenhuma. Decisão: só `NODE_ENV !== 'production'`, sem flag opt-in extra (tipo `DEV_EXPORT` de US-202). US-202 exige duas condições porque registra uma **rota HTTP** — superfície de ataque mesmo em dev, vale o opt-in explícito. Aqui é só escrita em disco local, sem rota nova; o pedido original já é "sempre que gerar em dev", e acúmulo de arquivo em `evals/reports/` não é problema novo (já existe dos spikes, ver "Fora do escopo" — rotação fica pra quando doer).

---

## Referências no código

- [apps/api/src/adventure/adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `runAdventureGeneration` (linha ~601) dispara o gate; `finalizeGeneratedAdventure` (linha ~630) recebe `generated` e persiste na transação (linha ~687).
- [apps/api/scripts/run-authoring.ts](../../../apps/api/scripts/run-authoring.ts) — dump equivalente, hoje só manual (US-232).
- [apps/api/src/adventure/adventure.module.ts](../../../apps/api/src/adventure/adventure.module.ts) — padrão de porta dev-only por `NODE_ENV` (US-202).
- [US-239](./US-239-motor-em-createforcharacter-ledger-e-aposenta-gancho.md) — motor passou a rodar no fluxo de criação, precondição desta story.
- [US-235](./US-235-gatilho-assincrono-tela-de-espera-erro-retry.md) — moveu a geração de `createForCharacter` pra `runAdventureGeneration` (promise solta); é este o entry point real do dump.
