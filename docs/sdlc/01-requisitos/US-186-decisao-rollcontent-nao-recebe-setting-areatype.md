# US-186 — Decisão: `rollContent`/tabelas LGMRD NÃO recebem `setting`/`areaType`

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** Nenhuma. **Relacionado:** [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md)/[US-185](./US-185-mestre-recebe-setting-areatype-em-todo-turno.md) (mesma investigação — "onde mais o registry precisa chegar" — os dois endereçam a camada de PROSA; esta story fecha a pergunta simétrica sobre a camada de ROLAGEM) · [US-145](./US-145-sync-lgmrd-notice.md) (pipeline de sync do LGMRD, "não há parser" — mesma razão pela qual esta story não propõe re-taggear tabela) · [US-147](./US-147-rolagem-registro-conteudo.md) (`rollContent`, a função investigada)
**Criada em:** 2026-08-21 — segunda metade da mesma investigação que gerou a US-187/US-185 ("onde mais o `registry` precisa chegar pra a aventura fazer sentido tematicamente"). Levantada como candidata a story, e **decidida durante a própria escrita desta story**, não depois.

---

## História

> **Como** jogadora,
> **quero** saber se o conteúdo bruto rolado (premissa, local, monumento, complicação) já poderia nascer coerente com o `setting`/`areaType` que escolhi, em vez de a coerência depender só da camada de prosa reinterpretar o que veio genérico —,
> **para que** a aventura tematicamente faça sentido o mais cedo possível na cadeia de geração, não só no fim.

---

## Contexto e motivação

### O que existe hoje

`rollContent` ([roll-content.ts](../../../apps/api/src/adventure-generation/roll-content.ts)) rola 4 tabelas do LGMRD por seed determinístico (`tableSeed`, US-146) — `1d20quests` (premissa), `locationsmonumentsanditems` (local+monumento), `conditiondescriptionandorigin` (complicação), `patronsandnpcs` (comportamento+ancestralidade dos NPCs) — sem `registry` como parâmetro, sem filtrar linha nenhuma por `setting`/`areaType`.

### O problema (motivador original)

`setting`/`areaType` só chegam à PROSA (`generateLocationsAndNpcs`, US-187) — a rolagem bruta que alimenta essa prosa é cega ao registro. Cabia perguntar: a coerência temática ficaria mais forte se a própria rolagem já respeitasse o eixo, em vez de a prosa carregar sozinha o trabalho de reinterpretar "Tower"/"Sarcophagus" como o que o `areaType` pedir?

### Investigação (21/08/2026)

Dump de `scripts/lazygm/lgmrd-tables.json` (o derivado committed que `rollContent` lê em runtime):

| Tabela | Colunas reais | Exemplo de linha |
|---|---|---|
| `1d20quests` | `item_num`, `item` | `"Find an item"` |
| `locationsmonumentsanditems` | `d20`, `location`, `monument`, `item` | `"Tower"` / `"Sarcophagus"` / `"Coin"` |
| `conditiondescriptionandorigin` | `d20`, `condition`, `description`, `origin` | `"Smoky"` / `"Ruined"` / `"Human"` |
| `patronsandnpcs` | `d20`, `behavior`, `ancestry` | `"Enthusiastic"` / `"Human"` |

**Nenhuma das 4 tabelas tem coluna de bioma, ambiente ou tipo de área.** `location`/`monument` são substantivos genéricos de propósito ("Tower", "Sarcophagus", "Cage") — o próprio LGMRD (fonte upstream, CC-BY, US-145) os desenhou assim: qualquer um serve pra qualquer cenário na mesa, porque é o MESTRE (humano, no material original; o modelo, aqui) quem veste a linha rolada da roupa que a aventura pedir. `condition`/`origin` (`"Smoky"`/`"Human"`) são textura/clima, não geografia — também não carregam o eixo.

### Por que filtrar não funcionaria mesmo se fosse tentado

- **Cada tabela tem só 20 linhas** (ou 10, nos 40 prompts de segredo). Filtrar por `areaType` reduziria o pool de rolagem por sorteio — menos variedade, ou sorteio degenerado quando um `areaType` tivesse poucas linhas "compatíveis" (que nem existem, ver acima).
- **Re-taggear as 20 linhas à mão** (decidir que "Tower" combina com `dungeon` mas não com `coastal`, por exemplo) é trabalho de CURADORIA DE CONTEÚDO, não engenharia — e o pipeline da US-145 declara explicitamente **"não há parser"**: o sync é só download+NOTICE, nunca edição do dado upstream. Inventar uma camada de tags que o LGMRD não publica quebraria essa garantia (o dado deixaria de ser fiel à fonte CC-BY).
- **O próprio design de três camadas do backlog** (`backlog-motor-de-geracao-de-aventuras.md`, `§O desenho: três camadas`) já separa isso por construção: **camada 1 (determinístico) rola conteúdo genérico; camada 2 (modelo) veste de prosa coerente.** Forçar tema na camada 1 duplicaria uma responsabilidade que a camada 2 já tem, e faria pior (sem os ~1000 tokens de raciocínio que o modelo tem pra decidir "Tower" vira o quê nesta aventura específica).

### A decisão

`rollContent`/`rollAdventure` **continuam sem `registry` como parâmetro.** Coerência temática nasce inteiramente na camada de prosa — `generateLocationsAndNpcs` (US-187, já soma `setting`/`areaType` ao `system`) reinterpreta a linha crua ("Tower"/"Sarcophagus") como o que o registro pedir; o mesmo vale, se algum dia pedido, pros outros três consumidores de `registry.tone` (`generateSecrets`/`generateClosing`/`generateOpeningBeat`, ver *Fora do escopo* da US-187, questão em aberto #3). Não há ganho estrutural em filtrar/re-taggear a tabela — o custo (curadoria manual, sorteio degenerado, quebra do "não há parser") supera o benefício (a prosa já resolve isso, e resolve melhor).

---

## Escopo

### Dentro do escopo

- **Nenhuma mudança de código.** Esta story é o registro da investigação e da decisão — fecha a pergunta pra não ser reaberta sem evidência nova (ex.: se o LGMRD publicar uma versão com tags de bioma no futuro, `sync` da US-145 traria o dado, e aí sim haveria o que filtrar).
- Opcional, barato: comentário de uma linha no topo de [roll-content.ts](../../../apps/api/src/adventure-generation/roll-content.ts) apontando pra esta story, pra quem vier depois perguntar "por que `rollContent` não recebe `registry`?" achar a resposta sem reabrir a investigação.

### Fora do escopo

- **Re-taggear as tabelas do LGMRD à mão** com um eixo de área/bioma que a fonte não publica. Quebraria o "não há parser" da US-145 e a fidelidade ao dado upstream (CC-BY).
- **Propor upstream ao LGMRD** que as tabelas ganhem esse eixo. Fora do controle do projeto, e o motor não depende disso pra funcionar (a camada de prosa já resolve).
- **Mudar `generateLocationsAndNpcs`/demais consumidores de prosa.** Já é o escopo da US-187 (locais) e das questões em aberto que ela deixou pros outros três.
- **Revisitar esta decisão sem evidência nova.** Se o eval mostrar que a prosa não está conseguindo "vestir" a linha crua de forma coerente com o `areaType`, o remédio é ajustar o PROMPT da camada 2 (US-187/US-185), não reabrir esta.

---

## Critérios de aceite

- [x] Investigação concluída: estrutura real das 4 tabelas do LGMRD dumpada e documentada (ver tabela acima).
- [x] Decisão registrada: `rollContent`/`rollAdventure` não ganham `registry` como parâmetro; motivo e alternativa (camada de prosa) documentados.
- [ ] *(Opcional, se aplicado)* Comentário em `roll-content.ts` referenciando esta story.

---

## Notas de implementação

Não aplicável — esta story não altera comportamento. Se o comentário opcional (ver *Dentro do escopo*) for somado, é uma linha, sem teste associado (não é lógica, é documentação inline).

---

## Questões em aberto

1. **Se o LGMRD publicar uma versão com eixo de bioma/área no futuro**, isso reabre a possibilidade — mas é evento externo (mudança na fonte upstream), não uma ação deste projeto. Registrado só pra não ser esquecido se acontecer.

---

## Referências no código

- [`apps/api/src/adventure-generation/roll-content.ts`](../../../apps/api/src/adventure-generation/roll-content.ts) — `rollContent`, função investigada; candidato ao comentário opcional.
- [`apps/api/src/adventure-generation/lgmrd-tables.ts`](../../../apps/api/src/adventure-generation/lgmrd-tables.ts) — `readLgmrdTables`, `LgmrdTableRow` (schema genérico `{[column]: string | number}` — confirma que não há coluna reservada de área/bioma em lugar nenhum do tipo).
- [`scripts/lazygm/lgmrd-tables.json`](../../../scripts/lazygm/lgmrd-tables.json) — o artefato committed dumpado nesta investigação; fonte da tabela em *Investigação*.
- [`docs/sdlc/01-requisitos/backlog-motor-de-geracao-de-aventuras.md`](./backlog-motor-de-geracao-de-aventuras.md), seção *O desenho: três camadas* — a separação determinístico/modelo que esta decisão reafirma.
- [US-145](./US-145-sync-lgmrd-notice.md) — "não há parser", a garantia que esta decisão preserva.
- [US-187](./US-187-distribuicao-tematica-de-locationid-baseada-em-registry.md) — onde a coerência temática de fato é resolvida, na camada de prosa.
- [US-185](./US-185-mestre-recebe-setting-areatype-em-todo-turno.md) — mesma investigação, achado irmão (narração de turno).
