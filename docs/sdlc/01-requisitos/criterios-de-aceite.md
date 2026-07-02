# Critérios de Aceite — AI Dungeon Master

**Fase atual:** Fase 1 — MVP single-player  
**Atualizado em:** 2026-07-02

> ⚠️ US-01 e o critério transversal de isolamento foram alinhados à [ADR 003](../../adr/003-sistemas-como-dado.md): sistema como dado (US-21) e fim da entidade `Campaign` (US-22).

---

## US-01 — Criar personagem

- [ ] O jogador escolhe o sistema antes de criar o personagem; o personagem é vinculado a esse sistema (`systemId`)
- [ ] Os atributos disponíveis e seus limites vêm do `System.config` do sistema escolhido — não de uma lista fixa de atributos (ver US-21)
- [ ] Os atributos informados são validados contra o `System.config` (nomes e min/max); valores fora do intervalo são rejeitados
- [ ] O HP inicial é calculado conforme o sistema escolhido (Free é o padrão do MVP), não fixo em D&D 5e
- [ ] O personagem é salvo no banco com ID único e o seu `systemId` antes do início da aventura

## US-02 — Ver ficha do personagem

- [ ] A ficha exibe HP atual e máximo, atributos, modificadores, inventário e status de condição
- [ ] A ficha é atualizada em tempo real quando o mestre aplica dano, cura ou mudança de status
- [ ] A ficha é acessível durante qualquer ponto da aventura sem interromper a narração

## US-03 — Personagem persiste entre aventuras

- [ ] Ao iniciar uma nova aventura, o DM Agent recebe um resumo dos eventos relevantes da aventura anterior
- [ ] O resumo inclui: missões completadas, itens obtidos/perdidos, mudanças de nível, NPCs conhecidos
- [ ] O jogador pode ver o histórico de aventuras anteriores do personagem

## US-08 — Narração em streaming

- [ ] O texto da narração aparece progressivamente (streaming) sem esperar o fim da resposta
- [ ] Um indicador visual de "o mestre está pensando" aparece enquanto o LLM processa
- [ ] O streaming não bloqueia a interface; o jogador pode rolar o histórico durante a narração

## US-09 — Rolagem de dados transparente

- [ ] Toda rolagem exibe: fórmula solicitada, valores individuais dos dados, modificadores e total
- [ ] Exemplo: `Ataque: 1d20+5 → [14] +5 = 19`
- [ ] O resultado da rolagem é processado no Game Server (não pelo LLM)
- [ ] O histórico de rolagens da sessão é acessível ao jogador

## US-10 — Consulta de regras

- [ ] O DM Agent busca a regra correta via RAG antes de aplicar mecânicas de combate, magia ou habilidades
- [ ] Quando uma regra não é encontrada no índice, o agente narra de forma coerente e registra a incerteza no log
- [ ] O agente não inventa modificadores ou números que não constem no sistema ativo

## US-11 — Ação em linguagem natural

- [ ] O jogador pode descrever ações em texto livre em português ou inglês
- [ ] O agente interpreta a intenção e solicita a rolagem de dados adequada quando necessário
- [ ] O agente descreve as consequências da ação na narrativa após resolver a mecânica
- [ ] Ações inválidas (impossíveis pelo sistema) geram resposta narrativa coerente em vez de erro técnico

---

## Critérios de aceite transversais (todos os stories)

- [ ] Todas as alterações de estado do personagem são persistidas antes da narração ser enviada ao cliente
- [ ] Falhas no LLM (timeout, erro de API) são tratadas com mensagem amigável ao jogador sem corromper o estado do jogo
- [ ] A resposta do DM Agent não contém informações de outros usuários ou aventuras
- [ ] Rolagens de dados são auditáveis: cada resultado tem timestamp, seed e contexto registrados no EventLog
