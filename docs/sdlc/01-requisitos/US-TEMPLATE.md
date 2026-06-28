# US-XX — [Título curto da story]

**Épico:** [número] — [Nome do épico]
**Fase:** [número] — [Nome da fase]
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [story ou feature que precisa existir antes, ou "nenhuma"]
**Criada em:** YYYY-MM-DD

---

## História

> **Como** [persona / papel do usuário],
> **quero** [ação ou capacidade desejada],
> **para que** [benefício ou objetivo].

---

## Contexto e motivação

### O problema observado

[Descreva o comportamento atual problemático ou a lacuna. Se possível, use um exemplo concreto — uma sessão real, um bug, um cenário de uso — que mostre por que a story é necessária.]

### Por que a solução atual não basta

[Explique por que o estado atual do código não resolve o problema. Referencie arquivos ou mecanismos existentes que tentam cobrir isso mas ficam aquém.]

### A proposta

[Uma ou duas frases descrevendo a solução proposta em termos de negócio/produto, sem entrar em implementação ainda.]

---

## Escopo

### Dentro do escopo

- [Item 1]
- [Item 2]
- [Item 3]

### Fora do escopo

- [Item que parece relacionado mas não entra aqui — com uma justificativa]
- [Pode virar story futura]

---

## Modelo de dados proposto

> *Preencha apenas se a story introduz dados novos ou altera o schema. Caso contrário, remova esta seção.*

```json
{
  "campo": "valor de exemplo"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `campo` | tipo | O que representa. |

**Persistência:** [Onde e como esses dados vivem — tabela Prisma, Redis key, etc.]

---

## Critérios de aceite

- [ ] [Critério 1 — verificável, com verbo no presente: "Existe X", "O sistema faz Y", "Ao fazer Z, acontece W".]
- [ ] [Critério 2]
- [ ] [Critério 3]
- [ ] **Eval / teste de regressão:** [Descreva o cenário mínimo que falha se a story não estiver implementada corretamente.]

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- [Ponto técnico relevante, ex.: "Reaproveitar X de Y"]
- [Arquivo principal a tocar]
- [Armadilha conhecida]

---

## Questões em aberto

1. [Decisão técnica ou de produto que ainda não foi tomada]
2. [Trade-off que precisa ser resolvido antes de implementar]

---

## Referências no código

- `[caminho/para/arquivo.ts]` — [o que é e por que é relevante para esta story]
- `[outro/arquivo]` — [relevância]
