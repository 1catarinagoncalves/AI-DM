# US-223 — Proficiência de arma legível na revisão (categoria no valor, não no rótulo)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-221](./US-221-proficiencias-de-arma-armadura-e-ferramenta-por-classe.md) (introduziu a exibição de arma/armadura/ferramenta de classe na revisão e na ficha — é o código que esta story corrige; `reviewWeaponCategories`/`reviewWeapons`/`weaponCategories`, `WEAPON_CATEGORY_LABEL`/`ARMOR_CATEGORY_LABEL`) · [US-127](./US-127-revisao-espelha-ficha-completa.md) (revisão espelha a ficha — a razão de esta story **precisar** tocar `GameView.tsx` junto: corrigir só a revisão faria as duas telas divergirem no mesmo dado)
**Relacionado:** [US-215](./US-215-proficiencias-de-arma-e-ferramenta-fixa-de-raca.md) (padrão de seção FLAT `SheetHeading` + `<ul>` só-rótulo que a ficha reusa) · [US-208](./US-208-revisao-em-forma-de-ficha.md) (a `<dl>` `<dt>/<dd>` da revisão que esta story ajusta) · [US-46](./US-46-acessibilidade-wcag-aa.md) (o `<dt>` de uma `<dl>` é o **nome** do campo; um `<dt>` que muda de texto por personagem é o que esta story elimina)
**Criada em:** 2026-09-08

---

## História

> **Como** jogadora revisando minha ficha antes de confirmar,
> **quero** ver em quais armas sou proficiente como um **valor** ao lado do rótulo "Proficiências de arma",
> **para que** eu leia a informação onde o olho procura — e não um traço (`—`) na coluna de valor enquanto a informação de verdade fica escondida no rótulo.

---

## Contexto e motivação

### O que a US-221 entregou — e o artefato que ela deixou

A US-221 exibe a proficiência de arma de classe assim: as **categorias** (`Simples`/`Marcial`) viram **sufixo do rótulo**, e só as armas **nomeadas** entram no valor. Na revisão ([SetupWizard.tsx:1701-1712](../../../apps/web/src/components/setup/SetupWizard.tsx:1701)):

```tsx
<dt>{reviewWeaponCategories.length > 0
      ? `${t('setup.review.weapons')} — ${…categorias…}`   // rótulo cresce com a categoria
      : t('setup.review.weapons')}</dt>
<dd>{reviewWeapons.length > 0 ? reviewWeapons.join(' · ') : '—'}</dd>  // valor = nomeadas, ou "—"
```

`setup.review.weapons` é literalmente **"Proficiências de arma"** ([pt-BR.ts:289](../../../apps/web/src/messages/pt-BR.ts:289)). Então, para as **7 classes que só têm categoria** e nenhuma arma nomeada (bárbaro, clérigo, guerreiro, paladino, patrulheiro, bruxo, marshal), a linha da revisão renderiza:

> **Proficiências de arma — Simples, Marcial**  …  **—**

Ou seja: um personagem proficiente em **todas** as armas simples e marciais lê, na coluna de valor, **"—" (nada)**. A informação real ("Simples, Marcial") está grudada no *nome do campo*, não no valor. É a coluna errada — a que a jogadora menos escaneia — carregando o conteúdo, enquanto a coluna de conteúdo sinaliza vazio.

### Três defeitos concretos

1. **O valor mente para 7 de 13 classes.** `<dd>` = `—` para toda classe sem arma nomeada, apesar de a classe conceder proficiência de categoria inteira. Contradiz o próprio dado que a US-221 modelou.
2. **O `<dt>` muda de texto por personagem.** Numa `<dl>`, o `<dt>` é o *nome* do campo — deveria ser estável ("Proficiências de arma" para todo mundo). Hoje é "Proficiências de arma" para o mago, "Proficiências de arma — Simples" para o bardo, "Proficiências de arma — Simples, Marcial" para o guerreiro. A coluna esquerda deixa de alinhar num rótulo fixo (escaneabilidade) e o leitor de tela anuncia um termo mutante (US-46: `<dt>` é rótulo, não valor).
3. **Categoria e arma nomeada ficam separadas por uma regra invisível.** No bardo, `<dt>` "…— Simples" e `<dd>` "Besta de mão · Espada longa · Rapieira · Espada curta". Quem lê não tem como saber que "Simples" é um **grupo** e "Rapieira" é um **item** — a distinção mora só em qual lado do travessão cada um caiu.

### A linha logo abaixo já faz certo — na MESMA story

A US-221 também criou a linha de **armadura** ([SetupWizard.tsx:1715-1722](../../../apps/web/src/components/setup/SetupWizard.tsx:1715)) e ali as categorias vão no **valor**, corretamente:

> **Proficiências de armadura**  …  **Leve · Média · Escudos**

`<dt>` estável, categorias no `<dd>`, sem travessão no rótulo, sem "—". Duas linhas irmãs, tratamento oposto — arma é a exceção errada, armadura é a referência certa.

### Por que a US-221 hoisteou a categoria pro rótulo — e por que isso não era necessário

A US-221 argumentou que **misturar categoria e nome de arma na mesma lista confunde** ("não dá pra saber se 'Marcial' é um item ou um grupo") e por isso tirou a categoria da lista. Mas a ambiguidade vinha do **rótulo cru e curto** ("Simples"/"Marcial"), não do fato de listar a categoria junto: a seção de **armadura** lista "Leve"/"Média"/"Escudos" como itens e ninguém confunde — porque armadura **nunca** mistura categoria com item nomeado. Arma é a única seção que mistura os dois.

A saída barata: **rotular a categoria com a frase inteira** — "Armas simples"/"Armas marciais" em vez do adjetivo solto "Simples"/"Marcial". Um item de lista que diz **"Armas marciais"** lê inequivocamente como grupo; "Adaga" lê como item. Com isso a categoria volta a poder conviver com o nome no mesmo valor/lista (igual armadura já faz), e o hoist pro rótulo — com todo o seu séquito de `—`, `<dt>` mutante e split invisível — deixa de ter motivo.

---

## Escopo

### Dentro do escopo

- **Rótulo de categoria de arma vira frase inteira.** `WEAPON_CATEGORY_LABEL` continua mapeando `simple`/`martial` para `sheet.proficiency.weapon.simple`/`.martial`, mas o **texto dessas duas chaves** muda de `"Simples"`/`"Marcial"` para **`"Armas simples"`/`"Armas marciais"`** (pt-BR) e `"Simple weapons"`/`"Martial weapons"` (en-US). Uma chave, dois consumidores (revisão + ficha) — muda nos dois de uma vez. **Armadura fica como está** (`ARMOR_CATEGORY_LABEL`, "Leve"/"Média"/…): nunca mistura com item nomeado, o adjetivo curto não gera ambiguidade.
- **Revisão (`SetupWizard.tsx`) — arma passa a espelhar a linha de armadura.** O `<dt>` volta a ser o rótulo fixo `t('setup.review.weapons')`, **sem sufixo de categoria**. O `<dd>` passa a conter **categorias + nomeadas juntas**, unidas por ` · ` (mesmo separador da linha de armadura): `[...reviewWeaponCategories.map(rótulo), ...reviewWeapons]`. Categoria primeiro (é a base 5e), nomeadas depois. A condição de render continua `reviewWeapons.length > 0 || reviewWeaponCategories.length > 0`. O `—` só aparece se as duas listas estiverem vazias (sistema `Free`/classe sem dado — não some a linha à toa).
  - Guerreiro: `<dt>` "Proficiências de arma", `<dd>` "Armas simples · Armas marciais".
  - Bardo: `<dd>` "Armas simples · Besta de mão · Espada longa · Rapieira · Espada curta".
  - Mago: `<dd>` "Adaga · Dardo · Funda · Bordão · Besta leve" (só nomeadas, sem categoria — como já é).
- **Ficha (`GameView.tsx`) — mesma correção, por espelhamento (US-127).** A seção "Armas" ([GameView.tsx:594-607](../../../apps/web/src/components/game/GameView.tsx:594)) perde o sufixo de categoria no `SheetHeading` (volta a ser `t('game.weapons')` puro) e passa a renderizar as **categorias como `<li>`** no topo da `<ul>`, seguidas das armas nomeadas — mesmo molde que a seção "Armadura" logo acima ([GameView.tsx:566-577](../../../apps/web/src/components/game/GameView.tsx:566)) já usa para categoria. A seção continua renderizando quando há categoria e/ou nomeada (a condição composta da US-221 se mantém, só deixa de alimentar o heading).
- **Corrigir os dois lados juntos é requisito, não conveniência.** US-127 fixa que a revisão espelha a ficha; deixar a revisão com categoria-no-valor e a ficha com categoria-no-heading criaria a divergência que a US-127 proíbe. As duas telas leem o mesmo `WEAPON_CATEGORY_LABEL` e o mesmo dado de `config.classes[].weaponProficiencies` — a correção é a mesma decisão aplicada nos dois consumidores.

### Fora do escopo

- **Reordenar/renomear as linhas da revisão.** A ordem e os rótulos das outras linhas (`skills`, `tools`, `armor`, `languages`, `kit`…) não mudam — só o `<dt>`/`<dd>` de arma e o texto de 2 chaves de i18n.
- **Distinguir visualmente grupo de item além da frase.** Nada de ícone, chip, cor ou sub-lista para "grupo vs item": a frase inteira ("Armas marciais") já resolve a ambiguidade pelo texto, mesmo custo de render de hoje. Se um dia a mistura ficar densa demais para uma linha, aí sim é redesenho — não agora (ver §Questões em aberto).
- **Mexer no modelo de dados.** Zero mudança em `config.classes[].weaponProficiencies`, DTO, schema Prisma ou `ingest.mjs` — é bug de exibição, o dado da US-221 está correto. Nenhum re-seed, nenhum re-ingest.
- **Armadura e ferramenta.** A linha de armadura já está no formato certo (é a referência). Ferramenta soma em `Character.tools` (US-221), sem categoria — nada a corrigir.
- **`—` como estado legítimo.** Sistema `Free` (sem `config.classes`) e classe sem `weaponProficiencies` continuam caindo em `—` quando não há nem categoria nem nomeada — a story só tira o `—` de quem **tem** categoria, não inventa conteúdo para quem não tem.

---

## Modelo de dados

Nenhuma mudança. `config.classes[].weaponProficiencies` (US-221) já traz `categories`/`weapons`. Esta story só muda como os dois campos são **compostos e rotulados** na hora de renderizar, e o **texto** de 2 chaves de i18n.

---

## Critérios de aceite

- [x] Na revisão, `<dt>` da linha de arma é **sempre** `t('setup.review.weapons')` puro ("Proficiências de arma"), sem sufixo de categoria, para qualquer classe.
- [x] Guerreiro (e as demais 6 classes só-categoria: bárbaro, clérigo, paladino, patrulheiro, bruxo, marshal) mostra na revisão `<dd>` = "Armas simples · Armas marciais" (ou "Armas simples" para o bruxo/clérigo), **nunca** `—`.
- [x] Bardo mostra `<dd>` = "Armas simples" seguido das 4 armas nomeadas, unidas por ` · ` (categoria antes das nomeadas).
- [x] Mago/Feiticeiro/Druida (só nomeadas, sem categoria) mostram `<dd>` só com os nomes, sem prefixo de categoria — comportamento inalterado.
- [x] As chaves `sheet.proficiency.weapon.simple`/`.martial` valem "Armas simples"/"Armas marciais" (pt-BR) e "Simple weapons"/"Martial weapons" (en-US), nos dois locales.
- [x] `ARMOR_CATEGORY_LABEL` e a linha de armadura ficam inalterados (adjetivo curto "Leve"/"Média"/"Escudos").
- [x] Na ficha (`GameView`), o `SheetHeading` da seção "Armas" é `t('game.weapons')` puro (sem "— Simples, Marcial"); as categorias aparecem como `<li>` no topo da `<ul>`, com o mesmo estilo dos `<li>` de nome — mesma forma da seção "Armadura".
- [x] Revisão e ficha exibem exatamente a mesma composição de arma para a mesma classe (US-127) — verificável no teste que já compara as duas.
- [x] `—` só aparece (revisão) / a seção só some (ficha) quando NÃO há categoria nem arma nomeada (sistema `Free`/classe sem dado).
- [x] **Eval/teste de regressão:** `SetupWizard.test.tsx` afirma que a revisão de um Guerreiro tem `<dd>` de arma com "Armas simples · Armas marciais" e **não** contém `—`, e que o `<dt>` não contém `—` no meio nem o texto de categoria; um caso de Bardo afirmando categoria antes das nomeadas. Se houver teste de snapshot/render da seção "Armas" do `GameView`, atualizar para o heading sem sufixo + categorias como `<li>`.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **A revisão de arma converge com a de armadura — literalmente o mesmo shape.** Copiar a estrutura da linha de armadura ([SetupWizard.tsx:1715-1722](../../../apps/web/src/components/setup/SetupWizard.tsx:1715)), trocando a fonte por `[...categorias, ...reviewWeapons]`. O sufixo no `<dt>` sai; o ternário do `<dd>` vira `join(' · ')` da lista composta.
- **A ficha de arma converge com a de armadura — idem.** A seção "Armadura" ([GameView.tsx:566-577](../../../apps/web/src/components/game/GameView.tsx:566)) já mapeia categoria para `<li>` via `ARMOR_CATEGORY_LABEL`; a seção "Armas" faz o mesmo com `WEAPON_CATEGORY_LABEL`, concatenando as nomeadas depois. O ramo do `SheetHeading` com sufixo é removido.
- **Um comentário da US-221 fica factualmente errado** ([GameView.tsx:590-593](../../../apps/web/src/components/game/GameView.tsx:590) e [SetupWizard.tsx:1695-1700](../../../apps/web/src/components/setup/SetupWizard.tsx:1695)): ele documenta a decisão "categoria NUNCA entra na `<ul>`/`<dd>` junto do nome, só no sufixo do heading" — que esta story reverte. Reescrever apontando para US-223 e explicando o porquê da reversão (a frase inteira "Armas marciais" desfaz a ambiguidade que motivou o hoist), **não apagar** (AGENTS.md).
- **Trocar só o texto das 2 chaves de i18n resolve os dois consumidores** porque `WEAPON_CATEGORY_LABEL` (idêntico em `GameView.tsx:44` e `SetupWizard.tsx:245`) já aponta para elas — não há categoria de arma renderizada por texto literal em nenhum outro lugar. Confirmar com grep de `sheet.proficiency.weapon` antes de assumir.
- **Ordem no valor: categoria antes de nomeada.** É a leitura 5e ("armas simples, e ainda X, Y, Z") e mantém as categorias — a informação mais abrangente — na frente.

---

## Questões em aberto

1. **Densidade da linha do bardo/ladino na revisão.** "Armas simples · Besta de mão · Espada longa · Rapieira · Espada curta" é a linha de arma mais longa (5 itens). Cabe no `<dd>` de uma linha da `<dl>` como as demais (kit/perícias já têm listas longas com `·`), mas se em telas estreitas (US-66) ficar apertada, avaliar quebra — **não** antecipar: medir na tela primeiro, mesmo corte de "forma segue conteúdo real" do resto do wizard.
