# ADR 010 — Upload de livro: lore recuperável, nunca fonte de regra

**Status:** Proposto
**Data:** 2026-08-12
**Decisores:** Time de Produto e Engenharia
**Relacionado:** [ADR 001 — Arquitetura](./001-arquitetura.md) (**este ADR o revisa**: o desenho de ingestão/RAG de lá pressupõe uma pilha que a Fase 1 não tem) · [ADR 006 — Deploy a custo zero](./006-deploy-custo-zero.md) (a pilha real, e a razão de metade das revisões) · [ADR 004 — Origem do dado de sistema](./004-origem-do-dado-de-sistema.md) e [ADR 009 — União dos SRD](./009-uniao-dos-srd-5-1-e-5-2.md) (a fonte de **regra**, que este ADR não toca) · [ADR 007 — Camadas do prompt](./007-camadas-do-prompt-por-volatilidade.md) (por que o trecho recuperado não entra no prefixo cacheável) · [US-47](../sdlc/01-requisitos/US-47-ingestao-srd-como-dado.md) (o molde de pipeline de ingestão que já existe no repo)

---

## 1. Contexto

O upload de livro é promessa de produto desde o começo: o [PRD](../prd.md) diz que *"um jogador ou mestre pode jogar D&D ou outro sistema ao fazer o upload do livro"*, e o [ADR 001](./001-arquitetura.md) já desenhou o caminho — Object Storage para o arquivo, fila BullMQ, worker de parsing e embedding, pgvector, RAG isolado por campanha. A Fase 1 declara explicitamente *"sem upload de livro ainda"*.

Dois anos de decisões depois, aquele desenho não sobrevive à pilha que de fato existe. O [ADR 006](./006-deploy-custo-zero.md) fixou a Fase 1 em **Vercel Hobby + Render Free + Neon Free**, e ali:

- **Não há Redis.** BullMQ é fila sobre Redis; o ADR 006 põe Redis nas Fases 2–3.
- **Não há worker durável.** O Render Free é um web service que hiberna por inatividade; um job de parsing longo morre com ele.
- **Não há Object Storage.** Nada no ADR 006 provisiona S3.
- **O runtime da API carrega dois segredos de LLM.** [`render.yaml:52-55`](../../render.yaml): `OPENROUTER_API_KEY` e `GROQ_API_KEY`. A `GEMINI_API_KEY` existe no repo, mas para o juiz de eval e para a tradução do overlay do SRD — que [`model.ts:47`](../../packages/ai-engine/src/model.ts) marca como *"roda no BUILD, nunca em runtime de jogo"*.

E falta a decisão que o ADR 001 nunca tomou, que é a mais cara de errar. Naquele desenho, `System (regras) ◄── derivado de Book (upload)`: o livro enviado **vira sistema de regras**. Desde então o repo decidiu o contrário duas vezes — [ADR 004](./004-origem-do-dado-de-sistema.md) e [ADR 009](./009-uniao-dos-srd-5-1-e-5-2.md) puseram a regra num artefato pinado, derivado por pipeline determinístico, com mapa de equivalência escrito à mão; e o Game Server rola os dados, nunca o LLM. Um trecho recuperado por similaridade de vetor não tem nenhuma dessas garantias.

O desenho de referência externo confirma a fronteira em vez de contrariá-la: [tegridydev/dnd-llm-game](https://github.com/tegridydev/dnd-llm-game) faz RAG de PDF **para lore**, e mantém dados, extração de estado e escolhas num caminho separado do texto recuperado. (Licença "Other", não-padrão — **verificar o arquivo antes de tocar em qualquer linha de lá**; nada precisa ser copiado, só a forma.)

### Como esse repositório entrou aqui

Registrado porque a procedência limita o que a referência autoriza.

Em **12/08/2026** a mantenedora trouxe **cinco repositórios** de D&D/LLM com a pergunta de quais seriam bons acréscimos ao AI DM. A avaliação foi feita por **README e metadados da API do GitHub** — o código **não** foi lido, executado nem auditado; das licenças, só o que o campo `license` e o README declaram.

Dos cinco, dois renderam alguma coisa:

| Repositório | Licença | O que rendeu |
|---|---|---|
| [tegridydev/dnd-llm-game](https://github.com/tegridydev/dnd-llm-game) | "Other" (não-padrão) | RAG de PDF **como lore** → este ADR. Split narração × modelo utilitário → [US-114](../sdlc/01-requisitos/US-114-modelo-utilitario-para-extracao-e-fecho.md) |
| [neuralinitiative/claude-dnd-skill](https://github.com/neuralinitiative/claude-dnd-skill) | AGPL-3.0 | Arco de beats e vínculos ancorados na fonte → [US-112](../sdlc/01-requisitos/US-112-arco-de-beats-do-que-muda.md) e [US-113](../sdlc/01-requisitos/US-113-vinculos-ancorados-na-fonte-no-ledger.md). **Nada para este ADR** |

Os outros três não contribuíram: [nisakson2000/dnd-tracker](https://github.com/nisakson2000/dnd-tracker) (Tauri/Rust desktop, offline-first — pilha incompatível), [drovani/dnd-maintainer](https://github.com/drovani/dnd-maintainer) (**sem licença** — todos os direitos reservados, nada dali é utilizável) e [nqs/dnd-campaign-template](https://github.com/nqs/dnd-campaign-template) (sem licença; workspace de prep para mestre humano, sem interseção com um mestre que é a IA).

**O que essa procedência NÃO é.** Não houve levantamento de abordagens de RAG, nem comparação com o que outros projetos do gênero fazem, nem benchmark. Um repositório com 121 estrelas mostra **uma** forma que funciona para alguém — não a melhor forma, e não uma forma verificada por nós. Nenhuma decisão deste ADR se apoia na autoridade dele: todas se sustentam na pilha do [ADR 006](./006-deploy-custo-zero.md), na fronteira do [ADR 004](./004-origem-do-dado-de-sistema.md)/[009](./009-uniao-dos-srd-5-1-e-5-2.md) e na verificação da §4. O que a referência externa contribui é **confiança de que a fronteira lore × regra é a divisão certa** — porque um projeto que resolveu o mesmo problema chegou nela por conta própria.

---

## 2. Decisão

**O livro enviado entra no jogo como LORE recuperável — contexto narrativo consultado sob demanda — e nunca como fonte de regra, de ficha ou de rolagem. Ele é indexado no mesmo Postgres da Neon com pgvector, sem fila, sem worker e sem object storage.**

### D1 — O livro é lore; a regra continua vindo do SRD pinado

Trecho recuperado alimenta **ambientação, NPC, lugar, tom, gancho**. Não alimenta CD, dano, slot de magia, progressão nem qualquer número que a mecânica consuma. A fronteira é a mesma que já governa `getSpell` (`ai.service.ts:585`): consulta de *awareness*, só leitura, não gasta slot nem rola dano.

Isto **revoga** o `System (regras) ◄── derivado de Book (upload)` do ADR 001. Regra vem do artefato do SRD (ADR 004 + ADR 009); dado vem do Game Server. Um chunk vizinho por cosseno não é fonte de verdade mecânica, e tratá-lo como tal desfaria as duas garantias que mais custaram a construir.

### D2 — pgvector no Postgres que já existe, não um vector store novo

Extensão `vector`, versão `0.8.0`, **disponível e ainda não instalada** na Neon do projeto (verificado em 12/08/2026 — §4). Confirma a escolha #5 do ADR 001 com medição, e mantém o princípio do ADR 006: nenhum serviço novo, nenhuma conta nova, nenhum custo novo. Um datastore a mais numa pilha de camada gratuita é um ponto de falha a mais sem orçamento para monitorá-lo.

### D3 — Sem fila e sem worker: a ingestão é script idempotente e retomável

**Revoga a escolha #7 do ADR 001** (ingestão assíncrona com BullMQ). Sem Redis e com um web service que hiberna, "assíncrono" na Fase 1 significa "morre no meio e ninguém sabe".

O molde já está no repo e não precisa ser inventado: `scripts/srd/` (`sync.mjs` + [`ingest.mjs`](../../scripts/srd/ingest.mjs)) roda fora do runtime, é determinístico e produz artefato versionado. A ingestão de livro segue a mesma forma, com um requisito a mais: **retomável**, porque o custo aqui é chamada de embedding paga. Cada chunk gravado marca progresso; re-rodar continua de onde parou em vez de re-embedar o livro inteiro.

Consequência de produto que este ADR aceita explicitamente: **o primeiro corte não tem endpoint de upload para o jogador.** A mantenedora roda o script. Upload self-service espera uma pilha que aguente segurar um job — o que é decisão do ADR 006, não desta.

### D4 — Recuperação por tool, não por injeção em todo turno

Uma tool de leitura, no molde exato do `getSpell`: o Mestre a chama quando precisa de lore, recebe os trechos e narra. **Não** há recuperação implícita a cada turno.

Três razões, todas medidas neste repo: embedar a ação do jogador em todo turno adiciona uma chamada de rede ao caminho quente que já vive sob o **teto de 60s do proxy SSE**; a maioria dos turnos (combate, ficha, diálogo curto) não precisa de lore nenhuma; e o resultado voltando como *tool result* dispensa bloco novo no turn-state.

### D5 — O trecho recuperado nunca entra no prefixo cacheável

Por [ADR 007](./007-camadas-do-prompt-por-volatilidade.md): conteúdo que muda por turno vive na camada 3. Como D4 o entrega por tool result, ele já cai naturalmente fora do system prompt — mas a regra é escrita aqui porque a tentação de "pôr o lore do livro no system, já que é da campanha inteira" é exatamente o erro que o ADR 007 existe para prevenir.

Com teto: **número de trechos e orçamento de tokens fixos por chamada**, porque a camada 3 é paga integralmente todo turno ([US-55](../sdlc/01-requisitos/US-55-prompt-caching-do-dm.md) / US-104).

### D6 — Embedding por API, e a chave é decisão pendente de provisionamento

Não há máquina para modelo local (o `dnd-llm-game` usa Ollama; o Render Free não tem onde). O embedding vem de API, e ele precisa da **mesma família na ingestão e na consulta** — vetor de modelos diferentes não é comparável, e trocar o modelo obriga a re-embedar o acervo inteiro. Logo: **o identificador do modelo de embedding é gravado junto do vetor**, e a consulta recusa acervo indexado por outro.

Qual provider fica aberto (§5, questão 1) porque tem custo de provisionamento real: o runtime do Render carrega hoje só `OPENROUTER_API_KEY` e `GROQ_API_KEY` ([`render.yaml:52`](../../render.yaml)). Qualquer outro é **env var nova em painel**, configuração manual — a fricção que a US-59 documentou.

### D7 — O arquivo original não é persistido; os chunks são privados do dono

O que fica no banco é **chunk + vetor + metadado de origem**, escopado ao usuário que subiu. O arquivo enviado é processado e descartado — não há Object Storage na pilha, e não guardá-lo é ao mesmo tempo o caminho barato e o menos exposto.

Regras que acompanham, herdadas do ADR 001 §4 e agora concretas:

- **Nenhum endpoint devolve texto do livro.** Chunk existe para alimentar o prompt do Mestre; não há rota de leitura, busca ou export.
- **Nenhum compartilhamento entre contas.** Acervo é do usuário, filtrado por dono em toda consulta — não por convenção de código, por cláusula na query.
- **Sem redistribuição.** O texto não vai para log, para eval salva em disco, nem para o relatório do grafo.

Isto reduz exposição; **não** a elimina. Chunk é o livro em pedaços, e o ADR 001 já registrava que *"risco jurídico de uploads exige política clara e revisão legal"*. Este ADR toma a decisão técnica e **deixa a jurídica em aberto** (§5, questão 3) — não a resolve por omissão.

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---|---|
| 1 | Livro é lore, nunca regra | Regra tem pipeline determinístico e artefato pinado (ADR 004/009); vizinho por cosseno não tem nenhuma das duas garantias |
| 2 | pgvector no Postgres existente | Verificado disponível na Neon; zero serviço novo, alinhado ao ADR 006 |
| 3 | Script retomável em vez de fila | Sem Redis e com web service que hiberna, job assíncrono morre calado |
| 4 | Recuperação por tool (molde `getSpell`) | Não paga rede em turno que não precisa de lore; caminho quente já tem teto de 60s |
| 5 | Trecho fora do prefixo cacheável | ADR 007; camada 3 é paga por turno, então tem teto de tokens |
| 6 | Modelo de embedding gravado com o vetor | Vetores de modelos diferentes não se comparam; sem a marca, o acervo apodrece em silêncio |
| 7 | Original descartado, chunk privado | Sem object storage na pilha; menos superfície legal pelo mesmo esforço |

---

## 4. O que foi verificado

Consulta à Neon do projeto (`purple-wave-53471231`), 12/08/2026:

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions WHERE name IN ('vector','pg_trgm','pgcrypto');
```

| Extensão | Versão disponível | Instalada |
|---|---|---|
| `vector` | 0.8.0 | não |
| `pg_trgm` | 1.6 | não |
| `pgcrypto` | 1.3 | não |

Duas consequências. **A D2 é fato, não suposição** — o pgvector está a um `CREATE EXTENSION` de distância, sem plano pago nem ticket. E `pg_trgm` estar ali ao lado abre a alternativa que a §5 rejeita com ressalva: busca lexical pura, sem embedding e sem custo por token.

Não verificado, e deliberadamente: desempenho de índice vetorial no plano Free, e o teto de armazenamento que um livro de centenas de páginas ocupa. São medições de implementação, não de decisão de arquitetura.

---

## 5. Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| **LanceDB** (a escolha do `dnd-llm-game`) | Store embutido em arquivo. O disco do Render Free é efêmero e o serviço hiberna — o índice evapora entre sessões. Funciona no desenho local-first de origem, não neste |
| **Pinecone / Qdrant gerenciado** | Serviço e conta novos; contraria o ADR 006. O pgvector só perde em escala que a Fase 2 não tem |
| **BullMQ + worker** (ADR 001 #7) | Precisa de Redis, que a pilha não tem. Revogado, não adiado por gosto |
| **Livro vira `System` de regras** (ADR 001) | Revogado por este ADR (D1). Colide com ADR 004/009 e com dado rolado no servidor |
| **Recuperação implícita todo turno** (molde do `dnd-llm-game`) | Chamada de rede por turno num caminho com teto de 60s, para um contexto que a maioria dos turnos não usa |
| **Só busca lexical (`pg_trgm`), sem embedding** | Tentador: zero custo por token, extensão já disponível, nenhuma chave nova. Perde sinônimo e paráfrase — que é justamente como o Mestre consulta lore ("quem manda na vila?" não casa literalmente com o parágrafo que responde). **Rejeitada com ressalva:** se o custo de embedding inviabilizar o acervo, é o degrau abaixo, e a §4 mostra que ele está disponível |
| **Guardar o arquivo original em object storage** | Não existe na pilha, custa dinheiro, e aumenta exposição sem servir a nada que o chunk não sirva |

---

## 6. Consequências

**Boas**

- A promessa de produto do PRD sai do papel sem serviço novo, conta nova ou custo novo.
- A fronteira regra × lore fica escrita antes de existir código para violá-la — que é o único momento em que essa escrita é barata.
- O acervo de lore não compete com o prefixo cacheável: turno sem lore custa exatamente o que custa hoje.

**Ruins, e aceitas**

- **Sem upload self-service no primeiro corte.** O jogador não sobe o próprio livro; a mantenedora roda o script. É regressão frente ao PRD, e o preço de não ter worker durável.
- **Trocar o modelo de embedding re-embeda o acervo inteiro.** Mitigado pela marca do D6, não eliminado.
- **Provavelmente env var nova em painel** se o embedding não vier do OpenRouter — a fricção manual de três painéis que a US-59 documentou.
- **O risco jurídico continua aberto.** D7 reduz superfície; não dá cobertura.
- **`Adventure` ganha vizinhança nova no schema** (acervo, chunk, vetor), com migração na Neon por `migrate deploy` — `pnpm db:migrate` falha ali com P1017/shadow DB (AGENTS.md → *Armadilhas*).

---

## 7. Questões em aberto

1. **Qual provider de embedding?** Critérios, em ordem: (a) alcançável pela `OPENROUTER_API_KEY` que o runtime já carrega — evita env var nova; (b) dimensão de vetor estável entre versões; (c) barato por token de entrada, que é onde está o volume da ingestão; (d) sem teto de requisições que um livro inteiro estoure em lote (o mesmo 413/6000 TPM que a [US-114](../sdlc/01-requisitos/US-114-modelo-utilitario-para-extracao-e-fecho.md) documenta para o Groq). Escolher no dia, do catálogo vivo — `model.ts` é a fonte, não este documento.
2. **Chunking de quê, e de que tamanho?** PDF de livro de RPG tem duas colunas, caixas de texto, statblock e tabela — extração ingênua embaralha tudo. O corte por parágrafo pode não sobreviver ao layout. Medir contra um livro real antes de fixar; é a parte da ingestão com maior chance de sair errada em silêncio.
3. **A política de upload aguenta revisão legal?** D7 é decisão técnica. Uso privado, sem compartilhamento e sem redistribuição é a postura; se ela basta, este ADR não decide, e o ADR 001 já dizia que não deveria decidir sozinho.
4. **Lore de livro e o ledger de entidades se falam?** Um NPC que o Mestre registra via `recordEntity` e um NPC que vive num chunk do livro são a mesma pessoa sem nenhum vínculo entre si. Deixar separado é o corte barato; se o Mestre passar a contradizer o livro, a costura é assunto de story, não deste ADR.

---

## 8. Implementação (referência)

> *Onde isto encosta. Não é especificação — a story que implementar decide o detalhe.*

- [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) — onde o acervo e os chunks entram. `Adventure.entities` (`:77`) é o precedente de coluna `Json`; aqui, ao contrário, há tabela e coluna vetorial de verdade, então **há migração**.
- [`apps/api/src/ai/ai.service.ts:585`](../../apps/api/src/ai/ai.service.ts) — a tool `getSpell`, molde exato da tool de lore do D4: só leitura, *awareness*, sem efeito mecânico. O objeto `tools` fica em `:349-585`; cada `description` nova vai ao modelo **todo turno**.
- [`scripts/srd/ingest.mjs`](../../scripts/srd/ingest.mjs) — o molde de pipeline do D3: roda fora do runtime, determinístico, artefato versionado. O que muda é ser retomável.
- [`packages/ai-engine/src/model.ts`](../../packages/ai-engine/src/model.ts) — onde o modelo de embedding se registra, ao lado da escada de narração; `:47` é o comentário que separa provider de build de provider de runtime.
- [`render.yaml:52-55`](../../render.yaml) — os dois segredos de LLM que o runtime carrega hoje; qualquer terceiro é trabalho manual de painel.
- [ADR 006 §D3](./006-deploy-custo-zero.md) — a Neon Free, onde o `CREATE EXTENSION vector` acontece.
