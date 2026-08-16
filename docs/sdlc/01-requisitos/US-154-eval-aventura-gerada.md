# US-154 — Eval da aventura gerada

**Épico:** 5 — Qualidade e avaliação do DM Agent
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-151](./US-151-semear-ledger-segredos-gerados.md) (ledger semeado do artefato) · [US-153](./US-153-aventura-deixa-de-ser-derivada-da-classe.md) (motor já é o caminho de criação de aventura)
**Relacionado:** [Backlog — Motor de geração de aventuras one-shot](./backlog-motor-de-geracao-de-aventuras.md) (US-154) · [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (resolve rótulos `GEN-N` do backlog para número de story) · [US-49](./US-49-eval-fidelidade-de-regra.md) (molde de caso de fidelidade) · [US-36](./US-36-eval-de-qualidade-da-narracao.md) (rubrica de qualidade narrativa reusada)
**Criada em:** 2026-08-15

---

## História

> **Como** mantenedora,
> **quero** um caso de eval que, contra um seed pinado, verifique se o Mestre respeita os segredos e NPCs que o motor gerou — sem revelar segredo antes da hora, sem inventar NPC quando já existem ~7 gerados —,
> **para que** a qualidade da aventura gerada tenha um piso medido, não só a impressão de quem jogou uma vez.

---

## Contexto e motivação

### O problema observado

Com a inversão de ordem do backlog, **não há mais aventura escrita à mão como âncora de eval** — o plano original mediria a saída gerada contra *O Lamento* (backlog irmão), mas ele foi adiado para a fase 4. Sem esta story, a única medida de qualidade do motor seria o playtest manual do gate ([US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)) — humano, não repetível em CI, e que não escala a cada mudança no prompt de segredos ([US-149](./US-149-segredos-40-prompts-lgmrd.md)).

### Por que a solução atual não basta

A [US-49](./US-49-eval-fidelidade-de-regra.md) e a [US-36](./US-36-eval-de-qualidade-da-narracao.md) já dão o molde de caso de eval e a rubrica de qualidade narrativa — mas nenhuma delas mede especificamente "o Mestre respeitou o que o motor gerou". O que se perde com o adiamento do arco autoral: a eval fica **sem exemplar solo em pt-BR**, e isso é permanente (registrado pelo backlog como custo sem remédio grátis) — os dois exemplares do LGMRD (`36-villageofwhitesparrow.md`, `37-thenightblade.md`, CC-BY, já baixados pela [US-145](./US-145-sync-lgmrd-notice.md)) medem estrutura e densidade, mas são em inglês e escritos para grupo — não medem se a aventura funciona para um personagem só, nem se a prosa em pt-BR presta.

### A proposta

Um caso de fidelidade no molde da US-49, com a rubrica da US-36, contra um seed pinado: verifica que o Mestre não revela segredo com `revelado: false` antes da ficção merecer, nem inventa NPC quando há ~7 já gerados. Referência de densidade: os dois exemplares do LGMRD, de forma permanente (não provisória, dado o adiamento da fase 4). O que eles não medem — solo, pt-BR — fica com o seed jogado à mão ([US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)) e a rubrica da US-36.

---

## Escopo

### Dentro do escopo

- **Caso de eval determinístico** (`evals/cases/us-154-eval-aventura-gerada.ts` ou nome equivalente, no molde de `evals/cases/us-110-tabela-de-testes.ts` citado pela US-111) — roda o motor com **seed pinado**, gera uma `GeneratedAdventure` fixa, e verifica dois assertos ancorados no **artefato** (nunca na impressão de quem leu a narração):
  - **Nenhum segredo com `revelado: false` é revelado** na narração/opções de uma sequência de turnos fixture, até a ficção "merecer" (critério operacional: dentro do trecho medido, o segredo continua oculto).
  - **Nenhum NPC inventado** quando há ~7 já gerados — a narração referencia só NPCs presentes no artefato.
- **Referência de densidade:** os dois exemplares do LGMRD (`36-villageofwhitesparrow.md`, `37-thenightblade.md`) como comparação de estrutura/contagem de seções — não como gabarito de conteúdo (idiomas e público diferentes).
- **Reusa a rubrica da [US-36](./US-36-eval-de-qualidade-da-narracao.md)** para a dimensão de qualidade de prosa em pt-BR, sem duplicar dimensões já existentes.

### Fora do escopo

- **Substituir o playtest manual do gate** ([US-150](./US-150-gate-antes-de-persistir-aventura-gerada.md)) — esta eval mede assertos automatizáveis (segredo oculto, NPC não inventado); não mede se a aventura tem quebra-cabeça ou é sopa de pista genérica (isso é humano, ver *O que o motor não produz* no backlog).
- **Medir se a aventura funciona para um personagem só, ou se a prosa em pt-BR presta** — explicitamente **não** coberto pelos exemplares do LGMRD (inglês, grupo); fica com o seed jogado à mão e a rubrica da US-36, não com um assert automatizado novo.
- **Um exemplar solo em pt-BR próprio.** Custo permanente registrado pelo backlog, sem remédio nesta story.

---

## Modelo de dados proposto

> Sem schema novo — usa `GeneratedAdventure` (US-144) e o formato de caso de eval já existente no repo.

**Persistência:** nenhuma — caso de eval roda sob demanda (`pnpm eval`), sem gravar resultado além do relatório padrão da suite.

---

## Critérios de aceite

- [ ] O caso de eval roda o motor com um **seed pinado** fixo, produzindo `GeneratedAdventure` determinística (dependência direta de [US-146](./US-146-seed-deterministico-motor-aventura.md)).
- [ ] Assert de segredo oculto: contra uma fixture de turnos jogados, a narração do Mestre não revela o texto/nome de nenhum `secret` com `revelado: false` no ledger, ancorado no `secretId` (mesmo padrão de "não na impressão de quem leu", disciplina da US-77).
- [ ] Assert de NPC não inventado: a narração não introduz NPC nomeado ausente do artefato gerado, quando ~7 NPCs já existem.
- [ ] Os dois exemplares do LGMRD entram como referência de densidade/estrutura (contagem de seções comparável), documentada no caso de eval — não como assert de conteúdo textual.
- [ ] O caso está integrado a `pnpm eval` e passa (ou falha de forma diagnosticável, com o `secretId`/NPC ofensor no output).
- [ ] **Eval / teste de regressão:** o próprio caso É o teste de regressão desta story — falha se um prompt futuro (mudança em [US-149](./US-149-segredos-40-prompts-lgmrd.md)) fizer o Mestre vazar um segredo oculto ou inventar NPC.

---

## Notas de implementação

- **Ancorar assert no artefato, não na impressão de quem leu** — mesma disciplina de re-ancoragem que a [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md) já estabeleceu para outros casos de eval: o assert testa `secretId`/`npc.id` continuando ausente/presente no texto, não uma leitura subjetiva de "pareceu bom".
- **Molde de caso determinístico:** `evals/cases/us-110-tabela-de-testes.ts` (citado pela US-111) e o padrão geral de `evals/cases/us-49-*` são os exemplares mais próximos no repo — copiar a estrutura de setup/assert, trocar o conteúdo.
- **Os exemplares do LGMRD já estão no repo** desde a US-145 (`scripts/lazygm/_data/`, gitignored) — este caso de eval é o primeiro consumidor deles fora do motor em si.

---

## Questões em aberto

1. Como o caso de eval "joga" a sequência de turnos fixture para testar se um segredo vaza? Precisa de um harness que simule N turnos contra o Mestre real (custo de chamadas de modelo) ou pode ser um teste mais estático (verificar que o prompt monta o bloco de entidades corretamente, sem rodar o modelo)? A US-70 já registra a lacuna geral de "eval vivo de obediência do modelo exige inspecionar trajetória de tool calling" — esta story herda a mesma limitação, a decidir com o [US-94](./US-94-eval-vivo-noturno-com-chaves.md) se precisar de execução real.

---

## Referências no código

- [US-49](./US-49-eval-fidelidade-de-regra.md) — molde de caso de fidelidade.
- [US-36](./US-36-eval-de-qualidade-da-narracao.md) — rubrica de qualidade narrativa reusada.
- [US-77](./US-77-reancorar-assertivas-de-prompt-e-guard-de-regressao.md) — disciplina de ancorar assert no dado, não na impressão.
- [US-145](./US-145-sync-lgmrd-notice.md) — os dois exemplares do LGMRD, referência de densidade.
- [Backlog — Motor de geração de aventuras one-shot §GEN-11](./backlog-motor-de-geracao-de-aventuras.md) (US-154) — texto de origem.
