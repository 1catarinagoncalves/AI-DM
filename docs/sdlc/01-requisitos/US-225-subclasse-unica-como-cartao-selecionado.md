# US-225 — Subclasse única aparece como cartão selecionado, não como texto solto

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) (`config.subclasses`, 1 entrada por classe SRD) · [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) (`CatalogCardGroup` e a subgrade de subclasse — esta story reusa o mesmo componente, não cria nenhum novo)
**Relacionado:** [ADR 009 §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) (fonte de subclasse fica **fechada** no SRD 5.1 por esta story — ver *Contexto*, decisão de 2026-09-08: sem segunda fonte confirmada, não se persegue segunda opção por classe) · [US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) (raiz de raça **sem** subespécie já aparece como cartão normal na grade — é o precedente visual direto que esta story aplica à subclasse) · [US-211](./US-211-ancestralidade-draconica-do-dragonborn.md) (mesmo protótipo de referência, mesma disciplina de não copiar o mockup sem confirmar a fonte)

**Criada em:** 2026-09-08

---

## História

> **Como** jogadora na etapa de Classe,
> **quero** ver a subclasse da minha classe como um cartão selecionado — do jeito que uma raça sem subespécie já aparece como cartão normal na grade de raça —,
> **para que** eu veja visualmente o que ganhei, em vez de ler um parágrafo solto no painel de detalhe que não lembra em nada o resto da tela.

---

## Contexto e motivação

### O problema observado

Hoje, para as 12 das 13 classes que têm **1 só** subclasse no catálogo ([US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md)), o wizard não renderiza cartão nenhum de subclasse — a subgrade só existe quando `subclassCatalog.length > 1` ([`SetupWizard.tsx:1049`](../../../apps/web/src/components/setup/SetupWizard.tsx:1049), regra da US-205). A subclasse resolvida automaticamente aparece só no painel de detalhe, como `SheetHeading` + parágrafo de texto ([`SetupWizard.tsx:1065-1071`](../../../apps/web/src/components/setup/SetupWizard.tsx:1065)) — sem borda de acento, sem selo de seleção, sem nenhuma das pistas visuais que toda outra escolha da tela (classe, raça, e a própria subclasse de `marshal`) já tem.

**Investigação encerrada, sem segunda fonte.** Uma primeira versão desta story cogitou trazer uma segunda subclasse por classe base, inspirada no protótipo de referência (`refined-wizard-glow.lovable.app`, mesmo já citado pela US-211), que mostra Bárbaro com duas trilhas ("Caminho do Berserker" e "Caminho do Guerreiro Totêmico"). Checado em 2026-09-08 contra o ADR 009 §8: o SRD 5.2 (única fonte plausível para um segundo arquétipo de classe base) está **fora de escopo** por decisão de produto já registrada, e nenhum dos documentos `a5e-ag`/`a5e-ddg`/`a5e-gpg`/*Spells That Don't Suck* já em escopo tem subclasse de classe base do SRD — só `marshal`. **Decisão:** não reabrir o ADR por esta story. A subclasse fica com a única entrada que o catálogo já tem; o que muda é só como essa entrada única é **mostrada**.

### Por que a solução atual não basta

Um parágrafo de texto no meio de uma tela inteira desenhada em cartões (classe, raça, subclasse de `marshal`, subespécie de raça) é uma quebra de linguagem visual — a jogadora que acabou de escolher a classe num cartão com borda de acento vê a subclasse, a coisa mais parecida com "mais uma escolha" da tela, virar prosa solta. `CatalogCardGroup` já resolve exatamente essa anatomia (`kicker`/rótulo/`blurb`/borda de acento) para toda outra opção do wizard, inclusive quando não há de fato uma escolha a fazer: raça-raiz **sem** subespécie ([US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md)) é um cartão normal na grade de raça — visualmente idêntico a uma raça com subespécie, só que sozinho, sem irmãos pra formar um subgrupo. É esse precedente que a subclasse única deveria seguir e hoje não segue.

### A proposta

Quando `subclassCatalog.length === 1`, renderizar essa entrada única com o mesmo componente de cartão que a subgrade já usa (`CatalogCardGroup`, ou uma variante somente-leitura dele), marcada como selecionada, no lugar do bloco de texto atual — sem interação nenhuma além de exibir, porque não há segunda opção pra trocar. Quando `subclassCatalog.length > 1` (`marshal`, hoje), nada muda: a subgrade continua interativa, exatamente como a US-205 já entrega.

---

## Escopo

### Dentro do escopo

- **`SetupWizard.tsx`, bloco do painel de detalhe da etapa `class`** ([:1065-1071](../../../apps/web/src/components/setup/SetupWizard.tsx:1065)): quando `subclassCatalog?.length === 1`, troca o `SheetHeading` + `<p>` atual por `CatalogCardGroup` (ou o cartão individual que ele já renderiza por item, extraído se necessário) com `items={subclassCatalog}` e `value={resolvedSubclass}` fixo — sem `onChange` funcional, porque a única entrada já é a escolhida e não há alternativa pra selecionar.
- **`marshal` (única classe com `subclassCatalog.length === 3`): escolha real entre as 3 subclasses** (`Gambling General`/`Swift Strategist`/`Talented Tactician`) — a subgrade da US-205 já entrega isso hoje (`CatalogCardGroup` com as 3 cartas, `onChange={setSubclass}`, `SetupWizard.tsx:1049-1051`); esta story preserva esse comportamento tal como está, sem regressão, e o critério de aceite abaixo verifica explicitamente as 3 opções — não só "continua igual".
- **`subclassCatalog` ausente ou vazio** (sistema sem catálogo, ex. `Free`): comportamento inalterado — sem bloco de subclasse nenhum, mesmo fallback de hoje.
- **Acessibilidade do cartão somente-leitura:** sem `role="radio"`/`<input>` funcional quando não há escolha — o cartão comunica estado (selecionado), não convida a interação que não existe. Evitar tornar focável algo que não faz nada ao ativar.

### Fora do escopo

- **Segunda subclasse por classe base.** Investigada e fechada nesta própria story (ver *Contexto*) — sem fonte confirmada em escopo, não é perseguida. Reabrir o ADR 009 §8 para trazer o SRD 5.2 (ou outro documento) só para este domínio é decisão de produto separada, não desta story.
- **Mecânica de subclasse.** Mesmo corte já aplicado por US-141/US-205.
- **Mudança na subgrade de `marshal`.** Já funciona, já é interativa, não é tocada.
- **Novo componente de cartão.** Reuso de `CatalogCardGroup`/`CatalogCardEntry` já existentes (US-205); se a forma somente-leitura exigir uma prop nova (ex. `readOnly`/`interactive={false}`), é extensão pontual do componente existente, não um componente novo.

---

## Critérios de aceite

- [ ] Classe com exatamente 1 subclasse no catálogo mostra, no painel de detalhe da etapa `class`, um cartão com a mesma anatomia visual da subgrade (`kicker`/rótulo/`blurb`/borda de acento, marcado como selecionado) no lugar do bloco de texto atual.
- [ ] Esse cartão não é clicável/desselecionável — não existe segunda opção pra trocar, e a tela não sugere que existe.
- [ ] `marshal` mostra as **3** subclasses como cartões clicáveis (`General Apostador`/`Estrategista Ágil`/`Tático Talentoso`), a jogadora escolhe **uma** delas, e `canAdvance('class')` bloqueia o avanço até a escolha ser feita — mesmo comportamento da US-205, verificado explicitamente por esta story (não presumido por "nada mudou").
- [ ] Sistema sem `config.subclasses` (`Free`) continua sem bloco de subclasse nenhum, mesmo fallback de hoje.
- [ ] `Character.subclass` continua sendo gravado exatamente como a US-205 já grava — nenhuma mudança de payload, schema ou validação; esta story é só de apresentação.
- [ ] **Eval / teste de regressão:** `SetupWizard.test.tsx` cobre uma classe SRD comum (ex. `fighter`) e afirma que o painel de detalhe renderiza o cartão de subclasse (não mais o parágrafo antigo); e cobre `marshal` selecionando cada uma das 3 subclasses pelo cartão, afirmando que `canAdvance('class')` só libera depois da escolha e que `createCharacter` recebe a chave certa (`gambling-general`/`swift-strategist`/`talented-tactician`) conforme o cartão clicado.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **`CatalogCardGroup` pode já aceitar `items` de tamanho 1 sem mudança nenhuma** — vale testar primeiro se só passar `items={subclassCatalog}` (um item) já produz o visual certo antes de criar variante somente-leitura; o `onChange` pode virar um no-op (`() => {}`) sem quebrar nada, já que não há segundo valor possível.
- **Não confundir com a subgrade de `marshal`.** São dois blocos condicionais diferentes (`=== 1` vs `> 1`), não um `if/else` que reusa a mesma variável de estado — `subclass` (estado local) só existe de verdade para `marshal`; para as outras 12, `resolvedSubclass` já vem de `subclassCatalog[0].key` (ver `SetupWizard.tsx:404`), sem depender de interação.
- **Decisão de fonte fechada, não reabrir em code review.** Se a implementação tropeçar de novo na tentação de "só mais uma subclasse resolveria isso direito", o `ADR 009 §8` já foi checado (ver *Contexto*) — sem fonte nova confirmada, a resposta continua sendo cartão único.

---

## Referências no código

- [apps/web/src/components/setup/SetupWizard.tsx:1049-1071](../../../apps/web/src/components/setup/SetupWizard.tsx:1049) — subgrade (`> 1`) e bloco de texto da subclasse resolvida (`=== 1`), os dois pontos que esta story toca.
- [apps/web/src/components/setup/SetupWizard.tsx:400-405](../../../apps/web/src/components/setup/SetupWizard.tsx:400) — `subclassCatalog`/`resolvedSubclass`, já calculados, sem mudança.
- [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) — `CatalogCardGroup`, componente reusado sem alteração de contrato (ou com extensão pontual somente-leitura).
- [docs/adr/009-uniao-dos-srd-5-1-e-5-2.md §8](../../adr/009-uniao-dos-srd-5-1-e-5-2.md) — limite de fonte checado e mantido fechado por esta story.
- [`refined-wizard-glow.lovable.app`](https://refined-wizard-glow.lovable.app/) — protótipo de referência (etapa Classe, Bárbaro) que motivou a investigação de segunda fonte, encerrada sem achado.
