# Arquitetura — Motor de aventuras autorais (mundo-primeiro)

**Status:** Decisão de arquitetura — alimenta a reescrita da [ADR 012](./adr/012-aventura-gerada-como-dado.md) e o reslice do [backlog do motor de geração](./sdlc/01-requisitos/backlog-motor-de-geracao-de-aventuras.md).
**Data:** 2026-09-09
**Decisora:** Mantenedora
**Origem:** insatisfação com o resultado do motor atual (montado de tabelas → genérico, plano, prosa fraca). Alvo estético: o artefato **O Olho de Iremet** (one-shot solo, pt-BR, cenário autoral "Khemsar", 3 facções, arco de 3 beats, 4 sessões, fecho sem herói). *(A tabela d8 de perigos do artefato foi deliberadamente deixada de fora da geração — decisão 10/09.)*

> Este doc é decisão de **abordagem e forma**, não plano de implementação task-a-task. O plano por ticket vem depois (`piv-plan-implementation` / reslice do backlog).

---

## Problema e metas

O motor atual gera a aventura **montando de tabelas** (rolagem LGMRD com `seed` determinístico, registro = chave de catálogo fixa `setting`/`tone`/`areaType`). O resultado saiu **genérico, de estrutura plana e prosa fraca** — o oposto do alvo, que é **autoral**: um mundo inventado e específico, com tensão de facções que move o enredo, arco em atos e um fecho ramificado sem herói claro.

Meta: gerar aventuras no nível de **O Olho de Iremet** — mundo bespoke, facções concorrentes, estrutura de atos/sessões, fecho ramificado — **mantendo a mecânica 5e SRD** (Open5e, statblocks por papel, CD 2024). O que se porta do repo `RPG-World-Builder` e do artefato é **apresentação e estrutura**, nunca mecânica (o artefato é AD&D 2E: THAC0, CA descendente, perícias em %) nem código (GPL-3.0 contamina; plot vem do *Dungeon Master's Design Kit* / TSR 1988, proprietário; 2E). O repo é **inspiração/alvo estético**, não fonte de código.

Toda decisão abaixo é julgada contra: *a saída chega perto de O Olho de Iremet, para um personagem solo de nível 1, em pt-BR?*

---

## Abordagens consideradas

| # | Abordagem | Trade-off |
|---|---|---|
| A | **Manter tabelas como espinha, soltar a rédea no prompt** | Menor risco, menor mudança. Registro continua chave; prompt ganha liberdade pra nomear/desenvolver mundo por cima do esqueleto rolado. **Risco:** pode não chegar em Khemsar — o esqueleto de tabela ainda puxa pro genérico. |
| B | **Híbrido: esqueleto determinístico + camada autoral** | Seed+tabelas geram esqueleto (preserva determinismo/eval/gate); passo de modelo depois veste num mundo autoral, facções e arco. Preserva o que existe. **Risco:** o esqueleto pode engessar a autoria; duas fontes de verdade (tabela vs autoria) a reconciliar. |
| C | **Inversão: modelo autora o mundo primeiro, tabelas viram tempero** ✅ | Modelo autora o mundo bespoke como ato criativo principal (como o artefato); seed/tabelas rebaixados a variedade + inspiração no prompt. **Custo:** perde determinismo byte-a-byte e o seed como espinha — a fundação que o backlog atual chama de "o que separa gerador de roleta". Exige âncora de eval nova. |

**Escolhida: C (inversão).** A dor é qualidade autoral, e A/B mantêm a espinha de tabela que produziu o genérico. C ataca a raiz. O custo (fim do determinismo) é aceito conscientemente e endereçado na âncora de eval abaixo.

---

## Abordagem recomendada

**Geração mundo-primeiro.** O modelo autora, em cadeia, do mundo pro detalhe; a única matemática determinística que fica é a de encontro (5e). Onde encaixa no sistema existente:

- **Reusa:** o schema `GeneratedAdventure` (`packages/shared/src/types/adventure-generation.ts`, US-144) como contrato de saída — **cresce, não é jogado fora**; o gate antes de persistir (US-150) — **adapta**: valida a saída do modelo e **regenera on-fail** em vez de re-seed; a mecânica 5e (statblocks por papel US-152, orçamento US-159/160, CD US-111) — **intacta**; a escada de provedores/`model.ts` e o padrão de coluna congelada `Adventure.generatedAdventure Json?` (ADR 012 D2).
- **Rebaixa/remove:** `seed` byte-a-byte (US-146, ✅ implementada — vira código morto a remover) e a rolagem LGMRD como espinha (US-147, ✅ — LGMRD passa a inspiração injetada no prompt, não sorteio); escolha de registro do jogador (US-156/157) vira **botão de direção opcional** que alimenta o prompt de autoria, não trava de catálogo — como, ver §*Parâmetros de mundo (US-156/157) no prompt de autoria*.

**Nova ordem de geração — CALL ÚNICO de autoria + passo determinístico + gate:**

```
CHAMADA 1 — autoria (modelo deepseek-v4-pro, UMA chamada, tudo junto):
   · mundo autoral + tom          (o bespoke tipo Khemsar)
   · facções (3) com desejos concorrentes
   · conflito central + fecho ramificado (escolha sem herói)
   · locais + NPCs                (amarrados às facções)
   · segredos / pistas            (referenciam locais/facções por id)
   · atos / sessões + followUps
   · encontros — FICÇÃO só         (local + facção + situação, SEM números — abordagem A)
PASSO 2 — números dos encontros   ← 5e determinístico no código: papel (Minion/Soldier/Brute)
                                     + orçamento pro nível do personagem, preenchendo a ficção da CHAMADA 1
PASSO 3 — gate                    ← grafo fecha + orçamento cabe. Falha ⇒ regenera a CHAMADA 1
```

**Por que call único, não cadeia (decidido 2026-09-09):** o Spike 1 já produziu aventura Khemsar-grade numa chamada só. A cadeia multi-passo é **mais lenta** — os passos são sequencialmente dependentes (mundo→facções→…, sem paralelizar), e cada chamada extra paga round-trip + prefill do artefato acumulado + warmup de raciocínio; o call único do Spike levou ~95s, uma cadeia de ~6 passos empilharia esse overhead 2-4×. E é **menos código**. Trade aceito: gate mais **grosso** — valida a aventura inteira e regenera o blob todo em vez de por-peça. Se um dia o controle fino por seção importar, a cadeia é o caminho de volta conhecido.

---

## Decisões-chave

### Stack e bibliotecas
Sem dependência nova. Reusa a escada de provedores existente (`packages/ai-engine`, `apps/api/src/ai/ai.service.ts`, `model.ts`) e Zod pro schema (`@ai-dm/shared`). Geração é **off-turn** (assíncrona, sem streaming, sem o teto de 60s do proxy SSE) — o modelo de autoria pode ser mais forte que o utilitário barato de hoje (US-114); **a decidir no spike**.

### Modelo de dados (nível de forma)
`GeneratedAdventureSchema` cresce. Adições (referência cruzada por `id`, mantendo o contrato da US-144):
- **`world`** — objeto autoral: `name` (ex. "Khemsar, o Mar de Areia"), `description`, locais-âncora. **Distinto** da chave coarse `setting` (que sobrevive só como dimensão de filtro/eval, não como fonte do mundo).
- **`factions[]`** — entidade de 1ª classe: `id`, `name`, `kind` (poder/submundo/culto…), `want`, vínculos por `id` a `npcs`/`locations`/`secrets`. Hoje só existe `npc.role` (texto solto).
- **`acts[]` / sessões** — agrupamento sobre `encounters[]`, cada ato com gancho pro próximo. Hoje `encounters[]` é plano.
- **`branchedResolution`** — array estruturado `{ choice, consequence }` (vender/entregar/sumir). Hoje `conclusion` é uma string.
**Fora do schema (decisão 10/09):** `hazardTable`/tabela de perigo — **removida da geração** a pedido da mantenedora. Perigo de viagem, se surgir, fica a cargo do Mestre em jogo; não pré-gera.

**Coerência com os campos que já existem (US-144), pra não deixar campo morto (gate US-89):**
- **`branchedResolution` SUBSTITUI `conclusion` (string).** O fecho é ramificado (3 escolhas/consequências), não cabe numa frase; manter `conclusion` seria redundância morta. O `generateClosing` (US-181/183/190) passa a emitir os ramos.
- **`start` FICA** — é o seed de abertura, composto por **código** (US-194, sem chamada de IA), consumidor vivo e distinto dos atos.
- **`acts[]` mora entre `start` e `branchedResolution`** — sem sobreposição depois que `conclusion` sai.
- **`followUps[]` FICA obrigatório E entra no prompt de autoria (CHAMADA 1).** O Spike esqueceu de pedir — mas é a única continuidade entre one-shots (ver backlog, *O adiamento do arco pra fase 4*), não pode ficar de fora.

Persistência inalterada: coluna congelada `Adventure.generatedAdventure Json?` (ADR 012 D2). Ciclo de vida imutável — o ledger `WorldEntity[]` mutável continua em `Adventure.entities`.

### Parâmetros de mundo (US-156/157) no prompt de autoria
A tela "O Mundo da Aventura" (US-157) dá quatro knobs. Sob a montagem-por-tabela eles indexavam rolagens; sob a inversão, eles **restringem o que o modelo autora**. Mapeamento:

| Knob (tela) | Campo | Como entra na autoria |
|---|---|---|
| **Cenário** (Alta Fantasia, Mitológico, Cyberpunk…) | `setting` (chave) | Linha de restrição no prompt: "Cenário: <rótulo>". O modelo inventa um mundo autoral **dentro** do gênero. |
| **Tom** (Heroico, Sombrio, Terror…) | `tone` (chave) | "Tom: <rótulo>", uma vez pra aventura toda — governa o registro emocional (passo 0 da ordem). |
| **Tipo de Área** (Cidade, Deserto, Ruínas…) | `areaType` (chave) | "Área predominante: <rótulo>" — ancora a geografia do mundo e dos locais. |
| **Desafio** (Modo aventura / Modo desafio) | `challenge` | **NÃO entra na autoria.** Alimenta o passo 7 (orçamento de encontro): `adventure` = `encounterDeadlyThreshold`, `challenge` = `singleMonsterCrCap` (US-161). Eixo de dificuldade, não de mundo — a tela agrupa, a mecânica separa. |
| **Aventura pronta × Criar minha história** | roteamento | "Aventura pronta" = gancho de classe fixo (US-217), **não roda o motor**. "Criar minha história" = motor mundo-primeiro com os três knobs acima. |

Quatro regras que o reslice do backlog precisa carregar:

1. **O prompt recebe o RÓTULO pt-BR (ou descrição), nunca a chave.** O artefato grava a chave (`grimdark`) pra eval/filtro (D6: `world` autoral vs `setting` coarse); o catálogo `SystemCatalogEntry` (US-156) já tem chave+rótulo por locale, então a resolução é a mesma de `races`/`classes` (US-105).
2. **"Aleatório" = campo OMITIDO do prompt = modelo com rédea livre nesse eixo.** Mudança vs US-156 original: lá "ausência = seed sorteia"; com o `seed` morto (ADR 012 D1), ausência = **o modelo escolhe**. Nada determinístico — a variedade é do modelo (era o caso do Spike, todos os eixos livres).
3. **A restrição ESTREITA, não genericiza.** "Alta Fantasia" ainda exige mundo autoral nomeado e específico (nível Ur-Veth), só dentro do gênero. O knob é a **única** direção de conteúdo hard-injetada no prompt; o exemplar ensina qualidade/estrutura, **não motivo** — é o antídoto da convergência "ossos de titã" que o Spike 1 expôs.
4. **A combinação dos três é o espaço criativo.** Mitológico + Deserto + Sobrevivência → um mundo tipo Khemsar. Os três em Aleatório → modelo livre.

### Derivação do personagem: gancho leve (não espinha)
O mundo/aventura vem dos **params** (cenário/tom/área). O `background` do personagem (`story`/`bonds`/`flaws`/`deity`) entra como **contexto opcional** no prompt de autoria pra semear ganchos — um NPC preso a um `bond`, a `deity` colorindo uma facção — **sem amarrar a trama**. Foi o que o Spike fez ("contexto, não amarra a trama") e funcionou.

**Robusto a background vazio:** `Character.background` é `Json @default("{}")` — criar personagem sem preencher é caminho válido (ressalva do backlog). O gancho é opcional por construção: background vazio = prompt sem essa parte, mundo sai completo só dos params. O motor **nunca** depende de `story`/`bonds`/`deity` existirem.

Distinto da US-148 (derivação forte, rejeitada aqui): **não** é antagonista-da-divindade nem quest-dos-bonds — é tempero, não espinha. Casa com o defeito que a mantenedora **não** marcou ("não reflete o personagem" não era a dor).

### Costura encontros ↔ mundo autorado (abordagem A)
Eixo: **números = sempre código; ficção do encontro = modelo.** O modelo autora a ficção do encontro dentro da CHAMADA 1 — onde acontece (local por `id`), quem ataca (facção), a situação — **sem números**. O PASSO 2, determinístico no código, preenche a mecânica 5e: papéis de statblock (Minion/Soldier/Brute, US-152) e orçamento pro nível do personagem (Lazy Encounter Benchmark, US-159/160). O gate regenera se não couber.

Mantém o encontro **preso às facções e à trama** (evita o defeito "plano/sem alma") e o código **dono da matemática** (evita a rolagem fictícia que a US-29 saneia — o Spike mostrou o modelo inventando "teste de Sabor"/HP errado). Controle do estouro de orçamento: o prompt recebe o nível do personagem ("encontros derrotáveis por um personagem nível N") e o gate rejeita+regenera quando a ficção pede mais do que o orçamento aguenta.

**Rejeitadas:** (B) código gera encontro do zero e cola num local por `id` — orçamento sempre certo, mas ficção genérica desconexa das facções (o defeito de origem); (C) híbrido com passo de prosa extra pra reescrever o boxed text com a contagem real — mais entrosado, mas volta a ter chamada extra e perde o ganho do call único.

### Saneamento de mecânica na prosa autorada (US-29)
Mesmo contrato da costura de encontros, aplicado a **toda** a prosa gerada: **números NUNCA pertencem à prosa** — é o contrato que a [US-29](./sdlc/01-requisitos/US-29-saneamento-de-rolagens-ficticias.md) já impõe à narração de turno ("o Game Server é a única fonte de dado; o narrador só interpreta qualitativamente"). A geração de aventura é off-turn, então a rede `onFinish` da US-29 não roda nela — o contrato precisa ser reimposto no caminho de autoria.

Onde bate: boxed text, descrições de local, segredos e falas de NPC são prosa autorada e tendem a trazer CD/dado/dano inventados (o Spike mostrou o qwen escrevendo "teste de **Sabor**" e HP fictício). O exemplar *O Olho de Iremet* já faz certo: nomeia o teste ("teste de Percepção") **sem CD nem dano** — a resolução numérica vem em jogo.

Defesa em profundidade, no molde da própria US-29 (prompt + rede determinística):
1. **Prompt** — a autoria proíbe número mecânico na prosa (CD, dado, dano, HP, CA), mesma regra que `dm-system.ts` já carrega pro turno. Teste é nomeado **qualitativamente** por perícia/atributo canônico do SRD.
2. **Rede determinística (pré-gate)** — reusa o stripper da US-29 sobre os campos autorados (`boxedText`, `description`, `secret.text`, `npc.interactions[].narrative`): remove número de rolagem vazado; e **valida a perícia nomeada contra o catálogo do sistema** — "Sabor" não existe, reprova → gate regenera.

Onde número legítimo vive: statblock de encontro (código, US-152, campo estruturado, não prosa) e rolagem em jogo (`rollDice` + escada de CD do SRD 2024, US-111). O artefato **não** congela CD/dano.

### Fronteiras e contratos
- **Chamadas ao modelo:** a inversão troca "1 chamada barata + rolagem" por **uma chamada de autoria** (call único, escada `deepseek-v4-pro`→`-pro-0813`→`v4.1-flash`) + o passo determinístico de encontros no código. Não é cadeia — ver *Por que call único* acima. Custo ~$0.012/aventura (Spike 1, call único de pro); latência ~95s+, off-turn (mitigada por US-197, tela de espera).
- **Gate como fronteira de confiança:** saída do modelo nunca persiste sem passar no grafo fechado + orçamento de encontro. Falha ⇒ regenera (teto de tentativas explícito, falha registrada — gerador que regenera sem limite trava a criação de personagem).
- **Locale:** a prosa é gerada no locale do personagem (ADR 005 — bilíngue por dimensão; EN é a base nativa). `en-US` → aventura em inglês, `pt-BR` → em português; o prompt recebe o locale e manda gerar naquele idioma. As **chaves** (`setting`/`tone`/`areaType`) continuam canônicas EN nos dois casos — só o texto autoral segue o locale (schema bilíngue por natureza, US-144). Sem overlay de tradução: o motor gera direto no idioma-alvo.
- Sem secret novo, sem serviço externo novo.

### Artefatos do motor velho: descartados, sem migração
D6 muda a forma do `generatedAdventure`. Artefatos gerados pelo motor antigo (sem `world`/`factions[]`/`acts[]`/`branchedResolution`) **não são migrados — são descartados**. O `GeneratedAdventureSchema.parse()` novo não precisa tolerar a forma velha: sem versionamento, sem reader dual-shape, sem backfill. Mata por descarte a preocupação "versionamento de schema é problema futuro" do ADR velho.

**Seguro porque a fase 1 é pré-lançamento — sem usuário nem save real a proteger.** As `Adventure` existentes são dado de dev/teste, resetáveis. **Escopo da decisão:** vale enquanto não houver aventura jogada que importe preservar; se usuários reais (ou a fase 4) chegarem antes de o schema estabilizar, descartar destruiria história jogada — aí a decisão volta à mesa (versionar/migrar). Registrado pra não ser aplicado cego depois.

### Gatilho e falha: assíncrono, tela de espera, retry (não fallback)
**Gatilho — assíncrono.** Ao clicar "Criar aventura", a geração roda em **background**, não no caminho síncrono da criação. Síncrono não é opção: a autoria leva ~95s (call único de pro) e o proxy SSE corta em **60s** (US-60) — bloquear daria timeout. O jogador vê a **tela de espera** (US-197, carrossel de worldbuilding) enquanto o mundo é tecido; enquadrada como criação, não barra de load.

**Falha — erro + retry, NUNCA fallback pra pronta.** O gate (PASSO 3) regenera on-fail; ao **estourar o teto de tentativas**, a tela mostra **erro pedindo pra criar a aventura de novo** — retry da autoria, com os mesmos parâmetros. **Decisão da mantenedora (2026-09-09): não desviar pro "Aventura pronta"** (gancho de classe, US-217) — o jogador que escolheu "Criar minha história" fica no caminho autoral; desviar pro gancho de classe trairia a escolha. (Sem `seed`, cada retry dá um mundo diferente — o que é o comportamento certo aqui.)

Dois estados terminais da tela de espera: sucesso → entra no jogo; falha (teto estourado) → erro + botão "Criar aventura de novo".

### Âncora de eval (substitui o determinismo)
"Reprodutibilidade" são duas coisas; a inversão só mata uma:
1. **Repro pra debug** — o artefato **congelado** (ADR 012 D1) já fica gravado em `Adventure.generatedAdventure`. Aventura ruim é linha inspecionável, não precisa regenerar. Morre reproduzir o *processo*; o *resultado* fica de graça.
2. **Regressão** — mede **rubrica (US-36/154) sobre amostra**, a partir de um conjunto **pinado de perfis de entrada**, contra **O Olho de Iremet** como exemplar de referência (resolve a lacuna do backlog: sem exemplar solo/pt-BR/autoral). Golden deixa de ser string, vira barra de qualidade.

`seed` se aposenta da produção. Onde a eval precisar de quase-determinismo (testar pipeline, não criatividade): `temperature: 0` + versão de modelo pinada sobre os perfis fixos.

**O exemplar NÃO entra no prompt de produção.** *O Olho de Iremet* é anchor de **eval** (regressão), não texto do prompt. O mundo gerado tem **zero conexão de conteúdo** com o exemplar — só herda qualidade e estrutura. O prompt de autoria ensina qualidade de forma **abstrata** ("mundo autoral nomeado e específico, facções com desejos concorrentes, detalhe sensorial concreto"), sem citar nenhum mundo. Isso corta por construção a convergência de motivo que o Spike 1 expôs (todos os modelos copiaram "ossos de titã" porque o prompt do spike descrevia Khemsar literalmente).

### Escopo da ADR 012 (cirúrgico, não do zero)
| Decisão ADR 012 | Sob a inversão |
|---|---|
| D1 — congela artefato | **Fica** |
| D1 — `seed` recomputável | **Morre** (única parte que cai) |
| D2 — coluna própria `generatedAdventure Json?` | **Fica** (schema cresce) |
| D3 — `id` sem renomear | **Fica** |
| D4 — portabilidade adiada | **Fica** |

Refazer ADR 012 = reescrever a metade-`seed` do D1 + registrar as decisões do schema mais rico e da inversão. O resto vale.

---

## Peças que faltam

- Prompt de autoria **call único** mundo-primeiro (uma chamada gera mundo→facções→…→tabela+followUps): não existe; hoje é rolagem + prompt por peça.
- `factions[]`, `acts[]`/sessões, `branchedResolution`, `world` no schema (US-144 cresce).
- Gate (US-150) adaptado: **regenera on-fail** em vez de re-seed; grafo fecha sobre o schema mais rico (facções incluídas).
- Rubrica de eval **recalibrada** contra O Olho de Iremet como exemplar (US-154/US-36).
- Remoção de código morto pós-inversão: `deriveAdventureSeed` (US-146) e a rolagem-espinha (US-147) — passar pelo gate de código morto (`pnpm dead`, US-89).
- Camada de apresentação estilo módulo (renderização da ficha/aventura) — **fora deste doc**, é frontend, decisão à parte.

---

## Spikes e experimentos

> **Spike 1 — RESOLVIDO em 2026-09-09. Inversão confirmada.** Script: `packages/ai-engine/adventure-authoring-spike.mjs`; relatório: `evals/reports/adventure-authoring-spike-2026-09-09T12-59-00.md`. Uma chamada de autoria, perfil solo pinado (ladino nível 3), pt-BR. O modelo forte (`deepseek-v4-flash`) gerou "Ur-Veth, a Cidade dos Ossos de Sal" — mundo autoral, 3 facções concorrentes, arco de 3 beats, fecho ramificado sem herói, 4 sessões, NPCs com fala, segredos ancorados, tabela d8 — Khemsar-grade a $0.001/aventura. O barato (`qwen3.7-flash`) passou mas escorregou (erro mecânico, nomes mais genéricos). **Decisões fechadas:** (1) commita a inversão (abordagem C); (2) modelo de prosa — ver 2ª rodada abaixo. **Caveat:** juiz Gemini saturou (quase tudo 5/5, esperado — ver backlog US-17); o sinal decisivo foi a saída a olho, não a nota.

> **Spike 1 — 2ª rodada (bake-off de 8 modelos, 2026-09-09).** Relatório: `evals/reports/adventure-authoring-spike-2026-09-09T13-32-25.md`. Mesmos slugs do OpenRouter que a mantenedora pediu (nemotron-3.5-lightning, qwen3.8-flash, kimi-k2.6, deepseek-v4-pro, grok-4.3, muse-spark-1.3, gpt-5.6-luna) + deepseek-v4-flash de âncora. Achados: juiz saturou de novo (quase tudo 5/5, não discrimina); `grok-4.3` entregou curto (1726 tokens, aventura incompleta); `muse-spark-1.3` falhou (n=0); **convergência de motivo** — todos inventaram "cidade sobre ossos de titã" porque o `EXEMPLAR_BAR` do prompt descreve Khemsar literalmente (em produção a referência tem de ensinar QUALIDADES, não semear um motivo). **Decisão da mantenedora, lendo cada texto: modelo de prosa = `deepseek/deepseek-v4-pro`** (o texto que mais agradou; ~$0.012/aventura, aceitável por ser one-time e off-turn).

> **Escada de prosa (2026-09-10).** A DeepSeek anunciou descontinuação do `deepseek-v4-pro`. Testado `deepseek/deepseek-v4.1-flash` como substituto (relatório `adventure-authoring-spike-2026-09-10T12-46-00.md`): 5x mais barato ($0.0024) e sobrevive, mas a mantenedora **ainda preferiu o v4-pro** lendo os dois. Decisão: **escada** (mesmo padrão de `narrationModels`), não troca forçada — a autoria tenta na ordem:
> 1. `deepseek/deepseek-v4-pro` — preferido, **em descontinuação**.
> 2. `deepseek/deepseek-v4-pro-0813` — snapshot pinado do pro (mais próximo do texto aprovado). **Ressalva:** é da mesma família v4-pro; pode ser desligado junto — fallback de qualidade, não de sobrevivência.
> 3. `deepseek/deepseek-v4.1-flash` — o **sobrevivente real** (não anunciado pra sair), mais barato; o piso quando os dois pro caírem.
> Quando o pro sair, a escada troca sozinha; revisitar a preferência quando a data de EOL for conhecida.

**Spike 1 (registro original) — a inversão produz qualidade Khemsar-grade, e a que custo? (PRIMEIRA AÇÃO, antes de reescrever ADR 012 ou qualquer story)**

```
Pergunta:      Modelo-primeiro autora aventura no nível de O Olho de Iremet,
               para um perfil solo nível 1, em pt-BR? A que custo/latência?
Spike:         Cadeia de prompt mundo-primeiro (passos 1-6 da nova ordem, sem
               encontros/gate ainda) para UM perfil pinado. Gerar 3-5 aventuras.
               Rodar com modelo forte E com o utilitário barato (US-114) para comparar.
               Julgar contra O Olho de Iremet pela rubrica da US-36. Timebox: curto.
Regra de decisão:
  - qualidade ≥ artefato E custo/latência aceitáveis ⇒ commita a inversão (abordagem C);
    a comparação forte×barato fixa o modelo de prosa.
  - ainda genérico OU lento/caro demais ⇒ cai pro híbrido (abordagem B: esqueleto
    determinístico + camada autoral), reavaliando o determinismo.
```

O spike responde de uma vez as duas decisões deixadas em aberto na sessão: **modelo de prosa** (forte vs barato) e se a **inversão** se sustenta antes de investir na reescrita do backlog.

---

## Questões em aberto

1. ~~**Modelo de prosa: forte ou barato?**~~ **RESOLVIDA (09/09, revista 10/09):** escada `deepseek-v4-pro` → `deepseek-v4-pro-0813` → `deepseek-v4.1-flash` (preferência da mantenedora lendo os textos; juiz saturou; pro em descontinuação, escada absorve — ver *Escada de prosa* acima). Referência do prompt ensina QUALIDADES, não semeia o motivo "ossos de titã".
2. **Âncora de eval final** — recomendado artefato congelado + rubrica sobre perfis pinados, `seed` aposentado; confirmar. (Nota do spike: juiz Gemini satura na tarefa de aventura — a rubrica de regressão precisa de ancoragem mais dura que "nota 1-5", ex. asserts sobre o artefato, como a US-154 já previa.)
3. ~~**Quantas chamadas ao modelo por aventura?**~~ **RESOLVIDA (09/09): call único de autoria** + passo determinístico de encontros. Mais rápido e menos código que a cadeia; ~$0.012/aventura em deepseek-v4-pro (Spike 1). Cadeia é o caminho de volta se o gate por-peça importar.
4. ~~**Gerar na criação ou em background?**~~ **RESOLVIDA (09/09):** background/assíncrono com tela de espera (US-197) — síncrono estoura o teto SSE 60s. Falha do gate = erro + retry da autoria, nunca fallback pra "Aventura pronta". Ver §*Gatilho e falha*.
5. **Extensão do rebaixamento do LGMRD** — inspiração no prompt, ou sai de vez? Decidir depois do spike (se a autoria pura já basta, LGMRD pode não agregar).
6. **Facções: sempre 3?** — o artefato tem 3; fixar 3 ou faixa (2-4)? Decisão de produto, não bloqueia o spike.
7. Nível 1 e grupo=1 continuam as únicas escalas da fase 1 (ressalvas do backlog inalteradas).

---

## Próximos passos

1. **Spike 1** (acima) — antes de tudo.
2. Conforme o resultado: reescrever [ADR 012](./adr/012-aventura-gerada-como-dado.md) (metade-`seed` do D1 + inversão + schema rico) e reslice do [backlog](./sdlc/01-requisitos/backlog-motor-de-geracao-de-aventuras.md) (US-146/147 rebaixadas; stories novas de facção/atos/fecho ramificado/tabela/cadeia mundo-primeiro).
3. Recalibrar a eval (US-154) com O Olho de Iremet como exemplar.
