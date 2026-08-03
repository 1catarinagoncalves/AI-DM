# ADR 009 — Regra de uso do SRD: união do 5.1 e do 5.2, com o 5.2 vencendo

**Status:** Aceito
**Data:** 2026-08-02
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 004 — Origem do dado de sistema](./004-origem-do-dado-de-sistema.md) (**este ADR o estende**: o pipeline e o pin continuam; muda de *quais* documentos ele lê) · [ADR 003 — Sistemas como dado](./003-sistemas-como-dado.md) (catálogo é dado) · [ADR 005 — Locale como dimensão](./005-locale-como-dimensao.md) (a chave canônica é EN; o overlay pt-BR é indexado por ela) · [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md) (o pipeline `sync`+`ingest`) · [US-105](../sdlc/01-requisitos/US-105-raca-e-classe-por-chave-do-srd.md) (o primeiro cliente: espécies)

---

## 1. Contexto

O [ADR 004](./004-origem-do-dado-de-sistema.md) escolheu o Open5e pinado em `v2.1.0` como origem do dado do D&D 5e, e leu **um** documento: `data/v2/wizards-of-the-coast/srd-2024/` (SRD 5.2). `System.version` do D&D passou de `'5.1'` para `'5.2'` ([`seed.ts:436`](../../apps/api/prisma/seed.ts)).

A [US-105](../sdlc/01-requisitos/US-105-raca-e-classe-por-chave-do-srd.md) esbarrou no custo dessa escolha. O `SetupWizard` oferece Meio-Elfo e Meio-Orc; a edição 2024 as retirou. Ao procurar a fonte, apareceu o fato que motiva este ADR: **`srd-2014/` é irmão de `srd-2024/` no mesmo repositório, no mesmo tag pinado.** Não é outra dependência, outro download, nem outra licença a auditar — é um diretório ao lado, já coberto pelo pin.

E o bump de edição deixou rastro: as **duas** features órfãs do overlay pt-BR curado hoje — `paladin_divine-sense` e `ranger_natural-explorer`, registradas no `_comment` de [`locale/pt-BR.json`](../../scripts/srd/locale/pt-BR.json) — são exatamente conteúdo que existe no 5.1 e sumiu no 5.2. O overlay foi semeado do `seed.ts` da era 5.1; o bump as transformou em tradução curada sem dono. Elas não são erro de curadoria: são a edição anterior batendo na porta.

Falta uma regra geral. "Ler o 5.1 também" precisa valer para todo domínio, não virar exceção pontual de espécie.

---

## 2. Decisão

**A fonte do dado de sistema do D&D 5e é a UNIÃO dos dois SRD do tag pinado — `srd-2024` (5.2) e `srd-2014` (5.1) — com o 5.2 vencendo sempre que os dois descreverem a mesma coisa.**

### D1 — União, para todos os domínios

O `sync` baixa os dois documentos; o `ingest` os funde antes de derivar qualquer campo do `SystemConfig`. A regra é geral por princípio: uma decisão "vale para espécie mas não para magia" vira exceção que ninguém lembra no próximo bump.

### D2 — Precedência: 2024 primeiro, 2014 só preenche buraco

Carrega-se o `srd-2024` inteiro; do `srd-2014` entra **apenas a chave que ainda não existe**. Nunca o inverso, nunca merge campo a campo. Consequência direta: onde as duas edições têm o mesmo conceito, o jogador recebe o texto e as regras da **edição corrente**, e o 5.1 é invisível.

### D3 — "A mesma coisa" exige mapa de equivalência, porque a chave não basta

Esta é a parte que a medição (§4) tornou obrigatória. Entre as edições, **conceito idêntico frequentemente mudou de slug**: `draconic-bloodline` → `draconic-sorcery`, `cleric_divine-domain` → `cleric_divine-order`, `bard_cantrips-known` → `bard_cantrips`. Precedência por chave crua não detecta isso e **duplicaria o conceito**, servindo as duas edições ao mesmo personagem.

Logo, o `ingest` mantém um **`SRD_EQUIVALENTS` explícito** — pares `chave-2014 → chave-2024` — aplicado ao normalizar o `pk` do 5.1 **antes** do teste de precedência. Uma chave 2014 com equivalente conhecido é descartada como duplicata; sem equivalente, entra.

O mapa é escrito à mão e falha alto: como o `CLASS_MAP` ([ADR 004](./004-origem-do-dado-de-sistema.md) §3), a rigidez é a feature. Um bump que renomeie mais coisas produz duplicata **visível no diff do artefato**, não um personagem com duas edições dentro.

### D4 — Licença: só a via CC-BY-4.0; OGL 1.0a continua barrado

`srd-2014/Document.json` declara `licenses: ["cc-by-40", "ogl-10a"]` — dual. Usa-se **a via CC-BY-4.0**, a mesma do 5.2, mantendo intacta a regra de licença única do [ADR 004](./004-origem-do-dado-de-sistema.md). O [`NOTICE-open5e.md`](../../scripts/srd/NOTICE-open5e.md) passa a atribuir os **dois** documentos, e continua verdadeira a frase "nenhum material OGL 1.0a entra aqui".

### D5 — `System.version` continua `'5.2'`

`version` declara a **edição de regras de referência**, não o inventário. O catálogo pode conter entradas do 5.1 que o 5.2 não substituiu; a proveniência de cada uma fica no `NOTICE` e, onde o domínio pedir (espécies), num campo de origem no próprio catálogo.

---

## 3. Decisões-chave e justificativas

1. **Por que a união e não "só a edição corrente".** O SRD 5.2 é o corte editorial da WotC, não o do nosso produto. Retirar Meio-Elfo e Meio-Orc de um jogo de RPG porque uma revisão de regras os moveu para outro livro é deixar a política editorial de terceiro decidir a ficha do jogador. A união custa uma regra de precedência; a alternativa custa opções de personagem e fichas migradas para lugar nenhum.
2. **Por que o 2024 vence, e não "o mais completo".** Precisa haver um vencedor fixo, escolhido antes de ver o caso. "O mais completo" é julgamento por entrada, ou seja, 300 julgamentos e nenhuma regra.
3. **Por que o mapa de equivalência é explícito e não heurístico.** Casar `cantrips-known` com `cantrips` por prefixo funciona nos seis casos medidos e falha no primeiro slug que só *parece* prefixo. Doze linhas escritas à mão valem menos que uma normalização esperta que engole conteúdo em silêncio.
4. **Por que a regra é geral mesmo rendendo pouco em vários domínios.** A medição (§4) mostra que a união acrescenta 2 espécies e 2 magias, e zero classes. O ganho é pequeno **hoje** — mas a regra existe para o próximo domínio ingerido (o corpus do `getRule` da US-48, feitos, itens) e para o próximo bump de tag, quando outro conteúdo sair da edição corrente. Regra geral escrita uma vez > exceção redescoberta a cada story.

---

## 4. O que a medição mostrou

Medido em 02/08/2026 no tag `v2.1.0`, comparando por slug sem o prefixo do documento (`srd_x` vs `srd-2024_x`):

| Domínio | 5.1 | 5.2 | comuns | só 5.1 | só 5.2 | **ganho real da união** |
|---|---:|---:|---:|---:|---:|---|
| `Species` (raiz) | 9 | 9 | 7 | 2 | 2 | **+2** — `half-elf`, `half-orc` |
| `Spell` | 319 | 339 | 317 | 2 | 22 | **+2** — `branding-smite`, `feeblemind` |
| `CharacterClass` (base) | 12 | 12 | 12 | 0 | 0 | **0** — idênticas |
| `CharacterClass` (subclasse) | 12 | 12 | 8 | 4 | 4 | **0** — são as mesmas 4, renomeadas |
| `ClassFeature` nível 1 | 62 | 77 | 41 | 21 | 36 | **negativo sem o `SRD_EQUIVALENTS`** |

**As subclasses são a prova do D3.** Os quatro pares — `draconic-bloodline`/`draconic-sorcery`, `school-of-evocation`/`evoker`, `the-fiend`/`fiend-patron`, `way-of-the-open-hand`/`warrior-of-the-open-hand` — são o mesmo conceito com nome novo. União por chave crua produziria **oito subclasses onde existem quatro**.

**As features são o caso mais duro.** Só 41 das 62 do 5.1 casam por slug. Classificando as 21 restantes por inspeção do slug:

- **7 são de subclasse** (`life-domain_*`, `draconic-bloodline_*`, `the-fiend_*`) — o `ingest` já as descarta, porque deriva só classe base.
- **6 são `*_cantrips-known`**, renomeadas para `*_cantrips` no 5.2.
- **3 são `*_spells-known`**, renomeadas para `*_prepared-spells`.
- **3 são o slot de subclasse renomeado**: `cleric_divine-domain` → `divine-order`, `sorcerer_sorcerous-origin`, `warlock_otherworldly-patron`.
- **2 são conteúdo que a edição 2024 retirou de fato**: `paladin_divine-sense` e `ranger_natural-explorer`.

Ou seja: **12 das 14 features de classe base "exclusivas do 5.1" são renomeação**, não conteúdo. Sem o `SRD_EQUIVALENTS`, a união daria a todo conjurador duas entradas de "truques conhecidos" e ao clérigo dois slots de subclasse.

E os 2 que sobram fecham o círculo do §1: são as duas órfãs do overlay pt-BR, **que voltam a ter dono e já chegam traduzidas**.

**O que a união NÃO resolve.** As 7 magias órfãs do overlay (`friends`, `thorn-whip`, `toll-the-dead`, `mind-sliver`, `thunderclap`, `blade-ward`, `word-of-radiance`) **não estão em nenhum dos dois SRD** — verificado uma a uma. Vieram de livros que não são SRD; continuam órfãs e continuam sendo relatadas pelo `ingest`. A união reconcilia o que o bump de edição quebrou, não o que nunca foi SRD.

---

## 5. Alternativas rejeitadas

- **Só o 5.2 (o que valia até aqui).** Simples e coerente com `version: '5.2'`, mas tira duas raças clássicas do jogador e deixa fichas existentes sem chave de destino. Rejeitada em [US-105](../sdlc/01-requisitos/US-105-raca-e-classe-por-chave-do-srd.md) → *Questões em aberto* #1.
- **Só o 5.1.** Mais material em alguns eixos, mas é a edição anterior: perde-se Weapon Mastery, as 22 magias novas e a estrutura que o `config` já ingeriu. Andar para trás.
- **União com merge campo a campo** (pegar a descrição mais longa, o campo não-vazio de cada lado). Produz entrada que não existe em edição nenhuma — regra de mesa Frankenstein, impossível de citar como fonte.
- **União sem mapa de equivalência**, resolvendo duplicata na exibição. Empurra o problema para cada consumidor (ficha, prompt, tool) em vez de resolvê-lo uma vez na ingestão, que é o lugar onde o dado é dado.
- **Puxar o 5.1 via OGL 1.0a.** Desnecessário — o documento é dual-licenciado e a via CC-BY serve. Aceitar OGL quebraria a regra de licença única do ADR 004 sem ganho nenhum.

---

## 6. Consequências

**Positivas**
- Meio-Elfo e Meio-Orc voltam com fonte citável; Goliath e Orc entram. 11 espécies contra as 9 de qualquer edição isolada.
- As duas features órfãs do overlay pt-BR ganham dono, com a tradução curada que já existe.
- Uma regra escrita para todo domínio futuro, em vez de uma decisão por story.
- Custo de dependência: **zero**. Mesmo repositório, mesmo tag, mesma licença.

**Negativas / riscos**
- **O `SRD_EQUIVALENTS` é manutenção manual** e é o ponto único de falha do desenho: um par esquecido vira conteúdo duplicado servido ao jogador. Mitigação: o artefato é versionado e determinístico — duplicata aparece no diff do PR de bump.
- **Duas edições no mesmo catálogo divergem em mecânica.** O caso concreto medido: `srd-2014/SpeciesTrait.json` tem 93 traços contra 51 do 5.2, e `Ability Score Increase` por espécie (half-elf: +2 Carisma) **só existe no 5.1** — o 5.2 moveu bônus de atributo para o antecedente. **Enquanto o catálogo for só rótulo, não há mecânica para divergir**; a story que ingerir traços de espécie herda essa decisão e precisa resolvê-la de frente.
- `System.version = '5.2'` passa a ser uma meia-verdade útil (ver D5). Quem auditar proveniência lê o `NOTICE`, não o campo.
- O `sync` baixa cerca do dobro de arquivos por domínio ingerido. Irrelevante: o `_data/` é gitignored e o download é local.

---

## 7. Implementação (referência)

- [`scripts/srd/sync.mjs`](../../scripts/srd/sync.mjs) — a lista `FILES` ganha o par `srd-2014` de cada arquivo ingerido; `TAG` continua uma só, para os dois.
- [`scripts/srd/ingest.mjs`](../../scripts/srd/ingest.mjs) — normalização do `pk` por documento, `SRD_EQUIVALENTS`, e a fusão com precedência antes das funções `build*`. O `CLASS_MAP` existente é o precedente de estilo: mapa explícito que falha alto.
- [`scripts/srd/NOTICE-open5e.md`](../../scripts/srd/NOTICE-open5e.md) — atribuição dos dois documentos, pela via CC-BY-4.0 dos dois.
- [`scripts/srd/locale/pt-BR.json`](../../scripts/srd/locale/pt-BR.json) — as duas features órfãs deixam de ser órfãs; o `_comment` registra a mudança.
- [US-105](../sdlc/01-requisitos/US-105-raca-e-classe-por-chave-do-srd.md) — primeiro cliente da regra (espécies). É ela que constrói a fusão; os demais domínios a herdam.
