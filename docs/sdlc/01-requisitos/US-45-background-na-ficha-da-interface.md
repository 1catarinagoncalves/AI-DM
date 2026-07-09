# US-45 — Background visível na ficha do personagem (interface)

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-39](./US-39-identidade-narrativa-background-ideais.md) (campo `Character.background` persistido — já entregue)
**Relacionado:** [US-23](./US-23-dm-ciente-da-ficha.md) (o mestre já conhece o background; esta US é sobre o JOGADOR o ver) · [US-19](./US-19-estado-de-ficha-via-api.md) (ficha servida pela API)
**Criada em:** 2026-07-09

---

## História

> **Como** jogador,
> **quero** ver o background do meu personagem (história, ideais, vínculos e fraquezas) na ficha, na interface,
> **para que** eu me lembre de quem ele é durante o jogo — não só o mestre.

---

## Contexto e motivação

### O problema observado

A [US-39](./US-39-identidade-narrativa-background-ideais.md) faz o personagem ter background e o **mestre** o conhece (injetado no prompt). Mas o **jogador** não o vê: a sidebar "Ficha do personagem" no [GameView.tsx:215](../../apps/web/src/components/game/GameView.tsx) mostra HP, condições, atributos, perícias e inventário — **nada de background**. O jogador preenche a história na criação e depois ela some da vista.

### Por que a solução atual não basta

O dado já existe e já é servido: `Character.background` é persistido (US-39) e o endpoint `findOne` já o devolve (é um scalar do `Character`, sem `select` que o exclua — [character.service.ts](../../apps/api/src/character/character.service.ts) `findOne`). Falta apenas **passar** o campo à `GameView` e **renderizar** uma seção na ficha. É render novo sobre dado existente, não dado novo.

### A proposta

Adicionar uma seção "Background" à ficha na sidebar da `GameView`, read-only, no mesmo estilo das seções Atributos/Perícias — mostrando história, ideais, vínculos e fraquezas quando presentes.

---

## Escopo

### Dentro do escopo

- Seção "Background" na ficha (sidebar da [GameView.tsx](../../apps/web/src/components/game/GameView.tsx)): história (prosa) + ideais + vínculos + fraquezas.
- Thread do campo `background` da API (`findOne`) → página de jogo (`app/play/[adventureId]/page.tsx`) → prop da `GameView`.
- Render **por iteração/condicional**: campo vazio não vira linha; background vazio (`{}`) não gera a seção (mesmo padrão de condições/perícias, que só aparecem quando há).
- Read-only, coerente com o resto da ficha.

### Fora do escopo

- **Editar** o background pela ficha — a captura é na criação (US-39). Um editor pós-criação é story própria (futura).
- Injeção no prompt do mestre — já é a [US-39](./US-39-identidade-narrativa-background-ideais.md).
- Divindade/features/magias na ficha — quando existirem ([US-40](./US-40-divindade-do-personagem.md)/[US-41](./US-41-features-traits-de-classe.md)/[US-42](./US-42-magias-conhecidas.md)), entram como seções análogas; não é escopo desta.

---

## Critérios de aceite

- [ ] A ficha na sidebar da `GameView` mostra uma seção **Background** com história, ideais, vínculos e fraquezas quando presentes.
- [ ] Cada eixo só aparece se preenchido; personagem com background vazio (`{}`) **não** gera a seção (sem bloco vazio).
- [ ] A seção é **read-only** (sem edição na ficha).
- [ ] O campo `background` é lido do que a API já devolve (`findOne`), sem novo endpoint.
- [ ] **Eval / regressão:** renderizar `GameView` com um `background` preenchido mostra a história e uma fraqueza; com `{}` não mostra a seção (`GameView.test.tsx` ou equivalente).

---

## Notas de implementação

- `GameView` recebe a ficha por props (`attributes`, `skills`, `conditions`, …) montadas na página de jogo. Adicionar `background?: { story?; ideals?; bonds?; flaws? }` às `Props` e uma seção no bloco da sidebar, ao lado de Perícias/Inventário.
- A página `app/play/[adventureId]/page.tsx` já carrega o personagem para montar as props — passar `character.background` adiante (o `findOne` já o traz).
- Render condicional como as outras seções (`conditions && conditions.length > 0 && …`): para o background, mostrar a seção só se algum campo tiver conteúdo; iterar os eixos com rótulos ("História", "Ideais", "Vínculos", "Fraquezas"), listas como itens.
- Reaproveitar o tipo `CharacterBackground` de `@ai-dm/ai-engine` para a prop, ou um tipo estrutural local — não redefinir a forma.
- Cuidar do dark mode e do estilo das seções existentes (mesmos utilitários Tailwind da sidebar).

---

## Questões em aberto

1. **Só no jogo ou também num "detalhe de personagem"?** Hoje a única ficha visível é a sidebar da `GameView` (em jogo). Se surgir uma tela de detalhe de personagem no hub (US-25), a mesma seção se aplica lá — mas por ora o alvo é a sidebar da `GameView`.
2. **Prosa longa na sidebar:** a `story` pode ser um parágrafo. Truncar com "ver mais", ou mostrar inteiro (a sidebar rola)? Sugestão: mostrar inteiro com `whitespace-pre-wrap`; só truncar se virar problema de layout.

---

## Referências no código

- `apps/web/src/components/game/GameView.tsx` — sidebar "Ficha do personagem" (`:215`), onde entra a seção Background e as `Props`.
- `apps/web/src/app/play/[adventureId]/page.tsx` — carrega o personagem e monta as props da `GameView`.
- `apps/api/src/character/character.service.ts` — `findOne` já devolve `Character.background`.
- `packages/ai-engine/src/prompts/dm-system.ts` — tipo `CharacterBackground` reaproveitável.
- `docs/sdlc/01-requisitos/US-39-identidade-narrativa-background-ideais.md` — origem do campo `background`.
