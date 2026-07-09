# US-44 — Defaults de background semeados por classe

**Épico:** 3 — Narração e mecânica
**Fase:** 2 — Memória / continuidade espacial (Fase B)
**Status:** 🗂️ Backlog
**Depende de:** [US-39](./US-39-identidade-narrativa-background-ideais.md) (campo `Character.background` + etapa "Background" no wizard — já entregues) · [US-26](./US-26-criacao-personagem-em-etapas.md) (fluxo de criação)
**Relacionado:** [US-28](./US-28-aventura-inicial-baseada-na-classe.md) (equipamento/gancho por classe — mesmo padrão `classKey`) · [US-21](./US-21-sistemas-como-dado.md) (`System.config` como dado)
**Criada em:** 2026-07-09

---

## História

> **Como** jogador,
> **quero** que a etapa de background já venha pré-preenchida com um texto coerente com a minha classe, que eu edito ou aceito,
> **para que** eu nunca encare um campo em branco e o mestre receba identidade mesmo quando eu não escrevo nada.

---

## Contexto e motivação

### O problema observado

A [US-39](./US-39-identidade-narrativa-background-ideais.md) entregou o campo `Character.background`, a etapa "Background" no wizard e a injeção no prompt — mas os campos **nascem em branco**. A decisão da [US-39 §2](./US-39-identidade-narrativa-background-ideais.md) era **"gerar defaults por classe que o jogador edita — nunca campo em branco"**, justamente para garantir que o mestre sempre receba identidade (sem isso, o jogador que pula a etapa deixa a produção — e a fixture do bake-off da [US-17](./US-17-comparacao-modelos-eval.md) — magra de novo).

### Por que a solução atual não basta

O `System.config` já semeia por classe o **equipamento inicial** (`startingKits`) e o **gancho de aventura** (`initialAdventures.hooks`), ambos por `classKey` com fallback `'default'` ([system.ts](../../packages/shared/src/types/system.ts)). Não há um equivalente para background: nem o schema tem o campo, nem o `seed.ts` tem os textos, nem o wizard pré-preenche. É dado novo, não render novo.

### A proposta

Adicionar `backgroundDefaults` por `classKey` ao `SystemConfig` (com `'default'` obrigatório, como `startingKits`), semear os textos por classe no `seed.ts`, e o wizard **pré-preencher** a etapa "Background" a partir da classe escolhida — o jogador edita ou aceita.

---

## Escopo

### Dentro do escopo

- Campo `backgroundDefaults` no `SystemConfigSchema`: `Record<classKey, {story?, ideals?, bonds?, flaws?}>`, com chave `'default'` obrigatória (fallback para classes desconhecidas/custom).
- Seed dos defaults por classe no `seed.ts` do sistema D&D 5e SRD (~12 classes) — texto curto e coerente por classe (paladino → código de honra; ladino → passado nas sombras; etc.).
- Wizard: ao entrar na etapa "Background", pré-preencher os campos a partir de `config.backgroundDefaults[classKey] ?? default`, **sem sobrescrever** o que o jogador já digitou. Campos continuam editáveis.

### Fora do escopo

- Persistência/normalização/injeção do background — já é a [US-39](./US-39-identidade-narrativa-background-ideais.md).
- Divindade/features/magias por classe — [US-40](./US-40-divindade-do-personagem.md)/[US-41](./US-41-features-traits-de-classe.md)/[US-42](./US-42-magias-conhecidas.md).
- Catálogo rico/versionado de backgrounds SRD (Acolyte, Noble…) como entidade própria — aqui é um texto default por classe, não o sistema de Backgrounds do 5e. Extensão futura.

---

## Modelo de dados proposto

Extensão do `SystemConfigSchema` (espelha `startingKits`):

```ts
backgroundDefaults: z.record(z.string(), z.object({
  story: z.string().optional(),
  ideals: z.array(z.string()).optional(),
  bonds: z.array(z.string()).optional(),
  flaws: z.array(z.string()).optional(),
})).refine(d => 'default' in d, { message: 'backgroundDefaults precisa de uma chave "default"' })
```

**Persistência:** vive no `System.config` (Json), semeado no `seed.ts`. Nenhuma coluna nova — o `Character.background` (US-39) continua sendo o que o jogador confirmou (default editado ou não).

Exemplo (seed, classe paladino):

```json
{
  "story": "Fez um juramento sagrado após uma tragédia e vaga protegendo os inocentes.",
  "ideals": ["Justiça acima de tudo"],
  "bonds": ["Protege quem não pode se proteger"],
  "flaws": ["Um código de honra rígido que raramente admite exceções"]
}
```

---

## Critérios de aceite

- [ ] `SystemConfigSchema` aceita `backgroundDefaults` por `classKey` com `'default'` obrigatório; config sem a chave `'default'` é rejeitada.
- [ ] O `seed.ts` do D&D 5e SRD tem defaults para as classes suportadas + `'default'`.
- [ ] Ao chegar na etapa "Background", os campos aparecem **pré-preenchidos** com o default da classe escolhida (ou `default` para classe sem entrada).
- [ ] Editar um campo pré-preenchido e voltar/avançar **não** perde a edição; o pré-preenchimento **não sobrescreve** texto já digitado pelo jogador.
- [ ] Um personagem criado **sem tocar** na etapa persiste o default da classe (não `{}`) — garante "nunca campo em branco".
- [ ] **Eval / regressão:** criar um paladino sem editar o background produz um `Character.background` com o `story`/`flaws` default da classe (teste do wizard + do service/seed).

---

## Notas de implementação

- Reaproveitar o padrão `classKey` + `'default'` do `startingKits`/`hooks` ([system.ts](../../packages/shared/src/types/system.ts), [seed.ts](../../apps/api/prisma/seed.ts)) — mesma resolução por classe com fallback.
- Wizard: pré-preencher no `useEffect`/ao entrar na etapa, guardando um flag "tocado" por campo para não sobrescrever edição. Alternativa mais simples: semear o estado `bg` quando a classe é escolhida (etapa Raça/Classe), já que o jogador ainda não digitou nada de background nesse ponto — evita a lógica de "tocado". Preferir esta se não houver como voltar e trocar a classe depois de editar o background.
- A normalização/persistência no backend não muda (US-39): ele recebe o texto final (default editado) como qualquer outro.
- Manter os textos default **curtos e genéricos** por classe — são ponto de partida, não biografia; o jogador especializa.

---

## Questões em aberto

1. **Quando semear no wizard:** ao escolher a classe (simples, mas re-trocar a classe teria de re-semear e poderia pisar em edição) ou ao entrar na etapa com flag de "tocado" (robusto, mais lógica)? Decidir no começo — depende de o wizard permitir voltar e trocar a classe.
2. **Ideais/vínculos por classe:** um de cada por classe basta como default, ou oferecer uma pequena lista para o jogador escolher? Sugestão: um de cada — YAGNI; o jogador adiciona os que quiser.
3. **Sistemas FREE / sem config:** sem `backgroundDefaults`, a etapa segue em branco (comportamento US-39). Confirmar que é aceitável (provavelmente sim — FREE é narração livre).

---

## Referências no código

- `packages/shared/src/types/system.ts` — `SystemConfigSchema` (onde entra `backgroundDefaults`, ao lado de `startingKits`).
- `apps/api/prisma/seed.ts` — seed do D&D 5e SRD (onde moram os textos por classe).
- `apps/web/src/components/setup/SetupWizard.tsx` — etapa "Background" que passa a pré-preencher.
- `docs/sdlc/01-requisitos/US-39-identidade-narrativa-background-ideais.md` — campo/etapa/injeção já entregues; esta US só semeia.
- `docs/sdlc/01-requisitos/US-28-aventura-inicial-baseada-na-classe.md` — padrão `classKey`/`default` reaproveitado.
