# US-268 — Atribuir o +1 de origem e de raça com um controle explícito, não com uma pílula de 10px

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-123](./US-123-integracao-mecanica-background-pointbuy.md) (✅ — +1 livre da origem) · [US-212](./US-212-bonus-de-atributo-de-raca-na-etapa-de-atributos.md) (✅ — bônus de atributo de raça) · [US-207](./US-207-atributos-e-pericias-com-orcamento-visivel.md) (✅ — `CounterBadge`)
**Relacionada a:** [US-259](./US-259-proximo-desabilitado-diz-o-que-falta.md) (a pendência "escolha onde vai o +1" precisa aparecer) · [US-262](./US-262-distribuicao-recomendada-de-atributos.md) · [US-269](./US-269-acessibilidade-do-wizard-alvos-erro-e-foco.md)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código. Alvo de toque inferido do CSS, não medido no navegador.

---

## História

> **Como** jogadora escolhendo onde aplicar o +1 da minha origem (ou os dois +1 do meio-elfo),
> **quero** um controle que pareça um controle e diga o que falta,
> **para que** eu descubra como fazer a escolha sem procurar uma pílula tracejada.

---

## Contexto e motivação

### O problema observado

Em `attributes`, a escolha do +1 acontece **dentro** de cada linha, por `AbilityBonusBadge` ([SetupWizard.tsx:125](../../../apps/web/src/components/setup/SetupWizard.tsx)): `px-2 py-0.5 text-[10px]`, ou seja ~18px de altura, com variante tracejada ("fantasma") como única pista de que dá para clicar. O texto é o mesmo ("+1 origem") tanto para o que já é fixo quanto para o que é escolhível.

Além disso:

- O selo "Principal" (informativo, [:1650](../../../apps/web/src/components/setup/SetupWizard.tsx)) usa a variante `solid` verde, idêntica à do bônus mecânico. Duas informações diferentes com a mesma aparência.
- Até três selos numa linha só (`Principal`, `+1 origem`, `+N raça`).
- Sem escolha feita, o "Próximo" fica desabilitado sem dizer por quê (ver [US-259](./US-259-proximo-desabilitado-diz-o-que-falta.md)).

### A proposta

Quando a origem ou a raça exigem escolha, um bloco no topo da etapa: "Aplique o +1 da sua origem (Soldado)", com os atributos elegíveis como botões de alternância (`aria-pressed`) de alvo ≥44px e contador X/N (o mesmo `CounterBadge`). A linha do atributo só **mostra** o resultado (selo sólido). "Principal" muda de aparência para não ser lido como bônus.

---

## Escopo

### Dentro do escopo

- Bloco de escolha por fonte (origem, raça) com contador e botões ≥44px, `aria-pressed`, dentro de `fieldset`/`legend`.
- Selo de bônus na linha vira só leitura (não clicável).
- "Principal" com tratamento neutro, diferente do selo de bônus.
- Reaproveitar os estados existentes (`abilityChoice`, `raceAbilityChoice`); sem mudança de payload.

### Fora do escopo

- **Mudança na regra de negócio** do bônus (o que cada origem/raça concede). Só a interface.
- **Redesenhar o point-buy** (+/−, contador de pontos) — funciona e tem alvo de 44px.

---

## Critérios de aceite

- [ ] Origem com `grant.kind === 'ability'` mostra o bloco de escolha com os atributos elegíveis; a linha do atributo escolhido mostra o selo sólido e não é clicável.
- [ ] Raça com `grant.choice` (contagem 2) mostra "0/2 → 2/2"; a terceira escolha fica bloqueada com motivo.
- [ ] Cada botão de escolha tem alvo ≥44px e `aria-pressed`.
- [ ] O selo "Principal" é visualmente distinto do selo de bônus.
- [ ] O total exibido (`attrs + bônus`) e o payload enviado não mudam em relação ao fluxo atual.
- [ ] **Teste de regressão:** origem "+1 livre" + raça com escolha de 2: as três escolhas mudam o total exibido e o payload igual ao de hoje; o "Próximo" só habilita com as três feitas.

---

## Notas de implementação

- `abilityChoice` (uma chave) e `raceAbilityChoice` (array) já são estados independentes. O bloco novo só troca o **gatilho**, não o estado.
- A linha do atributo (:1647-1682) já é longa; extrair a linha para componente próprio ao mexer nela (função de 4–20 linhas).
- **Não reimplementar** o cálculo de `bonus`/`total`; já existe.

---

## Questões em aberto

1. **Bloco no topo ou dentro da lista?** Topo evita procurar; dentro mantém a relação com o atributo. Recomendação: topo; validar no visual (não renderizei).

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — `AbilityBonusBadge` (:125-137), linhas de atributo (:1624-1685)
