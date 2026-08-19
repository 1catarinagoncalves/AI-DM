# US-174 — `hookSeed` deixa de ser insumo das outras chamadas do motor de geração

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** nenhuma — mexe em chamadas diferentes de `generateAdventure` das que a US-172 altera; sobreposição de arquivo é possível (merge), não dependência real.
**Relacionado:** [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) (story irmã — fonte literal do item "Fora do escopo" que originou esta story) · [US-175](./US-175-generateclosing-perde-hookseed-antagonista-so-premissa.md) (resolve a Questão em aberto #1 desta story — `generateClosing`) · [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) (Questão em aberto #2, decisão revisitada por US-175) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (comentário-fonte da intenção "gancho só ancora a abertura") · [US-148](./US-148-perfil-personagem-entrada-motor.md) (`buildAdventureProfile`, dono de `hookSeed`)
**Criada em:** 2026-08-19 — nasceu do item "Fora do escopo" da US-172: *"Remover `hookSeed` das OUTRAS chamadas do motor (`generateLocationsAndNpcs`, `generateSecrets`, `generateClosing`) — elas continuam recebendo `hookSeed` exatamente como hoje; esta story mexe só na geração de `start`."*

---

## História

> **Como** jogador que gera uma aventura nova,
> **quero** que `hookSeed` (o gancho fixo por classe) pare de influenciar locais, NPCs e segredos gerados pelo motor,
> **para que** o conteúdo do motor dependa só do que É desta aventura (`registry`/`rolled`/background), sem herdar viés do catálogo fixo por classe — mesma garantia que a US-172 já traz para `start`, agora para o resto do artefato.

---

## Contexto e motivação

### O problema observado

`hookSeed` é passado como parâmetro para três das quatro chamadas de IA do motor de geração (US-164): `generateLocationsAndNpcs` ([adventure.service.ts:139-144](../../../apps/api/src/adventure/adventure.service.ts)), `generateSecrets` ([adventure.service.ts:146-153](../../../apps/api/src/adventure/adventure.service.ts)) e `generateClosing` ([adventure.service.ts:161-169](../../../apps/api/src/adventure/adventure.service.ts)). Mas o comentário de `buildAdventureProfile` ([adventure.service.ts:92](../../../apps/api/src/adventure/adventure.service.ts)) e o comentário US-153 dentro de `generateAdventure` ([adventure.service.ts:219-220](../../../apps/api/src/adventure/adventure.service.ts)) já dizem: *"o gancho (`profile.hookSeed`) só ancora a abertura, não decide mais locais/NPCs/segredos/quest"*. A intenção documentada já é essa — o código é que ainda não chegou lá.

Uso real hoje, por chamada:

- **`generateLocationsAndNpcs`**: `hookSeed` só entra em `bondsInstruction` ([ai.service.ts:1290-1294](../../../apps/api/src/ai/ai.service.ts)) — rede de segurança que só ativa quando o personagem não tem `bonds` registrados no background. Consistente com "rede de segurança".
- **`generateSecrets`**: mesma rede de segurança condicional no `system` (`anchorInstruction`, [ai.service.ts:1356-1360](../../../apps/api/src/ai/ai.service.ts)) — **mas** `hookSeed` também entra incondicionalmente na primeira linha do `prompt`, via `buildSecretsPrompt` ([ai.service.ts:170-177](../../../apps/api/src/ai/ai.service.ts), `` `Gancho da aventura: ${hookSeed}` ``), **independente** de `background`/`origin` existirem. Isso contradiz a própria premissa de "rede de segurança": mesmo com bonds/background completos, `hookSeed` ainda aparece no prompt.
- **`generateClosing`**: `hookSeed` entra incondicionalmente na primeira linha de `buildClosingPrompt` ([ai.service.ts:200-212](../../../apps/api/src/ai/ai.service.ts)) — não é rede de segurança, é insumo direto e **deliberado**: decisão da US-164 Questão em aberto #2 (antagonista como cor narrativa no fecho, ancorado no gancho de classe).

### Por que a solução atual não basta

A US-172 resolveu o eixo `start`, mas reservou explicitamente (seu "Fora do escopo", item 2) a remoção de `hookSeed` dessas três chamadas para uma story separada, pra não inflar o próprio escopo. Ficou pendente. Enquanto isso não é resolvido, o motor de geração carrega uma dependência estrutural do catálogo fixo por classe (US-28, já aposentado como "a aventura" pela US-153) em pontos que, pela própria intenção já documentada no código, deveriam ser independentes dele.

### A proposta

As duas primeiras chamadas (`generateLocationsAndNpcs`, `generateSecrets`) usam `hookSeed` só como rede de segurança textual — dá pra substituir sem perda por uma instrução genérica de ancoragem, sem citar o gancho de classe. A terceira (`generateClosing`) é diferente: `hookSeed` ali é insumo deliberado para coerência do antagonista (US-164 #2), e removê-lo reabre aquela decisão de produto — não é corte de código morto. Esta story cobre as duas remoções seguras e trata a terceira como questão em aberto, não como decisão já tomada.

---

## Escopo

### Dentro do escopo

- `generateLocationsAndNpcs` ([ai.service.ts:1283-1328](../../../apps/api/src/ai/ai.service.ts)) para de receber `hookSeed` como parâmetro. `bondsInstruction` do caminho "sem bonds" deixa de citar o gancho — vira instrução genérica de ancoragem.
- `generateSecrets` ([ai.service.ts:1339-1380](../../../apps/api/src/ai/ai.service.ts)) para de receber `hookSeed` como parâmetro — remove tanto o `anchorInstruction` condicional no `system` quanto a linha incondicional em `buildSecretsPrompt`.
- `buildSecretsPrompt` ([ai.service.ts:170-181](../../../apps/api/src/ai/ai.service.ts)) perde o parâmetro `hookSeed`.
- `adventure.service.ts:139-153` — as duas chamadas dentro de `generateAdventure` param de passar `hookSeed: profile.hookSeed` a essas duas funções.
- Teste de regressão: fixture sem `bonds`/`background`/`origin` confirma que locais/NPCs/segredos gerados não citam nenhum elemento do `hookSeed` do fixture, e que a chamada não falha nem produz prompt vazio na ausência dele.

### Fora do escopo

- `generateClosing` e `buildClosingPrompt` — continuam recebendo `hookSeed` exatamente como hoje. Removê-lo dali é decisão de produto (US-164 #2: coerência do antagonista) tratada como story dedicada — ver [US-175](./US-175-generateclosing-perde-hookseed-antagonista-so-premissa.md) e Questões em aberto.
- `start` (`generateOpeningBeat`) — já é escopo da US-172, story irmã; intocado aqui.
- `profile.hookSeed` em si (`buildAdventureProfile`, US-148) — continua existindo, só muda quem o consome.
- Fallback estático (`openingText = generatedOpening ?? profile.hookSeed`) — intocado, comportamento correto da US-101.

---

## Critérios de aceite

- [ ] `generateLocationsAndNpcs` não recebe mais `hookSeed` nos parâmetros — verificação estrutural (assinatura da função), não só de prompt.
- [ ] `generateSecrets` não recebe mais `hookSeed` nos parâmetros, nem `buildSecretsPrompt`.
- [ ] `hookSeed` não aparece em nenhum `system`/`prompt` dessas duas chamadas — teste garante que a string de `hookSeed` do fixture não é passada a elas.
- [ ] Teste: personagem sem `bonds` e sem `background`/`origin` — locais/NPCs/segredos gerados não citam elemento específico do `hookSeed` do fixture, e a geração não falha nem produz instrução vazia na ausência dele.
- [ ] `generateClosing` continua recebendo `hookSeed` sem alteração — teste de não-regressão da assinatura.
- [ ] `pnpm typecheck` e `pnpm test` passam.
- [ ] `pnpm eval` passa (mudança em prompt do motor de geração — regra do projeto, AGENTS.md).

---

## Notas de implementação

- Pontos exatos a mudar: [adventure.service.ts:139-153](../../../apps/api/src/adventure/adventure.service.ts); [ai.service.ts:1283-1380](../../../apps/api/src/ai/ai.service.ts) (as duas funções + `buildSecretsPrompt`, linhas ~170-181).
- Texto exato da instrução genérica que substitui `bondsInstruction`/`anchorInstruction` sem citar `hookSeed` fica a critério da implementação — não é critério de aceite bloqueante.
- Cuidado ao remover de `generateSecrets`: o parâmetro `hookSeed` some da assinatura **e** do corpo de `buildSecretsPrompt`, não só da chamada de `generateAdventure`.

---

## Questões em aberto

1. ~~`generateClosing` deve parar de receber `hookSeed` também?~~ **Resolvida — sim, ver [US-175](./US-175-generateclosing-perde-hookseed-antagonista-so-premissa.md).** `premissa` já é documentada (comentário em `generateClosing`, [ai.service.ts:1388](../../../apps/api/src/ai/ai.service.ts)) como a fonte primária de cor pro antagonista — `hookSeed` era redundante com essa função, não essencial a ela. US-175 remove `hookSeed` de `generateClosing`/`buildClosingPrompt` como story dedicada, deixando a decisão de rastreabilidade da US-164 #2 intocada.
2. Instrução genérica de `bondsInstruction`/`anchorInstruction` sem citar `hookSeed` — texto exato fica pra implementação, não bloqueante.

---

## Referências no código

- [apps/api/src/adventure/adventure.service.ts:139-153](../../../apps/api/src/adventure/adventure.service.ts) — as duas chamadas dentro de `generateAdventure` que esta story altera.
- [apps/api/src/adventure/adventure.service.ts:88-94](../../../apps/api/src/adventure/adventure.service.ts) — comentário de `buildAdventureProfile`, fonte da intenção "`hookSeed` é rede de segurança".
- [apps/api/src/adventure/adventure.service.ts:219-220](../../../apps/api/src/adventure/adventure.service.ts) — comentário US-153, "gancho só ancora a abertura, não decide mais locais/NPCs/segredos/quest" — a intenção que esta story faz o código cumprir.
- [apps/api/src/ai/ai.service.ts:1283-1328](../../../apps/api/src/ai/ai.service.ts) — `generateLocationsAndNpcs`.
- [apps/api/src/ai/ai.service.ts:1339-1380](../../../apps/api/src/ai/ai.service.ts) — `generateSecrets`.
- [apps/api/src/ai/ai.service.ts:170-181](../../../apps/api/src/ai/ai.service.ts) — `buildSecretsPrompt`.
- [apps/api/src/ai/ai.service.ts:1392-1416](../../../apps/api/src/ai/ai.service.ts) — `generateClosing`, fora do escopo, ver Questões em aberto.
- [apps/api/src/ai/ai.service.ts:200-215](../../../apps/api/src/ai/ai.service.ts) — `buildClosingPrompt`, fora do escopo.
- [US-172](./US-172-abertura-gerada-nao-copia-gancho-fixo.md) — story irmã, fonte literal do item "Fora do escopo" que originou esta story.
- [US-164](./US-164-orquestrador-motor-monta-aventura-gerada.md) — decisão #2, o antagonista-via-`hookSeed` que a Questão em aberto #1 desta story reabre.
- [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) — comentário fonte da intenção "gancho só ancora a abertura".
- [US-148](./US-148-perfil-personagem-entrada-motor.md) — `buildAdventureProfile`, dono de `hookSeed`.
