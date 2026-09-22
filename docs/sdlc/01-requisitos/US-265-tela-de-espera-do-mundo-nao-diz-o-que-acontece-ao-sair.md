# US-265 — A tela de espera do mundo não diz que o personagem está salvo nem o que acontece ao sair

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** ✅ Feita
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

## Copy proposta

Chaves seguem o padrão de `setup.world.loading.*` já usado pelo carrossel ([messages/pt-BR.ts:131-136](../../../apps/web/src/messages/pt-BR.ts)).

| Chave | PT-BR | EN-US |
|---|---|---|
| `setup.world.loading.saved` | Seu personagem já está salvo. | Your character is already saved. |
| `setup.world.loading.exit` | Pode sair agora — a aventura continua sendo criada. Volte ao hub pra continuar assim que estiver pronta. | You can leave now — the adventure keeps being created. Come back to the hub to continue once it's ready. |
| `setup.world.loading.delay` | Isso está demorando mais que o normal, mas a aventura ainda está sendo criada. | This is taking longer than usual, but the adventure is still being created. |

**Por que essa redação e não outra:**
- `exit` não promete "vai estar lá quando você voltar" nem "avisa quando terminar" — o hub não tem polling nem indicação de `GENERATING` ([Notas de implementação](#notas-de-implementação) acima), então a única coisa verificável é que sair não mata a geração no servidor (`void this.runAdventureGeneration(...)`, [adventure.service.ts:384](../../../apps/api/src/adventure/adventure.service.ts), fire-and-forget desacoplado da conexão do cliente — comentário em [:330-334](../../../apps/api/src/adventure/adventure.service.ts) confirma a intenção) e que "Continuar" aparece assim que o status vira `OPENING_READY` ou `ACTIVE`.
- `delay` não promete prazo nem sugere recarregar a página — nenhuma das duas coisas foi verificada.
- `saved` reaproveita a frase que já está na história do US-265 (linha 16), verdadeira desde `handleConfirm` ([SetupWizard.tsx:974](../../../apps/web/src/components/setup/SetupWizard.tsx)) — não confundir com a chave existente `setup.world.saved`, que fala do formulário do passo `world` (etapas anteriores travadas), contexto diferente da tela de espera.

## Critérios de aceite

- [x] A tela de espera diz que o personagem está salvo.
- [x] A frase sobre sair é sustentada por teste ou leitura de código citada nas Notas (o que o hub mostra para `GENERATING`).
- [x] Após o limiar, a tela mostra o aviso de demora; antes, não.
- [x] Textos nos dois locales.
- [x] **Teste de regressão:** com timers falsos, a tela não mostra o aviso de demora aos 100 s e mostra aos 130 s.

---

## Notas de implementação

- O limiar mora como constante ao lado de `STATUS_POLL_TIMEOUT_MS`; não invente configuração.
- Registrar aqui, ao fechar, o que o hub mostra para `GENERATING` (arquivo e linha) — é a evidência da frase sobre sair.

### O que o hub mostra para `GENERATING` (verificado em 2026-09-22)

O hub trata personagem com aventura `GENERATING` **igual a personagem sem nenhuma aventura** — sem "continuar", sem indicação de que algo está sendo gerado.

- [character.service.ts:600](../../../apps/api/src/character/character.service.ts) — `currentAdventure` do hub só inclui participação em aventura com status dentro de `IN_PROGRESS_ADVENTURE_STATUSES`.
- [adventure-status.ts:6](../../../apps/api/src/adventure-generation/adventure-status.ts) — `IN_PROGRESS_ADVENTURE_STATUSES = ['ACTIVE', 'OPENING_READY']`. `GENERATING` fica de fora.
- [HomeHero.tsx:132-135](../../../apps/web/src/components/HomeHero.tsx) — sem `currentAdventure`, renderiza `home.noAdventure` ("Nenhuma aventura em andamento"), mesmo estado de quem nunca criou aventura.
- [schema.prisma:154-168](../../../apps/api/prisma/schema.prisma) — ciclo confirmado: `GENERATING → OPENING_READY → ACTIVE` (ou `FAILED`).
- [HomeHero.tsx:77-79](../../../apps/web/src/components/HomeHero.tsx) — hub não faz polling: busca a lista uma vez, só no mount.

**Consequência pra copy:** sair não mata a geração, mas prometer "volte depois e vai estar lá" é falso enquanto o status ainda é `GENERATING` — a jogadora só vê "continuar" quando a aventura virar `OPENING_READY`. A frase sobre sair não pode prometer progresso visível no hub.

**Personagem salvo:** confirmado. [SetupWizard.tsx:974](../../../apps/web/src/components/setup/SetupWizard.tsx) — wizard só cria o personagem em `handleConfirm`, antes do passo `world`.

---

## Questões em aberto

1. ~~**O que o hub mostra hoje para personagem com aventura `GENERATING`?**~~ Respondido — ver Notas de implementação.
2. **120 s é o limiar certo?** Medir a distribuição real do motor antes de fixar.

---

## Referências no código

- [AdventureLoadingScreen.tsx](../../../apps/web/src/components/setup/AdventureLoadingScreen.tsx) — carrossel de 3 s
- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `exitToHub` (:1219, :1237), polling (:1003-1023)
