# US-03 — Estado de cena estruturado (continuidade espacial)

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 📋 Planejada (não iniciada)
**Depende de:** Fase A da memória (resumo contínuo + janela recente) — já implementada
**Criada em:** 2026-06-27

---

## História

> **Como** jogador,
> **quero** que o mestre mantenha um estado de cena explícito (local atual, personagens presentes, período do dia e objetos em cena),
> **para que** a narração nunca me teletransporte nem invente cenário que contradiz onde estou.

---

## Contexto e motivação

### O problema observado

Numa sessão real, o personagem estava na **praça central** de uma vila ao entardecer e recebeu de um NPC um **mapa da estrada**. No turno seguinte, ao digitar "olhar o mapa", o mestre narrou:

> *"Você olha para o mapa desdobrado **sobre a mesa**, mostrando a região de **Floresta Escura**..."*

Três erros de continuidade num único parágrafo:

1. **Cenário inventado** — não há mesa numa praça aberta; o personagem nunca foi colocado em local interno.
2. **Reposicionamento implícito** — o personagem foi "sentado a uma mesa" sem ter se movido.
3. **Conteúdo do objeto trocado** — o "mapa da estrada" virou "mapa da Floresta Escura".

### Por que a Fase A não basta

A **Fase A** (resumo de longo prazo em `Adventure.memorySummary` + janela recente verbatim, ver `apps/api/src/ai/ai.service.ts`) resolve o **esquecimento de enredo** em sessões longas: quests, NPCs e fios em aberto não somem mais em silêncio.

Mas a continuidade **espacial** ainda depende de o modelo **reler a prosa** dos turnos anteriores e inferir corretamente onde está. Modelos menores (como o `llama-3.3-70b` usado na narração) escorregam justamente nesse tipo de inferência implícita. O reforço textual no prompt (`dm-system.ts` → seção *SPATIAL & SCENE CONTINUITY RULE*) ajuda, mas não tem uma **fonte de verdade**: é só mais texto que o modelo pode ignorar.

### A proposta

Manter um **estado de cena estruturado** (`sceneState`), persistido e atualizado deterministicamente, reinjetado no prompt a cada turno como **fonte de verdade** da regra de continuidade. Assim o modelo não precisa *inferir* o lugar — ele recebe o lugar.

---

## Escopo

### Dentro do escopo

- Um objeto `sceneState` persistido por aventura (single-player: um personagem por aventura).
- Atualização do `sceneState` a partir de um mecanismo determinístico (tool dedicada ou tags já emitidas).
- Reinjeção do `sceneState` atual no system prompt a cada turno.
- Inclusão do `sceneState` no fluxo de sumarização (Fase A) para não se perder ao sair da janela recente.
- Eval de regressão cobrindo o caso "praça → mapa → olhar o mapa".

### Fora do escopo

- Estado de cena por jogador em sessões multiplayer (Fase 4) — aqui assume-se single-player.
- Mapa/grid tático ou posicionamento em coordenadas. `sceneState` é narrativo, não geométrico.
- Renderização visual da cena no frontend. (Pode virar story futura; aqui é só dado interno.)

---

## Modelo de dados proposto

Formato do `sceneState` (JSON):

```json
{
  "local": "praça central de Willowdale",
  "ambiente": "externo",
  "periodo": "entardecer",
  "presentes": ["Thorne (prefeito)"],
  "objetos_em_cena": ["mapa da estrada", "bolsa de provisões"],
  "atualizadoEm": "2026-06-27T21:40:00Z"
}
```

| Campo             | Tipo                     | Descrição                                                                           |
| ----------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `local`           | string                   | Local atual do personagem em linguagem natural.                                     |
| `ambiente`        | `"externo" \| "interno"` | Distingue cena aberta de fechada — base direta da regra "não há mesa numa praça".   |
| `periodo`         | string                   | Período do dia (manhã/tarde/entardecer/noite).                                      |
| `presentes`       | string[]                 | Personagens/NPCs presentes na cena agora.                                           |
| `objetos_em_cena` | string[]                 | Objetos relevantes visíveis/disponíveis na cena (distinto do inventário carregado). |
| `atualizadoEm`    | ISO datetime             | Última atualização.                                                                 |

**Persistência (decisão a tomar — ver Questões em aberto):**

- Opção A: coluna `sceneState Json?` em `Adventure`.
- Opção B: coluna `sceneState Json?` em `CharacterState` (já é por `(characterId, adventureId)`).

Recomendação: **`CharacterState`**, pois já é a granularidade certa (personagem × aventura) e onde HP/inventário/condições vivem — mantém todo o estado mutável de jogo junto.

---

## Como o `sceneState` é alimentado (determinístico)

O agente **não** deve ter o estado extraído por parsing frágil da narração livre. Duas alternativas:

1. **Tool dedicada `updateScene`** (recomendado) — análoga a `updateCharacterHp`. O agente declara mudanças explicitamente:
   
   ```ts
   updateScene({ local?, ambiente?, periodo?, presentes?, objetos_em_cena? })
   ```
   
   Vantagem: determinístico, validável com Zod, registrável em `EventLog`. O Game Server faz merge parcial com o estado atual.

2. **Reuso das tags `[WORLD_STATE_UPDATE: {...}]`** que o prompt já manda emitir — interceptadas no `onFinish`/no stream e mescladas no `sceneState`.

Em ambos os casos, o **merge é parcial**: campos não informados num turno preservam o valor anterior.

---

## Regras de continuidade (lógica)

1. **Local persiste.** `local`/`ambiente` só mudam quando o jogador age para se mover (andar, entrar, sair, viajar). Inspecionar um item carregado (mapa, carta, livro) **nunca** altera `local`.
2. **Coerência ambiente × objeto.** Se `ambiente = "externo"`, a narração não pode referenciar mobília/cômodo (mesa, cadeira, parede, balcão) que não esteja em `objetos_em_cena`.
3. **Presentes são canônicos.** Não introduzir nem remover personagens fora de `presentes` sem um evento que justifique (NPC chega/sai).
4. **Objetos mantêm identidade.** Um "mapa da estrada" não vira "mapa de outra região". Nome e conteúdo de objetos estabelecidos são imutáveis salvo evento explícito.
5. O `sceneState` reinjetado tem **precedência** sobre inferências do modelo a partir da prosa.

---

## Critérios de aceite

- [ ] Existe um `sceneState` persistido por aventura/personagem com, no mínimo: `local`, `ambiente`, `periodo`, `presentes`, `objetos_em_cena`.
- [ ] O `sceneState` é alimentado por mecanismo determinístico (tool `updateScene` ou tags `[WORLD_STATE_UPDATE]`), nunca por parsing da narração livre.
- [ ] Atualizações de cena fazem **merge parcial** — campos omitidos num turno preservam o valor anterior.
- [ ] O `sceneState` atual é reinjetado no system prompt a cada turno, como fonte de verdade da regra de continuidade espacial de `dm-system.ts`.
- [ ] Mudança de `local` só ocorre em ação de deslocamento do jogador; ação que só inspeciona item carregado NÃO altera `local`.
- [ ] O `sceneState` é incluído/resumido no `memorySummary` ao ser condensado (Fase A), para não se perder ao sair da janela recente.
- [ ] **Eval de regressão:** o cenário "praça (externo) → recebe mapa da estrada → olhar o mapa" produz narração que (a) mantém `ambiente = externo`, (b) não introduz mesa/sala/mobília, (c) não troca o conteúdo do mapa, (d) não move o personagem.
- [ ] Mudança de cena legítima (ex.: "entrar na taverna") atualiza `ambiente` para `interno` e `local` corretamente.

---

## Notas de implementação

- Reaproveitar o gancho `onFinish` e o pipeline de tags já existentes; **evitar nova chamada de LLM** só para extrair o estado.
- Tool `updateScene` análoga a `updateCharacterHp` em `ai.service.ts` (validação Zod + persistência + `EventLog` tipo `CHARACTER_UPDATE` ou novo tipo `SCENE_UPDATE`).
- A reinjeção entra em `buildDmSystemPrompt` como uma seção `## Cena atual` próxima à regra espacial, em formato compacto (chave: valor).
- No `summarizeOldTurns`, anexar uma linha do `sceneState` corrente ao input de resumo para que o estado sobreviva à condensação.
- Avaliar adicionar `SCENE_UPDATE` ao enum `EventType` do Prisma se quiser auditar mudanças de cena separadamente.

---

## Questões em aberto

1. **Persistência:** `Adventure.sceneState` vs `CharacterState.sceneState`? (Recomendação: `CharacterState`.)
2. **Alimentação:** tool `updateScene` dedicada vs reuso das tags `[WORLD_STATE_UPDATE]`? A tool é mais robusta porém exige o modelo chamá-la com disciplina; as tags já existem mas dependem de parsing confiável.
3. **Novo `EventType.SCENE_UPDATE`** para auditoria, ou reaproveitar `CHARACTER_UPDATE`?
4. Quão verboso deve ser `objetos_em_cena`? Risco de inflar o prompt se a IA listar cada detalhe ambiental.

---

## Referências no código

- `apps/api/src/ai/ai.service.ts` — pipeline de turno, `onFinish`, `summarizeOldTurns` (Fase A).
- `packages/ai-engine/src/prompts/dm-system.ts` — seção *SPATIAL & SCENE CONTINUITY RULE* e *MANDATORY TEXT FORMATTING RULES* (tags `[WORLD_STATE_UPDATE]`).
- `apps/api/prisma/schema.prisma` — `CharacterState`, `EventLog`, enum `EventType`.
- `docs/sdlc/01-requisitos/user-stories.md` — entrada-resumo desta story.
