# ADR 001 — Arquitetura do AI Dungeon Master

**Status:** Proposto  
**Data:** 2026-06-27  
**Decisores:** Time de Produto e Engenharia

---

## 1. Contexto

Construir um AI Dungeon Master (AI DM): jogadores jogam sozinhos ou em grupo qualquer sistema
de RPG narrativo (D&D ou outros via upload), e mestres humanos podem usá-lo como apoio.

O sistema precisa:
- Entender regras de sistemas distintos e narrar a aventura.
- Manter ficha de personagem com persistência entre aventuras.
- Suportar campanhas multiplayer (até 10 personagens), missões, multiverso e memória de longo prazo.
- Permitir upload de livros/aventuras para criar sistemas e campanhas.
- Estar alinhado ao estado da arte de desenvolvimento web com IA em TypeScript.

Desafios técnicos principais:
- (a) Jogabilidade em tempo real e em grupo
- (b) Memória persistente e coerente do personagem e da narrativa
- (c) Raciocínio sobre regras de sistemas arbitrários
- (d) Ingestão de conteúdo com risco de direitos autorais

---

## 2. Decisão

Adotar arquitetura **full-stack TypeScript, modular, orientada a eventos**, com camada de IA
baseada em **RAG + tool calling**, e estado de jogo persistido de forma autoritativa no backend.

### 2.1 Visão geral

```
┌──────────────────────────────────────────────────────────┐
│  Cliente (Next.js + React)                                │
│  - UI de mesa, chat narrativo, ficha, rolagem de dados    │
│  - Realtime (WebSocket) para sessão multiplayer           │
└──────────────────────────────────────────────────────────┘
                          │  (HTTPS / WSS)
┌──────────────────────────────────────────────────────────┐
│  Game Server (Node.js + NestJS + TypeScript)              │
│  - Orquestração de turnos, regras determinísticas         │
│  - Autoridade do estado de jogo, dados, missões           │
│  - Gateway de realtime (salas por campanha)               │
└──────────────────────────────────────────────────────────┘
        │                    │                     │
┌───────────────┐  ┌───────────────────┐  ┌──────────────────┐
│  AI Engine    │  │  Persistência     │  │  Ingestão/RAG    │
│  (DM Agent)   │  │  Postgres + Redis │  │  Worker + Vector │
│  LLM + tools  │  │  + Object Storage │  │  Embeddings      │
└───────────────┘  └───────────────────┘  └──────────────────┘
```

### 2.2 Componentes principais

**Frontend — Next.js (App Router) + React + TypeScript**
- SSR/streaming para narração token-a-token
- Tailwind + shadcn para UI
- WebSocket para sala de campanha
- Chat narrativo, ficha e rolagem de dados como componentes reativos ao estado do servidor

**Game Server — NestJS em TypeScript**
- Fonte de verdade do estado de jogo
- Valida e aplica ações (o LLM *sugere*, o servidor *decide e persiste*)
- Rolagem de dados feita em código (RNG criptográfico), nunca delegada ao LLM
- Gerencia turnos, iniciativa, missões e limites (1 personagem por jogador, máx. 10 por campanha)
- Salas de realtime por campanha (Socket.IO)

**AI Engine (DM Agent)**
- Vercel AI SDK (streaming, tool calling agnóstico de provedor) sobre Groq e OpenRouter
- Loop do mestre:
  1. Recebe ação do jogador + contexto recuperado (RAG)
  2. Decide via tool calling quando precisa rolar dados, consultar regra, atualizar ficha, avançar missão
  3. Gera narração em streaming
- Tools tipadas são o contrato entre IA e regras

**Persistência**
- **PostgreSQL + Prisma:** usuários, personagens, campanhas, aventuras, missões, snapshots, EventLog
- **Redis:** sessões ativas, estado de sala, pub/sub, filas leves
- **Object Storage (S3-compatível):** livros enviados e artefatos
- **pgvector:** embeddings de regras, lore e memória de longo prazo (MVP; Pinecone/Qdrant se necessário)

**Ingestão & RAG (worker assíncrono)**
- Upload → fila (BullMQ) → parsing (chunking semântico) → embeddings → indexação no vector store
- Separação de *regras do sistema* e *conteúdo da aventura*
- Memória entre aventuras: EventLog resumido por sessão, indexado para recuperação na aventura seguinte

### 2.3 Modelo de dados (núcleo)

```
User 1─┬─* Character
       │       │ (duplicável → multiverso)
       │       └─* CharacterState (por aventura)
       │
Campaign 1─┬─* CharacterSlot (máx. 10)
           ├─* Adventure 1─* Quest
           └─* EventLog (append-only, base de memória)

System (regras) ◄── derivado de Book (upload) ── RAG index
```

### 2.4 Loop de jogo

```
Jogador → ação → Game Server (valida)
   → AI Engine: monta contexto (estado + RAG: regras + memória)
   → LLM (tool calling): rollDice? updateSheet? advanceQuest?
   → Game Server executa tools (autoritativo) e persiste
   → LLM narra resultado (streaming) → todos os jogadores da sala
   → EventLog atualizado (alimenta memória futura)
```

---

## 3. Decisões-chave e justificativas

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | Full-stack TypeScript (Next.js + NestJS) | Tipos compartilhados entre cliente, servidor e tools de IA reduzem erros |
| 2 | Estado autoritativo no servidor, não no LLM | LLMs alucinam e perdem estado; ficha, dados e missões precisam ser determinísticos e auditáveis |
| 3 | Tool calling para mecânica | Separa narrativa (LLM) de regras (código); suporta sistemas variados sem reescrever prompts |
| 4 | RAG em vez de fine-tuning por sistema | Cada upload vira índice consultável; suporta "qualquer sistema" sem treinar modelo por jogo |
| 5 | pgvector como vector store inicial | Menos infraestrutura; um único Postgres para dados relacionais + embeddings no MVP |
| 6 | Realtime via WebSocket + Redis pub/sub | Sessões em grupo exigem baixa latência e estado de sala compartilhado e escalável |
| 7 | Ingestão assíncrona com BullMQ | Parsing/embedding de livros é pesado; não pode bloquear a requisição do usuário |
| 8 | Provider de LLM abstraído (Vercel AI SDK) | Evita lock-in; provedores atuais: Groq (velocidade/custo) e OpenRouter (variedade de modelos); permite trocar sem reescrever código |

---

## 4. Questões em aberto do PRD

**Pirataria no upload de livros:** uploads tratados como conteúdo privado do usuário (não
compartilhado entre contas). RAG isolado por campanha/usuário. Não redistribuir texto bruto.
Para conteúdo oficial, priorizar SRD e integrações licenciadas. Recomenda-se validação jurídica
antes do lançamento.

**Integração com D&D SDK:** adaptador plugável via interface `RuleSystemProvider` — uma
implementação para D&D via SRD/SDK oficial, outra genérica via RAG do upload.

---

## 5. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| LLM como fonte de verdade do estado | Inconsistência, alucinação de regras, impossibilidade de auditar rolagens |
| Fine-tuning por sistema de RPG | Custo alto, lento, não escala para "qualquer sistema via upload" |
| Backend em Python | Conflita com requisito de TypeScript; perde compartilhamento de tipos |
| Microsserviços desde o início | Complexidade operacional desnecessária no MVP |

---

## 6. Consequências

**Positivas**
- Mecânica de jogo justa, auditável e determinística
- Suporte genérico a múltiplos sistemas sem retreinar modelos
- Tipagem ponta-a-ponta e iteração rápida
- Escala horizontal de sessões via Redis/WS

**Negativas / riscos**
- Custo de inferência cresce com contexto longo — mitigar com sumarização + RAG enxuto
- Qualidade da narração depende de prompt engineering e qualidade dos chunks de RAG
- Risco jurídico de uploads exige política clara e revisão legal
- Latência percebida em grupo precisa de cuidado (streaming + indicador "o mestre está pensando")

---

## 7. Roadmap incremental

| Fase | Entregável |
|------|-----------|
| 1 | MVP single-player: SRD aberto, ficha, dados em código, narração LLM + tool calling, Postgres |
| 2 | Memória entre aventuras: EventLog + sumarização + RAG de memória |
| 3 | Upload de livros: worker de ingestão + RAG por campanha |
| 4 | Multiplayer: salas WebSocket, limite 10, turnos e iniciativa |
| 5 | Multiverso e múltiplas campanhas: duplicação de personagem, históricos |
| 6 | Provider D&D oficial e refinamento de regras por sistema |
