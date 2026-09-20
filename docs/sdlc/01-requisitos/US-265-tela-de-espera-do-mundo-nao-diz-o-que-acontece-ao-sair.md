# US-265 — A tela de espera do mundo não diz que o personagem está salvo nem o que acontece ao sair

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-197](./US-197-tela-de-espera-com-carrossel-na-criacao-da-aventura.md) (✅ — dona da tela) · [US-235](./US-235-gatilho-assincrono-tela-de-espera-erro-retry.md) (✅ — polling de até 300 s, retomada)
**Relacionada a:** [US-256](./US-256-jogador-entra-no-chat-antes-do-resto-da-aventura-gerar.md) · [US-269](./US-269-acessibilidade-do-wizard-alvos-erro-e-foco.md) (o `aria-live` do carrossel)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código. **A crítica original errou aqui:** disse que a tela não tem saída. Tem — `{exitToHub}` renderiza fora do condicional ([SetupWizard.tsx:1237](../../../apps/web/src/components/setup/SetupWizard.tsx)). O que falta é dizer à jogadora o que sair significa.

---

## História

> **Como** jogadora esperando o mundo ficar pronto (até cinco minutos),
> **quero** saber que o meu personagem já está salvo e o que acontece se eu sair,
> **para que** eu não fique parada com medo de perder tudo, nem saia sem saber se a aventura vai existir quando eu voltar.

---

## Contexto e motivação

### O problema observado

`AdventureLoadingScreen` ([AdventureLoadingScreen.tsx](../../../apps/web/src/components/setup/AdventureLoadingScreen.tsx)) mostra o título e uma frase rotativa a cada 3 s. Nada sobre progresso, tempo, nem estado. O motor leva ~95 s esperados e o teto do cliente é 300 s ([:1004](../../../apps/web/src/components/setup/SetupWizard.tsx)). O link "Voltar aos personagens" está no topo, mas a jogadora não sabe se sair mata a geração.

### O que não sei (e a copy depende disso)

O servidor gera de forma assíncrona (`status: 'GENERATING'`, [US-235](./US-235-gatilho-assincrono-tela-de-espera-erro-retry.md)), então sair provavelmente não a interrompe. **Mas** o `apps/web` não trata `GENERATING` em lugar nenhum fora do wizard (grep, fora de testes): não sei o que o hub mostra para um personagem cuja aventura ainda está sendo gerada. Prometer "volte depois" sem isso é afirmar o que não foi verificado.

### A proposta

1. Verificar o que o hub faz hoje com aventura `GENERATING`.
2. Só então escrever a copy: personagem salvo, e a frase verdadeira sobre sair.
3. Depois de um limiar (sugestão: 120 s, acima dos ~95 s esperados), trocar o carrossel por "está demorando mais que o normal".

---

## Escopo

### Dentro do escopo

- Linha fixa na tela de espera: "Seu personagem já está salvo." (verdadeiro desde `handleConfirm`).
- Segunda linha sobre sair — **somente** com o texto que a verificação do passo 1 sustentar.
- Aviso de demora após o limiar, nos dois locales.

### Fora do escopo

- **Barra de progresso real.** Não há sinal de progresso vindo do motor; uma barra falsa seria pior que nenhuma.
- **Mudar o hub** para mostrar "aventura sendo preparada". Se a verificação mostrar que o hub não lida com isso, vira story própria.
- **`aria-live` do carrossel:** em [US-269](./US-269-acessibilidade-do-wizard-alvos-erro-e-foco.md).

---

## Critérios de aceite

- [ ] A tela de espera diz que o personagem está salvo.
- [ ] A frase sobre sair é sustentada por teste ou leitura de código citada nas Notas (o que o hub mostra para `GENERATING`).
- [ ] Após o limiar, a tela mostra o aviso de demora; antes, não.
- [ ] Textos nos dois locales.
- [ ] **Teste de regressão:** com timers falsos, a tela não mostra o aviso de demora aos 100 s e mostra aos 130 s.

---

## Notas de implementação

- O limiar mora como constante ao lado de `STATUS_POLL_TIMEOUT_MS`; não invente configuração.
- Registrar aqui, ao fechar, o que o hub mostra para `GENERATING` (arquivo e linha) — é a evidência da frase sobre sair.

---

## Questões em aberto

1. **O que o hub mostra hoje para personagem com aventura `GENERATING`?** Bloqueia o resto da story. Responde-se lendo o hub e a API, não pedindo opinião.
2. **120 s é o limiar certo?** Medir a distribuição real do motor antes de fixar.

---

## Referências no código

- [AdventureLoadingScreen.tsx](../../../apps/web/src/components/setup/AdventureLoadingScreen.tsx) — carrossel de 3 s
- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `exitToHub` (:1219, :1237), polling (:1003-1023)
