# US-71 — Simplificar a localização do personagem (uma fonte de verdade, sem replay)

**Épico:** 3 — Narração e mecânica
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-11b](./US-11b-estado-de-cena-estruturado.md) (sceneState), [US-56](./US-56-estado-do-turno-na-mensagem.md) (estado do turno na mensagem), [registro de entidades](../../adr/002-memoria-de-sessao.md) (Adventure.entities).
**Relacionada a:** [US-69](./US-69-guard-anti-degeneracao-narracao.md) (anti-degeneração — o detector de n-grama serve aqui também).
**Criada em:** 2026-07-24

---

## História

> **Como** jogador,
> **quero** que, quando eu já estou num lugar e ajo, o Mestre continue de onde parou — sem re-narrar a viagem, a chegada nem a saudação do NPC que já aconteceram,
> **para que** a cena avance a cada turno em vez de rebobinar, e o Mestre nunca me confunda sobre onde estou.

---

## Contexto e motivação

### O problema observado

Sessão real anexada (`erro location.md`). No **turno 1** a jogadora escolhe "Passar na casa do ferreiro antes de partir" — a narração conta a despedida na capela, a travessia da rua e a **chegada à forja**, terminando com Hélio erguendo os olhos e perguntando *"Vai sair?"*. O `sceneState` termina o turno correto: `local = forja`, `presentes = [Hélio]`.

No **turno 2** a jogadora escolhe uma opção que apenas **continua a conversa** ("Contar a Hélio que vai para o Pântano de Ossos…"). O esperado: Hélio responde ali mesmo, na forja. O que aconteceu: o Mestre **re-narrou o turno 1 inteiro** — a despedida de Elara, Tobias acenando, Barnabé na porta, a travessia da rua, o cão abanando o rabo, a chegada à forja e a saudação **idêntica** de Hélio (*"Anetra! Achei que a menina ia passar o dia na capela… Vai sair?"*). Duas vezes a mesma chegada, mais tokens gastos, cena parada.

Isto é **replay de transição**, não erro de posição: a personagem já estava na forja; o Mestre rebobinou um trecho de passado já narrado.

### Por que a solução atual não basta

A localização hoje é sustentada por **três representações que se sobrepõem** e por **prosa que o modelo pode ignorar**:

1. **`sceneState.local`** (bloco "Cena atual", `formatSceneState`) — o *snapshot* espacial do agora.
2. **`local` de cada entidade** no registro durável (bloco "Entidades do mundo", `formatEntities`) — cada NPC/lugar carrega sua própria localização.
3. **A prosa** — o resumo (`memorySummary`) e o histórico recente verbatim, de onde o modelo *infere* onde está.

Ter três fontes cria a necessidade de **arbitrar precedência entre elas** — e é exatamente o que `dm-system.ts:361` faz num parágrafo dedicado ("the MOST RECENT on-screen state wins… when the summary disagrees with recent narration, recent narration wins"). Regra de desempate só existe porque há fontes demais brigando.

E o pior: **nenhuma das três marca que "a chegada já foi narrada".** O `sceneState` é um *snapshot* (onde/quem/quando), não um registro de que a transição terminou. A única defesa contra o replay é **prosa**:

- `dm-system.ts:353-366` — seção *SPATIAL & SCENE CONTINUITY RULE* (~14 linhas), incluindo *"Arrival happens ONCE… NEVER re-narrate a journey already completed"*.
- `dm-system.ts:344-349` — *NARRATIVE CONSISTENCY RULE*.
- `dm-system.ts:307-312` — *World State — tools only*.

São ~40 linhas de instrução reinjetadas **todo turno** (~centenas de tokens de entrada) e, como o anexo prova, **falham**: `Arrival happens ONCE` é conselho, não trava. A própria US-11b já reconhecia que reforço textual "é só mais texto que o modelo pode ignorar" — e adicionou o `sceneState`; mas o `sceneState`, sendo *snapshot*, não impede o replay de um beat já contado.

### A proposta

Enxugar a localização para **uma fonte de verdade espacial** (a cena) e substituir a prosa anti-replay por **um sinal estrutural de continuidade** que o modelo lê como imperativo: *"a personagem ESTÁ em {local}; a chegada JÁ foi contada; narre APENAS o que esta ação acrescenta."* Menos representações concorrentes → menos confusão; sinal estruturado no lugar de ~40 linhas de prosa → menos degeneração e menos tokens.

---

## Escopo

### Dentro do escopo

- **Fonte única espacial.** A localização da **personagem** passa a viver **só** no `sceneState` (`local`/`ambiente`/`periodo`). O `local` das **entidades** fica reservado a **NPCs/objetos fora de cena** (última posição conhecida de quem não está presente) e, quando o NPC está em `presentes`, `formatEntities` **omite** a linha "— em {local}" redundante (Q2 resolvida). Remover a arbitragem de precedência da prosa (`dm-system.ts:361`), que só existe por causa da concorrência de fontes.
- **Sinal de continuidade estrutural** (Q1 resolvida): uma **linha imperativa** no `buildTurnStateBlock` — emitida só quando há `local` — afirma que a personagem **já está** no local e que a **chegada/transição já foi narrada**, o Mestre continua daí. Substitui o `Arrival happens ONCE` em prosa por dado do Game Server. Sem flag persistido / sem migração (upgrade adiado por YAGNI — ver Questões em aberto #1).
- **Corte de prosa redundante.** Colapsar as seções *SPATIAL & SCENE CONTINUITY* + *NARRATIVE CONSISTENCY* num único bloco curto que **aponta para o estado estruturado** em vez de repetir a regra por extenso. Meta mensurável: reduzir os tokens de entrada dessas seções (ver eval).
- **Eval comparativo velho-vs-novo** (o pedido central) — ver seção dedicada abaixo.

### Fora do escopo

- **Mapa/grid tático ou coordenadas.** `sceneState` continua narrativo, não geométrico (mantém a fronteira da US-11b).
- **Reescrever o registro de entidades** (US da memória de sessão). Aqui só se **redefine o papel** do campo `local` da entidade (fora-de-cena), não a estrutura do ledger.
- **Guard determinístico de degeneração em streaming** — é a [US-69](./US-69-guard-anti-degeneracao-narracao.md). Esta story reduz a *probabilidade* de replay pela via do prompt/estado; a US-69 é a rede de segurança em runtime. O detector de n-grama da US-69, porém, é **reaproveitado como métrica** no eval desta story.
- **Renderização visual da cena no frontend.**

---

## Modelo de dados proposto

Sem tabela nova. A mudança é de **papel** e de **um sinal**, não de esquema.

O `sceneState` (em `CharacterState.sceneState`) permanece:

```json
{
  "local": "forja de Hélio",
  "ambiente": "interno",
  "periodo": "manhã",
  "presentes": ["Hélio"],
  "objetos_em_cena": ["bigorna", "martelo"],
  "atualizadoEm": "2026-07-24T09:12:00Z"
}
```

O que muda:

| Campo / conceito | Antes | Depois |
|---|---|---|
| Localização da **personagem** | `sceneState.local` **e** inferível da prosa **e** cruzável com `local` de entidades | **Só** `sceneState.local`. Fonte única. |
| `local` de uma **entidade** (`Adventure.entities`) | Autoridade paralela sobre posição (gera a regra de desempate) | **Última posição conhecida de entidade FORA de cena.** Quem está em `presentes` tem posição = `sceneState.local`, ponto. |
| "Chegada já narrada" | Não existe como dado; só prosa `Arrival happens ONCE` | **Sinal estrutural** no bloco do turno (forma mínima — ver Questões em aberto #1). |

**Persistência:** inalterada — `CharacterState.sceneState` (Json). Se a forma escolhida para o sinal de continuidade for um flag no próprio `sceneState` (ex.: `chegadaNarrada: true` marcado quando `updateScene` muda o `local`), ele entra no mesmo Json, sem migração de coluna.

---

## Critérios de aceite

- [ ] A localização **da personagem** tem **uma** fonte de verdade (`sceneState.local`). O parágrafo de arbitragem de precedência entre cena / entidades / resumo (`dm-system.ts:361`) foi removido ou reduzido a uma linha, porque não há mais fontes concorrentes a desempatar.
- [ ] O campo `local` de uma entidade é documentado (no código e no prompt) como **última posição conhecida de entidade fora de cena** — não como autoridade sobre a posição da personagem.
- [ ] Existe um **sinal estrutural** no bloco de estado do turno que afirma "a personagem JÁ está em {local}; a chegada/transição já foi narrada; continue daqui" — não como conselho em prosa, mas como estado fornecido pelo Game Server.
- [ ] As seções de continuidade em `dm-system.ts` foram **colapsadas** e apontam para o estado estruturado; os tokens de entrada dessas seções caíram de forma mensurável (medido no eval — meta ≥ 30% de redução nas linhas de regra de cena/continuidade, sem regressão de qualidade).
- [ ] **Regressão do bug do anexo (determinística):** dado o `sceneState` do turno 1 (`local = forja`, `presentes = [Hélio]`) e a ação do turno 2 continuando a conversa, a narração gerada **não** repete a chegada/saudação já presente no histórico recente — verificado pelo detector de sobreposição de n-grama contra a narração do turno anterior (limiar em constante nomeada).
- [ ] **Sem regressão de qualidade:** a MÉDIA da rubrica do juiz (US-36) da narração continua estatisticamente igual ou melhor que a solução antiga, no mesmo modelo de produção.
- [ ] **Sem regressão de continuidade espacial:** o eval "praça → mapa → olhar o mapa" (US-03/US-11b) continua passando — a personagem não é teletransportada nem ganha mobília inexistente.

---

## O eval comparativo (velho × novo)

O pedido explícito é **comparar a solução antiga com a nova**. O repositório já tem o arnês certo: `packages/ai-engine/prompt-ab-bakeoff.mjs` compara o **system prompt ANTIGO** (`old-system.snapshot.txt`) contra o **NOVO** (`buildDmSystemPrompt` do dist), **no mesmo modelo de produção** (`deepseek-v4-flash`, effort high), medindo por versão: onomástica, MÉDIA da rubrica, **taxa de degeneração (palavras coladas / n-grama repetido)** e **tokens de entrada reais**. Esta story **estende esse mesmo padrão** para o cenário de localização.

**Duas camadas de eval:**

1. **Determinística (unit, `evals/cases/`).** Estende `us-03-scene-state.ts` com um caso novo dedicado ao replay:
   - Monta o `sceneState` do turno 1 (forja/Hélio) e a narração do turno 1 (com a chegada + saudação).
   - Gera/simula o turno 2 e roda um **detector de replay** puro e testável — `overlapRatio(narrTurno2, narrTurno1)` por n-grama (trigrama), reusando a mesma ideia do detector da US-69. **ANTIGO** (prompt/estado atuais) dispara acima do limiar; **NOVO** fica abaixo. Custo zero, roda no CI (`pnpm eval`), sem chamar LLM.

2. **A/B com LLM real (`*-ab-bakeoff.mjs`, offline).** Clonar `prompt-ab-bakeoff.mjs` para um `location-ab-bakeoff.mjs` com:
   - **Cena-ímã de replay:** o `TURN_STATE` do turno 1 já com a personagem chegada à forja + a narração do turno 1 no histórico; a `PLAYER_ACTION` é uma opção que **só continua a conversa** (o pior caso do anexo).
   - **Dois braços:** `ANTIGO` = builder/estado de localização atuais; `NOVO` = fonte única + sinal de continuidade + prosa enxuta.
   - **Métricas por braço:** (a) **taxa de replay** = `overlapRatio` da nova narração contra a narração do turno anterior (o alvo); (b) **tokens de ENTRADA reais** (a prosa encolheu — validação do "enxugar"); (c) **MÉDIA da rubrica** do juiz (US-36) — trava contra regredir qualidade ao cortar prosa; (d) taxa de degeneração (n-grama), como no A/B existente.
   - Sucesso = NOVO com **replay menor**, **tokens de entrada menores** e **rubrica ≥** ANTIGO.

Assim o "comparar antigo com novo" fica tanto no CI (determinístico, barato) quanto no offline (LLM real, sobre o cenário exato do bug).

---

## Notas de implementação

> *Dicas para quem implementar. Pode divergir com boa justificativa.*

- **Onde está a localização hoje:**
  - `packages/ai-engine/src/scene.ts` — `mergeSceneState` / `formatSceneState` (snapshot da cena).
  - `packages/ai-engine/src/entities.ts` — `mergeEntities` / `formatEntities` (o `local` por entidade que vira "fora-de-cena").
  - `packages/ai-engine/src/prompts/dm-system.ts:344-366` — as seções CRITICAL a colapsar; `:401` `buildTurnStateBlock` (onde o sinal de continuidade entra); `:419-427` bloco "Cena atual".
  - `apps/api/src/ai/ai.service.ts:414-459` — tool `updateScene` (onde marcar "chegada narrada" ao mudar `local`); `:465-502` `recordEntity`.
- **Sinal de continuidade — forma mínima primeiro (ponytail).** Antes de adicionar campo ao Json, tentar a via **só-texto no bloco do turno**: quando `sceneState.local` está preenchido, o `buildTurnStateBlock` emite uma linha imperativa ("A personagem JÁ ESTÁ em {local}; a chegada foi narrada; comece DENTRO da cena, não a repita"). Isso é dado fornecido pelo Game Server, não conselho no system — e não custa migração. Só promover a um flag persistido (`chegadaNarrada`) se o texto sozinho não segurar no A/B.
- **Detector de replay reutilizável.** Extrair `overlapRatio(a, b)` puro (trigramas compartilhados / trigramas de `a`) — mesma família do detector de n-grama previsto na US-69. Serve ao eval determinístico E pode virar, depois, sinal de runtime.
- **Não apagar a prosa toda de uma vez.** Colapsar mantendo o essencial (mudança de cena → `updateScene` antes de narrar; inspecionar item carregado NÃO move). O corte é da **repetição** e da **arbitragem de precedência**, não das invariantes.
- **`ai-engine` roda do `dist`.** Editar `src` sem `pnpm --filter @ai-dm/ai-engine build` não tem efeito no A/B nem na API — rebuild antes de medir.
- **Rodar `pnpm eval`** após tocar em prompt/tools de cena e confirmar que passa (regra do projeto).

---

## Questões em aberto

> Decidido pela lente **enxugar tokens + diminuir degeneração**. As duas primeiras foram resolvidas; a terceira fica aberta porque é calibração de eval, não afeta token nem replay em runtime.

1. **Forma do sinal de continuidade — RESOLVIDO: linha imperativa no `buildTurnStateBlock`, sem flag persistido.** A linha (emitida só quando `sceneState.local` está preenchido) substitui as ~14 linhas da seção *SPATIAL & SCENE CONTINUITY* em prosa → **corta tokens líquidos** e ainda vira dado fornecido pelo Game Server (mais duro que conselho no system) → **ataca o replay**. Zero migração de schema. O flag persistido `chegadaNarrada` fica como upgrade **só se** o A/B mostrar que a linha sozinha não segura — YAGNI até lá.
2. **Papel do `local` da entidade — RESOLVIDO: deixar de exibir `local` de entidade que já está em `presentes`.** Além de documentar o campo como "fora-de-cena", `formatEntities` suprime a linha redundante "Hélio — em forja de Hélio" quando o NPC está na cena (posição dele já é `sceneState.local`). **Corta tokens** todo turno com NPC presente **e** remove a fonte concorrente que gerava a confusão de "onde está quem". A entidade continua listada (canon durável) — só o `— em {local}` some enquanto ela está presente.
3. **Limiar do `overlapRatio`** que separa replay de continuidade legítima (um turno pode reusar 1-2 frases do anterior por coesão). **Fica aberto** — é calibração contra narrações reais no runner de `evals/`, igual à da US-69; não corta token nem muda degeneração em runtime, então não entra no "implementar o que enxuga/reduz".

---

## Referências no código

- `packages/ai-engine/src/scene.ts` — `mergeSceneState` / `formatSceneState`: a fonte única espacial que esta story consolida.
- `packages/ai-engine/src/entities.ts` — `formatEntities`: o `local` por entidade que passa a ser "fora-de-cena".
- `packages/ai-engine/src/prompts/dm-system.ts` — `:344-366` seções a colapsar; `:401-472` `buildTurnStateBlock` (bloco "Cena atual" e onde entra o sinal de continuidade); `:361` a arbitragem de precedência a remover.
- `apps/api/src/ai/ai.service.ts` — `:414-459` `updateScene`; `:465-502` `recordEntity`; `:255-264` montagem do bloco de turno prefixado à ação.
- `packages/ai-engine/prompt-ab-bakeoff.mjs` — o arnês A/B (ANTIGO × NOVO, mesmo modelo) que o eval desta story estende para o cenário de localização.
- `evals/cases/us-03-scene-state.ts` — eval determinístico da cena a estender com o caso de replay.
- [US-11b](./US-11b-estado-de-cena-estruturado.md) — introduziu o `sceneState`; esta story o promove a fonte única e ataca o replay que o snapshot sozinho não pega.
- [US-69](./US-69-guard-anti-degeneracao-narracao.md) — detector de n-grama reaproveitado como métrica de replay aqui.
- `C:\Users\Catarina\Downloads\erro location.md` — a sessão real que motivou a story.
