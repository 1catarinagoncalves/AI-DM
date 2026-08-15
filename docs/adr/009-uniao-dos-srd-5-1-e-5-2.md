# ADR 009 — Regra de uso do SRD: união do 5.1 e do 5.2, com o 5.2 vencendo

**Status:** Aceito · **precedência revista em 15/08/2026** (o SRD 5.1 vira a fonte de referência — ver §8) · **abertas do §8 fechadas em 15/08/2026 pela US-138** (`races` — ver §9) **e pela US-139** (`classes`/`classFeatures`/`classSpells`/`startingKits`, Marshal do a5e-ag — ver §10)
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

**A regra é geral; a instalação é por domínio.** Cada domínio entra na fusão quando uma story o liga — baixando o par 2014 daquele arquivo no `sync` e preenchendo o `SRD_EQUIVALENTS` do domínio. Hoje só `races` está ligado (US-105, ver §7). Ler este ADR não diz o que está no catálogo; isso se lê no artefato.

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

Medido em 02/08/2026 no tag `v2.1.0`, comparando por slug sem o prefixo do documento (`srd_x` vs `srd-2024_x`).

**A tabela mede o dataset, não o artefato.** O `ingest` deriva uma fatia dele (magia só até o 1º nível, feature só de classe base e nível 1), então ganho aqui não é ganho no `config` — a coluna da direita marca onde os dois números divergem. Quem quiser saber o que está no catálogo lê o artefato.

| Domínio | 5.1 | 5.2 | comuns | só 5.1 | só 5.2 | **ganho real da união** |
|---|---:|---:|---:|---:|---:|---|
| `Species` (raiz) | 9 | 9 | 7 | 2 | 2 | **+2** — `half-elf`, `half-orc` |
| `Spell` | 319 | 339 | 317 | 2 | 22 | **+2** no dataset — `branding-smite` (nível 2), `feeblemind` (nível 8); **0 no artefato**, porque o `ingest` corta em `level > 1` (confirmado em 03/08/2026) |
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
- As duas features órfãs do overlay pt-BR ganham dono, com a tradução curada que já existe — **quando o domínio de feature for ligado à fusão**, que não é a US-105 (ver §7). Até lá elas seguem fora do artefato, e quem precisar delas as trata como autorais ([ADR 004 §3.1](./004-origem-do-dado-de-sistema.md), 6f).
- Uma regra escrita para todo domínio futuro, em vez de uma decisão por story. **Escrita, não instalada:** cada domínio passa a valer no dia em que uma story ligar a fusão a ele. Consequência de ADR descreve o mundo depois da implementação; o que está no catálogo hoje se lê no artefato, não aqui.
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
- [`scripts/srd/locale/pt-BR.json`](../../scripts/srd/locale/pt-BR.json) — as duas features órfãs deixam de ser órfãs **na story que ligar `classFeatures` à fusão**; é ela que atualiza o `_comment`.
- [US-105](../sdlc/01-requisitos/US-105-raca-e-classe-por-chave-do-srd.md) — primeiro cliente da regra. Construiu o mecanismo e o aplicou **só a `races`** (`buildRaces`, com `species2014`): `sync` baixa o par 2014 apenas de `Species.json`, e `buildClassFeatures`/`buildClassSpells` continuam lendo só o 5.2. Domínio não herda a fusão sozinho — **é ligado um a um, por uma story**, e ligar `classFeatures` custa mais que uma linha: exige baixar o par 2014 de feature **e** preencher o `SRD_EQUIVALENTS`, porque 12 das 14 features "exclusivas do 5.1" são renomeação (§4) e fundir sem o mapa duplica em vez de deduplicar. Estado de hoje, medido em 03/08/2026: 11 espécies vindas da união; `classFeatures` com 24 entradas, todas 5.2.

---

## 8. Revisão da precedência (15/08/2026): o SRD 5.1 (2014) passa a ser a fonte de referência

**Contexto.** D2 e §4 mediam disponibilidade *dentro* do SRD dual — não o ecossistema de conteúdo de terceiros ao redor dele. Olhando o seletor de fontes do Open5e (a lista completa de publishers que o `open5e-api` agrega, não só a Wizards of the Coast), ficou visível que a maior parte do conteúdo extra hospedado ali — os livros de *Level Up: Advanced 5th Edition* (EN Publishing) e o *Spells That Don't Suck* (Somanyrobots, marcado explicitamente `5e 2014` no próprio seletor) — é compatível com as regras de 2014, não com a revisão de 2024. Manter o 5.2 como vencedor (D2) deixa esse material ao lado da edição de referência, em vez de dentro dela.

**Decisão.** A edição de referência do AI DM passa a ser o **SRD 5.1 (2014)**. Por hora, o SRD 5.2 (2024) sai de escopo — não é mais consultado nem para preencher lacuna; a leitura da §2 ("união com o 5.2 vencendo") fica suspensa enquanto esta revisão valer. `D1`, `D3` e `D4` continuam descrevendo o desenho do pipeline (fusão geral por domínio, mapa de equivalência, licença única); o que muda é qual documento é o vencedor por padrão, invertendo `D2`.

**Escopo das fontes, por hora.** Registrado a partir do seletor de fontes do Open5e, na tela consultada em 15/08/2026:

| Publisher | Documento | Em escopo? |
|---|---|---|
| Wizards of the Coast | SRD 5.1 (`srd-2014`) | Sim — fonte de referência |
| Wizards of the Coast | SRD 5.2 (`srd-2024`) | Não, por hora |
| EN Publishing | Adventurer's Guide (`a5e-ag`) | Sim — já ingerido (backgrounds, [ADR 004 §3.3](./004-origem-do-dado-de-sistema.md)) |
| EN Publishing | Dungeon Delver's Guide (`a5e-ddg`) | Sim — ainda não ingerido |
| EN Publishing | Gate Pass Gazette (`a5e-gpg`) | Sim — ainda não ingerido |
| EN Publishing | Monstrous Menagerie (`a5e-mm`) | Não, por hora |
| Somanyrobots | Spells That Don't Suck | Sim — ainda não ingerido |
| Kobold Press | (12 documentos) | Não, por hora |
| Open5e (própria) | (2 documentos) | Não, por hora |
| Green Ronin Publishing | (1 documento) | Não, por hora |

"Em escopo" aqui é decisão de produto, não instalação: como em D1, a fonte entra no pipeline quando uma story a ligar. `a5e-ddg`, `a5e-gpg` e o *Spells That Don't Suck* ainda não têm entrada em `sync.mjs`/`ingest.mjs` — permanecem candidatos até a primeira story que os consumir.

**O que fica em aberto.** Esta revisão não resolve:
- se o `System.version` (hoje `'5.2'`, ver D5) volta para `'5.1'` ou passa a descrever outra coisa;
- se o pipeline muda de fato a precedência (5.1 vence, 5.2 preenche buraco) ou se o 5.1 vira a **única** fonte WotC consultada, já que o 5.2 saiu de escopo — nesse caso não há mais união a fazer no lado WotC;
- a licença dos documentos novos (`a5e-ddg`, `a5e-gpg`, Spells That Don't Suck) — presume-se a mesma via CC-BY-4.0 do `a5e-ag` ([ADR 004 §3.3](./004-origem-do-dado-de-sistema.md)) até prova em contrário, mas cada um precisa da checagem de `Document.json` que o `a5e-ag` recebeu antes de entrar.

Fica para a story que ligar cada fonte nova.

---

## 9. Fechamento das duas perguntas do §8 — US-138 implementada (15/08/2026)

A [US-138](../sdlc/01-requisitos/US-138-catalogo-racas-srd-5-1-como-referencia.md) implementou a revisão do §8 para `races` e fecha as duas perguntas que o §8 deixava em aberto:

**"5.1 vence com 5.2 preenchendo buraco, ou 5.1 vira a única fonte?"** — para `races`: **única fonte**. `buildRaces` ([`ingest.mjs`](../../scripts/srd/ingest.mjs)) deixou de chamar `mergeEditions`; deriva `config.races` só de `srd-2014/Species.json`. O `sync` não baixa mais `srd-2024/Species.json` — nada mais o consome. Não é "5.1 vence, 5.2 preenche": é 5.2 fora do domínio inteiro. Fica em aberto ainda para os domínios que a US-139 vai ligar (`classFeatures`, `classSpells`) — a mesma pergunta pode ter resposta diferente lá.

**"`System.version` volta pra `'5.1'`?"** — decidido `'5.1'` como valor final, mas **não aplicado por esta story**: o campo (`apps/api/prisma/seed.ts:132,136`) continua `'5.2'` porque `classFeatures`/`classSpells` ainda vêm do 5.2 (US-139 não implementada). Mudar agora deixaria o campo mentindo na direção oposta à do §6 negativo original. Aplica quando US-139 fechar o mesmo trio de fontes.

**Correção ao §6 e §7.** A consequência positiva do §6 ("Meio-Elfo e Meio-Orc voltam... Goliath e Orc entram. 11 espécies contra as 9 de qualquer edição isolada") e o "Estado de hoje" do §7 ("11 espécies vindas da união") descreviam o efeito de D2 (2024 vence, 5.1 preenche buraco) — **revertido para `races`** por esta implementação. Estado atual, medido em 15/08/2026 (artefatos `en-US`/`pt-BR` e `System.config` no banco, via query direta): **9 raízes**, todas do 5.1 — `dragonborn`, `dwarf`, `elf`, `gnome`, `halfling`, `half-elf`, `half-orc`, `human`, `tiefling`. `goliath`/`orc` não têm mais fonte no escopo atual (ver §8, tabela de publishers — nenhum dos documentos novos tem `Species.json`) e não aparecem no catálogo. §6/§7 ficam como registro histórico da decisão original (D2); não foram reescritos.

**Overlay pt-BR:** `goliath`/`orc` continuam curados em [`locale/pt-BR.json`](../../scripts/srd/locale/pt-BR.json) — não apagados, mas passaram a aparecer no relatório `ÓRFÃOS` do `ingest` (domínio `races` entrou no loop de detecção, que antes não cobria esse domínio porque a união sempre consumia as 11 chaves do overlay).

---

## 10. Fechamento do §8 pro trio que sobrava — US-139 implementada (15/08/2026)

A [US-139](../sdlc/01-requisitos/US-139-catalogo-classes-marshal-a5e-adventurers-guide.md)
fecha, pro último trio que o §8/§9 deixavam em aberto (`classes`/`classFeatures`/`classSpells`/
`startingKits`), as mesmas duas perguntas que a US-138 já tinha fechado pra `races`.

**"5.1 vence com 5.2 preenchendo buraco, ou 5.1 vira a única fonte?"** — **única fonte**, mesma
resposta da US-138. `buildClasses`/`buildClassFeatures`/`buildClassSpells`/`buildStartingKits`
([`ingest.mjs`](../../scripts/srd/ingest.mjs)) nunca chamaram `mergeEditions` de verdade (§9 já
registrava isso) — não houve reversão de MECANISMO, só de FONTE: `CharacterClass.json`,
`ClassFeature.json`, `ClassFeatureItem.json` e `Spell.json` locais (`sync.mjs`) viram os do
`srd-2014`; o par 5.2 sai do `sync` por completo, nenhum dos quatro campos o lê mais.
`mergeEditions`/`SRD_EQUIVALENTS` ficaram sem NENHUM caller de produção (o último era
`buildRaces`, já cortado pela US-138) — removidos nesta story, não só deixados mortos.

**"`System.version` volta pra `'5.1'`?"** — **sim, aplicado**. `apps/api/prisma/seed.ts:132,136`
muda de `'5.2'` pra `'5.1'` nesta story — o adiamento que o §9 registrava ("aplica quando US-139
fechar o mesmo trio de fontes") se resolve aqui. Com `races`+`classFeatures`+`classSpells` todos
no 5.1, só o texto normativo (`Rule.json`/`ability-modifiers.srd-2024.json`, US-108/US-110, fora
do escopo das duas stories) segue ancorado no 5.2 — campo sem consumidor de runtime hoje (US-105
§6g), não bloqueia.

**A 13ª classe.** `a5e-ag/CharacterClass.json` tem uma classe base fora do SRD — **Marshal**
(`a5e_marshal`), com três subclasses excluídas pelo mesmo filtro `subclass_of !== null` que já
corta subclasse SRD (fica pra [US-141](../sdlc/01-requisitos/US-141-catalogo-subclasses-srd-5-1-e-marshal.md)).
Classe marcial, sem conjuração — não entra em `config.classSpells`. Medido no artefato real de
15/08/2026: **13 classes** (`config.classes`), **21 entradas de `classFeatures`** (2 do Marshal:
*Commanding Presence*, *Rallying Surge* — as outras 32 de 34 brutas são ruído de tabela/nível>1),
**73 magias distintas** de nível ≤1 em `classSpells` (nenhuma do Marshal).

**Achado fora do §8: o formato de equipamento inicial também mudou.** O §8 não previu isso — só
falava de features/magias. O 5.2 guardava o kit numa linha de tabela markdown
(`feature_type: 'CORE_TRAITS_TABLE'`); o 5.1 **e** o a5e-ag usam outro tipo,
`STARTING_EQUIPMENT`, com texto em prosa (bullets `(*a*)/(*b*)` no SRD, pacotes nomeados
alternativos no Marshal) — parser antigo (`parseStartingKit`) não lia nem um nem outro; foi
removido junto com os campos que ele consumia (`PDF_SPLITS`). Consequência de conteúdo: o
`kitItems` do overlay pt-BR, curado pro texto de tabela do 5.2, não casa mais com as chaves cruas
novas — pendência de curadoria registrada na US-139 (mesmo padrão da US-134 pra `tools`: fora de
`MT_DOMAINS`, gate é `--strict`, não bloqueia build normal).
