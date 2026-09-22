# US-266 — Perícias: a instrução e o contador vêm antes, e cada fonte de escolha tem o seu

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Concluída
**Depende de:** [US-207](./US-207-atributos-e-pericias-com-orcamento-visivel.md) (✅ — `CounterBadge`) · [US-131](./US-131-integracao-mecanica-background-proficiency.md) (✅ — grant de perícia da origem) · [US-220](./US-220-pericias-proficientes-por-raca.md) (✅ — perícia à escolha de raça)
**Relacionada a:** [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md) (📋 — já planeja o cabeçalho de três linhas em todas as etapas; **não duplicar aqui**)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.

---

## História

> **Como** jogadora na etapa Perícias,
> **quero** ler primeiro quantas escolhas tenho e de onde vêm, e ver quanto já gastei em cada fonte,
> **para que** eu não escolha à toa e descubra que faltava uma perícia da origem lá em cima.

---

## Contexto e motivação

### O problema observado

A etapa junta até três fontes de escolha na mesma tela (origem, raça, classe). Na ordem de leitura ([SetupWizard.tsx:1689-1793](../../../apps/web/src/components/setup/SetupWizard.tsx)):

1. bloco da origem (pode exigir escolha: `chooseCount`, ex. "duas à sua escolha" no Guildmember),
2. bloco da raça (Meio-elfo escolhe 2),
3. **só então** a instrução "Escolha {n} perícias" e o `CounterBadge`, que contam **apenas** a parte da classe.

A tarefa principal fica no fim. Os blocos de origem e raça, que também bloqueiam o "Próximo" (`canAdvance('skills')` os checa, [:881](../../../apps/web/src/components/setup/SetupWizard.tsx)), não têm contador nem instrução. Os cartões `full` (limite atingido) só ficam a 40% de opacidade (`optionCardClass`, [dm.tsx:82](../../../apps/web/src/components/ui/dm.tsx)) sem dizer por quê.

O cabeçalho de três linhas por etapa (chamada, pergunta, apoio) já é da [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md); esta story não o toca.

### A proposta

Instrução geral no topo ("Você escolhe perícias de até três fontes"), depois um bloco por fonte, cada um com o **mesmo `CounterBadge`** ("Origem 1/2", "Raça 0/2", "Classe 2/4"). Cartão bloqueado por limite mostra o motivo.

---

## Escopo

### Dentro do escopo

- Reordenar: instrução geral, depois blocos origem → raça → classe (a ordem em que a jogadora as escolheu).
- `CounterBadge` por bloco que exige escolha (`chooseCount > 0` / `raceSkillChoiceCount`), com `complete` quando fecha.
- Motivo do cartão desabilitado por limite: texto curto no bloco ("Limite atingido — desmarque uma para trocar"), ligado por `aria-describedby`; sem depender só de opacidade.

### Fora do escopo

- **Cabeçalho uniforme entre etapas** — [US-204](./US-204-wizard-em-duas-colunas-com-ficha-viva.md).
- **Auto-substituição em colisão de perícia** (o `effectiveSkillChoices` já trata) — sem mudança de regra.

---

## Critérios de aceite

- [x] A instrução geral aparece antes de qualquer bloco de perícia.
- [x] Cada fonte com escolha mostra o seu contador, que vira verde ao fechar.
- [x] Um cartão bloqueado por limite tem texto explicando, além da opacidade.
- [x] Origem sem `chooseCount` e raça sem escolha não mostram contador (só o bloco fixo, se houver).
- [x] **Teste de regressão:** com Guildmember (2 à escolha) + classe com 4 perícias, três contadores independentes; fechar um não altera os outros.

---

## Notas de implementação

- `CounterBadge` já existe em [SetupWizard.tsx:143](../../../apps/web/src/components/setup/SetupWizard.tsx); extrair para o módulo de UI do wizard, não copiar.
- Os três blocos repetem o mesmo cartão (nome + modificador). Uma função de 4–20 linhas para o bloco evita triplicar.

---

## Questões em aberto

1. **Um contador total além dos três?** Provavelmente ruído; só se os contadores por fonte não bastarem.

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — etapa `skills` (:1689-1793), `canAdvance('skills')` (:881)
- [dm.tsx](../../../apps/web/src/components/ui/dm.tsx) — `optionCardClass` (:80)
