# US-267 — Um termo por conceito no wizard: Espécie ou Raça, Origem ou Background

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-98](./US-98-i18n-da-interface-web.md) (✅ — dicionário de texto) · [US-205](./US-205-escolha-por-cartao-classe-e-raca.md) (✅)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código.

---

## História

> **Como** jogadora,
> **quero** que o mesmo conceito tenha o mesmo nome em todas as telas da criação,
> **para que** eu não ache que "Espécie" e "Raça", ou "Background" e "Origem", são coisas diferentes.

---

## Contexto e motivação

### O problema observado

Em pt-BR ([pt-BR.ts](../../../apps/web/src/messages/pt-BR.ts)):

| Conceito | Onde diz |
|---|---|
| espécie/raça | etapa "Espécie" (:54), eyebrow "Escolha uma espécie" (:125), mas legenda do grupo "Raça" (:133) e linha da revisão "Raça" (:305) |
| origem/background | título da etapa "Background" (:250) e da revisão "Background" (:322), mas seção interna "Origem" (:269, :323) e "O que esta origem te dá" (:255) |

Os docs já dizem "espécie" para a UI (ex.: [US-205](./US-205-escolha-por-cartao-classe-e-raca.md)), então "Raça" na revisão parece resíduo, não escolha. "Background" é palavra inglesa numa tela em português.

### Consideramos e recusamos

A crítica apontava também dois widgets para "escolha um" (cartão para variante/ancestralidade, `<select>` para ferramenta do anão, idioma extra e truque). Isso **já é decisão documentada** no código ([SetupWizard.tsx:1539-1547](../../../apps/web/src/components/setup/SetupWizard.tsx)): eixo de decisão → cartão; escolha subordinada dentro de um traço → `<select>`, com o rótulo já alinhado ao do cartão. Coerente; fica.

---

## Escopo

### Dentro do escopo

- Escolher **um** par de termos (ver Questões) e aplicar em todos os usos de pt-BR **e** en-US, incluindo revisão, legendas `sr-only` e mensagens de erro.
- Inventário por `grep` das chaves `setup.*` que citam os termos antes de editar.

### Fora do escopo

- **Renomear chaves internas** (`raceClass.race`, `character.class`…) e o modelo de dados: são contrato com a API ([US-54](./US-54-chaves-canonicas-em-ingles.md)). Só o texto exibido muda.
- **Traduzir o conteúdo do SRD** (nomes de raça, classe): [US-52](./US-52-traducao-automatica-do-srd.md).

---

## Critérios de aceite

- [ ] Em pt-BR, nenhuma tela de criação usa dois termos para o mesmo conceito.
- [ ] Em en-US, idem (species/race, background/origin).
- [ ] Os testes que selecionam por texto (`getByRole('button', { name: 'Espécie' })`, [SetupWizard.test.tsx:287](../../../apps/web/src/components/setup/SetupWizard.test.tsx)) são atualizados junto.
- [ ] **Teste de regressão:** um teste percorre o dicionário `setup.*` e falha se o termo descartado reaparecer em qualquer chave.

---

## Notas de implementação

- O risco é quebrar seletores de teste que usam o texto ("Background", "Raça"). Grep antes.
- O gate da [US-102](./US-102-gate-de-string-literal-no-jsx.md) não pega texto que já está no dicionário; o teste de vocabulário acima cobre a lacuna.

---

## Questões em aberto

1. **Espécie ou Raça?** SRD 5.2 (2024) usa "espécie"; o SRD 5.1 (2014) usa "raça". O produto já migrou a etapa para "Espécie". Decisão de produto da mantenedora.
2. **Origem ou Background?** O catálogo vem do A5E como "background", a etapa fala em "origem". Recomendação: "Origem" (português), "Background" só no nome do dado.

---

## Referências no código

- [pt-BR.ts](../../../apps/web/src/messages/pt-BR.ts) — `setup.step.race` (:54), `setup.raceClass.race` (:133), `setup.review.race` (:305), `setup.background.titulo` (:250), `setup.review.background` (:322)
