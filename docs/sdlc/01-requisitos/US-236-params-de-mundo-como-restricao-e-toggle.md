# US-236 — Params de mundo como restrição no prompt + toggle pronta×criar

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Proposta
**Depende de:** [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) (o prompt de autoria que recebe a restrição) · [US-156](./US-156-catalogos-registro-dto-validacao.md) (catálogos `settings`/`tones`/`areaTypes`, chave+rótulo) · [US-157](./US-157-tela-de-mundo-depois-da-revisao.md) (tela "O Mundo da Aventura", os quatro knobs)
**Relacionado:** [US-216](./US-216-escolher-aventura-pronta-ou-criar-propria-historia.md)/[US-217](./US-217-aventura-pronta-sem-motor-de-geracao.md) (toggle pronta×criar) · [US-161](./US-161-jogador-escolhe-nivel-de-desafio-do-encontro.md)/[US-165](./US-165-tela-escolhe-nivel-de-desafio.md) (desafio → orçamento, não autoria) · [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) (chave canônica + rótulo por locale) · [Backlog — MA-6](./backlog-motor-de-geracao-de-aventuras.md)
**Criada em:** 2026-09-13

---

## História

> **Como** jogador,
> **quero** que minhas escolhas de cenário/tom/área **restrinjam** o mundo que o modelo inventa (em vez de indexar uma tabela), e um botão claro entre "Aventura pronta" e "Criar minha história" —
> **para que** eu dirija o gênero sem perder a autoria, e escolha se quero o motor ou o gancho fixo.

---

## Contexto e motivação

Sob a montagem-por-tabela, os quatro knobs da tela "O Mundo da Aventura" (US-157) **indexavam rolagens**. Sob a inversão (ADR 012 D5), eles **restringem o que o modelo autora**. Muda também a semântica de "Aleatório": na US-156 original, ausência = seed sorteava; com o `seed` morto (ADR 012 D1), ausência = **o modelo escolhe** (rédea livre nesse eixo). E o toggle "Aventura pronta × Criar minha história" (US-216/217) decide se o motor roda.

---

## Escopo

### Dentro do escopo

- **Knob vira restrição no prompt (US-232), não índice de tabela.** Mapeamento:
  - **Cenário** (`setting`) → linha "Cenário: <rótulo>" — o modelo inventa um mundo autoral **dentro** do gênero.
  - **Tom** (`tone`) → "Tom: <rótulo>", governa o registro emocional.
  - **Tipo de Área** (`areaType`) → "Área predominante: <rótulo>", ancora a geografia.
- **Rótulo pt-BR (ou descrição), nunca a chave.** O artefato grava a chave (`grimdark`) pra eval/filtro; o prompt recebe o rótulo (resolução via catálogo `SystemCatalogEntry`, US-156/US-105).
- **"Aleatório" = campo OMITIDO do prompt** = modelo livre nesse eixo (muda a semântica da US-156: não é mais seed sorteando).
- **Toggle pronta×criar (US-216/217) roteia:** "Aventura pronta" = gancho de classe fixo (US-217), **não roda o motor**; "Criar minha história" = motor mundo-primeiro (US-232) com os três knobs.
- **Desafio (US-161/165) NÃO entra na autoria** — alimenta o orçamento do encontro (MA-3/US-233): `adventure` = `encounterDeadlyThreshold`, `challenge` = `singleMonsterCrCap`. Eixo de dificuldade, não de mundo.

### Fora do escopo

- **O prompt de autoria em si** — US-232 (esta story só decide o que entra nele e como).
- **O orçamento do encontro** — US-233/MA-3 (esta story só roteia o desafio pra lá).
- **A orquestração assíncrona / telas** — MA-5 (US-235).
- **A "Aventura pronta"** (gancho de classe) — US-217 (existe); aqui só o roteamento até ela.

---

## Critérios de aceite

- [ ] Cada knob escolhido entra no prompt de autoria como **linha de restrição** com o **rótulo pt-BR** (nunca a chave); a chave segue gravada no artefato pra eval/filtro.
- [ ] Knob em "Aleatório" ⇒ o eixo é **omitido** do prompt (modelo livre) — não há sorteio determinístico.
- [ ] Toggle "Aventura pronta" ⇒ roteia pro gancho de classe (US-217), motor **não** roda; "Criar minha história" ⇒ roteia pro motor (US-232) com os knobs.
- [ ] Desafio (US-161/165) vai pro orçamento do encontro (MA-3), **não** pro prompt de autoria.
- [ ] **Eval / teste:** teste cobrindo (a) rótulo pt-BR chega ao prompt e chave ao artefato; (b) eixo "Aleatório" some do prompt; (c) toggle roteia pros dois caminhos; (d) desafio não aparece no prompt de autoria.

---

## Notas de implementação

- Reusar a resolução chave→rótulo por locale que `races`/`classes` já fazem (US-105/US-156) — não inventar uma segunda.
- A tela em si (US-157) já coleta os knobs; esta story muda **para onde** os valores vão (prompt em vez de tabela) e a semântica de "Aleatório".
- O toggle (US-216) já existe como escolha; esta story garante que o ramo "criar" chama o motor.

---

## Questões em aberto

Nenhuma bloqueante — herdadas do backlog: quantas facções/NPCs/segredos pedir são dials do prompt (US-232, *Questões em aberto*), não desta story.

---

## Referências no código

- [US-156](./US-156-catalogos-registro-dto-validacao.md)/[US-157](./US-157-tela-de-mundo-depois-da-revisao.md) — catálogos e tela dos knobs.
- [US-232](./US-232-schema-cresce-e-prompt-de-autoria-call-unico.md) — o prompt que recebe a restrição.
- [US-216](./US-216-escolher-aventura-pronta-ou-criar-propria-historia.md)/[US-217](./US-217-aventura-pronta-sem-motor-de-geracao.md) — toggle e caminho pronto.
- [Backlog — MA-6](./backlog-motor-de-geracao-de-aventuras.md).
