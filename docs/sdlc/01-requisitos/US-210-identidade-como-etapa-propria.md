# US-210 — Identidade como etapa própria (nome, gênero e alinhamento)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) (**reabre** a decisão "nome e
gênero ficam na etapa `class`" — ver *Contexto*) · [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md)
(a ficha viva ao lado precisa existir antes de mais uma etapa nova ter onde mostrar seu resumo) ·
[US-213](./US-213-etapa-magias-e-escolha-de-truque-do-alto-elfo.md) (**nova, 2026-09-04**: `identity`
passa a entrar depois de `spells`, não direto depois de `skills` — ver *Revisão de posição
(2026-09-04)* em *Contexto*. Se `spells` ainda não existir quando esta story rodar, implementar
US-213 primeiro evita inserir `identity` duas vezes no array `steps`.)
**Relacionada a:**
- [backlog-redesenho-criacao-de-personagem.md](./backlog-redesenho-criacao-de-personagem.md) — o
  mapa, atualizado com a etapa `identity` e a segunda referência.
- [US-98](./US-98-i18n-da-interface-web.md) — o padrão que esta story copia para `alignment`: valor
  canônico em pt-BR (`GENDERS`), rótulo traduzido por chave. `ALIGNMENTS` segue a mesma forma.
- [US-46](./US-46-acessibilidade-wcag-aa.md) — grupo de rádio de verdade para o alinhamento, mesmo
  padrão de `WorldOptionGroup`.
- [US-66](./US-66-telas-mobile-friendly.md) — nova etapa colapsa em coluna única no telemóvel, como
  as demais.

**Criada em:** 2026-09-02

---

## História

> **Como** jogadora criando um personagem,
> **quero** definir nome, gênero e alinhamento numa etapa própria de Identidade, como última etapa
> antes de revisar a ficha,
> **para que** a etapa `class` não misture "quem meu personagem é" com "o que ele faz", e eu feche
> a mecânica (classe, raça, atributos, perícias, antecedente) antes de fechar a identidade — e veja
> os dois juntos na revisão logo em seguida.

---

## Contexto e motivação

### A decisão da US-205 tinha uma exceção nomeada — esta story é a segunda

O [backlog](./backlog-redesenho-criacao-de-personagem.md) fixou em 2026-09-02 que "a regra sem
mexer na ordem das etapas ganha uma exceção nomeada" para `race-class` → `class` + `race`, e a
US-205 foi explícita ao **recusar** mover nome/gênero para uma etapa `Identidade`:

> "Nome e gênero ficam na etapa `class`, a primeira das duas, acima da grade — não migram para a
> etapa `Identidade` que o protótipo põe no fim; a ordem do produto manda (decisão do backlog)."
> — [US-205 §Escopo](./US-205-escolha-por-cartao-classe-e-raca.md)

Essa recusa foi contra o protótipo local ([`wizard-criacao-personagem-referencia.html`](./wizard-criacao-personagem-referencia.html)),
que só tem uma etapa `Identidade` **no fim**, sem alinhamento, com aparência/personalidade/história
em texto livre (já cortado do escopo do backlog por outro motivo). Esta story parte de uma
**referência diferente**, inspecionada ao vivo em 02/09/2026 em
`https://twirl-skate-47309606.figma.site/` (link fornecido pela mantenedora — não confundir com o
protótipo local citado acima): seis etapas — `Identidade · Raça · Classe · Atributos ·
Antecedente · Revisão` —, com `Identidade` **primeiro**, não último, contendo nome, pronomes
(mapeados a `gender`, ver *Fora do escopo*) e **alinhamento** (9 valores D&D, ausente do produto
hoje). Verificado navegando o fluxo completo (`ETAPA 1 DE 6` a `ETAPA 6 DE 6`): a etapa `Classe`
nesta referência é grade pura, sem nome/gênero — confirma que a separação é real, não um efeito
colateral de layout.

**Decisão de produto (2026-09-02, revisita a US-205):** onde as duas referências divergem, a mais
recente e inspecionada ao vivo prevalece para a posição da identidade — `identity` vira etapa
própria. `system` continua primeiro (é quem carrega o catálogo de que `class`/`race` dependem); a
referência nova não tem etapa de sistema para comparar.

**Revisão de posição (2026-09-03):** a posição de `identity` na trilha muda de novo, por instrução
direta da mantenedora — não é mais logo após `system`, e sim **a última etapa antes da revisão da
ficha** (`review`). Isso substitui a posição "primeiro" fixada acima; o resto da decisão de
2026-09-02 (etapa própria, campos `name`/`gender`/`alignment`, mesma forma de `gender`) continua de
pé. Fica registrado sem apagar o parágrafo anterior — mesma disciplina que este documento já cobra
para o comentário desatualizado da US-205 (ver *Notas de implementação*).

**Revisão de posição (2026-09-04):** entra uma etapa nova entre `skills` e `review` —
[US-213](./US-213-etapa-magias-e-escolha-de-truque-do-alto-elfo.md), "Magias" (`spells`) —, e a
mantenedora decidiu que `identity` fica **depois** dela. `identity` continua sendo a última etapa
antes de `review` (a posição de 2026-09-03 não muda); o que muda é o vizinho imediato: antes era
`skills → identity → review`, passa a ser `skills → spells → identity → review`. Mesma disciplina de
não apagar os parágrafos anteriores — só o "depois de `skills`" das seções abaixo passa a ler
"depois de `spells`".

### Por que não simplesmente mover o bloco de dentro de `class`

- **Mistura de assunto na mesma tela.** Hoje `class` abre com dois campos de identidade (nome,
  gênero) e imediatamente uma grade de treze cartões de classe — a jogadora decide "quem eu sou"
  no meio de decidir "o que eu jogo", sem fronteira visual nem de progresso na trilha de etapas.
- **A trilha de progresso já mostra a etapa errada.** Com `identity` dentro de `class`, o chip da
  trilha (`setup.step.class`) nunca comunica que nome/gênero foram preenchidos — só "Classe".
  Etapa própria dá à identidade seu próprio chip, sua própria marca de "concluída".
- **Alinhamento não tem onde entrar hoje.** Não existe campo, não existe etapa — a4crescentar seria
  mais um campo solto na etapa `class`, piorando exatamente o problema acima.

---

## Escopo

### Dentro do escopo

- **Nova etapa `identity`, última antes de `review`** (entre `spells` e `review` — ver *Revisão de
  posição (2026-09-04)* em *Contexto*; sem `spells` implementada ainda, cai direto após `skills`).
  `Step`/`steps`
  ([`SetupWizard.tsx:33-34`](../../../apps/web/src/components/setup/SetupWizard.tsx)) ganham a
  chave nova nessa posição — só `review` e `world` deslocam uma posição, sem mudar de conteúdo
  (mesma disciplina da US-205 ao inserir `race`).
- **Campo `name` e `gender` saem da etapa `class` e entram em `identity`**, mesmos campos, mesmo
  `<input>`/`<select>`, sem mudança de tipo nem de validação — só de etapa.
- **Campo novo `alignment`**, mesma forma de `gender`: constante `ALIGNMENTS` com os 9 valores
  canônicos em pt-BR (`'Leal e Bom'`, `'Neutro e Bom'`, `'Caótico e Bom'`, `'Leal e Neutro'`,
  `'Neutro'`, `'Caótico e Neutro'`, `'Leal e Mau'`, `'Neutro e Mau'`, `'Caótico e Mau'`), rótulo
  traduzido por chave `setup.alignment.<valor>` nos dois locales (US-98). `<select>` como `gender`
  usa hoje — 9 valores sem prosa não pedem grade de cartão (mesmo corte que a US-205 já fez para
  gênero, *Fora do escopo* §"Cartão para o gênero").
- **`class` perde os dois campos, fica só com a grade de classe** (e a subgrade de subclasse
  aninhada, US-205) — sem outra mudança de conteúdo na etapa.
- **`canAdvance('identity')` exige nome, gênero e alinhamento preenchidos** — a condição que hoje
  vive em `canAdvance('class')` (linhas 438-442) muda de etapa e ganha `alignment`.
  `canAdvance('class')` passa a exigir só classe (e subclasse, quando aplicável).
- **`Character.alignment` (campo novo) grava o valor canônico**, mesma disciplina de `gender` —
  string livre, sem catálogo (não é dado de sistema/SRD, é convenção D&D fixa nas 3 fases, mesmo
  argumento que já vale para gênero na US-98).
- **`setup.step.identity`** nos dois locales, chip próprio na trilha.
- **Trilha de progresso, `goTo`/`canAdvance`/`next`/`back`** continuam operando por índice — nenhuma
  mudança de mecanismo, só mais uma posição no array (mesma nota da US-205).
- **Mobile:** etapa nova colapsa como as demais (US-66) — nenhum campo pede grade, layout de
  formulário vertical simples basta.
- **i18n:** `setup.step.identity`, `setup.identity.*` (título, rótulos) e `setup.alignment.*` (9
  chaves) nos dois locales.

### Fora do escopo

- **Renomear `gender` para `pronouns` ou mudar a lista de valores.** A referência usa "Pronomes"
  (Ele/Dele, Ela/Dela, Elu/Delu); o produto usa "Gênero" com `GENDERS` (Feminino/Masculino/
  Não-binário) desde a US-98, e o campo já viaja para o prompt do Mestre com esse nome e essa forma
  (`packages/ai-engine/src/prompts/dm-system.ts`, seção *Gender Agreement*). Trocar rótulo, nome de
  campo ou os três valores é mudança de conteúdo, não de tela — a mesma régua "protótipo é forma,
  produto é conteúdo" do backlog. Fica **de fora**: só a etapa muda, o campo em si não.
- **`alignment` alimentando o prompt do Mestre.** A seção 8 do `dm-system.ts` já lê `gender` para
  concordância; ensinar o Mestre a respeitar o alinhamento na narração (decisões morais coerentes
  com "Leal e Bom", por exemplo) é trabalho de prompt e eval próprio, não wiring de formulário.
  Esta story persiste e mostra o campo; usá-lo na narração é story futura, sem precedente aqui.
- **Migrar fichas existentes.** Coluna nova, nullable, sem alinhamento a inferir — mesmo padrão da
  migração de `subclass` na US-205 (sem backfill).
- **Cartão de alinhamento com prosa própria** (a la classe/raça, US-203). 9 valores curtos e
  autoexplicativos não precisam de `kicker`/`blurb`; `<select>` é a forma certa, mesmo corte já
  feito para gênero.
- **Mudar a posição de `background`** (nome e história narrativa continuam em etapas diferentes:
  identidade formal aqui, história livre em `background` — US-39/US-40 sem mudança). Esta story
  também não reabre a ordem das etapas depois de `class`.

---

## Modelo de dados proposto

Mesma forma de `gender` (US-98/US-105): campo livre, sem catálogo, valor canônico em pt-BR.

```prisma
// apps/api/prisma/schema.prisma — model Character
name           String
gender         String
alignment      String?   // novo: 1 dos 9 valores de ALIGNMENTS (pt-BR), sem catálogo — mesma
                          // forma de `gender`. Opcional (nullable): fichas existentes não têm.
```

```ts
// apps/api/src/character/character.schema.ts — CreateCharacterSchema, irmão de `gender`
alignment: z.string().max(40).optional(),
```

```ts
// apps/web/src/components/setup/SetupWizard.tsx — ao lado de GENDERS
const ALIGNMENTS = [
  'Leal e Bom', 'Neutro e Bom', 'Caótico e Bom',
  'Leal e Neutro', 'Neutro', 'Caótico e Neutro',
  'Leal e Mau', 'Neutro e Mau', 'Caótico e Mau',
] as const
```

| Campo | Antes | Depois |
|---|---|---|
| `Character.alignment` | inexistente | `String?` — 1 dos 9 valores de `ALIGNMENTS`, sem validação de catálogo (mesmo padrão de `gender`) |
| `CreateCharacterSchema.alignment` | inexistente | `z.string().max(40).optional()` |

**Persistência:** migração Prisma nova (coluna nullable, sem backfill — nenhuma ficha existente tem
alinhamento). Campo opcional no schema/DTO por trust boundary, mas `canAdvance('identity')` exige
preenchido no wizard — a mesma distinção que `gender` já tem hoje (obrigatório na UI, string livre
sem enum forçado no backend).

---

## Critérios de aceite

- [ ] `Step`/`steps` (`SetupWizard.tsx:33-34`) ganham `'identity'` entre `'spells'` (US-213) e
      `'review'` (última etapa antes da revisão da ficha); só `'review'` e `'world'` deslocam uma
      posição, nenhuma outra etapa muda de posição relativa às demais.
- [ ] A etapa `identity` tem os campos `name`, `gender` (mesmo `<select>` de hoje) e `alignment`
      (`<select>` novo, 9 valores de `ALIGNMENTS`) — nenhum outro campo.
- [ ] A etapa `class` não tem mais `<input>` de nome nem `<select>` de gênero — só a grade de classe
      (e a subgrade de subclasse, quando aplicável).
- [ ] `canAdvance('identity')` exige nome não vazio, gênero em `GENDERS` e alinhamento em
      `ALIGNMENTS`; `canAdvance('class')` exige só classe (e subclasse, quando aplicável) — a
      condição composta que hoje vive em `canAdvance('class')` se divide em duas.
- [ ] A trilha de progresso mostra um chip `Identidade` depois de `Magias` (`spells`, US-213) e antes
      de `Revisão` (`review`), navegável de volta como as demais (US-107: `goTo` só permite etapas já
      concluídas).
- [ ] Personagem criado sem `alignment` no DTO é aceito (campo opcional no schema/DTO) — mas o
      wizard nunca envia esse estado, porque `canAdvance('identity')` bloqueia antes.
- [ ] `Character.alignment` grava o valor canônico enviado (`'Leal e Bom'`, etc.), verificável no
      registro criado — mesma disciplina de string livre que `gender` já tem.
- [ ] Em 360 px de largura a etapa `identity` é coluna única, sem rolagem horizontal (US-66).
- [ ] Navegar por teclado no `<select>` de alinhamento funciona como qualquer `<select>` nativo —
      sem grupo de rádio customizado (não é grade de cartão, ver *Fora do escopo*).
- [ ] **Eval / teste de regressão:** teste em `SetupWizard.test.tsx` que avança o wizard até
      `identity` (última etapa antes de `review`), preenche nome, gênero e alinhamento, avança para
      `review` e confirma a criação, e afirma que `createCharacter` recebe `alignment` com o valor
      canônico escolhido — o teste que falha se alguém mover o campo de volta para dentro de
      `class` sem atualizar o DTO.
- [ ] **Eval / teste de regressão (service):** teste em `character.service.test.ts` que cria
      personagem com `alignment` presente e ausente — os dois caminhos persistem sem erro
      (`alignment` é opcional no schema, mas grava o valor quando vem).

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **Extrair o bloco de nome/gênero da etapa `class` é um recorte, não uma reescrita.** O JSX de
  `char-name`/`char-gender` ([`SetupWizard.tsx:679-695`](../../../apps/web/src/components/setup/SetupWizard.tsx))
  já existe pronto — move para o novo `step === 'identity'`, ganha o `<select>` de alinhamento ao
  lado (mesmo `fieldClass`/`SELECT_ARROW` que `gender` já usa).
- **Comentário da US-205 em `SetupWizard.tsx:670-672` fica desatualizado por esta story** — ele
  documenta exatamente a decisão que esta story reverte ("não migram pra uma etapa Identidade no
  fim"). Com a *Revisão de posição* de 2026-09-03, `identity` volta a ser a última etapa — mas por
  motivo diferente do protótipo local que a US-205 recusou (campos estruturados `name`/`gender`/
  `alignment`, não texto livre de aparência/personalidade/história). Reescrever o comentário para
  apontar aqui, não apagar (`AGENTS.md`: comentário existente não some, mas pode ficar factualmente
  errado se não for atualizado — e este é o caso raiz que motivou a regra).
- **`canAdvance` muda de forma, não só de posição.** A condição hoje é um `&&` de quatro partes em
  `case 'class'`; vira duas `case` menores (`'identity'` com três partes, `'class'` com uma).
- **`ALIGNMENTS` é `as const`, mesmo padrão de `GENDERS`** — nove valores, sem depender de catálogo
  do sistema (não é dado de SRD, é convenção D&D fixa, mesmo argumento que já vale para `gender` na
  US-98).
- **Migração Prisma:** coluna nova, nullable, sem dado a migrar — mesmo padrão de simplicidade que a
  migração de `subclass` da US-205 já teve.
- **`api.ts` (`createCharacter`) precisa do campo novo no tipo do payload**, ao lado de `gender`
  ([`apps/web/src/lib/api.ts:61-63`](../../../apps/web/src/lib/api.ts)) — sem isso o TypeScript não
  acusa, mas o campo nunca sai do cliente (mesmo aviso que o cabeçalho do `character.schema.ts` já
  documenta para o schema Zod).
- **Revisão (`review`, US-208) ganha uma linha de alinhamento** ao lado de gênero, se a US-208 já
  estiver implementada quando esta story rodar — checar o estado da tela antes de decidir se é
  ajuste desta story ou já cabe sozinho no que a US-208 entrega.

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx:33-34`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `type Step` e `const steps`: onde `'identity'` entra entre `'spells'` (US-213) e `'review'` (última etapa antes da revisão da ficha).
- [US-213](./US-213-etapa-magias-e-escolha-de-truque-do-alto-elfo.md) — etapa `spells`, o novo vizinho imediato de `identity` (decisão de 2026-09-04).
- [`apps/web/src/components/setup/SetupWizard.tsx:43`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `GENDERS`: o molde direto para `ALIGNMENTS`.
- [`apps/web/src/components/setup/SetupWizard.tsx:670-695`](../../../apps/web/src/components/setup/SetupWizard.tsx) — bloco `step === 'class'` com `char-name`/`char-gender`: o que se move para `step === 'identity'`.
- [`apps/web/src/components/setup/SetupWizard.tsx:432-442`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `canAdvance`, `case 'class'`: a condição que se divide em `'identity'` + `'class'`.
- [`apps/web/src/lib/api.ts:61-63`](../../../apps/web/src/lib/api.ts) — `createCharacter`: onde `alignment` entra ao lado de `gender` no tipo do payload.
- [`apps/api/src/character/character.schema.ts:23`](../../../apps/api/src/character/character.schema.ts) — `CreateCharacterSchema.gender`: onde `alignment` entra como irmão opcional.
- [`apps/api/prisma/schema.prisma`](../../../apps/api/prisma/schema.prisma) — `model Character`, `gender String`: onde `alignment String?` entra ao lado.
- [`packages/ai-engine/src/prompts/dm-system.ts:497-498`](../../../packages/ai-engine/src/prompts/dm-system.ts) — seção *Gender Agreement*: o precedente de campo de identidade que já chega ao Mestre — `alignment` **não** entra aqui nesta story (ver *Fora do escopo*).
- [US-98](./US-98-i18n-da-interface-web.md) — o padrão valor-canônico-pt-BR/rótulo-traduzido que `ALIGNMENTS` copia de `GENDERS`.
- [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) §Escopo — a decisão que esta story reabre.
