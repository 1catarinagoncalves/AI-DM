# US-210 — Identidade como etapa própria (nome, gênero e alinhamento)

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
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
- [US-98](./US-98-i18n-da-interface-web.md) — o padrão de `GENDERS` (valor canônico + rótulo
  traduzido por chave) que a versão original desta story copiava para `alignment`; superado pela
  *Revisão de fonte (2026-09-07)* — `alignment` vira dado de catálogo (ver US-47/US-54 abaixo),
  `gender` continua no padrão US-98.
- [US-47](./US-47-ingestao-srd-como-dado.md) e [US-54](./US-54-chaves-canonicas-em-ingles.md) — o padrão que
  `alignment` passa a seguir: chave canônica EN derivada do dataset SRD, catálogo em `config`,
  overlay pt-BR curado (novo desde 2026-09-07, ver *Contexto*).
- [US-108](./US-108-tabela-de-modificadores-do-srd-2024.md) — `Rule.json` do doc `srd-2024`, já
  sincronizado por essa story; é de lá que `buildAlignments` lê a seção "The Nine Alignments".
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

**Revisão de fonte (2026-09-07):** os 9 valores de alinhamento deixam de ser "convenção D&D fixa,
não dado de sistema/SRD" (razão dada em *Fora do escopo* abaixo) — a mantenedora aponta
`https://open5e.com/rules/srd_alignment` como fonte. Verificado: é o MESMO conteúdo que
`scripts/srd/sync.mjs` já baixa hoje, sem tag nova — `Rule.json` do documento `srd-2024` (US-108),
registro `pk: "srd-2024_create-your-character_alignment"`, `desc` com a seção "The Nine Alignments"
por extenso (as 9 combinações LG/NG/CG/LN/N/CN/LE/NE/CE, cada uma com rótulo e frase de
comportamento típico). O dado já está sincronizado no repo — só `ingest.mjs` ainda não o parseia.
Isso reabre a decisão de modelo de dados: `alignment` passa a seguir o MESMO contrato de
`race`/`class` (`SystemCatalogEntrySchema` — chave canônica EN + rótulo por locale,
`config.alignments` novo, US-47/US-54), não mais o contrato de `gender` (string livre sem catálogo)
que a decisão de 2026-09-02 (`Modelo de dados proposto` abaixo) copiava. Fica registrado sem apagar
os parágrafos anteriores; *Escopo*, *Fora do escopo*, *Modelo de dados* e *Critérios de aceite*
abaixo já refletem a fonte nova.

**Revisão de campos (2026-09-07):** a mantenedora pede caixas de `appearance`/`personality` na
etapa `identity`, como na referência viva (`https://twirl-skate-47309606.figma.site/`) — texto
livre, OPCIONAL (só `name` é obrigatório; o subtítulo da etapa passa a dizer isso). Diferente de
`história de origem`/`background.story`, que **continua** em `background` (US-39/US-40) — a
referência os separa também: `identity` guarda aparência física e personalidade (traços de
character sheet clássicos), `background` guarda a narrativa de origem. Nenhum dos dois campos
precisa de catálogo/SRD — mesmo raciocínio de `background.ideals`/`bonds`/`flaws` (texto do
jogador, normalizado no service, sem validação de conteúdo). Ver *Escopo*, *Modelo de dados* e
*Critérios de aceite* abaixo.

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
- **Campo novo `alignment`, dado de sistema (SRD), não convenção hardcoded** — ver *Revisão de
  fonte (2026-09-07)* em *Contexto*. `config.alignments` (novo domínio de `SystemConfig`,
  `packages/shared/src/types/system.ts`): 9 entradas `SystemCatalogEntrySchema` (`key`/`label`,
  mesmo contrato de `config.races`/`config.classes`, sem `kicker`/`blurb` — 9 valores curtos não
  pedem prosa de cartão, mesmo corte que já valia para `gender`). `ingest.mjs` ganha
  `buildAlignments`, que parseia a seção "The Nine Alignments" de `Rule.json`
  (`srd-2024_create-your-character_alignment`, já sincronizado) em 9 pares rótulo/sigla — chave
  canônica EN kebab-case (`'lawful-good'`, `'neutral-good'`, `'chaotic-good'`, `'lawful-neutral'`,
  `'neutral'`, `'chaotic-neutral'`, `'lawful-evil'`, `'neutral-evil'`, `'chaotic-evil'`), mesmo
  padrão de chave de `CLASS_MAP`/`buildRaces` (US-54). Overlay pt-BR curado à mão em
  `locale/pt-BR.json` (`alignments.<key>`) — **fora** de `MT_DOMAINS`, mesmo argumento que já vale
  para `attributes`/`skills` (convenção fixa do 5e, sem risco de bump trazer conteúdo novo, ver
  comentário de `MT_DOMAINS` em `ingest.mjs`). `<select>` no wizard passa a listar
  `config.alignments` (como já faz para classe/raça), não mais uma constante local do componente.
- **Campos novos `appearance` e `personality`, texto livre, OPCIONAIS** — ver *Revisão de campos
  (2026-09-07)* em *Contexto*. Duas `<textarea>` lado a lado (grade 2 colunas, como
  `background.deity` já faz), placeholder "Como seu personagem se parece?" /
  "Como ele age e reage?" (`setup.identity.appearancePlaceholder`/`personalityPlaceholder`, i18n).
  Ao contrário de `name`/`gender`/`alignment`, `canAdvance('identity')` NÃO exige preenchidos — só
  o nome é obrigatório na etapa (subtítulo da etapa diz isso: "Nada aqui é obrigatório além do
  nome").
- **`class` perde os dois campos, fica só com a grade de classe** (e a subgrade de subclasse
  aninhada, US-205) — sem outra mudança de conteúdo na etapa.
- **`canAdvance('identity')` exige nome, gênero preenchidos e alinhamento presente em
  `config.alignments`** — a condição que hoje vive em `canAdvance('class')` (linhas 438-442) muda
  de etapa e ganha `alignment`. `canAdvance('class')` passa a exigir só classe (e subclasse, quando
  aplicável).
- **`Character.alignment` (campo novo) grava a CHAVE canônica** (ex. `'lawful-good'`), não o rótulo
  pt-BR — mesmo contrato de `Character.race`/`Character.class` (`SystemCatalogEntrySchema`), não
  mais o de `gender` (string livre) que a decisão de 2026-09-02 copiava — ver *Revisão de fonte
  (2026-09-07)*. Backend valida com `validateCatalogKey(config.alignments, dto.alignment,
  'Alinhamento')`, mesmo mecanismo de `race`/`class`/`origin`
  (`character.service.ts:236`, `validateCatalogKey`).
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
  feito para gênero — vale mesmo com `alignment` virando dado de catálogo (US-203 já mostra que
  `kicker`/`blurb` são opcionais no schema, não obrigatórios por domínio).
- **Guardar a descrição de cada alinhamento** (a frase de comportamento típico — "Lawful Good
  creatures endeavor to do the right thing…" — que `Rule.json` traz junto do rótulo). `ingest.mjs`
  lê só rótulo/sigla para `config.alignments`; a descrição fica em `Rule.json`, sem campo
  `description` no `SystemCatalogEntrySchema` desta story (mesmo corte que `races`/`classes` já
  fazem — `blurb` é prosa autoral, não a descrição crua do SRD). Mostrar a descrição na tela
  (tooltip, por exemplo) é story futura, sem precedente aqui.
- **Baixar `Rule.json` de novo ou mudar a tag do sync.** `scripts/srd/sync.mjs` já baixa
  `srd-2024/Rule.json` inteiro (US-108, para a tabela de modificadores) — o registro do alinhamento
  já está no dataset local. Esta story só soma um parser (`buildAlignments`) em `ingest.mjs`, sem
  tocar `sync.mjs` nem `TAG`.
- **Mudar a posição de `background`** (nome e história narrativa continuam em etapas diferentes:
  identidade formal aqui, história livre em `background` — US-39/US-40 sem mudança). Esta story
  também não reabre a ordem das etapas depois de `class`.

---

## Modelo de dados proposto

**Revisto em 2026-09-07** (ver *Revisão de fonte* em *Contexto*): `alignment` segue o contrato de
`race`/`class` (`SystemCatalogEntrySchema`, chave canônica EN + catálogo em `config`), não mais o
de `gender` (string livre pt-BR) que a versão anterior desta seção propunha.

```ts
// packages/shared/src/types/system.ts — SystemConfigSchema, ao lado de races/classes
alignments: z.array(SystemCatalogEntrySchema).length(9),
```

```ts
// scripts/srd/ingest.mjs — buildAlignments, novo builder ao lado de buildAttributes/buildSkills
// Fonte: Rule.json, pk "srd-2024_create-your-character_alignment" (já sincronizado, US-108).
// Parseia a seção "The Nine Alignments" do `desc` (padrão "_Rótulo (SIGLA)._ frase…", 9
// ocorrências) em { key: kebabCase(rótulo), label } — overlay pt-BR curado à mão
// (locale/pt-BR.json → alignments.<key>), fora de MT_DOMAINS (mesmo argumento de
// attributes/skills: convenção fixa do 5e).
export function buildAlignments(overlay, ruleDesc, resolve) { /* … */ }
```

```prisma
// apps/api/prisma/schema.prisma — model Character
name           String
gender         String
alignment      String?   // novo: chave canônica de config.alignments (ex. 'lawful-good'), não
                          // o rótulo pt-BR — mesmo contrato de `race`/`class`. Opcional
                          // (nullable): fichas existentes não têm.
appearance     String?   // novo: texto livre, sem catálogo — mesmo raciocínio de
                          // background.ideals/bonds/flaws. Opcional: nada aqui é obrigatório
                          // além do nome (ver Revisão de campos, 2026-09-07).
personality    String?   // novo: texto livre, mesmo padrão de `appearance`.
```

```ts
// apps/api/src/character/character.schema.ts — CreateCharacterSchema, irmãos de `race`/`class`
alignment: z.string().max(40).optional(),
appearance: z.string().max(500).optional(),
personality: z.string().max(500).optional(),
```

```ts
// apps/api/src/character/character.service.ts — validado como race/class/origin
const alignment = dto.alignment
  ? this.validateCatalogKey(config.alignments, dto.alignment, 'Alinhamento')
  : undefined
```

| Campo | Antes | Depois |
|---|---|---|
| `config.alignments` | inexistente | `SystemCatalogEntrySchema[]`, 9 entradas — derivado do SRD via `ingest.mjs` (`buildAlignments`) |
| `Character.alignment` | inexistente | `String?` — chave canônica de `config.alignments` (ex. `'lawful-good'`), validada por `validateCatalogKey` (mesmo padrão de `race`/`class`) |
| `CreateCharacterSchema.alignment` | inexistente | `z.string().max(40).optional()` |
| `Character.appearance` / `personality` | inexistente | `String?` cada — texto livre, sem catálogo, opcionais |
| `CreateCharacterSchema.appearance` / `personality` | inexistente | `z.string().max(500).optional()` cada |

**Persistência:** migração Prisma nova (coluna nullable, sem backfill — nenhuma ficha existente tem
alinhamento). Campo opcional no schema/DTO por trust boundary, mas `canAdvance('identity')` exige
preenchido no wizard e `validateCatalogKey` rejeita chave fora do catálogo no backend — a mesma
dupla camada que `race`/`class` já têm hoje (obrigatório na UI, validado contra o catálogo no
servidor).

---

## Critérios de aceite

- [ ] `Step`/`steps` (`SetupWizard.tsx:33-34`) ganham `'identity'` entre `'spells'` (US-213) e
      `'review'` (última etapa antes da revisão da ficha); só `'review'` e `'world'` deslocam uma
      posição, nenhuma outra etapa muda de posição relativa às demais.
- [ ] A etapa `identity` tem os campos `name`, `gender` (mesmo `<select>` de hoje), `alignment`
      (`<select>` novo, listando `config.alignments`), `appearance` e `personality` (duas
      `<textarea>` lado a lado, texto livre) — nenhum outro campo.
- [ ] `appearance`/`personality` são OPCIONAIS: `canAdvance('identity')` avança com os dois vazios
      (só `name`/`gender`/`alignment` bloqueiam), e o personagem criado sem eles no DTO é aceito
      (campo opcional no schema).
- [ ] A etapa `class` não tem mais `<input>` de nome nem `<select>` de gênero — só a grade de classe
      (e a subgrade de subclasse, quando aplicável).
- [ ] `config.alignments` tem 9 entradas `{key, label}`, derivadas de `Rule.json`
      (`srd-2024_create-your-character_alignment`) via `buildAlignments`; as 9 chaves batem com as
      siglas de `https://open5e.com/rules/srd_alignment` (LG/NG/CG/LN/N/CN/LE/NE/CE) — teste de
      regressão em `ingest.test.mjs` (mesmo padrão dos demais builders, `buildSkills`/`buildRaces`).
- [ ] `canAdvance('identity')` exige nome não vazio, gênero em `GENDERS` e alinhamento presente em
      `config.alignments`; `canAdvance('class')` exige só classe (e subclasse, quando aplicável) —
      a condição composta que hoje vive em `canAdvance('class')` se divide em duas.
- [ ] A trilha de progresso mostra um chip `Identidade` depois de `Magias` (`spells`, US-213) e antes
      de `Revisão` (`review`), navegável de volta como as demais (US-107: `goTo` só permite etapas já
      concluídas).
- [ ] Personagem criado sem `alignment` no DTO é aceito (campo opcional no schema/DTO) — mas o
      wizard nunca envia esse estado, porque `canAdvance('identity')` bloqueia antes.
- [ ] `Character.alignment` grava a CHAVE canônica enviada (ex. `'lawful-good'`), verificável no
      registro criado — `validateCatalogKey` rejeita chave fora de `config.alignments` (mesma
      disciplina de `race`/`class`, não mais a de string livre de `gender`).
- [ ] Em 360 px de largura a etapa `identity` é coluna única, sem rolagem horizontal (US-66).
- [ ] Navegar por teclado no `<select>` de alinhamento funciona como qualquer `<select>` nativo —
      sem grupo de rádio customizado (não é grade de cartão, ver *Fora do escopo*).
- [ ] **Eval / teste de regressão:** teste em `SetupWizard.test.tsx` que avança o wizard até
      `identity` (última etapa antes de `review`), preenche nome, gênero e alinhamento, avança para
      `review` e confirma a criação, e afirma que `createCharacter` recebe `alignment` com a chave
      canônica escolhida — o teste que falha se alguém mover o campo de volta para dentro de
      `class` sem atualizar o DTO.
- [ ] **Eval / teste de regressão:** teste em `SetupWizard.test.tsx` que avança até `identity` SEM
      preencher `appearance`/`personality` e confirma a criação com sucesso (os dois campos
      opcionais não bloqueiam `canAdvance`); teste separado que os preenche e afirma que
      `createCharacter` recebe os dois valores.
- [ ] **Eval / teste de regressão (service):** teste em `character.service.test.ts` que cria
      personagem com `alignment` presente e ausente — os dois caminhos persistem sem erro
      (`alignment` é opcional no schema, mas grava a chave quando vem) — e um caso com chave fora
      de `config.alignments` que rejeita via `validateCatalogKey`, mesmo padrão do teste de `race`
      inválida.

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
- **`buildAlignments` (novo, `ingest.mjs`) parseia por regex** o padrão `_Rótulo (SIGLA)._ frase…`
  repetido 9x no `desc` de `srd-2024_create-your-character_alignment` — mesmo estilo de parser
  textual que `parseSrdEquipmentBullets`/`parseAbilityGrant` já usam neste arquivo (regex sobre
  prosa medida, não parser genérico de markdown). O parágrafo final ("Unaligned Creatures") NÃO
  entra — não é um dos 9 alinhamentos jogáveis, é sobre criaturas sem capacidade racional.
- **Chave = `kebabCase(rótulo EN)`**, não a sigla (`'lawful-good'`, não `'lg'`) — mesmo estilo de
  chave legível que `CLASS_MAP`/`buildRaces` já usam (US-54), a sigla fica só como comentário/
  referência visual.
- **Overlay pt-BR é curadoria manual de 9 linhas**, não MT — mesmo argumento de
  `attributes`/`skills` no comentário de `MT_DOMAINS` (`ingest.mjs:57-60`): convenção fixa do 5e,
  sem risco de um bump de tag trazer alinhamento novo.
- **`config.alignments` precisa entrar em `SystemConfigSchema`** (`packages/shared/src/types/
  system.ts:216`), ao lado de `attributes`/`skills` — sem isso `ingest.mjs` grava um campo que o
  schema rejeita na validação final (mesmo risco que qualquer domínio novo do config já corre).
- **`appearance`/`personality` em grade 2 colunas**, mesmo `<textarea>` que `background.story` já
  usa (estilo, resize, `fieldClass`) — só a posição lado a lado é nova (`background.story` é
  largura cheia). Placeholder guia o texto ("Como seu personagem se parece?"/"Como ele age e
  reage?"), não `label` sozinho — mesmo padrão de affordance da referência viva.
- **Migração Prisma:** colunas novas (`alignment`, `appearance`, `personality`), todas nullable,
  sem dado a migrar — mesmo padrão de simplicidade que a migração de `subclass` da US-205 já teve.
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
- [`apps/web/src/components/setup/SetupWizard.tsx:43`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `GENDERS`: o molde que a versão anterior desta story copiava; `alignment` segue o contrato de `race`/`class` desde a *Revisão de fonte (2026-09-07)*.
- [`scripts/srd/sync.mjs:48`](../../../scripts/srd/sync.mjs) — `Rule.json` do doc `srd-2024`, já sincronizado (US-108); o registro `srd-2024_create-your-character_alignment` é a fonte de `config.alignments`.
- [`scripts/srd/ingest.mjs:74`](../../../scripts/srd/ingest.mjs) — `MT_DOMAINS`: onde `alignments` NÃO entra (curadoria manual, mesmo argumento de `attributes`/`skills`).
- [`scripts/srd/ingest.mjs:216`](../../../scripts/srd/ingest.mjs) — `makeResolver`/`resolve`: mecanismo de overlay/fallback que `buildAlignments` reusa, mesmo padrão de `buildAttributes`/`buildSkills`.
- [`packages/shared/src/types/system.ts:47`](../../../packages/shared/src/types/system.ts) — `SystemCatalogEntrySchema`: o contrato que `config.alignments` reusa (mesmo de `races`/`classes`/`subclasses`).
- [`apps/api/src/character/character.service.ts:236`](../../../apps/api/src/character/character.service.ts) — `validateCatalogKey`: mesma validação de `race`/`class`/`origin`, agora também de `alignment`.
- [US-108](./US-108-tabela-de-modificadores-do-srd-2024.md) — de onde `Rule.json` já vem sincronizado (a razão do dataset já ter o registro do alinhamento antes desta story).
- [`apps/web/src/components/setup/SetupWizard.tsx:670-695`](../../../apps/web/src/components/setup/SetupWizard.tsx) — bloco `step === 'class'` com `char-name`/`char-gender`: o que se move para `step === 'identity'`.
- [`apps/web/src/components/setup/SetupWizard.tsx:432-442`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `canAdvance`, `case 'class'`: a condição que se divide em `'identity'` + `'class'`.
- [`apps/web/src/lib/api.ts:61-63`](../../../apps/web/src/lib/api.ts) — `createCharacter`: onde `alignment` entra ao lado de `gender` no tipo do payload.
- [`apps/api/src/character/character.schema.ts:23`](../../../apps/api/src/character/character.schema.ts) — `CreateCharacterSchema.gender`: onde `alignment` entra como irmão opcional.
- [`apps/api/prisma/schema.prisma`](../../../apps/api/prisma/schema.prisma) — `model Character`, `gender String`: onde `alignment String?`, `appearance String?` e `personality String?` entram ao lado.
- [`apps/api/src/character/character.schema.ts:64-76`](../../../apps/api/src/character/character.schema.ts) — `background.story`: o precedente direto de texto livre opcional (max length, sem catálogo) que `appearance`/`personality` copiam.
- [`packages/ai-engine/src/prompts/dm-system.ts:497-498`](../../../packages/ai-engine/src/prompts/dm-system.ts) — seção *Gender Agreement*: o precedente de campo de identidade que já chega ao Mestre — `alignment` **não** entra aqui nesta story (ver *Fora do escopo*).
- [US-98](./US-98-i18n-da-interface-web.md) — o padrão valor-canônico-pt-BR/rótulo-traduzido que `gender` segue; `alignment` NÃO segue mais desde a *Revisão de fonte (2026-09-07)* (ver US-47/US-54 acima).
- [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) §Escopo — a decisão que esta story reabre.
