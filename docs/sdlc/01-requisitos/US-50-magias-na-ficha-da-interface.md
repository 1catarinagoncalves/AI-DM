# US-50 — Magias visíveis na ficha do personagem (aba Features)

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** ✅ Implementada
**Depende de:** [US-42](./US-42-magias-conhecidas.md) (campo `Character.spells` persistido — já entregue) · [US-45](./US-45-background-na-ficha-da-interface.md) (padrão de abas da ficha) · [US-41](./US-41-features-traits-de-classe.md) (a aba "Features" e o `FeaturesPanel` onde esta US entra)
**Relacionado:** [US-23](./US-23-dm-ciente-da-ficha.md) (o mestre já conhece as magias; esta US é sobre o JOGADOR as ver) · [US-19](./US-19-estado-de-ficha-via-api.md) (ficha servida pela API)
**Criada em:** 2026-07-14

---

## História

> **Como** jogador de um conjurador,
> **quero** ver as magias que o meu personagem conhece na ficha, junto das features de classe,
> **para que** eu saiba o que posso conjurar sem ter de perguntar ao mestre nem ir ler o livro — hoje só o mestre sabe.

---

## Contexto e motivação

### O problema observado

A [US-42](./US-42-magias-conhecidas.md) deu magias ao personagem: `Character.spells` (`{name, level?, description?}[]`), materializado do kit da classe na criação, e o **mestre** conhece-as (nomes no prompt, descrição via tool `getSpell`). Mas o **jogador** não as vê em lado nenhum. A ficha da `GameView` tem a aba **"Features"** (US-41), que mostra só `Character.features` — a clériga tem 9 truques persistidos e a ficha dela não os menciona.

Assimetria estranha: o mestre sabe que a personagem tem "Chama Sagrada"; quem joga, não. O jogador só descobre a magia se o mestre a oferecer.

### Por que a solução atual não basta

O dado já existe e **já é servido**: `spells` é um scalar do `Character`, e o `findOne` ([character.service.ts](../../../apps/api/src/character/character.service.ts)) não tem `select` que o exclua — o endpoint `GET /characters/:id` já o devolve hoje. Falta apenas **passá-lo adiante** (página de jogo → prop da `GameView`) e **renderizar**. Nenhum endpoint novo, nenhuma migração, nenhuma mudança de backend.

A US-42 excluiu explicitamente a UI do seu escopo ("esta US é **só backend/prompt + eval**; a aba de magias na ficha, se desejada, é uma US de interface separada"). Esta é essa US.

### A proposta

Mostrar as magias conhecidas **dentro da aba "Features" já existente**, como uma **segunda secção** abaixo das features — não numa aba nova.

Magias e features são a mesma pergunta do jogador ("o que é que este personagem sabe fazer de especial?"), e a aba "Features" já é exatamente esse painel. Uma aba "Magias" própria dividiria uma pergunta em dois cliques, e ficaria vazia para 4 das 12 classes (não-conjuradores). O `FeaturesPanel` ganha dois sub-títulos ("Features" e "Magias") em vez de um painel novo.

O formato de linha é o mesmo das features — **nome + descrição curta** — acrescido do **nível** (`(truque)` / `(nível 1)`). A descrição vem no próprio `Character.spells` (o seed guarda-a; é o prompt que a omite, não o dado), portanto a ficha mostra-a **sem** chamar `getSpell` nem qualquer endpoint.

---

## Escopo

### Dentro do escopo

- Secção **"Magias"** dentro do painel da aba **"Features"** ([GameView.tsx](../../../apps/web/src/components/game/GameView.tsx), `FeaturesPanel`), abaixo da secção de features.
- Cada magia: **nome + rótulo de nível + descrição curta**, read-only. `level === 0` → `(truque)`; `level >= 1` → `(nível N)`; `level` ausente → sem rótulo (mesma regra da secção "Known spells" do prompt, US-42).
- Thread do campo `spells` do que a API **já devolve** (`findOne`) → `app/play/[adventureId]/page.tsx` → prop `spells` da `GameView` (espelha exatamente o thread de `features`).
- Tipo `spells` acrescentado ao retorno tipado de `getCharacter` em [api.ts](../../../apps/web/src/lib/api.ts) (hoje só declara `features`).
- **Empty state por secção:** conjurador sem magias, ou não-conjurador (`spells: []`), **não** gera secção "Magias" vazia. A **aba nunca some** (padrão US-45) — se *nem* features *nem* magias existirem, mantém-se o empty state de hoje.
- Ordenação: magias por **nível e depois nome** (truques primeiro), para a lista de 20 truques do mago ficar legível.
- Acessibilidade e dark mode coerentes com o painel existente (US-46): sub-títulos como headings reais, não `<p>` a fingir de título.

### Fora do escopo

- **Aba "Magias" própria** — deliberado: ver [Decisões](#decisões).
- **Conjurar pela ficha** (botão "lançar magia") — a ficha é read-only, como todo o resto dela. Conjuração é ação de jogo, vai pelo chat/mestre.
- **Motor de spellcasting** (slots, preparação, componentes, concentração) — continua fora, como na [US-42](./US-42-magias-conhecidas.md). A ficha **não** mostra slots porque eles não existem no modelo.
- **Editar/escolher magias** na ficha — a lista vem do kit da classe na criação. Escolha de magias pelo jogador é US futura (provavelmente junto do motor de slots).
- Magias de nível ≥ 1 para além das 4 fixas de Paladino/Patrulheiro — é recorte da [US-42](./US-42-magias-conhecidas.md), não desta.
- Mudanças de backend, endpoint ou migração — **não há nenhuma**.

---

## Critérios de aceite

- [ ] A aba **"Features"** mostra, abaixo das features, uma secção **"Magias"** com as magias conhecidas do personagem.
- [ ] Cada magia aparece com **nome, nível e descrição curta**; `level === 0` renderiza **"(truque)"** e `level >= 1` renderiza **"(nível N)"**.
- [ ] Um **clérigo** vê "Chama Sagrada (truque)" com a descrição; um **paladino** vê "Curar Ferimentos (nível 1)".
- [ ] **Não-conjurador** (guerreiro, `spells: []`): a secção "Magias" **não aparece** (sem título órfão, sem lista vazia), e a aba continua a mostrar as features dele normalmente.
- [ ] Personagem **sem features e sem magias**: a aba continua presente e mostra o **empty state** (não some, não fica em branco).
- [ ] As magias são lidas do que a API **já devolve** (`findOne`) — **sem** endpoint novo, **sem** chamar `getSpell` a partir do frontend.
- [ ] Trocar de aba **não perde estado** de jogo (mensagens, HP, inventário) — continua a ser só troca de vista (US-45).
- [ ] A lista está **ordenada por nível e depois por nome** (os 20 truques do mago não saem em ordem arbitrária).
- [ ] **Eval / regressão:** renderizar `GameView` com um clérigo, clicar na aba **Features** e ver "Chama Sagrada" com "(truque)" e a descrição; com `spells: []` (guerreiro), a aba abre, mostra as features e **não** mostra a secção "Magias" ([GameView.test.tsx](../../../apps/web/src/components/game/GameView.test.tsx)).

---

## Notas de implementação

- **Backend: zero.** `Character.spells` já é persistido (US-42) e o `findOne` já o devolve. Resistir à tentação de criar `GET /characters/:id/spells` — não é preciso.
- **Thread do dado** (copiar linha a linha o que `features` já faz):
  - [page.tsx](../../../apps/web/src/app/play/[adventureId]/page.tsx): `spells={character.spells}` ao lado de `features={character.features}`.
  - [GameView.tsx](../../../apps/web/src/components/game/GameView.tsx): `spells?: KnownSpell[]` nas `Props`, desestruturado e passado ao `FeaturesPanel`.
  - [api.ts](../../../apps/web/src/lib/api.ts): acrescentar `spells: { name: string; level?: number; description?: string }[]` ao tipo do `getCharacter`.
- **Tipo:** reaproveitar `KnownSpell` de `@ai-dm/ai-engine` (já exportado pela US-42, ao lado de `ClassFeature` — que a `GameView` já importa). **Não** redefinir a forma no web.
- **Rótulo de nível:** a US-42 já tem essa regra em `spellLevelLabel` ([dm-system.ts](../../../packages/ai-engine/src/prompts/dm-system.ts)), mas está **privada** ao módulo. Exportá-la e reusar, em vez de reescrever a regra no web — senão o prompt e a ficha podem divergir (ex.: um diz "truque" e o outro "nível 0").
- **`FeaturesPanel`:** passa a receber `{ features, spells }` e a renderizar duas secções condicionais. Cada secção só existe se a sua lista tiver itens; o empty state atual ("Esta classe ainda não tem features registadas.") passa a cobrir o caso "**nem** features **nem** magias" — reformular o texto para não mentir a um conjurador sem features (ex.: "Esta classe ainda não tem features nem magias registadas.").
- A linha da magia reusa o layout da linha da feature (nome a âmbar, descrição por baixo); o nível entra no nome (`Chama Sagrada (truque)`), não numa coluna nova.
- Ordenação: `[...spells].sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name))` — não mutar a prop.
- Acessibilidade (US-46): sub-títulos das secções como `<h3>` (ou heading equivalente), não `<p>` estilizado; contraste do rótulo de nível legível nos dois temas.

---

## Decisões

- **Secção dentro da aba "Features", não aba nova.** Features e magias respondem à mesma pergunta do jogador ("o que sei fazer de especial?"), e a aba "Features" já é esse painel. Uma aba "Magias" própria partiria uma pergunta em dois cliques e ficaria **permanentemente vazia para 4 das 12 classes** (guerreiro, bárbaro, monge, ladino) — e o padrão da US-45 é que abas **não aparecem/somem** conforme o dado, logo teríamos uma aba morta na ficha deles. Alternativa descartada. *(Se um dia as magias ganharem slots/preparação e a secção crescer, promovê-la a aba é barato — `SHEET_TABS` já é uma lista iterada, não botões hard-coded.)*
- **Rótulo da aba mantém-se "Features".** Não renomear para "Features & Magias": o rótulo é o mesmo do domínio (US-41) e uma aba com dois sub-títulos internos já se explica. Renomear é gratuito depois, se a confusão aparecer em uso real.
- **Descrição mostrada na ficha, ao contrário do prompt.** No prompt, a descrição é omitida de propósito (custo de tokens — só nomes; a descrição vem sob demanda pela tool `getSpell`, US-42). Na ficha **não há esse custo**: o dado já veio na resposta do `findOne` e mostrar o efeito é justamente o que o jogador quer. Nada de chamar `getSpell` a partir do web.
- **Read-only, sem botão de conjurar.** Toda a ficha é read-only; a ação é do domínio do chat com o mestre. Um botão "conjurar" implicaria gasto de slot — e slots não existem no modelo (fora do escopo desde a US-42).
- **Secção "Magias" some quando vazia; a aba nunca some.** Coerente com a US-45: o que desaparece com dado vazio são os *blocos internos*, nunca a aba.

---

## Referências no código

- `apps/web/src/components/game/GameView.tsx` — `Props`, `SHEET_TABS`, aba `features` e o `FeaturesPanel` (onde entra a secção "Magias").
- `apps/web/src/app/play/[adventureId]/page.tsx` — carrega o personagem e monta as props da `GameView` (passar `character.spells`).
- `apps/web/src/lib/api.ts` — tipo do `getCharacter` (acrescentar `spells`).
- `apps/web/src/components/game/GameView.test.tsx` — regressão da aba.
- `apps/api/src/character/character.service.ts` — `findOne` já devolve `Character.spells` (nada a mudar).
- `packages/ai-engine/src/prompts/dm-system.ts` — tipo `KnownSpell` (exportado) e `spellLevelLabel` (a exportar).
- `docs/sdlc/01-requisitos/US-42-magias-conhecidas.md` — origem do campo `spells`; excluiu a UI do seu escopo.
- `docs/sdlc/01-requisitos/US-45-background-na-ficha-da-interface.md` — padrão de abas da ficha.
