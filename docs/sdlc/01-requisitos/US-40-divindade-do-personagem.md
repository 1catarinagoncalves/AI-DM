# US-40 — Divindade / patrono do personagem

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** ✅ Implementada
**Depende de:** [US-23](./US-23-dm-ciente-da-ficha.md) (injeção dirigida por dados) · [US-26](./US-26-criacao-personagem-em-etapas.md) (captura na criação)
**Relacionado:** [US-39](./US-39-identidade-narrativa-background-ideais.md) (identidade narrativa — mesma seção do prompt; divindade é o campo específico de classes divinas) · [US-45](./US-45-background-na-ficha-da-interface.md) (aba "Background" na ficha da interface, onde a divindade aparece para o jogador)
**Bloqueia:** [US-17](./US-17-comparacao-modelos-eval.md) slice 2 (paridade de contexto com a referência, cuja paladina é definida por Solariel)
**Criada em:** 2026-07-09

---

## História

> **Como** jogador de uma classe divina (paladino, clérigo…),
> **quero** declarar a divindade/patrono do meu personagem e que o mestre a conheça,
> **para que** a narração ancore invocações, presságios, tom e código moral na fé do personagem — como as visões de Solariel guiavam a paladina da aventura de referência.

---

## Contexto e motivação

### O problema observado

Na aventura de referência ([aventura-seraphine.md](../referencia/aventura-seraphine.md)), **Solariel, o Senhor da Luz Eterna** era metade da identidade da paladina: as bênçãos, o "Detectar o Mal", as visões divinas que julgavam a alma dos cultistas, o tom sagrado. Nada disso é possível no AI DM de hoje — não há campo de divindade em lugar nenhum. O mestre não sabe a quem o personagem reza.

### Por que a solução atual não basta

A [US-39](./US-39-identidade-narrativa-background-ideais.md) cobre identidade **genérica** (background, ideais, vínculos, fraquezas) que todo personagem tem. Divindade é **específica de classes divinas**: nem todo personagem tem uma, e ela carrega um pacote próprio (nome, domínio/portfólio, tom) que molda invocações e presságios. Meter isso num campo genérico de "ideais" perderia a semântica — por isso é story separada.

### A proposta

Um campo **opcional** de divindade/patrono no personagem, injetado no system prompt (na mesma seção de identidade da US-39) quando presente, para o mestre usar como cor divina: invocações, presságios, tom sagrado, código moral da fé. Ausente → sem seção, sem crash.

---

## Escopo

### Dentro do escopo

- Campo **opcional** de divindade no `Character`: nome + descrição/portfólio curto (ex.: domínios, o que a fé representa).
- Captura no **wizard de criação** ([US-26](./US-26-criacao-personagem-em-etapas.md)), junto aos demais campos de background, como **texto livre** e **opcional para todas as classes** (não sugerido/escondido por classe). Rótulo do campo: **"Divindade/Patrono"**.
- Injeção no prompt (linha na seção de identidade) só quando presente, com instrução ao mestre de usar a fé como cor (invocações/presságios/tom), coerente com os ideais/fraquezas da US-39.
- **Divindade visível na ficha (interface):** renderizada na **aba "Background"** da ficha (padrão de abas da [US-45](./US-45-background-na-ficha-da-interface.md)), como bloco próprio, read-only, ao lado de história/ideais/vínculos/fraquezas. Presente → mostra nome + portfólio (ex.: "Solariel, o Senhor da Luz Eterna — justiça, cura e combate ao mal"). Ausente → o bloco **não aparece** (é campo opcional de classes divinas, não um eixo fixo do background); sem bloco fantasma nem crash.

### Fora do escopo

- **Mecânica de fé:** enfraquecer poderes ao violar votos, canalizar divindade, spell slots divinos — narração só; mecânica de oath/domínio é story futura.
- **Catálogo de divindades como dado** (`System.config`, à la [US-20](./US-20-catalogo-de-sistemas-via-api.md)/[US-21](./US-21-sistemas-como-dado.md)) — por ora texto livre; um panteão catalogado é extensão futura.
- **Mecânica de patrono não-divino** (pacto de bruxo/warlock, juramentos seculares) — o rótulo "Divindade/Patrono" já **acomoda o texto** desses casos (texto livre), mas qualquer *mecânica* própria de pacto/juramento é story futura; aqui é só cor narrativa.
- Vincular rigidamente o campo à classe (bloquear divindade para não-clérigos) — deixar opcional para todos; um ladino devoto é válido.

---

## Modelo de dados proposto

Extensão do `identity` da [US-39](./US-39-identidade-narrativa-background-ideais.md) (mesmo campo JSON, mais uma chave) — não uma tabela nova:

```ts
interface CharacterIdentity {
  // ... campos da US-39 ...
  deity?: {
    name: string        // "Auril" — parte antes da primeira vírgula
    portfolio?: string  // "goddess of winter" — parte depois da primeira vírgula (trim)
  }
}
```

**Origem do dado (parsing no wizard):** o campo único **"Divindade/Patrono"** é texto livre; ao salvar, faz-se split na **primeira vírgula**:

- Antes da vírgula → `name` (trim).
- Depois da primeira vírgula → `portfolio` (trim). Vírgulas seguintes ficam dentro do `portfolio` (só a **primeira** separa).
- **Sem vírgula** → tudo vira `name`; `portfolio` fica `undefined`.
- Campo vazio → `deity` fica `undefined` (nenhum objeto).

Exemplos:

| Texto digitado | `name` | `portfolio` |
|---|---|---|
| `Auril, goddess of winter` | `Auril` | `goddess of winter` |
| `Solariel, o Senhor da Luz Eterna, justiça e cura` | `Solariel` | `o Senhor da Luz Eterna, justiça e cura` |
| `Tymora` | `Tymora` | `undefined` |

**Persistência:** chave `deity` dentro do JSON `identity` em `Character`. Renderizada pela mesma iteração da US-39 (ausente → some).

Render no prompt (dentro da seção de identidade):

```
- Divindade: Auril (goddess of winter).
```

Sem `portfolio` (só `name`), render sem parênteses: `- Divindade: Tymora.`

---

## Critérios de aceite

- [x] `Character.identity` aceita `deity` opcional (`name` + `portfolio`), preenchível na criação.
- [x] O campo único **"Divindade/Patrono"** do wizard é parseado por **split na primeira vírgula**: `name` = antes, `portfolio` = depois (trim); sem vírgula → só `name`; vazio → `deity` `undefined`. Ex.: `Auril, goddess of winter` gera `name: "Auril"`, `portfolio: "goddess of winter"`.
- [x] O prompt inclui a linha de divindade **só quando presente**; personagem sem divindade não gera linha nem crash.
- [x] O prompt instrui o mestre a usar a fé como cor narrativa (invocações, presságios, tom), coerente com ideais/fraquezas da US-39.
- [x] A divindade é renderizada pela **mesma iteração** da seção de identidade — não é um `if` novo dedicado no builder.
- [x] **Interface:** a **aba "Background"** da ficha ([GameView.tsx](../../../apps/web/src/components/game/GameView.tsx)) mostra a divindade (nome + portfólio) **quando presente**, read-only; personagem sem `deity` **não** gera bloco de divindade na aba (sem bloco fantasma nem crash).
- [x] **Eval / regressão (prompt):** personagem com `deity` produz um prompt contendo o nome da divindade na seção de identidade; personagem sem `deity` produz a seção sem linha de divindade (`evals/cases/us-40-*.ts`).
- [x] **Eval / regressão (interface):** renderizar `GameView` com `deity` e ver o nome da divindade na aba **Background**; sem `deity`, a aba não mostra bloco de divindade (`GameView.test.tsx` ou equivalente).

---

## Notas de implementação

- Reusar tudo da [US-39](./US-39-identidade-narrativa-background-ideais.md): mesmo campo `identity`, mesma seção do prompt, mesma iteração. Esta story só adiciona a chave `deity` e a instrução de uso.
- Ordem de entrega natural: US-39 primeiro (cria a seção e o mecanismo), US-40 depois (encaixa a chave). Podem ir juntas se convier, mas a US-39 é o alicerce.
- Não imprimir a ficha de divindade cruamente na narração — é cor, não recitação.

---

## Decisões

- **Texto livre (não catálogo).** `deity` é **texto livre** agora — YAGNI. Catálogo via `System.config` (consistência entre personagens do mesmo mundo) fica para quando houver um mundo compartilhado.
- **Opcional para todas as classes, sempre visível no wizard.** O campo aparece **para todo personagem** no wizard de criação, junto aos demais campos de background — não é sugerido/escondido por classe. Um ladino devoto é válido; um guerreiro ateu deixa em branco. Rótulo: **"Divindade/Patrono"** (o "Patrono" já acomoda bruxo/juramentos seculares sem nova story).

## Questões em aberto

1. **Fronteira com a mecânica de oath:** quando existir consequência de violar votos, ela lê a `deity` + `flaws` — mas isso é story futura; aqui a divindade é puramente narrativa.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — seção de identidade (criada na US-39) que ganha a linha de divindade.
- `apps/api/src/ai/ai.service.ts` — monta `identity` a partir do `Character`.
- `apps/web/src/components/game/GameView.tsx` — `BackgroundPanel` (aba "Background" da US-45) onde a divindade é renderizada para o jogador.
- `apps/api/prisma/schema.prisma` — `Character.identity` (JSON) onde mora `deity`.
- `docs/sdlc/referencia/aventura-seraphine.md` — Solariel como exemplo do papel narrativo da divindade.
- `docs/sdlc/01-requisitos/US-39-identidade-narrativa-background-ideais.md` — story-mãe da seção de identidade.
