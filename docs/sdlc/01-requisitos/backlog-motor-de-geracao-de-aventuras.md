# Backlog — Motor de geração de aventuras autorais (mundo-primeiro)

**Objetivo:** gerar aventuras one-shot **autorais** — mundo bespoke nomeado, 3 facções concorrentes, arco em atos/sessões, fecho ramificado sem herói — no nível do exemplar *O Olho de Iremet*, mantendo a mecânica 5e SRD.

**Decisão de produto:** na **fase 1 este backlog é o único caminho de aventura gerada**. A campanha com arco de história ([backlog do Lazy GM](./backlog-aventuras-autorais-lazygm.md)) segue adiada pra **fase 4 (multiplayer)**.

**Criado em:** 2026-08-07
**Reescrito em:** 2026-09-09 — **inversão para geração mundo-primeiro.** A versão anterior (07/08–21/08) montava a aventura de tabelas (rolagem LGMRD com `seed` determinístico). O resultado saiu genérico, plano e de prosa fraca. O Spike 1 (2026-09-09) confirmou que **o modelo autora o mundo primeiro** produz qualidade Khemsar-grade a centavos. Racional completo: [Arquitetura — motor de aventuras autorais](../../arquitetura-motor-aventuras-autorais.md) e [ADR 012](../../adr/012-aventura-gerada-como-dado.md) (revisto). O plano de montagem-por-tabela anterior está **superado** — o histórico dele vive no git e no ADR.
**Status:** 📋 Proposta — reslice pós-inversão, nenhuma tarefa nova iniciada.

Este documento **não é uma user story**. É a sequência de tarefas até a meta. Stories novas ganham número `US-*` ao serem escritas (mesmo padrão da renumeração `GEN-N`→`US-N` do backlog velho); aqui são rótulos provisórios `MA-N` (*motor autoral*).

---

## O desenho (resumo — detalhe no doc de arquitetura)

```
CHAMADA 1 — autoria (modelo deepseek-v4-pro, UMA chamada):
   mundo autoral + tom · facções (3) · conflito + fecho ramificado ·
   locais + NPCs (com fala) · segredos · atos/sessões + followUps ·
   encontros — FICÇÃO só (local + facção + situação, SEM números)
PASSO 2 — números dos encontros (código, 5e): papel de statblock + orçamento pro nível
PASSO 3 — gate: parse + grafo fecha + orçamento cabe + saneamento de mecânica na prosa
                Falha ⇒ regenera a CHAMADA 1 (teto de tentativas ⇒ erro + retry na tela)
```

- **Params de mundo** (cenário/tom/área) viram restrição no prompt; "Aleatório" = campo omitido = modelo livre (sem `seed`). Desafio → orçamento do encontro (PASSO 2), não autoria.
- **Locale:** prosa no idioma do personagem; chaves canônicas EN.
- **Exemplar** fica fora do prompt (só eval) — ensina qualidade, não motivo.
- **Derivação do personagem:** gancho leve, opcional, robusto a `background` vazio.

---

## A migração: o que sobrevive, rebaixa, sai, nasce

| Story velha | Destino sob a inversão |
|---|---|
| **US-144** schema | **Sobrevive e cresce** → MA-1 (`world`/`factions[]`/`acts[]`/`branchedResolution`; `conclusion` sai; `hazardTable` NÃO entra — removida 10/09) |
| **US-150** gate | **Sobrevive, adapta** → MA-4 (regenera-on-fail, grafo sobre schema rico, + saneamento de mecânica) |
| **US-151** semear ledger do artefato | **Sobrevive** → MA-9 (deriva ledger do artefato congelado) |
| **US-152** statblocks por papel | **Sobrevive** → MA-3 (PASSO 2) |
| **US-159/160** orçamento de encontro | **Sobrevive** → MA-3 (PASSO 2) |
| **US-153** aventura não derivada da classe | **Sobrevive** → MA-9 (chama o motor; derivação vira gancho leve) |
| **US-154** eval | **Sobrevive, recalibra** → MA-8 (exemplar *O Olho de Iremet* + asserts; juiz satura) |
| **US-155** aposentar quest fixa | **Sobrevive** → MA-9 |
| **US-156/157** catálogos + tela de mundo | **Sobrevive, adapta** → MA-6 (knob = restrição no prompt; Aleatório = omitido; + toggle pronta×criar US-216/217) |
| **US-161/165** modo desafio | **Sobrevive** → alimenta MA-3 (orçamento), não a autoria |
| **US-162/163** dials (nº de segredos, tamanho) | **Sobrevive como param do prompt** → dobra em MA-1 (quantidade pedida na autoria), não story própria |
| **US-145** sync LGMRD + Monster Builder | **Rebaixa parcial** → MA-7: a metade **Monster Builder** (statblocks, MA-3) FICA; as 135 tabelas LGMRD deixam de ser espinha (viram inspiração opcional no prompt, ou saem — decisão aberta 1) |
| **US-146** seed determinístico | **SAI** — código morto (seed morto, ADR 012 D1); remover (gate `pnpm dead`, US-89) → MA-7 |
| **US-147** rolagem registro+conteúdo | **SAI como espinha** — modelo autora, não rola tabela → MA-7 |
| **US-158** locais/NPCs com prosa (passo próprio) | **Some** — dobra na CHAMADA 1 (autoria produz locais/NPCs) |
| **US-149** segredos pelos 40 prompts | **Some** — dobra na CHAMADA 1; os 40 prompts podem informar o prompt de autoria |
| **US-164** orquestrador (encadeia 6 passos) | **Reduz** → MA-1: não encadeia, é o call único + montagem do `GeneratedAdventure` |
| **US-166** múltiplos encontros | **Some** — a CHAMADA 1 emite N ficções de encontro; PASSO 2 preenche cada |
| **US-190** antagonista (passo próprio) | **Some** — dobra na CHAMADA 1 (conflito central + facções) |
| **US-181/183** ancorar want/method/connection | **Some** — dobra em `branchedResolution` da CHAMADA 1 |

---

## Tarefas

Caminho crítico marcado ✱.

**✱ MA-1 — schema cresce + prompt de autoria call único**
Reabre a US-144: schema ganha `world` (nome/descrição/locais-âncora), `factions[]` (id/name/kind/want + vínculos por id), `acts[]` (sessões, cada uma com gancho), `branchedResolution` (`{choice, consequence}[]`, **substitui** `conclusion`); `encounters[]` ganha campo de **ficção** (situação) além de `locationId`/`npcIds[]`. `start`/`followUps[]` ficam.
Escreve o prompt de autoria mundo-primeiro: uma chamada, via a **escada de prosa** nova em `model.ts` (`deepseek-v4-pro` → `deepseek-v4-pro-0813` → `deepseek-v4.1-flash`, molde de `narrationModels` — pro em descontinuação, escada absorve), que emite tudo acima em ordem (mundo→facções→conflito+fecho→locais/NPCs com fala→segredos→atos+tabela+followUps→ficção dos encontros), no locale do personagem. Params de mundo entram como restrição (rótulo pt-BR); background como gancho leve opcional; exemplar **fora** do prompt (qualidade abstrata). Referência-base: `packages/ai-engine/adventure-authoring-spike.mjs`.
Depende de: nada. Bloqueia: quase tudo.

**✱ MA-3 — números dos encontros (PASSO 2, 5e determinístico)**
Reusa US-152 (statblock por papel, do `5e_Monster_Builder.json`) + US-159/160 (orçamento *Lazy Encounter Benchmark* pro nível, `encounterDeadlyThreshold`). Pega a **ficção** de cada encontro que a CHAMADA 1 emitiu e preenche papel + orçamento pra um personagem solo do nível. Modo desafio (US-161) escolhe o orçamento. Sem RNG de seed — as funções já são puras por `level`/`challenge`.
Depende de: MA-1, MA-7 (metade Monster Builder).

**✱ MA-4 — gate: parse + grafo + orçamento + saneamento, regenera-on-fail**
Adapta US-150. Quatro verificações: (1) `parse()` do schema de MA-1; (2) grafo fecha (todo `locationId`/`npcId`/`factionId` referenciado existe; sem órfão); (3) orçamento de cada encontro cabe no nível; (4) **saneamento de mecânica na prosa** (contrato US-29: nenhum número de rolagem/CD/dano na prosa — strip; perícia nomeada validada contra o catálogo do sistema, reprova "Sabor"). Falha ⇒ **regenera a CHAMADA 1** (não re-seed — seed morreu), teto de tentativas explícito. Teto estourado ⇒ sinaliza falha pra MA-5.
Depende de: MA-1, MA-3.

**✱ MA-5 — gatilho assíncrono + tela de espera + erro/retry**
Geração roda em **background** (não no caminho síncrono da criação — estoura o teto SSE 60s, US-60). Tela de espera (US-197, carrossel) durante o cook. Dois estados terminais: sucesso → entra no jogo; falha (teto do gate estourado, MA-4) → **tela de erro + "Criar aventura de novo"** (retry da autoria). **Nunca** cai pra "Aventura pronta".
Depende de: MA-4, US-197.

**✱ MA-6 — params de mundo como restrição + toggle pronta×criar**
Adapta US-156/157: os catálogos `settings`/`tones`/`areaTypes` (chave+rótulo, US-105) continuam, mas o valor escolhido vira **linha de restrição no prompt de autoria** (MA-1), não índice de tabela. "Aleatório" = **campo omitido** = modelo livre (muda a semântica da US-156: não é mais seed sorteando). Toggle "Aventura pronta × Criar minha história" (US-216/217) roteia: pronta = gancho de classe fixo (sem motor); criar = MA-1. Desafio (US-161/165) segue pro orçamento (MA-3), não pra autoria.
Depende de: MA-1.

**✱ MA-7 — remove seed, rebaixa LGMRD, mantém Monster Builder**
Remove `deriveAdventureSeed`/`createSeededRandom` (US-146) e a rolagem-espinha (US-147) — código morto pós-inversão (gate `pnpm dead`, US-89). O `sync` do `5e_Monster_Builder.json` (US-145) **fica** (statblocks, MA-3). As 135 tabelas do LGMRD saem da espinha; ver decisão aberta 1 (inspiração no prompt ou fora de vez).
Depende de: nada (limpeza). Bloqueia MA-3 na parte Monster Builder.

**✱ MA-9 — motor entra em `createForCharacter`, ledger do artefato, aposenta gancho**
`createForCharacter` chama o motor (MA-1→MA-3→MA-4) em vez de `resolveInitialHook(config, class)`; sai a validação que rejeita hook ≠ classe (US-153). Semeia o ledger `WorldEntity[]` a partir do artefato congelado (US-151: segredos `revelado:false`, NPCs `revelado:true`). Aposenta `primaryQuestTitle`/`primaryQuestDescription` dos ganchos (US-155). Gancho de classe sobrevive só como **porta de entrada** (`openingNarration` = seed do gancho leve) e como caminho "Aventura pronta" (US-217).
Depende de: MA-1, MA-4, US-151.

**MA-8 — eval da aventura gerada, recalibrada**
Adapta US-154. Exemplar de referência = **O Olho de Iremet** (solo, pt-BR, autoral — a lacuna que o backlog velho lamentava, agora preenchida). Como o juiz LLM **satura** nesta tarefa (medido no Spike 1), a rubrica ancora em **asserts sobre o artefato** (grafo fecha, `secretId` oculto, NPC existe, orçamento cabe), não na nota do juiz. Live eval opcional no caminho de criação.
Depende de: MA-1, MA-9.

---

## Corte mínimo

**MA-1 + MA-3 + MA-4 + MA-5 + MA-6 + MA-7 + MA-9** — sete tarefas, nenhuma de escrita à mão, nenhuma dependência de outro backlog. Fora do corte: MA-8 (eval), refino dos dials (US-162/163 dobrados em MA-1).

Critério de saída: um perfil pinado, aventura gerada jogada ponta a ponta à mão, comparada a *O Olho de Iremet*. Se sair genérica/plana, o resto é trabalho jogado fora — mesmo critério do backlog velho, agora com exemplar de verdade pra medir.

---

## Depende de

| # | Dependência | Estado |
|---|---|---|
| Nenhuma story deste repo | — | O corte roda sozinho |
| US-197 tela de espera | Existe | MA-5 consome |
| US-216/217 pronta×criar | Existe | MA-6 consome (roteamento) |
| D1 progressão de nível | Não existe | Só pra gerar acima do nível 1; one-shot não precisa (ver *ressalva do nível* — inalterada) |

---

## Decisões tomadas (2026-09-09, inversão)

Todas em [Arquitetura — motor de aventuras autorais](../../arquitetura-motor-aventuras-autorais.md) e [ADR 012](../../adr/012-aventura-gerada-como-dado.md):
- Geração **mundo-primeiro** (modelo autora; tabelas viram tempero), **call único** (não cadeia — Spike provou que basta, e é mais rápido/menos código).
- Mecânica **5e** (só apresentação/estrutura vem do alvo; nada de 2E). Modelo de prosa: **escada** `deepseek-v4-pro` → `-pro-0813` → `deepseek-v4.1-flash` (pro preferido mas em descontinuação; 10/09).
- `seed` **aposentado**; repro = artefato congelado; eval = rubrica ancorada em asserts.
- Encontros: **ficção do modelo, números do código** (abordagem A).
- Saneamento de mecânica na prosa (US-29). Falha do gate = erro + retry, nunca fallback pra pronta. Artefatos velhos **descartados** (sem migração; escopo pré-lançamento).

## Decisões abertas

1. **As 135 tabelas do LGMRD entram como inspiração no prompt de autoria, ou saem de vez?** O Spike gerou Khemsar-grade **sem** elas. Medir se agregam antes de manter o `sync` da metade LGMRD (a metade Monster Builder fica de qualquer jeito). Decidir junto de MA-1/MA-7.
2. **Quantos NPCs/segredos/locais a autoria pede?** Os dials US-162/163 viram parâmetro do prompt (MA-1); os números-alvo (~6 locais, ~7 NPCs, ~11 segredos) do backlog velho servem de default, a confirmar contra a qualidade da saída.
3. **4 sessões/atos × sem progressão de nível.** A estrutura multi-sessão sugere evolução que a fase 1 não entrega (nível trava em 1). Registrado — a aventura pode ser multi-sessão sem subir nível, mas a tensão fica anotada pra quando a D1 existir.

## Referências no código

- [packages/shared/src/types/adventure-generation.ts](../../../packages/shared/src/types/adventure-generation.ts) — `GeneratedAdventureSchema`, cresce em MA-1.
- [packages/ai-engine/adventure-authoring-spike.mjs](../../../packages/ai-engine/adventure-authoring-spike.mjs) — o Spike 1, referência-base do prompt de MA-1.
- [packages/ai-engine/src/model.ts](../../../packages/ai-engine/src/model.ts) — MA-1 cria a escada de prosa da autoria aqui (`deepseek-v4-pro` → `-pro-0813` → `deepseek-v4.1-flash`), molde de `narrationModels`.
- [apps/api/src/adventure-generation/adventure-gate.ts](../../../apps/api/src/adventure-generation/adventure-gate.ts) — gate de MA-4 (adapta o regenera-on-fail).
- [apps/api/src/adventure/adventure.service.ts](../../../apps/api/src/adventure/adventure.service.ts) — `createForCharacter`, onde MA-9 entra.
- [packages/shared/src/adventure-seed.ts](../../../packages/shared/src/adventure-seed.ts) — `deriveAdventureSeed`, **código morto** a remover em MA-7.
- [backlog-aventuras-autorais-lazygm.md](./backlog-aventuras-autorais-lazygm.md) — o produtor B (fase 4), inalterado.
