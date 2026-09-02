# US-203 — Prosa curta de catálogo: chamada e resumo de classe e de raça

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada (02/09/2026)
**Depende de:** [US-105](./US-105-raca-e-classe-por-chave-do-srd.md) — o catálogo por chave é onde a prosa se pendura. [US-138](./US-138-catalogo-racas-srd-5-1-como-referencia.md)/[US-140](./US-140-catalogo-subracas-srd-5-1.md) definem quais raças existem. [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) (**obrigatória e anterior**) — `config.subclasses` é onde a prosa de subclasse se pendura; sem `config.subclasses` existindo não há `{key,label}` de subclasse para estender com `kicker`/`blurb`. Decisão de 2026-09-02: subclasse deixou de ser "fora do escopo" nesta story e na US-205, então US-141 entra na ordem de execução, antes das duas.
**Criada em:** 2026-09-01

**Relacionada a:**
- [backlog-redesenho-criacao-de-personagem.md](./backlog-redesenho-criacao-de-personagem.md) — o mapa das diferenças; esta é a primeira story dele.
- [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) — a consumidora: sem esta story, o cartão é um `<select>` com mais espaço em volta. Desde 2026-09-02 também consome a prosa de subclasse, na subgrade aninhada na etapa de classe.
- [US-47](./US-47-ingestao-srd-como-dado.md) — o pipeline `sync`+`ingest` e o overlay pt-BR onde o texto novo entra.
- [US-99](./US-99-config-do-sistema-no-locale-ativo.md) — `configLocales[locale] ?? config`: a prosa nova segue a mesma resolução por locale de tudo o resto.

---

## História

> **Como** jogadora escolhendo classe e raça pela primeira vez,
> **quero** ler, ali na tela, o que cada uma **é** e como é **jogar** com ela,
> **para que** eu escolha por interesse e não por qual nome me soa familiar.

---

## Contexto e motivação

### O problema observado

A escolha de classe e raça é hoje um `<select>` com uma palavra por linha
([`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx), etapa `race-class`):
`Bárbaro`, `Bardo`, `Clérigo`… Quem nunca jogou 5e escolhe às cegas, e a correção custa caro — a
classe determina kit inicial (US-51), features (US-41) e magias conhecidas (US-42).

### Por que a solução atual não basta

O catálogo **não tem onde guardar** essa prosa. `SystemCatalogEntrySchema`
([`system.ts`](../../../packages/shared/src/types/system.ts)) é exatamente `{ key, label }`, e
`RaceCatalogEntrySchema` acrescenta só `parentKey`. O texto que existe no config é de outra
natureza:

- `classFeatures` — mecânica de nível 1, por classe (US-41). É o que a personagem **sabe fazer**,
  em linguagem de regra; não responde "como é jogar de bárbaro".
- `raceFeatures` — os traços do SRD 2014, por raça (US-142). Mesma coisa: `Ability Score
  Increase`, `Speed`, `Darkvision`. Serve no cartão como **lista de traços**, não como chamada.

E o dataset a montante só ajuda pela metade (medido em `scripts/srd/_data/`, 01/09/2026):

| Fonte | Tem | Não tem |
|---|---|---|
| `Species.json` / `Species.2014.json` | `desc` — uma frase por espécie ("Your draconic heritage manifests in a variety of traits you share with other dragonborn.") | chamada curta |
| `CharacterClass.json` (24 entradas) | `hit_dice`, `saving_throws` | **`desc` não existe**, e `primary_abilities` vem **`[]` nas 24** |

Ou seja: a raça tem uma frase de graça, a classe não tem nada. E `primary_abilities` vazio
significa que o selo `Principal` do protótipo
([US-207](./US-207-atributos-e-pericias-com-orcamento-visivel.md)) também não tem fonte no
dataset — sai daqui ou não sai de lugar nenhum.

### A proposta

Dois campos opcionais de prosa curta no catálogo de classe, raça **e subclasse** — uma **chamada**
de três a seis palavras e um **resumo** de uma a duas frases — mais, só para classe, a lista de
**atributos principais**. Curados por nós no overlay, pelo mesmo mecanismo que já traduz os
rótulos, e resolvidos por locale como todo o resto do config.

**Nenhuma das três grades tem busca.** Classes, raças e subclasses aparecem todas, sempre — quem
nunca jogou 5e não sabe que nome procurar, e um filtro por rótulo não ajuda a escolher entre nomes
que não significam nada para quem lê. Isso muda o teto de qualidade da curadoria: `kicker` e
`blurb` não são adorno de um `<select>` melhorado, são o **único** texto que separa um cartão do
vizinho numa varredura de 13 (classe) ou 9 (raça, contando só as selecionáveis). Precisam de
discriminar entre opções próximas (guerreiro / paladino / bárbaro; anão-da-colina / anão-da-
montanha), não só descrever cada uma isolada. (O protótipo tem `Buscar classe…`/`Buscar espécie…`;
a US-205 põe busca inteiramente fora do escopo, nas três grades.)

### Subclasse entra pela mesma porta, com uma dobra: quase nunca há irmã pra discriminar

O par classe/subclasse **não** é simétrico ao par raça/subespécie. Das 13 classes que a US-141
cataloga, **12 têm exatamente uma subclasse** — só `marshal` tem três (`Gambling General`, `Swift
Strategist`, `Talented Tactician`). Isso muda o trabalho do `kicker`/`blurb` de subclasse: nas 12
sem irmã, a prosa não precisa discriminar nada (não há o que comparar dentro da mesma classe) —
o papel dela é dizer **como aquele arquétipo específico se sente jogando**, complementando o
`blurb` da classe-mãe em vez de competir com opções ao lado. Só nas 3 do Marshal o `kicker`/`blurb`
volta a ter o trabalho de discriminação que classe e raça já têm. `CharacterClass.desc` (a mesma
fonte que falta para classe, US-141 §Contexto) confirma vazio nas 15 entradas — subclasse não tem
nem a semente parcial que raça tem (`Species.desc`); é copy 100% autoral, como classe.

Decisão de produto (US-141 §Fora do escopo): toda subclasse é tratada como escolhida no **nível
1**, sem exceção de classe — a regra oficial varia (1 para Clérigo/Feiticeiro/Bruxo, 3 para as
outras), mas o produto simplifica. Para a curadoria, isso significa **não escrever** "a partir do
nível 3, você se torna…" nem qualquer variação por nível no `blurb` — o texto descreve o arquétipo
como algo que a personagem já é desde a criação, igual a classe e raça.

---

## Escopo

### Dentro do escopo

- **`kicker` e `blurb` opcionais** em `SystemCatalogEntrySchema` — servem `races`, `classes` **e
  `subclasses`** de uma vez, pelo mesmo motivo que o schema hoje já serve `races`/`classes`: a
  US-141 reusa o mesmo `SystemCatalogEntrySchema` dentro de `config.subclasses`
  (`Record<classKey, SystemCatalogEntrySchema[]>`), então os dois campos chegam de graça em
  subclasse assim que as duas stories existirem — nenhum schema novo para subclasse.
- **`primary` opcional** (array de chaves de atributo) só em `classes`. É o que acende o selo
  `Principal` na etapa de atributos. Subclasse não ganha `primary` — o atributo principal já é da
  classe-mãe, repetir por subclasse seria o mesmo dado 15 vezes.
- **Curadoria das 13 classes, das 13 raças e das 15 subclasses** (12 SRD 5.1 + 3 Marshal, US-141)
  do sistema `srd-5e`, em **pt-BR e en-US**. Texto autoral: 41 chamadas e 41 resumos.
- **`blurb` de raça semeado do `Species.desc`** do dataset quando existir, e revisto à mão. A
  frase crua do SRD é semente, não produto final.
- **Overlay ganha forma de objeto** para `races`/`classes` em
  [`scripts/srd/locale/pt-BR.json`](../../../scripts/srd/locale/pt-BR.json), hoje `key → string`.
  Entrada em string continua válida e significa "só o rótulo" — nenhuma entrada existente muda.
- **Campos opcionais em todo o caminho:** schema, ingest, seed e tela toleram ausência. O sistema
  `Free` (que não vem do ingest) e um sistema de `UPLOAD` continuam a funcionar sem uma linha nova.

### Fora do escopo

- **Arte por classe/raça.** O cartão reserva o espaço
  ([US-205](./US-205-escolha-por-cartao-classe-e-raca.md)); produzir 26 imagens consistentes é
  trabalho de asset com orçamento próprio
  ([direção visual](../02-design/direcao-visual-anti-slop.md) §5).
- **Prosa de origem.** Os backgrounds já têm `benefits[].description` do A5E (US-121) — ali sobra
  prosa, não falta. O cartão de origem
  ([US-206](./US-206-origem-por-cartao-e-campos-livres-de-historia.md)) usa o que já existe.
- **Trazer `hit_dice` e `saving_throws` para o config.** Existem no dataset e não são ingeridos
  hoje; são mecânica (dado de vida, salvaguardas), não copy de escolha. Story própria — e é ela
  que destrava a seção "Salvaguardas" do protótipo, que esta não promete.
- **Tradução automática (`_mt`).** É para descrição de feature/magia em volume; 41 chamadas
  curadas à mão são o produto aqui.

---

## Modelo de dados proposto

```json
{
  "classes": [
    {
      "key": "barbarian",
      "label": "Bárbaro",
      "kicker": "Fúria e couro",
      "blurb": "Entra na frente, aguenta o que vier e bate mais forte quanto pior a situação fica. Pouca conversa, muita presença física.",
      "primary": ["strength", "constitution"]
    }
  ],
  "races": [
    {
      "key": "dragonborn",
      "label": "Dragonborn",
      "kicker": "Herança de dragão",
      "blurb": "Sangue dracônico à vista: escamas, sopro elemental e uma reputação que chega antes de você."
    }
  ],
  "subclasses": {
    "fighter": [
      {
        "key": "champion",
        "label": "Campeão",
        "kicker": "Simples e implacável",
        "blurb": "Menos truque, mais fio de espada: acerta crítico com mais frequência e é bom em quase tudo que exige o corpo."
      }
    ],
    "marshal": [
      { "key": "gambling-general", "label": "General Apostador", "kicker": "Aposta alta, comando maior", "blurb": "Cada nível oferece uma aposta: penalidade no ataque por mais dano, ou segurança trocada por vantagem. Comanda tropas dispostas a perder terreno para ganhar a rodada." },
      { "key": "swift-strategist", "label": "Estrategista Veloz", "kicker": "Sempre um passo à frente", "blurb": "Empurra o grupo pela velocidade: mais deslocamento, fuga sem provocar ataque, escape de área de efeito. Ninguém do seu esquadrão fica parado no lugar errado." },
      { "key": "talented-tactician", "label": "Tático Talentoso", "kicker": "Vantagem tática, sempre presente", "blurb": "Sustenta o grupo com um dado tático que reforça qualquer ataque aliado, coordenação silenciosa e perícias de campo. Vantagem constante, sem apostar nada." }
    ]
  }
}
```

Curadoria fundamentada no `desc` real de cada subclasse (`scripts/srd/_data/ClassFeature.a5e-ag.json`,
não só no nome): `gambling-general` gira em torno de trocas risco-por-recompensa (*Daring Commander*
penaliza o ataque por mais dano, *Risky Tactics* troca segurança por vantagem); `swift-strategist` é
mobilidade pura (*Skirmisher*, *Make Haste*, *Portentous Escape*); `talented-tactician` é suporte
estável sem risco (dado tático de *Tactical Edge* bonifica qualquer ataque aliado todo turno,
*Operations Leader* coordena o grupo). As três discriminam entre si por identidade mecânica, não só
por adjetivo.

`en-US` (mesmo par, mesmo teto de 200 caracteres):

| `key` | `kicker` | `blurb` |
|---|---|---|
| `gambling-general` | High risk, greater command | Every tier is a gamble: take a penalty to hit for more damage, or trade safety for advantage. Leads troops willing to give ground to win the round. |
| `swift-strategist` | Always one step ahead | Pushes the squad forward on speed: extra movement, disengage without provoking, escape from area effects. No one in your unit gets caught standing still. |
| `talented-tactician` | Tactical edge, always on | Backs the party with a tactics die that boosts any ally's attack, plus quiet coordination and field expertise. Steady advantage, no bets placed. |

`label` en-US é o `name` cru do dataset (`CharacterClass.a5e-ag.json`), sem curadoria — já é nome
próprio em inglês. `label` pt-BR (`gambling-general` → "General Apostador", `swift-strategist` →
"Estrategista Veloz", `talented-tactician` → "Tático Talentoso") segue o mesmo tom de tradução
direta das 12 subclasses SRD já traduzidas (`Champion` → "Campeão", `Life Domain` → "Domínio da
Vida", US-141 §Modelo de dados) — sem trocadilho, sem manter aliteração do inglês à força.

| Campo | Tipo | Descrição |
|---|---|---|
| `kicker` | `string` opcional | Chamada de 3–6 palavras. Aparece acima do nome no cartão, em caixa alta pequena. |
| `blurb` | `string` opcional | 1–2 frases, teto de ~200 caracteres. O corpo do cartão. |
| `primary` | `string[]` opcional | Chaves de `config.attributes`. Só em `classes`. Acende o selo `Principal` na etapa de atributos. |

`config.subclasses` em si **não é desta story** — é o `Record<classKey, SystemCatalogEntrySchema[]>`
que a US-141 propõe. Esta story só estende o `SystemCatalogEntrySchema` que ele reusa; `kicker` e
`blurb` chegam a `subclasses` automaticamente quando as duas existirem, sem tabela de campo própria.

**Persistência:** nenhuma tabela nova, nenhuma migração. Entram em `System.config` (base EN) e em
`System.configLocales[locale]` (US-99), pelo caminho que o `ingest` já escreve — em `subclasses`,
pelo caminho que a US-141 vai escrever. Chave de `primary` que não exista em `config.attributes` é
**erro de ingest**, não campo ignorado em silêncio — mesma disciplina de perícia órfã da US-131.

---

## Critérios de aceite

- [x] `SystemCatalogEntrySchema` aceita `kicker`, `blurb` e `primary` opcionais, e um config sem
      nenhum dos três continua válido (o sistema `Free` é a prova viva).
- [x] As 13 classes, as 13 raças e as 15 subclasses do sistema `srd-5e` têm `blurb` preenchido nos
      dois locales; `kicker` preenchido nas 13 classes, nas 13 raças e nas 3 subclasses do Marshal
      (as com irmã na mesma classe) — nas 12 subclasses SRD sem irmã, `kicker` é opcional e pode
      ficar ausente. As 13 classes têm `primary` com 1 ou 2 chaves de atributo.
- [x] Nenhum `blurb` de raça é cópia literal do `Species.desc` do dataset nas 13 entradas — o
      dataset é semente, a revisão é o produto.
- [x] Nas 3 subclasses do Marshal, `kicker`/`blurb` discriminam entre si (mesmo teste de leitura
      que classe/raça); nas 12 subclasses SRD sem irmã na mesma classe, o `blurb` descreve o
      arquétipo sem depender de comparação, com ou sem `kicker`.
- [x] O overlay aceita as duas formas para `races`/`classes` (`"dwarf": "Anão"` e
      `"dwarf": { "name": "Anão", "kicker": "…", "blurb": "…" }`), e as entradas em string que já
      existem continuam a resolver para o **mesmo rótulo** — ficha legada tem de resolver de volta
      para o mesmo texto que a jogadora via (é o motivo declarado no `_comment` do overlay).
- [x] `primary` com chave que não existe em `config.attributes` **falha o ingest**, com mensagem
      que cita a chave ofensora e a classe.
- [x] `pnpm typecheck` verde sem tocar em nenhum consumidor de `SystemCatalogEntry` — os campos
      são opcionais.
- [x] **Eval / teste de regressão:** teste do `ingest` que (a) lê um overlay com as duas formas no
      mesmo arquivo e afirma que ambas produzem o `label` correto, (b) afirma que `kicker`/`blurb`
      do overlay chegam ao artefato, e (c) falha quando `primary` cita atributo inexistente. O (a)
      é o que quebra quando alguém "simplifica" o overlay para só objeto — o caminho que apaga o
      rótulo de toda ficha legada.

### Nota de implementação (02/09/2026)

`primary` acabou NÃO indo para o overlay: as chaves de atributo (`strength`, `constitution`…)
são canônicas EN e idênticas nos dois locales — não é texto traduzido, é dado. Curada como
`CLASS_PRIMARY_ABILITIES` dentro de `ingest.mjs` (mesmo precedente de `DEFAULT_KIT`/
`ATTR_RANGE`), não em `locale/{pt-BR,en-US}.json`. `kicker`/`blurb`, esses sim são prosa e
precisam de curadoria por locale — como o dataset não tem semente nenhuma para eles (nem em
EN), a base EN passou a rodar com um overlay próprio (`locale/en-US.json`, novo) em vez do
`{}` que bastava antes desta story.

---

## Notas de implementação

> Dicas, não especificação. Quem implementa pode divergir com justificativa.

- **`resolve()` já é o ponto certo.** [`ingest.mjs`](../../../scripts/srd/ingest.mjs) (L150)
  recebe `overlayEntry` como objeto (`{ name }`), e `buildRaces` (L205) / `buildClasses` (L273) já
  chamam com essa forma — passar `{ name, kicker, blurb }` é a mudança mínima.
- **Normalizar a entrada em string no ponto de leitura do overlay**, não em cada chamador:
  `typeof entry === 'string' ? { name: entry } : entry`. Uma linha, e o resto do ingest não
  precisa saber que existem duas formas.
- **`blurb` tem teto de caracteres no schema** (`.max(200)`), não no CSS. Sem teto, a curadoria
  escreve parágrafo e o cartão da US-205 quebra o alinhamento da grade.
- **Escrever em pt-BR primeiro.** É o locale lido com olho crítico; o en-US sai dele, não o
  contrário.
- **`primary` é a única fonte do selo `Principal`.** `primary_abilities` do dataset vem `[]` nas
  24 entradas (medido). Não tentar derivar de `saving_throws`: salvaguarda e atributo principal
  coincidem nalgumas classes e divergem noutras.
- **Re-seed obrigatório** depois do ingest, como em toda mudança de catálogo (US-54).
- **`buildSubclasses` (US-141) precisa da mesma mudança mínima que `buildRaces`/`buildClasses`
  ganham aqui**: passar `{ name, kicker, blurb }` para `resolve()` em vez de só `{ name }`. Se
  US-141 for implementada antes desta story, ela nasce sem os dois campos e esta story só
  acrescenta; se depois, `buildSubclasses` já nasce pronta — coordenar com quem for implementar
  qual das duas.

---

## Questões em aberto

Todas as três decididas em 02/09/2026; mantidas aqui pelo histórico do porquê.

1. **`kicker` é copy autoral ou deriva do `blurb`?** **Decidido: autoral.** O protótipo usa uma
   chamada com voz própria, não as primeiras palavras do resumo. Cortar o `kicker` e ficar só com
   o `blurb` custa mais sem busca na grade: sobram 13 blocos de duas frases para ler um a um, sem
   nenhuma linha que se leia em varredura.
2. **Raiz e subespécie repetem `blurb`?** **Decidido: sim, por herança.** Hoje a raiz com
   subespécie nem aparece como opção (US-142); a subespécie herda o `blurb` da raiz e sobrescreve
   só o `kicker`, evitando escrever 4 textos quase iguais. Decisão de curadoria, não de schema —
   nenhum campo novo.
3. **Subclasse sem irmã ainda precisa de `kicker`?** **Decidido: não — `kicker` vira
   opcional-mesmo-com-`blurb` nas 12 subclasses sem irmã na mesma classe.** Nas 12 classes com uma
   única subclasse, o cartão de subclasse (US-205) aparece sem grade — preenchido automaticamente,
   sem a jogadora escolher — e o argumento de "discriminar numa varredura" que justifica o
   `kicker` de classe/raça não se aplica a elas. A referência ao vivo confirma isso na prática: a
   subgrade `marshal` (as 3 com irmã) renderiza cada trilha com `kicker` em caixa alta separado,
   mas o painel de detalhe das 12 sem irmã mostra só nome + `blurb`. Nas 3 subclasses do Marshal
   `kicker` continua obrigatório, igual classe/raça. O critério de aceite abaixo foi ajustado para
   refletir essa exceção.

---

## Referências no código

- [`packages/shared/src/types/system.ts`](../../../packages/shared/src/types/system.ts) — `SystemCatalogEntrySchema` e `RaceCatalogEntrySchema`: onde os campos entram.
- [`scripts/srd/ingest.mjs`](../../../scripts/srd/ingest.mjs) — `resolve()` (L150), `buildRaces` (L205), `buildClasses` (L273): o caminho do overlay até o artefato.
- [`scripts/srd/locale/pt-BR.json`](../../../scripts/srd/locale/pt-BR.json) — `races`/`classes` hoje `key → string`; o `_comment` explica por que esses PT vieram das listas literais do wizard.
- [`scripts/srd/_data/CharacterClass.json`](../../../scripts/srd/_data/CharacterClass.json) — sem `desc`, `primary_abilities` vazio: a razão de a classe precisar de copy autoral.
- [`scripts/srd/_data/Species.2014.json`](../../../scripts/srd/_data/Species.2014.json) — `desc` por espécie: a semente do `blurb` de raça.
- [`apps/web/src/components/setup/SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — `raceCatalog`/`classCatalog`: quem consome hoje, e vai consumir os campos novos na US-205.
- [`wizard-criacao-personagem-referencia.html`](./wizard-criacao-personagem-referencia.html) — o protótipo: `kicker`/`blurb` são exatamente os dois campos que o cartão dele lê, inclusive no `subclassCards` que ele já deriva de `cls.subclasses`.
- [US-141](./US-141-catalogo-subclasses-srd-5-1-e-marshal.md) — `config.subclasses`, `buildSubclasses` (a criar): onde a prosa de subclasse se pendura.
